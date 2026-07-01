// @ts-ignore
import { projectId, publicAnonKey } from '/utils/supabase/info';

export interface SendSMSParams {
  phone: string;
  message: string;
  patientId?: string;
  incidentId?: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  message: string;
  patientId?: string;
  incidentId?: string;
}

const serverUrl = `https://${projectId}.supabase.co/functions/v1/make-server-e1d15c13`;

export async function sendSMS(params: SendSMSParams) {
  try {
    const response = await fetch(`${serverUrl}/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify(params)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send SMS');
    }

    return data;
  } catch (error) {
    console.error('Failed to send SMS:', error);
    throw error;
  }
}

export async function sendEmail(params: SendEmailParams) {
  try {
    const response = await fetch(`${serverUrl}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify(params)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send email');
    }

    return data;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

export async function sendDoseReminder(
  patientName: string,
  patientPhone: string,
  patientEmail: string | null,
  doseDay: number,
  scheduledDate: string,
  patientId: string,
  incidentId: string
) {
  const message = `BITEMAP Reminder: ${patientName}, your Day ${doseDay} anti-rabies vaccination is scheduled for ${scheduledDate}. Please visit Digos City Health Office. Call +63 82 553 1234 for questions.`;

  const results = {
    sms: null as any,
    email: null as any
  };

  // Send SMS
  if (patientPhone) {
    try {
      results.sms = await sendSMS({
        phone: patientPhone,
        message,
        patientId,
        incidentId
      });
    } catch (error) {
      console.error('SMS sending failed:', error);
    }
  }

  // Send Email
  if (patientEmail) {
    try {
      results.email = await sendEmail({
        to: patientEmail,
        subject: 'BITEMAP: Vaccination Reminder',
        message,
        patientId,
        incidentId
      });
    } catch (error) {
      console.error('Email sending failed:', error);
    }
  }

  return results;
}

export async function sendLowStockAlert(itemName: string, currentStock: number, recipients: string[]) {
  const message = `BITEMAP Alert: Low stock warning for ${itemName}. Current stock: ${currentStock} units. Please reorder immediately.`;

  for (const recipient of recipients) {
    if (recipient.includes('@')) {
      // Email
      await sendEmail({
        to: recipient,
        subject: 'BITEMAP: Low Stock Alert',
        message
      });
    } else {
      // SMS
      await sendSMS({
        phone: recipient,
        message
      });
    }
  }
}
