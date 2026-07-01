# BITEMAP Backend Implementation Summary

## ✅ What Was Built

### 1. Complete Database Schema (`supabase/schema.sql`)

**Tables Created:**
- `profiles` - User accounts with roles (Admin, Health Officer, Nurse, BHW, Vet Staff)
- `barangays` - 8 Digos City barangays with population data
- `patients` - Patient demographics and contact information
- `incidents` - Animal bite incident records with WHO categories
- `pep_schedule` - Vaccination schedule (Day 0, 3, 7, 14, 28)
- `inventory` - Vaccine and supply stock levels
- `inventory_transactions` - Complete stock movement history
- `animals` - Dog/cat vaccination registry
- `notifications` - SMS/Email notification logs
- `audit_log` - Complete system activity tracking
- `settings` - System configuration

**Features:**
- ✅ Automatic PEP schedule generation on incident creation
- ✅ Auto inventory deduction on vaccine administration
- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Role-based access policies
- ✅ Automatic timestamp triggers
- ✅ Pre-populated default data (barangays, inventory items)

### 2. Supabase Edge Functions

**`send-sms` Function:**
- Sends SMS via Semaphore API (Philippines)
- Logs all notifications to database
- Tracks delivery status
- Cost: ~₱0.80 per SMS

**`send-email` Function:**
- Sends HTML emails via Resend API
- Professional BITEMAP branding
- Logs all notifications
- Free tier: 3,000 emails/month

**`check-reminders` Function:**
- Cron job (runs daily at 8 AM)
- Finds doses due tomorrow
- Automatically sends SMS + Email reminders
- Updates dose status to 'Upcoming'

### 3. Frontend Integration

**Authentication (`src/lib/services/auth.ts`):**
- `signIn()` - Email/password login
- `signOut()` - Logout
- `getCurrentUser()` - Get authenticated user
- `getCurrentProfile()` - Get user profile with role
- `createUser()` - Register new staff
- `hasRole()` - Check user permissions

**Database Operations (`src/lib/supabase/database.ts`):**
- **Patients:** getPatients, createPatient, updatePatient
- **Incidents:** getIncidents, createIncident, updateIncidentStatus
- **PEP Schedule:** getPEPScheduleByIncident, getUpcomingDoses, administerDose
- **Inventory:** getInventory, getLowStockItems, updateInventoryStock
- **Animals:** getAnimals, registerAnimal, updateAnimalVaccination
- **Notifications:** getNotifications, createNotification
- **Statistics:** getStatistics (aggregated data for dashboard)

**Notification Services (`src/lib/services/notifications.ts`):**
- `sendSMS()` - Send individual SMS
- `sendEmail()` - Send individual email
- `sendDoseReminder()` - Send both SMS + Email for dose reminder
- `sendLowStockAlert()` - Alert staff of low inventory

**React Context (`src/app/context/AuthContext.tsx`):**
- Provides authentication state globally
- Auto-loads user profile with role
- Listens for auth state changes
- Used via `useAuth()` hook

### 4. Configuration Files

**`.env.example`:**
- Template for all required environment variables
- Supabase credentials
- SMS provider (Semaphore) setup
- Email provider (Resend/SMTP) setup

**`SUPABASE_SETUP.md`:**
- Complete step-by-step setup guide
- SMS provider registration (Semaphore)
- Email provider configuration
- Cron job setup for reminders
- Cost estimates (₱2,000/month for 500 patients)
- Troubleshooting guide

**`README.md`:**
- Project overview and features
- Installation instructions
- Tech stack documentation
- Security disclaimers

## 🔌 How SMS Works

### Setup Process:
1. Sign up at [semaphore.co](https://semaphore.co)
2. Buy SMS credits (₱100 minimum)
3. Get API key from dashboard
4. Add to Supabase secrets:
   ```bash
   supabase secrets set SMS_API_KEY=your-key
   ```

### Sending SMS:
```typescript
import { sendSMS } from '@/lib/services/notifications';

await sendSMS({
  phone: '+639123456789',
  message: 'Your Day 3 dose is due tomorrow',
  patientId: 'uuid',
  incidentId: 'uuid'
});
```

### Automatic Reminders:
- Cron job runs daily at 8 AM
- Checks for doses due tomorrow
- Sends SMS + Email automatically
- Logs all sends to `notifications` table

## 🔑 How to Connect Everything

### Step 1: Create Supabase Project
```bash
# Go to supabase.com, create project
# Note: Project URL and anon key
```

### Step 2: Run Database Schema
```sql
-- Copy all of supabase/schema.sql
-- Paste in Supabase SQL Editor
-- Click Run
```

### Step 3: Deploy Edge Functions
```bash
supabase login
supabase link --project-ref your-ref
supabase functions deploy send-sms
supabase functions deploy send-email
supabase functions deploy check-reminders
```

### Step 4: Set Secrets
```bash
supabase secrets set SMS_API_KEY=your-semaphore-key
supabase secrets set RESEND_API_KEY=your-resend-key
```

### Step 5: Configure Frontend
```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

### Step 6: Create Admin User
```sql
-- In Supabase SQL Editor
INSERT INTO auth.users (email, encrypted_password, ...)
-- Then add profile
INSERT INTO profiles (id, email, full_name, role, ...)
```

## 📊 Data Flow Examples

### Creating a New Patient + Incident:

1. **Nurse fills incident form** → Frontend
2. **createPatient()** → Supabase `patients` table
3. **createIncident()** → Supabase `incidents` table
4. **Database trigger fires** → Auto-creates 5 PEP schedule entries
5. **Frontend receives incident** → Shows confirmation
6. **Navigate to patient detail** → Shows PEP timeline

### Administering a Vaccine Dose:

1. **Nurse clicks "Administer Dose"** → Frontend
2. **administerDose()** → Updates `pep_schedule` status to 'Done'
3. **Database trigger fires** → Reduces `inventory` by 1
4. **Transaction logged** → `inventory_transactions` entry
5. **Frontend reloads** → Shows updated timeline
6. **If low stock** → Alert banner appears

### Daily Reminder Process:

1. **8:00 AM Philippine Time** → Cron triggers `check-reminders`
2. **Edge function queries** → Finds doses due tomorrow
3. **For each patient:**
   - Calls `send-sms` edge function
   - Calls `send-email` edge function
   - Logs to `notifications` table
   - Updates dose status to 'Upcoming'
4. **Returns summary** → X reminders sent, Y failed

## 🔒 Security Implementation

### Row Level Security (RLS):
- ✅ All tables have RLS enabled
- ✅ Policies restrict access by role
- ✅ Nurses can't delete records
- ✅ BHWs have limited access
- ✅ Admins have full access

### Authentication:
- ✅ Supabase Auth with email/password
- ✅ Profile linked to auth user
- ✅ Role checked on every request
- ✅ JWT tokens for API calls

### API Keys:
- ✅ All secrets in environment variables
- ✅ Never committed to git
- ✅ Edge functions use Supabase secrets
- ✅ Frontend uses public anon key (safe)

## 💰 Cost Breakdown

**Monthly for 500 patients:**

| Service | Usage | Cost |
|---------|-------|------|
| Supabase Free Tier | 500MB DB, 2GB bandwidth | ₱0 |
| SMS (Semaphore) | 2,500 messages × ₱0.80 | ₱2,000 |
| Email (Resend) | 2,500 emails (free tier) | ₱0 |
| **TOTAL** | | **₱2,000/month** |

**Scaling to 2,000 patients:**
- SMS: ₱8,000/month (10,000 messages)
- Email: ₱0 (still within free tier)
- Supabase: May need Pro ($25/month)
- **Total: ~₱9,500/month**

## 🚀 Next Steps to Go Live

1. ✅ Complete Supabase setup (30 min)
2. ✅ Deploy edge functions (10 min)
3. ✅ Configure SMS provider (15 min)
4. ✅ Test SMS sending (5 min)
5. ✅ Create admin user (5 min)
6. ✅ Set up cron job (5 min)
7. ✅ Train staff (2 hours)
8. ✅ Import existing patient data (if any)
9. ✅ Go live! 🎉

## ⚠️ Important Notes

**This is a PROTOTYPE for demonstration:**
- Not HIPAA compliant
- Not certified for production healthcare
- Requires additional security for real PHI
- Needs legal/compliance review for production

**For Production Deployment:**
- Consult healthcare compliance experts
- Implement additional encryption
- Regular security audits
- Proper backup strategy
- Disaster recovery plan
- Staff training program
- Data privacy compliance (RA 10173)

## 📞 Support Contacts

- **Supabase Issues:** support@supabase.com
- **Semaphore SMS:** support@semaphore.co
- **Resend Email:** support@resend.com
- **Technical:** File issue in repository

---

**Ready to deploy?** Follow `SUPABASE_SETUP.md` step by step!
