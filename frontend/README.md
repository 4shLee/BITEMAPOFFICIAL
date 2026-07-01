# BITEMAP - Animal Bite Incident Tracking System

**GIS-Based Animal Bite Incident Tracking & Anti-Rabies Vaccination Monitoring System for Digos City, Davao del Sur, Philippines**

## 🏥 About

BITEMAP is a comprehensive healthcare information system designed for the Digos City Health Office to track and manage animal bite incidents, anti-rabies vaccination schedules (PEP - Post-Exposure Prophylaxis), vaccine inventory, and generate public health reports.

### Key Features

**For Health Workers:**
- 📝 Animal bite incident registration and tracking
- 💉 PEP vaccination schedule management (Day 0, 3, 7, 14, 28)
- 📦 Vaccine and supply inventory monitoring
- 📊 Real-time GIS heatmap of incident density by barangay
- 📱 Automated SMS/Email reminders for patients
- 🐕 Animal vaccination registry
- 📈 Comprehensive reporting and analytics
- 👥 User management with role-based access control
- 🔍 Complete audit trail

**For Public:**
- 🗺️ View public heatmap of bite incidents by area
- 📊 Access aggregated statistics and trends
- 🏥 Find vaccination clinics and contact information
- ℹ️ Prevention tips and emergency procedures

## 🚀 Tech Stack

- **Frontend:** React 18 + TypeScript
- **Styling:** Tailwind CSS v4
- **Routing:** React Router v7
- **Charts:** Recharts
- **Icons:** Lucide React
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **SMS:** Semaphore API (Philippines)
- **Email:** Resend / SMTP
- **Authentication:** Supabase Auth with RLS

## 📋 System Requirements

- Node.js 18+ and pnpm
- Supabase account (free tier available)
- SMS provider account (Semaphore recommended for PH)
- Email provider (Resend or SMTP)

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd bitemap
pnpm install
```

### 2. Set Up Supabase Backend

Follow the detailed guide in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

Quick steps:
1. Create Supabase project
2. Run `supabase/schema.sql` in SQL Editor
3. Deploy edge functions
4. Configure SMS/Email providers
5. Create admin user

### 3. Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SMS_API_KEY=your-semaphore-key
RESEND_API_KEY=your-resend-key
```

### 4. Start Development Server

```bash
pnpm dev
```

Visit `http://localhost:5173`

## 👤 Default Login

After running the schema and creating an admin user:

- **Email:** admin@digos.gov.ph
- **Password:** (the one you set during user creation)

## 📁 Project Structure

```
bitemap/
├── src/
│   ├── app/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── Layout/          # Sidebar, Header, MainLayout
│   │   │   └── UI/              # Badge, Button, Input, etc.
│   │   ├── context/             # React Context (Auth)
│   │   ├── pages/               # All application pages
│   │   └── App.tsx              # Main app with routing
│   ├── lib/
│   │   ├── supabase/            # Database client & types
│   │   └── services/            # Auth, Notifications, etc.
│   └── styles/                  # Global styles & theme
├── supabase/
│   ├── schema.sql               # Database schema
│   └── functions/               # Edge functions
│       ├── send-sms/            # SMS sending
│       ├── send-email/          # Email sending
│       └── check-reminders/     # Daily reminder cron
└── SUPABASE_SETUP.md            # Backend setup guide
```

## 🔐 User Roles

- **Admin:** Full system access, user management
- **Health Officer:** View all data, generate reports
- **Nurse/Vaccinator:** Register patients, administer vaccines
- **BHW (Barangay Health Worker):** Register incidents, basic data entry
- **Vet Staff:** Animal vaccination registry

## 📱 Features in Detail

### 1. Incident Management
- Register new animal bite cases
- WHO category classification (I, II, III)
- GIS coordinates for mapping
- Link to patient records

### 2. PEP Schedule Tracking
- Auto-generate vaccination schedule based on WHO category
- Track dose administration (0, 3, 7, 14, 28 days)
- Visual timeline with status indicators
- Automated reminders before due dates

### 3. Inventory Management
- Real-time stock levels
- Low stock alerts
- Transaction history
- Automatic stock deduction on vaccine administration

### 4. GIS Heatmap
- Interactive barangay-level visualization
- Incident density color coding
- Demographic breakdowns
- Risk area identification

### 5. Notifications
- **SMS:** Via Semaphore API
- **Email:** Via Resend or SMTP
- Automated daily reminder checks
- Manual bulk sending capability

### 6. Public Portal
- No login required
- View aggregate statistics
- Interactive heatmap (anonymized)
- Clinic finder with directions
- Prevention guidelines

## 💰 Cost Estimates

For ~500 patients/month:

- **Supabase:** Free (within 500MB database)
- **SMS:** ~₱2,000/month (₱0.80 × 2,500 messages)
- **Email:** Free (Resend free tier: 3,000/month)
- **Total:** ~₱2,000/month

## 🔒 Security & Compliance

⚠️ **IMPORTANT:** This is a prototype/demo system.

For production use with real patient data:
- Consult with healthcare compliance experts
- Ensure Philippine Data Privacy Act (RA 10173) compliance
- Implement additional encryption for PHI
- Regular security audits
- Proper backup and disaster recovery
- Consider healthcare-grade infrastructure

## 📊 Database Schema

Main tables:
- `profiles` - User accounts and roles
- `patients` - Patient demographics
- `incidents` - Bite incident records
- `pep_schedule` - Vaccination schedules
- `inventory` - Vaccine stock levels
- `animals` - Animal vaccination registry
- `notifications` - SMS/Email logs
- `audit_log` - Complete audit trail

## 🧪 Testing

### Test SMS Sending

```typescript
import { sendSMS } from '@/lib/services/notifications';

await sendSMS({
  phone: '+639123456789',
  message: 'Test from BITEMAP'
});
```

### Test Database

```typescript
import { getPatients } from '@/lib/supabase/database';

const patients = await getPatients();
console.log(patients);
```

## 🐛 Troubleshooting

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed troubleshooting.

Common issues:
- **Can't connect:** Check `.env.local` credentials
- **SMS not sending:** Verify Semaphore API key and credits
- **Permission denied:** Check Supabase RLS policies

## 📞 Support

- **Technical:** File an issue in repository
- **Supabase:** https://supabase.com/docs
- **Semaphore:** support@semaphore.co

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

This project is licensed under MIT License.

## 🏛️ Credits

Developed for:
- **Digos City Health Office**
- **Cor Jesu College**
- **Department of Health - Philippines**

In compliance with:
- Republic Act 9482 (Anti-Rabies Act of 2007)
- Republic Act 10173 (Data Privacy Act of 2012)

---

**⚠️ Disclaimer:** This is prototype software for demonstration purposes. Not certified for production healthcare use. Consult legal and compliance experts before deploying with real patient data.
