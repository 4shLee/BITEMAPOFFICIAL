// Supabase Edge Function for checking and sending scheduled reminders
// This should be triggered by a cron job (daily)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_KEY') ?? '', // Use service key for cron jobs
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Find all upcoming doses scheduled for tomorrow
    const { data: upcomingDoses, error: fetchError } = await supabaseClient
      .from('pep_schedule')
      .select(`
        *,
        incident:incidents(
          id,
          patient:patients(
            id,
            full_name,
            contact_number,
            email
          )
        )
      `)
      .eq('scheduled_date', tomorrowStr)
      .in('status', ['Pending', 'Upcoming']);

    if (fetchError) {
      throw fetchError;
    }

    const remindersSent: string[] = [];
    const remindersFailed: string[] = [];

    // Send reminders for each upcoming dose
    for (const dose of upcomingDoses || []) {
      const patient = dose.incident?.patient;
      if (!patient) continue;

      const message = `BITEMAP Reminder: ${patient.full_name}, your Day ${dose.dose_day} anti-rabies vaccination is scheduled for tomorrow (${dose.scheduled_date}). Please visit Digos City Health Office. Call +63 82 553 1234 for questions.`;

      try {
        // Send SMS if phone number exists
        if (patient.contact_number) {
          const smsResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-sms`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
            },
            body: JSON.stringify({
              phone: patient.contact_number,
              message: message,
              patientId: patient.id,
              incidentId: dose.incident.id
            })
          });

          if (smsResponse.ok) {
            remindersSent.push(`SMS to ${patient.full_name}`);
          } else {
            remindersFailed.push(`SMS to ${patient.full_name}: ${await smsResponse.text()}`);
          }
        }

        // Send Email if email exists
        if (patient.email) {
          const emailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
            },
            body: JSON.stringify({
              to: patient.email,
              subject: 'BITEMAP: Vaccination Reminder',
              message: message,
              patientId: patient.id,
              incidentId: dose.incident.id
            })
          });

          if (emailResponse.ok) {
            remindersSent.push(`Email to ${patient.full_name}`);
          } else {
            remindersFailed.push(`Email to ${patient.full_name}: ${await emailResponse.text()}`);
          }
        }

        // Update dose status to 'Upcoming'
        await supabaseClient
          .from('pep_schedule')
          .update({ status: 'Upcoming' })
          .eq('id', dose.id);

      } catch (error) {
        remindersFailed.push(`${patient.full_name}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${upcomingDoses?.length || 0} reminders`,
        sent: remindersSent,
        failed: remindersFailed
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
