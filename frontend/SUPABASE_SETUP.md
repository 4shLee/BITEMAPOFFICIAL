# BITEMAP - Supabase Backend Setup Guide

## 🚀 Quick Start

### Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name**: BITEMAP
   - **Database Password**: (save this!)
   - **Region**: Singapore (closest to Philippines)
5. Wait for project to be created (~2 minutes)

### Step 2: Run Database Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `supabase/schema.sql`
4. Paste into the SQL editor
5. Click "Run" or press `Ctrl+Enter`
6. Verify success (you should see "Success. No rows returned")

### Step 3: Get API Credentials

1. In Supabase Dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key

3. Create `.env.local` file in project root:
```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Step 4: Deploy Edge Functions

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link your project:
```bash
supabase link --project-ref your-project-ref
```

4. Deploy functions:
```bash
supabase functions deploy send-sms
supabase functions deploy send-email
supabase functions deploy check-reminders
```

5. Set secrets for edge functions:
```bash
# SMS Provider (Semaphore - Philippines)
supabase secrets set SMS_API_KEY=your-semaphore-api-key
supabase secrets set SMS_SENDER_NAME=BITEMAP

# Email Provider (Resend)
supabase secrets set RESEND_API_KEY=your-resend-api-key
supabase secrets set SMTP_FROM=noreply@digos.gov.ph
```

### Step 5: Set Up SMS Provider (Semaphore - Philippines)

1. Go to [https://semaphore.co](https://semaphore.co)
2. Sign up for an account
3. Buy SMS credits (starting from ₱100)
4. Go to **API** section in dashboard
5. Copy your **API Key**
6. Add to Supabase secrets:
```bash
supabase secrets set SMS_API_KEY=your-key-here
```

**Semaphore Pricing (Philippines):**
- ₱0.80 per SMS to Philippine mobile numbers
- No monthly fees
- Pay as you go

**Alternative SMS Providers:**
- **Twilio** - Global, more expensive
- **Vonage/Nexmo** - Global coverage
- **Movider** - Philippines-based

### Step 6: Set Up Email Provider (Optional)

**Option A: Resend (Recommended)**
1. Go to [https://resend.com](https://resend.com)
2. Sign up (free tier: 3,000 emails/month)
3. Add and verify your domain
4. Get API key from dashboard
5. Add to Supabase:
```bash
supabase secrets set RESEND_API_KEY=your-key
```

**Option B: SMTP (Gmail, etc.)**
```bash
supabase secrets set SMTP_HOST=smtp.gmail.com
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USER=your-email@gmail.com
supabase secrets set SMTP_PASS=your-app-password
```

### Step 7: Set Up Cron Jobs (Automated Reminders)

1. In Supabase Dashboard, go to **Database** → **Cron Jobs**
2. Click "New Cron Job"
3. Configure:
   - **Name**: Daily Reminder Check
   - **Schedule**: `0 8 * * *` (every day at 8 AM Philippine time)
   - **Function**: 
   ```sql
   SELECT net.http_post(
     url:='https://your-project-ref.supabase.co/functions/v1/check-reminders',
     headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
   ) as request_id;
   ```

### Step 8: Create Admin User

1. In Supabase Dashboard, go to **Authentication** → **Users**
2. Click "Add User"
3. Fill in:
   - **Email**: admin@digos.gov.ph
   - **Password**: (create secure password)
   - **Auto Confirm User**: ✓ (checked)
4. Click "Create User"

5. Go to **SQL Editor** and run:
```sql
-- Get the user ID first
SELECT id FROM auth.users WHERE email = 'admin@digos.gov.ph';

-- Insert profile (replace USER_ID with the ID from above)
INSERT INTO profiles (id, email, full_name, role, phone, is_active)
VALUES (
  'USER_ID',
  'admin@digos.gov.ph',
  'System Administrator',
  'Admin',
  '+63 82 553 1234',
  true
);
```

## 🔒 Security Setup

### Row Level Security (RLS)

RLS is already enabled in the schema. Verify policies:

1. Go to **Authentication** → **Policies**
2. Check that all tables have policies enabled
3. Review policies match your access requirements

### API Keys

- **anon key**: Safe to use in frontend (public)
- **service_role key**: NEVER expose to frontend (admin only)

## 📊 Testing the Backend

### Test SMS Sending

```typescript
import { sendSMS } from '@/lib/services/notifications';

await sendSMS({
  phone: '+639123456789',
  message: 'Test message from BITEMAP',
  patientId: 'some-uuid',
  incidentId: 'some-uuid'
});
```

### Test Database Connection

```typescript
import { supabase } from '@/lib/supabase/client';

const { data, error } = await supabase
  .from('barangays')
  .select('*');

console.log('Barangays:', data);
```

### Test Authentication

```typescript
import { signIn } from '@/lib/services/auth';

const result = await signIn(
  'admin@digos.gov.ph',
  'your-password'
);

console.log('Logged in:', result);
```

## 🔧 Troubleshooting

### "Failed to connect to Supabase"
- Check `.env.local` has correct URL and key
- Verify project is not paused (free tier pauses after 1 week inactivity)
- Check internet connection

### "SMS not sending"
- Verify SMS_API_KEY is set correctly
- Check Semaphore account has credits
- Verify phone number format (+63XXXXXXXXXX)
- Check Supabase function logs

### "Email not sending"
- Verify email provider credentials
- Check domain is verified (for Resend)
- Review Supabase function logs
- Test with a different email address

### "Permission denied"
- Check RLS policies are correct
- Verify user is authenticated
- Ensure user has correct role in `profiles` table

## 📱 SMS Format for Philippines

**Correct format:** `+639123456789`
- Start with `+63`
- Remove leading `0` from mobile number
- Total: 13 characters

**Common mistakes:**
- ❌ `09123456789` (missing country code)
- ❌ `63917234567` (missing +)
- ❌ `+630917234567` (has extra 0)

## 💰 Cost Estimates (Monthly)

**For ~500 patients:**

**SMS (Semaphore):**
- 500 patients × 5 doses = 2,500 SMS
- 2,500 × ₱0.80 = **₱2,000/month**

**Email (Resend):**
- Free tier: 3,000 emails/month
- **₱0/month** (within free tier)

**Supabase:**
- Free tier: 500MB database, 2GB bandwidth
- **₱0/month** (for typical usage)

**Total: ~₱2,000/month** (mainly SMS costs)

## 🚨 Production Checklist

Before going live:

- [ ] Database schema deployed
- [ ] Admin user created
- [ ] SMS provider configured and tested
- [ ] Email provider configured and tested
- [ ] Cron jobs set up for reminders
- [ ] RLS policies verified
- [ ] Backup strategy in place
- [ ] Monitoring/alerts configured
- [ ] Staff trained on system usage
- [ ] Data privacy compliance verified
- [ ] Disaster recovery plan documented

## 📞 Support

**Supabase:** [https://supabase.com/docs](https://supabase.com/docs)
**Semaphore:** support@semaphore.co
**Technical Issues:** File an issue in the project repository

---

**⚠️ IMPORTANT SECURITY NOTES:**

1. Never commit `.env.local` or API keys to git
2. Use environment variables for all secrets
3. Regularly rotate API keys
4. Monitor usage and costs
5. Enable MFA on all admin accounts
6. Regularly backup your database
7. This is a prototype - consult security experts for production deployment with real patient data
