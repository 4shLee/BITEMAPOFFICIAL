// Supabase Edge Function for sending SMS notifications
// Deploy this function to Supabase after connecting

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMSRequest {
  phone: string;
  message: string;
  patientId?: string;
  incidentId?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { phone, message, patientId, incidentId }: SMSRequest = await req.json();

    // Get SMS API credentials from environment
    const SMS_API_KEY = Deno.env.get('SMS_API_KEY');
    const SMS_API_URL = Deno.env.get('SMS_API_URL') || 'https://api.semaphore.co/api/v4/messages';
    const SMS_SENDER_NAME = Deno.env.get('SMS_SENDER_NAME') || 'BITEMAP';

    if (!SMS_API_KEY) {
      throw new Error('SMS_API_KEY not configured');
    }

    // Send SMS via Semaphore API (Philippines)
    const smsResponse = await fetch(SMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apikey: SMS_API_KEY,
        number: phone,
        message: message,
        sendername: SMS_SENDER_NAME
      })
    });

    const smsResult = await smsResponse.json();

    // Log notification in database
    const { error: notificationError } = await supabaseClient
      .from('notifications')
      .insert([{
        patient_id: patientId,
        incident_id: incidentId,
        notification_type: 'SMS',
        recipient: phone,
        message: message,
        status: smsResponse.ok ? 'Sent' : 'Failed',
        sent_at: new Date().toISOString(),
        delivery_status: JSON.stringify(smsResult)
      }]);

    if (notificationError) {
      console.error('Failed to log notification:', notificationError);
    }

    return new Response(
      JSON.stringify({
        success: smsResponse.ok,
        data: smsResult,
        message: smsResponse.ok ? 'SMS sent successfully' : 'Failed to send SMS'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: smsResponse.ok ? 200 : 500
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
