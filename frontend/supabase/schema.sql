-- BITEMAP Database Schema for Supabase
-- Animal Bite Incident Tracking & Anti-Rabies Vaccination Monitoring System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users/Staff Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Health Officer', 'Nurse', 'BHW', 'Vet Staff')),
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Barangays
CREATE TABLE IF NOT EXISTS barangays (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  population INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patients
CREATE TABLE IF NOT EXISTS patients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('Male', 'Female')),
  address TEXT NOT NULL,
  barangay_id UUID REFERENCES barangays(id),
  contact_number TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Animal Bite Incidents
CREATE TABLE IF NOT EXISTS incidents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  incident_date DATE NOT NULL,
  incident_time TIME,
  animal_type TEXT NOT NULL CHECK (animal_type IN ('Dog', 'Cat', 'Other')),
  animal_description TEXT,
  bite_site TEXT NOT NULL,
  who_category TEXT NOT NULL CHECK (who_category IN ('I', 'II', 'III')),
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  barangay_id UUID REFERENCES barangays(id),
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Missed', 'Lost to Follow-up')),
  reported_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PEP Schedule
CREATE TABLE IF NOT EXISTS pep_schedule (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE NOT NULL,
  dose_day INTEGER NOT NULL CHECK (dose_day IN (0, 3, 7, 14, 28)),
  scheduled_date DATE NOT NULL,
  administered_date DATE,
  vaccine_type TEXT DEFAULT 'Anti-rabies',
  vaccine_lot_number TEXT,
  administered_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Upcoming', 'Done', 'Missed', 'Skipped')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(incident_id, dose_day)
);

-- Vaccine Inventory
CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_name TEXT NOT NULL UNIQUE,
  item_type TEXT NOT NULL CHECK (item_type IN ('Vaccine', 'Immunoglobulin', 'Supply', 'Medicine')),
  current_stock INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  reorder_level INTEGER NOT NULL,
  expiry_date DATE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- Inventory Transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('Used', 'Restocked', 'Adjusted', 'Expired')),
  quantity INTEGER NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Animal Registry (for vaccination tracking)
CREATE TABLE IF NOT EXISTS animals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  animal_id TEXT UNIQUE NOT NULL,
  animal_type TEXT NOT NULL CHECK (animal_type IN ('Dog', 'Cat', 'Other')),
  breed TEXT,
  owner_name TEXT NOT NULL,
  owner_contact TEXT,
  barangay_id UUID REFERENCES barangays(id),
  is_vaccinated BOOLEAN DEFAULT false,
  last_vaccination_date DATE,
  next_vaccination_due DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications/Reminders
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('SMS', 'Email', 'Both')),
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Sent', 'Failed', 'Delivered')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivery_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System Settings
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_patients_barangay ON patients(barangay_id);
CREATE INDEX idx_incidents_patient ON incidents(patient_id);
CREATE INDEX idx_incidents_barangay ON incidents(barangay_id);
CREATE INDEX idx_incidents_date ON incidents(incident_date);
CREATE INDEX idx_pep_schedule_incident ON pep_schedule(incident_id);
CREATE INDEX idx_pep_schedule_date ON pep_schedule(scheduled_date);
CREATE INDEX idx_notifications_patient ON notifications(patient_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE pep_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read their own profile, admins can read/update all
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
);
CREATE POLICY "Admins can update profiles" ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
);

-- Patients: All authenticated users can read, health workers can create/update
CREATE POLICY "Authenticated users can view patients" ON patients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Health workers can create patients" ON patients FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Health Officer', 'Nurse', 'BHW'))
);
CREATE POLICY "Health workers can update patients" ON patients FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Health Officer', 'Nurse'))
);

-- Incidents: All authenticated users can read, health workers can create/update
CREATE POLICY "Authenticated users can view incidents" ON incidents FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Health workers can create incidents" ON incidents FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Health Officer', 'Nurse', 'BHW'))
);
CREATE POLICY "Health workers can update incidents" ON incidents FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Health Officer', 'Nurse'))
);

-- PEP Schedule: All authenticated users can read, nurses can update
CREATE POLICY "Authenticated users can view pep schedule" ON pep_schedule FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Nurses can update pep schedule" ON pep_schedule FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Health Officer', 'Nurse'))
);

-- Inventory: All authenticated users can read, authorized staff can update
CREATE POLICY "Authenticated users can view inventory" ON inventory FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authorized staff can update inventory" ON inventory FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Health Officer', 'Nurse'))
);

-- Audit Log: Admins and Health Officers can read
CREATE POLICY "Admins can view audit log" ON audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Health Officer'))
);

-- Functions and Triggers

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pep_schedule_updated_at BEFORE UPDATE ON pep_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_animals_updated_at BEFORE UPDATE ON animals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-create PEP schedule when incident is created
CREATE OR REPLACE FUNCTION create_pep_schedule()
RETURNS TRIGGER AS $$
DECLARE
  dose_days INTEGER[] := ARRAY[0, 3, 7, 14, 28];
  dose_day INTEGER;
BEGIN
  -- Only create schedule for Category II and III
  IF NEW.who_category IN ('II', 'III') THEN
    FOREACH dose_day IN ARRAY dose_days
    LOOP
      INSERT INTO pep_schedule (incident_id, dose_day, scheduled_date, status)
      VALUES (
        NEW.id,
        dose_day,
        NEW.incident_date + (dose_day || ' days')::INTERVAL,
        CASE WHEN dose_day = 0 THEN 'Upcoming' ELSE 'Pending' END
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_create_pep_schedule
AFTER INSERT ON incidents
FOR EACH ROW
EXECUTE FUNCTION create_pep_schedule();

-- Function to update inventory when vaccine is used
CREATE OR REPLACE FUNCTION update_inventory_on_vaccination()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Done' AND (OLD.status IS NULL OR OLD.status != 'Done') THEN
    -- Reduce vaccine stock by 1
    UPDATE inventory
    SET current_stock = current_stock - 1,
        last_updated = NOW()
    WHERE item_name = 'Anti-rabies Vaccine';

    -- Log the transaction
    INSERT INTO inventory_transactions (inventory_id, transaction_type, quantity, created_by)
    SELECT id, 'Used', -1, NEW.administered_by
    FROM inventory
    WHERE item_name = 'Anti-rabies Vaccine';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_inventory
AFTER UPDATE ON pep_schedule
FOR EACH ROW
EXECUTE FUNCTION update_inventory_on_vaccination();

-- Function to log audit trail
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (user_id, action, module, details)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    json_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    )::TEXT
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Insert default barangays
INSERT INTO barangays (name, population) VALUES
  ('Aplaya', 12500),
  ('San Jose', 10200),
  ('Dawis', 8900),
  ('Zone 1', 5600),
  ('Zone 2', 4800),
  ('Mahayahay', 9300),
  ('Balabag', 6200),
  ('Tiguman', 7100)
ON CONFLICT (name) DO NOTHING;

-- Insert default inventory items
INSERT INTO inventory (item_name, item_type, current_stock, unit, reorder_level) VALUES
  ('Anti-rabies Vaccine', 'Vaccine', 45, 'vials', 50),
  ('Equine Rabies Immunoglobulin (eRIG)', 'Immunoglobulin', 120, 'vials', 30),
  ('Human Rabies Immunoglobulin (hRIG)', 'Immunoglobulin', 8, 'vials', 10),
  ('Tetanus Toxoid', 'Vaccine', 85, 'vials', 40),
  ('Anti-Tetanus Serum (ATS)', 'Medicine', 22, 'vials', 25),
  ('Wound Care Kit', 'Supply', 156, 'sets', 50)
ON CONFLICT (item_name) DO NOTHING;

-- Insert default system settings
INSERT INTO settings (setting_key, setting_value) VALUES
  ('sms_enabled', 'true'),
  ('email_enabled', 'true'),
  ('low_stock_threshold', '20'),
  ('reminder_days_before', '1'),
  ('organization_name', 'Digos City Health Office'),
  ('contact_email', 'health@digos.gov.ph'),
  ('contact_phone', '+63 82 553 1234')
ON CONFLICT (setting_key) DO NOTHING;
