# BITEMAP Backend Setup Guide

## Overview

Your BITEMAP application now has a fully functional backend powered by Supabase. The backend handles authentication, data storage, and all CRUD operations for the 14 screens in your application.

## What's Been Implemented

### ✅ Backend Features

1. **Authentication System**
   - User signup with email/password
   - User signin with JWT tokens
   - Session management
   - Role-based access control (Admin, Health Officer, Nurse, BHW, Vet Staff)
   - Automatic audit logging for all auth actions

2. **API Endpoints** (All Protected with Authentication)
   - **Dashboard** - Real-time statistics and recent incidents
   - **Incidents** - Full CRUD operations
   - **Patients** - Full CRUD operations
   - **PEP Schedule** - View and update vaccination schedules
   - **Inventory** - Stock management with transaction logging
   - **Animals** - Animal registration and vaccination tracking
   - **Users** - User management (Admin only)
   - **Audit Logs** - System activity tracking (Admin/Health Officer only)
   - **Settings** - System configuration management
   - **Notifications** - View notification history
   - **Barangays** - Get list of barangays

3. **Public API Endpoints** (No Authentication Required)
   - Public statistics for the public portal
   - Heatmap data for incident visualization
   - Barangay statistics

4. **Notification Services**
   - SMS notifications (via Semaphore API)
   - Email notifications (via Resend API)

### ✅ Frontend Integration

1. **API Service Layer** (`/src/lib/services/api.ts`)
   - Centralized API client with automatic token management
   - Error handling with automatic logout on 401
   - Separate APIs for each feature module

2. **Updated Components**
   - Login page with real authentication
   - Dashboard with live data from backend
   - Sidebar with user profile and logout
   - All pages ready to connect to backend APIs

## Database Schema

The database includes these tables:
- `profiles` - User accounts extending Supabase Auth
- `barangays` - Digos City barangays
- `patients` - Patient records
- `incidents` - Animal bite incidents
- `pep_schedule` - PEP vaccination schedules
- `inventory` - Vaccine and supply inventory
- `inventory_transactions` - Stock movement logs
- `animals` - Animal vaccination registry
- `notifications` - SMS/Email notification logs
- `audit_log` - System activity audit trail
- `settings` - System configuration

## Important: Database Setup Required

⚠️ **Before the app will work, you MUST set up your database:**

1. **Go to your Supabase Project**
   - URL: https://supabase.com/dashboard/project/YOUR_PROJECT_ID

2. **Run the Schema SQL**
   - Navigate to: SQL Editor in Supabase Dashboard
   - Copy the entire contents of `/supabase/schema.sql`
   - Paste into the SQL editor
   - Click "Run" to create all tables, indexes, policies, and triggers

3. **Verify Tables Were Created**
   - Go to: Table Editor in Supabase Dashboard
   - You should see all 10+ tables listed

## Creating Your First Admin User

Since there's no UI for signup yet (to prevent unauthorized registrations), you have two options:

### Option 1: Using the Supabase Dashboard (Recommended)
1. Go to: Authentication > Users in Supabase Dashboard
2. Click "Add User" manually
3. Set email, password, and confirm email
4. After creating the user, go to Table Editor > profiles
5. Add a row with matching `id` (the user's auth ID), email, full_name, and role='Admin'

### Option 2: Using the API Endpoint
Make a POST request to:
```
POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-e1d15c13/auth/signup
Content-Type: application/json
Authorization: Bearer YOUR_ANON_KEY

{
  "email": "admin@digos.gov.ph",
  "password": "your-secure-password",
  "fullName": "Admin User",
  "role": "Admin",
  "phone": "+639123456789"
}
```

## Optional: Email & SMS Configuration

### For Email Notifications (Optional)
If you want to enable email notifications:

1. Get a Resend API key from https://resend.com
2. Set environment variables in Supabase:
   - `RESEND_API_KEY` - Your Resend API key
   - `SMTP_FROM` - Sender email (e.g., "noreply@digos.gov.ph")

### For SMS Notifications (Optional)
If you want to enable SMS notifications:

1. Get a Semaphore API key from https://semaphore.co
2. Set environment variables in Supabase:
   - `SMS_API_KEY` - Your Semaphore API key
   - `SMS_SENDER_NAME` - Sender name (default: "BITEMAP")

To set environment variables:
- Go to: Edge Functions > Settings in Supabase Dashboard
- Add the environment variables
- Redeploy the edge function

## Testing the Backend

1. **Login Test**
   - Open the app
   - Enter your admin email and password
   - Click "Sign In"
   - You should be redirected to the dashboard

2. **Dashboard Test**
   - The dashboard should load statistics (will show zeros if no data yet)
   - Check browser console for any errors

3. **Create Test Data**
   - Try creating a patient
   - Try creating an incident
   - The PEP schedule should auto-generate for Category II/III incidents

## API Architecture

```
Frontend → API Service → Backend Server → Supabase Database
                              ↓
                        Audit Logging
                              ↓
                      Notifications (SMS/Email)
```

## Security Features

1. **Row Level Security (RLS)** - Enabled on all tables
2. **JWT Authentication** - All protected routes require valid tokens
3. **Role-Based Access** - Admin-only routes for user management
4. **Audit Logging** - All actions logged with user ID and timestamp
5. **Auto-logout** - Invalid tokens trigger automatic logout

## Automatic Features

The backend includes several automatic features:

1. **PEP Schedule Auto-Creation**
   - When you create a Category II or III incident
   - Automatically creates vaccination schedule (Day 0, 3, 7, 14, 28)

2. **Inventory Auto-Update**
   - When a vaccine dose is marked as "Done"
   - Automatically decrements vaccine stock
   - Logs the transaction

3. **Audit Trail**
   - All CREATE, UPDATE, DELETE operations logged
   - Includes user ID, action, module, and details

## Troubleshooting

### "Unauthorized" errors
- Check if you've created a user account
- Verify the token in localStorage (`bitemap_access_token`)
- Check browser console for auth errors

### "Table does not exist" errors
- Run the schema.sql in Supabase SQL Editor
- Verify tables exist in Table Editor

### Dashboard shows all zeros
- This is normal if no data exists yet
- Try creating some patients and incidents

### API errors in console
- Check Supabase Edge Function logs
- Verify environment variables are set
- Check network tab for failed requests

## Next Steps

1. ✅ **Set up the database** (run schema.sql)
2. ✅ **Create your first admin user**
3. ✅ **Login and test the dashboard**
4. 📝 **Start adding real data** (patients, incidents, inventory)
5. 🔔 **Configure notifications** (optional - SMS/Email)
6. 👥 **Create additional user accounts** (nurses, health workers, etc.)

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Check Supabase Edge Function logs
3. Verify all environment variables are set
4. Ensure the database schema was applied correctly

---

**Built with:** React + TypeScript + Supabase + Hono
**Database:** PostgreSQL (Supabase)
**Authentication:** Supabase Auth with JWT
**API:** Supabase Edge Functions (Deno)
