import { useState } from 'react';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Button } from '../components/UI/Button';
import { Bell, Mail, Shield, Database } from 'lucide-react';
import { toast } from 'sonner';

const defaults = {
  smsReminders: true,
  emailNotifications: true,
  lowStockAlerts: true,
  smtpServer: 'smtp.gmail.com',
  smtpPort: '587',
  smtpUser: 'noreply@health.gov.ph',
  smtpPassword: '',
  orgName: 'Animal Bite Treatment Center',
  contactEmail: 'health@gov.ph',
  contactPhone: '+63 82 553 1234',
  timezone: 'Asia/Manila',
  language: 'en',
  strongPasswords: true,
  sessionTimeout: '30 minutes',
};

const timezoneOptions  = [{ value: 'Asia/Manila', label: 'Asia/Manila (GMT+8)' }];
const languageOptions  = [{ value: 'en', label: 'English' }, { value: 'fil', label: 'Filipino' }];
const timeoutOptions   = ['30 minutes', '1 hour', '2 hours'].map(v => ({ value: v, label: v }));

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring
        rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white
        after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white
        after:border-border after:border after:rounded-full after:h-5 after:w-5
        after:transition-all peer-checked:bg-primary" />
    </label>
  );
}

export function Settings() {
  const [cfg, setCfg] = useState(defaults);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof defaults) => (val: any) =>
    setCfg(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    if (!cfg.orgName.trim()) { toast.error('Organization name is required.'); return; }
    if (!cfg.contactEmail.trim()) { toast.error('Contact email is required.'); return; }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success('Settings saved successfully.');
    }, 800);
  };

  const handleReset = () => {
    setCfg(defaults);
    toast.success('Settings reset to defaults.');
  };

  return (
    <div className="flex-1">
      <Header title="System Settings" breadcrumbs={['Admin', 'Settings']} />

      <div className="p-8 max-w-4xl space-y-6">

        {/* Notification settings */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-primary-bg rounded-lg flex items-center justify-center">
              <Bell className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Notification Settings</h2>
              <p className="text-xs text-muted-foreground">Configure reminders and alerts</p>
            </div>
          </div>
          <div className="space-y-1">
            {[
              { key: 'smsReminders',        label: 'SMS Reminders',          desc: 'Send SMS for upcoming PEP doses' },
              { key: 'emailNotifications',  label: 'Email Notifications',    desc: 'Send email for important updates' },
              { key: 'lowStockAlerts',      label: 'Low Stock Alerts',       desc: 'Alert when inventory is low' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Toggle
                  checked={cfg[item.key as keyof typeof cfg] as boolean}
                  onChange={set(item.key as keyof typeof defaults)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Email configuration */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-accent-bg rounded-lg flex items-center justify-center">
              <Mail className="w-4.5 h-4.5 text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Email Configuration</h2>
              <p className="text-xs text-muted-foreground">SMTP settings for outgoing emails</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="SMTP Server"   value={cfg.smtpServer}   onChange={e => set('smtpServer')(e.target.value)}   placeholder="smtp.gmail.com" />
            <Input label="SMTP Port"     value={cfg.smtpPort}     onChange={e => set('smtpPort')(e.target.value)}     placeholder="587" />
            <Input label="Username"      value={cfg.smtpUser}     onChange={e => set('smtpUser')(e.target.value)}     placeholder="noreply@health.gov.ph" />
            <Input label="Password"      value={cfg.smtpPassword} onChange={e => set('smtpPassword')(e.target.value)} type="password" placeholder="••••••••" />
          </div>
        </div>

        {/* System configuration */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-success-bg rounded-lg flex items-center justify-center">
              <Database className="w-4.5 h-4.5 text-success" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">System Configuration</h2>
              <p className="text-xs text-muted-foreground">General system settings</p>
            </div>
          </div>
          <div className="space-y-4">
            <Input label="Organization Name" value={cfg.orgName}       onChange={e => set('orgName')(e.target.value)}       required />
            <Input label="Contact Email"     value={cfg.contactEmail}  onChange={e => set('contactEmail')(e.target.value)}  type="email" />
            <Input label="Contact Phone"     value={cfg.contactPhone}  onChange={e => set('contactPhone')(e.target.value)}  type="tel" />
            <Select label="Timezone"         options={timezoneOptions} value={cfg.timezone} onChange={e => set('timezone')(e.target.value)} />
            <Select label="Language"         options={languageOptions} value={cfg.language} onChange={e => set('language')(e.target.value)} />
          </div>
        </div>

        {/* Security */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-destructive-bg rounded-lg flex items-center justify-center">
              <Shield className="w-4.5 h-4.5 text-destructive" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Security Settings</h2>
              <p className="text-xs text-muted-foreground">Password and access policies</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Require Strong Passwords</p>
                <p className="text-xs text-muted-foreground">Minimum 8 characters with special characters</p>
              </div>
              <Toggle checked={cfg.strongPasswords} onChange={set('strongPasswords')} />
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Session Timeout</p>
                <p className="text-xs text-muted-foreground">Auto-logout after inactivity</p>
              </div>
              <select
                value={cfg.sessionTimeout}
                onChange={e => set('sessionTimeout')(e.target.value)}
                className="px-3 py-2 bg-input-background border border-input rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              >
                {timeoutOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-semibold
              rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
            ) : 'Save Settings'}
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-2.5 border border-border text-sm font-medium text-muted-foreground rounded-lg
              hover:bg-muted hover:text-foreground transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
