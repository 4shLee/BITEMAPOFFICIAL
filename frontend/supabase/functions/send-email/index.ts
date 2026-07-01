// Supabase Edge Function for sending email notifications

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string;
  subject: string;
  message: string;
  patientId?: string;
  incidentId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { to, subject, message, patientId, incidentId }: EmailRequest = await req.json();

    // Get SMTP credentials from environment
    const SMTP_HOST = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com';
    const SMTP_PORT = Deno.env.get('SMTP_PORT') || '587';
    const SMTP_USER = Deno.env.get('SMTP_USER');
    const SMTP_PASS = Deno.env.get('SMTP_PASS');
    const SMTP_FROM = Deno.env.get('SMTP_FROM') || 'noreply@digos.gov.ph';

    if (!SMTP_USER || !SMTP_PASS) {
      throw new Error('SMTP credentials not configured');
    }

    // For production, use a proper email service like SendGrid, AWS SES, or Resend
    // This is a simple example using fetch to an email API

    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #2C2C2A; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1D9E75; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #ffffff; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #888780; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>BITEMAP</h1>
              <p>Animal Bite Tracking - Digos City</p>
            </div>
            <div class="content">
              ${message.replace(/\n/g, '<br>')}
            </div>
            <div class="footer">
              <p>Digos City Health Office - Cor Jesu College</p>
              <p>Department of Health - Philippines</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Using Resend API as an example (you can replace with your preferred service)
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    let emailSent = false;
    let emailResult: any = {};

    if (RESEND_API_KEY) {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: SMTP_FROM,
          to: [to],
          subject: subject,
          html: emailHTML
        })
      });

      emailResult = await emailResponse.json();
      emailSent = emailResponse.ok;
    }

    // Log notification in database
    const { error: notificationError } = await supabaseClient
      .from('notifications')
      .insert([{
        patient_id: patientId,
        incident_id: incidentId,
        notification_type: 'Email',
        recipient: to,
        message: message,
        status: emailSent ? 'Sent' : 'Failed',
        sent_at: new Date().toISOString(),
        delivery_status: JSON.stringify(emailResult)
      }]);

    if (notificationError) {
      console.error('Failed to log notification:', notificationError);
    }

    return new Response(
      JSON.stringify({
        success: emailSent,
        data: emailResult,
        message: emailSent ? 'Email sent successfully' : 'Failed to send email'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: emailSent ? 200 : 500
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
