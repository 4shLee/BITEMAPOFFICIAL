# 🚀 BITEMAP Quick Start Guide

## What You Have Now

✅ **Complete Frontend Application** (14 screens)
- Login with authentication
- Dashboard with statistics
- Patient & incident management
- PEP vaccination schedules
- Inventory tracking
- GIS heatmaps
- Public portal
- And more!

✅ **Full Backend Infrastructure**
- PostgreSQL database with Supabase
- User authentication & roles
- SMS sending via Semaphore
- Email notifications
- Automated daily reminders
- Complete audit logging

## 🎯 Choose Your Path

### Path A: Test Locally (No Backend) - 2 Minutes

Just want to see the UI?

```bash
pnpm install
pnpm dev
```

Visit `http://localhost:5173`
- Login with ANY email/password
- Browse all screens
- **Note:** No data will be saved, SMS won't work

### Path B: Full Setup with Backend - 30 Minutes

Want SMS, database, and real functionality?

#### 1. Create Supabase Account (5 min)
1. Go to [supabase.com](https://supabase.com)
2. Sign up (free)
3. Create new project named "BITEMAP"
4. **SAVE the database password!**

#### 2. Setup Database (5 min)
1. In Supabase, go to **SQL Editor**
2. Open `supabase/schema.sql` from this project
3. Copy ALL content
4. Paste in SQL Editor
5. Click **Run**
6. Should see "Success. No rows returned"

#### 3. Get Credentials (2 min)
1. In Supabase, go to **Settings** → **API**
2. Copy:
   - Project URL
   - anon public key
3. Create `.env.local` in project root:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

#### 4. Create Admin User (3 min)
1. In Supabase, go to **Authentication** → **Users**
2. Click **Add User**
3. Email: `admin@digos.gov.ph`
4. Password: (create one)
5. ✓ Auto Confirm User
6. Click **Create**

7. Get the user ID (copy it)
8. Go to **SQL Editor**, run:
```sql
INSERT INTO profiles (id, email, full_name, role, is_active)
VALUES (
  'paste-user-id-here',
  'admin@digos.gov.ph',
  'System Administrator',
  'Admin',
  true
);
```

#### 5. Run Application (1 min)
```bash
pnpm install
pnpm dev
```

Visit `http://localhost:5173`
Login with admin@digos.gov.ph + your password

**✨ You now have:**
- Real authentication
- Database storage
- All CRUD operations working

#### 6. Optional: Add SMS (15 min)

**For SMS functionality:**

1. Sign up at [semaphore.co](https://semaphore.co)
2. Buy credits (₱100 minimum)
3. Get API key

4. Install Supabase CLI:
```bash
npm install -g supabase
supabase login
```

5. Link project:
```bash
supabase link --project-ref your-project-ref
```

6. Deploy SMS function:
```bash
supabase functions deploy send-sms
```

7. Set secret:
```bash
supabase secrets set SMS_API_KEY=your-semaphore-key
```

8. Test SMS from the app!

**Full SMS setup guide:** See `SUPABASE_SETUP.md`

## 📁 Key Files

| File | Purpose |
|------|---------|
| `README.md` | Complete project documentation |
| `SUPABASE_SETUP.md` | Detailed backend setup (SMS, email, cron) |
| `BACKEND_SUMMARY.md` | Backend architecture explained |
| `supabase/schema.sql` | Database schema (run this in Supabase) |
| `.env.example` | Environment variables template |

## 🎨 Screens Available

### Public Access (No Login)
- `/public` - Public portal home
- `/public/heatmap` - Incident heatmap
- `/public/statistics` - Charts and stats
- `/public/clinics` - Clinic finder

### Staff Access (Login Required)
- `/dashboard` - Main dashboard
- `/incidents` - Report new incidents
- `/patients` - Patient registry
- `/pep-schedule` - Vaccination schedules
- `/inventory` - Vaccine stock
- `/gis-map` - Staff GIS tools
- `/animal-registry` - Animal vaccinations
- `/reports` - Generate reports
- `/notifications` - SMS/Email logs
- `/users` - User management (Admin only)
- `/audit-log` - Activity log (Admin only)
- `/settings` - System settings

## 🔐 Default Credentials

After creating admin user:
- **Email:** admin@digos.gov.ph
- **Password:** (the one you set)

## 💡 Quick Tips

**Testing without SMS?**
- The app works fully without SMS
- Notifications just won't actually send
- Everything else functions normally

**Want to add more users?**
- Use the **Users** page in the app
- Or add manually via Supabase Auth panel

**Need sample data?**
- The schema includes 8 barangays
- 6 inventory items pre-loaded
- Create test patients via the app

**Customization?**
- Colors: Edit `src/styles/theme.css`
- Logo: Replace in `src/app/pages/Login.tsx`
- Text: Search and replace "Digos City"

## 🐛 Common Issues

**"Connection refused"**
- Check `.env.local` exists
- Verify Supabase URL and key are correct

**"Login failed"**
- Make sure you created the profile in SQL
- Password must match what you set in Auth

**"Table does not exist"**
- Run `supabase/schema.sql` in Supabase SQL Editor
- Check for errors in output

## 📞 Get Help

- **Setup Issues:** See `SUPABASE_SETUP.md`
- **SMS Problems:** See `BACKEND_SUMMARY.md`
- **Code Questions:** Check `README.md`

## ⏱️ Time Estimates

| Task | Time |
|------|------|
| View UI only | 2 min |
| Basic backend setup | 15 min |
| Full setup with SMS | 30 min |
| Staff training | 2 hours |
| Import existing data | Varies |

## 🎉 Next Steps

1. ✅ Get the app running
2. ✅ Create a few test patients
3. ✅ Try creating an incident
4. ✅ Test the PEP schedule
5. ✅ Explore all features
6. ✅ Add real data
7. ✅ Train your team
8. ✅ Go live!

---

**Questions?** Check the other documentation files or file an issue!

**Ready for production?** Review security requirements in `README.md`
