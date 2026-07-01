# ✅ Supabase Connected! Next Steps

Your Supabase project is now connected to BITEMAP. Here's what you need to do to get everything working:

## 🎯 Step 1: Run Database Schema (5 minutes)

The most important step - create all the database tables:

1. Open your Supabase dashboard: https://supabase.com/dashboard/project/pcuckfzkltztueqvmjme

2. Click **SQL Editor** in the left sidebar

3. Click **New Query**

4. Open the file `supabase/schema.sql` from this project

5. Copy **ALL** the contents (it's long - about 500 lines)

6. Paste into the SQL Editor

7. Click **Run** (or press Ctrl+Enter)

8. You should see: **"Success. No rows returned"**

This creates:
- ✅ 10 database tables (patients, incidents, inventory, etc.)
- ✅ 8 Digos City barangays with population data
- ✅ 6 pre-loaded inventory items
- ✅ Automatic triggers for PEP schedules
- ✅ Row-level security policies
- ✅ All relationships and constraints

## 🎯 Step 2: Create Admin User (3 minutes)

1. In Supabase dashboard, go to **Authentication** → **Users**

2. Click **Add User** (green button)

3. Fill in:
   - **Email**: `admin@digos.gov.ph`
   - **Password**: Create a secure password (save it!)
   - **Auto Confirm User**: ✓ (check this box)

4. Click **Create User**

5. Copy the **user ID** that appears (starts with a UUID like `abc123...`)

6. Go back to **SQL Editor**, click **New Query**

7. Paste this (replace `USER_ID_HERE` with the ID you copied):

```sql
INSERT INTO profiles (id, email, full_name, role, phone, is_active)
VALUES (
  'USER_ID_HERE',
  'admin@digos.gov.ph',
  'System Administrator',
  'Admin',
  '+63 82 553 1234',
  true
);
```

8. Click **Run**

9. You should see: **"Success. 1 row affected"**

## 🎯 Step 3: Test the Application (2 minutes)

The app should already be running. If not:

```bash
pnpm install
pnpm dev
```

Visit: http://localhost:5173

**Login with:**
- Email: `admin@digos.gov.ph`
- Password: (the one you created)

You should now be able to:
- ✅ Login successfully
- ✅ See the dashboard
- ✅ Create patients
- ✅ Register incidents
- ✅ Track vaccinations
- ✅ View inventory
- ✅ Access all features

## 🎯 Step 4 (Optional): Enable SMS Sending (15 minutes)

Want to send real SMS notifications?

### A. Sign up for Semaphore (Philippines SMS provider)

1. Go to: https://semaphore.co
2. Create account
3. Buy credits (minimum ₱100 = ~125 SMS messages at ₱0.80 each)
4. Go to **API** section
5. Copy your **API Key**

### B. Add API Key to Supabase

1. In your terminal, run:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref pcuckfzkltztueqvmjme

# Set the SMS API key
supabase secrets set SMS_API_KEY=your-semaphore-api-key-here
```

2. Deploy the server function:

```bash
supabase functions deploy server
```

### C. Test SMS

In the app, go to **Notifications** page and try sending a test SMS!

**Alternative SMS Providers:**
- **Twilio** - Global, more expensive
- **Vonage** - Global
- **Movider** - Philippines-based

## 🎯 Step 5 (Optional): Enable Email (10 minutes)

### A. Sign up for Resend (Free tier: 3,000 emails/month)

1. Go to: https://resend.com
2. Create account (free)
3. Add your domain (or use their testing domain)
4. Get API key

### B. Add to Supabase

```bash
supabase secrets set RESEND_API_KEY=your-resend-api-key
supabase secrets set SMTP_FROM=noreply@digos.gov.ph
```

### C. Test Email

Send a test email from the Notifications page!

## ✅ What Works Right Now (Without SMS/Email)

Even without SMS configured, you can:

- ✅ Full authentication system
- ✅ Patient registration
- ✅ Incident reporting
- ✅ PEP schedule tracking
- ✅ Vaccine inventory management
- ✅ GIS heatmaps
- ✅ Statistics dashboard
- ✅ User management
- ✅ Audit logging
- ✅ Public portal
- ✅ All CRUD operations

The app is **fully functional** - SMS/Email just won't actually send (but will be logged in the notifications table).

## 🔍 Verify Everything is Working

### Check Database Tables

1. Go to Supabase dashboard
2. Click **Table Editor**
3. You should see these tables:
   - profiles
   - patients
   - incidents
   - pep_schedule
   - inventory
   - barangays
   - animals
   - notifications
   - audit_log
   - settings

### Check Barangays Data

1. In Table Editor, click **barangays**
2. You should see 8 rows:
   - Aplaya (population: 12,500)
   - San Jose (10,200)
   - Dawis (8,900)
   - Zone 1 (5,600)
   - Zone 2 (4,800)
   - Mahayahay (9,300)
   - Balabag (6,200)
   - Tiguman (7,100)

### Check Inventory

1. Click **inventory** table
2. You should see 6 items:
   - Anti-rabies Vaccine (45 vials)
   - eRIG (120 vials)
   - hRIG (8 vials)
   - Tetanus Toxoid (85 vials)
   - ATS (22 vials)
   - Wound Care Kit (156 sets)

## 🚨 Troubleshooting

**Can't login?**
- Make sure you ran the profile INSERT query
- Check the user ID matches
- Try resetting password in Supabase Auth

**Tables don't exist?**
- Run `supabase/schema.sql` in SQL Editor
- Check for errors in the output
- Make sure you copied the ENTIRE file

**App shows errors?**
- Check browser console (F12)
- Verify Supabase is connected
- Try refreshing the page

**Need help?**
- Check `SUPABASE_SETUP.md` for detailed troubleshooting
- Review `BACKEND_SUMMARY.md` for how things work

## 📊 Current Configuration

**Supabase Project:**
- Project ID: `pcuckfzkltztueqvmjme`
- URL: `https://pcuckfzkltztueqvmjme.supabase.co`
- Region: (check your dashboard)

**Backend Endpoints:**
- Health: `https://pcuckfzkltztueqvmjme.supabase.co/functions/v1/make-server-e1d15c13/health`
- SMS: `https://pcuckfzkltztueqvmjme.supabase.co/functions/v1/make-server-e1d15c13/send-sms`
- Email: `https://pcuckfzkltztueqvmjme.supabase.co/functions/v1/make-server-e1d15c13/send-email`

## 🎉 You're Almost There!

Just complete Steps 1 & 2 above and you'll have a fully working system!

**Total Time: ~10 minutes**

---

**Questions?** See the other documentation files or the error console.
