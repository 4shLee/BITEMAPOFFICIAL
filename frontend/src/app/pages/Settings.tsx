import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bell, Building2, CheckCircle2, MessageSquare, RotateCcw, Save, Shield, X, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Button } from '../components/UI/Button';
import { getErrorMessage, settingsAPI } from '../../lib/services/api';
import { getStoredUser, isSystemAdminRole, normalizeRoleKey } from '../../lib/auth/roleAccess';

type SystemSettings = {
  smsProvider: string;
  smsSenderId: string;
  retryFailedSms: boolean;
  maxRetryAttempts: string;
  strongPasswords: boolean;
  sessionTimeout: string;
  maxFailedLogins: string;
  accountLockDuration: string;
  forcePasswordChange: boolean;
  securityAlerts: boolean;
  smsServiceFailureAlerts: boolean;
  queueFailureAlerts: boolean;
  systemFailureAlerts: boolean;
};

type ClinicSettings = {
  clinicName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  timezone: string;
  language: string;
  smsReminders: boolean;
  reminderLeadTime: string;
  lowStockAlerts: boolean;
  expiringBatchAlerts: boolean;
};

type SmsCredentialsForm = {
  account_sid: string;
  auth_token: string;
  from_number: string;
};

const systemDefaults: SystemSettings = {
  smsProvider: 'Twilio',
  smsSenderId: '',
  retryFailedSms: true,
  maxRetryAttempts: '3',
  strongPasswords: true,
  sessionTimeout: '30',
  maxFailedLogins: '5',
  accountLockDuration: '15',
  forcePasswordChange: true,
  securityAlerts: true,
  smsServiceFailureAlerts: true,
  queueFailureAlerts: true,
  systemFailureAlerts: true,
};

const clinicDefaults: ClinicSettings = {
  clinicName: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
  timezone: 'Asia/Manila',
  language: 'en',
  smsReminders: true,
  reminderLeadTime: '1',
  lowStockAlerts: true,
  expiringBatchAlerts: true,
};

const systemSettingKeys: Record<keyof SystemSettings, string> = {
  smsProvider: 'sms_provider',
  smsSenderId: 'sms_sender_id',
  retryFailedSms: 'retry_failed_sms_enabled',
  maxRetryAttempts: 'max_sms_retry_attempts',
  strongPasswords: 'strong_passwords_required',
  sessionTimeout: 'session_timeout_minutes',
  maxFailedLogins: 'max_failed_login_attempts',
  accountLockDuration: 'account_lock_minutes',
  forcePasswordChange: 'force_password_change_approved_users',
  securityAlerts: 'security_alerts_enabled',
  smsServiceFailureAlerts: 'sms_service_failure_alerts_enabled',
  queueFailureAlerts: 'queue_failure_alerts_enabled',
  systemFailureAlerts: 'system_failure_alerts_enabled',
};

const clinicSettingKeys: Record<keyof ClinicSettings, string> = {
  clinicName: 'clinic_name',
  contactEmail: 'contact_email',
  contactPhone: 'contact_number',
  address: 'clinic_address',
  timezone: 'system_timezone',
  language: 'system_language',
  smsReminders: 'sms_reminders_enabled',
  reminderLeadTime: 'reminder_days_before',
  lowStockAlerts: 'low_stock_alert_enabled',
  expiringBatchAlerts: 'expiring_batch_alert_enabled',
};

const smsProviderOptions = [
  { value: 'Twilio', label: 'Twilio' },
  { value: 'Semaphore', label: 'Semaphore' },
  { value: 'Other', label: 'Other provider' },
];

const sessionTimeoutOptions = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
];

const timezoneOptions = [{ value: 'Asia/Manila', label: 'Asia/Manila (GMT+8)' }];
const languageOptions = [{ value: 'en', label: 'English' }, { value: 'fil', label: 'Filipino' }];
const phMobilePattern = /^(09|\+639)\d{9}$/;

const boolFromSetting = (value: unknown, fallback: boolean) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value) === 'true';
};

const toSettingValue = (value: string | boolean) => typeof value === 'boolean' ? String(value) : value;

function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={'relative inline-flex items-center ' + (disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
      <input type="checkbox" className="sr-only peer" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <div className="h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white" />
    </label>
  );
}

function SettingsCard({ title, description, icon: Icon, tone, children }: { title: string; description: string; icon: LucideIcon; tone: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-emerald-900/5 bg-white p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
      <div className="mb-4 flex items-center gap-3">
        <div className={'flex h-10 w-10 items-center justify-center rounded-xl ' + tone}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ToggleRow({ title, description, checked, onChange, disabled = false }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-muted p-2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Settings() {
  const currentUser = getStoredUser();
  const isSystemAdmin = isSystemAdminRole(currentUser?.role);
  const isClinicAdmin = normalizeRoleKey(currentUser?.role) === 'clinic_admin';
  const [systemCfg, setSystemCfg] = useState<SystemSettings>(systemDefaults);
  const [initialSystemCfg, setInitialSystemCfg] = useState<SystemSettings>(systemDefaults);
  const [clinicCfg, setClinicCfg] = useState<ClinicSettings>(clinicDefaults);
  const [initialClinicCfg, setInitialClinicCfg] = useState<ClinicSettings>(clinicDefaults);
  const [smsCredentialsConfigured, setSmsCredentialsConfigured] = useState(false);
  const [credentialsForm, setCredentialsForm] = useState<SmsCredentialsForm>({ account_sid: '', auth_token: '', from_number: '' });
  const [testSmsForm, setTestSmsForm] = useState({ phone: '', message: 'BITEMAP test SMS: This confirms the SMS service is configured.' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [credentialSaving, setCredentialSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showTestSmsModal, setShowTestSmsModal] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getAll();
      const settings = (response.data || []) as Array<{ setting_key: string; setting_value: unknown }>;
      const map = new Map(settings.map((setting) => [setting.setting_key, setting.setting_value]));
      setSmsCredentialsConfigured(Boolean(response.meta?.sms_credentials_configured));

      if (isSystemAdmin) {
        const loaded: SystemSettings = {
          smsProvider: String(map.get(systemSettingKeys.smsProvider) || systemDefaults.smsProvider),
          smsSenderId: String(map.get(systemSettingKeys.smsSenderId) || systemDefaults.smsSenderId),
          retryFailedSms: boolFromSetting(map.get(systemSettingKeys.retryFailedSms), systemDefaults.retryFailedSms),
          maxRetryAttempts: String(map.get(systemSettingKeys.maxRetryAttempts) || systemDefaults.maxRetryAttempts),
          strongPasswords: boolFromSetting(map.get(systemSettingKeys.strongPasswords), systemDefaults.strongPasswords),
          sessionTimeout: String(map.get(systemSettingKeys.sessionTimeout) || systemDefaults.sessionTimeout),
          maxFailedLogins: String(map.get(systemSettingKeys.maxFailedLogins) || systemDefaults.maxFailedLogins),
          accountLockDuration: String(map.get(systemSettingKeys.accountLockDuration) || systemDefaults.accountLockDuration),
          forcePasswordChange: boolFromSetting(map.get(systemSettingKeys.forcePasswordChange), systemDefaults.forcePasswordChange),
          securityAlerts: boolFromSetting(map.get(systemSettingKeys.securityAlerts), systemDefaults.securityAlerts),
          smsServiceFailureAlerts: boolFromSetting(map.get(systemSettingKeys.smsServiceFailureAlerts), systemDefaults.smsServiceFailureAlerts),
          queueFailureAlerts: boolFromSetting(map.get(systemSettingKeys.queueFailureAlerts), systemDefaults.queueFailureAlerts),
          systemFailureAlerts: boolFromSetting(map.get(systemSettingKeys.systemFailureAlerts), systemDefaults.systemFailureAlerts),
        };
        setSystemCfg(loaded);
        setInitialSystemCfg(loaded);
      } else {
        const loaded: ClinicSettings = {
          clinicName: String(map.get(clinicSettingKeys.clinicName) || ''),
          contactEmail: String(map.get(clinicSettingKeys.contactEmail) || ''),
          contactPhone: String(map.get(clinicSettingKeys.contactPhone) || ''),
          address: String(map.get(clinicSettingKeys.address) || ''),
          timezone: String(map.get(clinicSettingKeys.timezone) || clinicDefaults.timezone),
          language: String(map.get(clinicSettingKeys.language) || clinicDefaults.language),
          smsReminders: boolFromSetting(map.get(clinicSettingKeys.smsReminders), clinicDefaults.smsReminders),
          reminderLeadTime: String(map.get(clinicSettingKeys.reminderLeadTime) || clinicDefaults.reminderLeadTime),
          lowStockAlerts: boolFromSetting(map.get(clinicSettingKeys.lowStockAlerts), clinicDefaults.lowStockAlerts),
          expiringBatchAlerts: boolFromSetting(map.get(clinicSettingKeys.expiringBatchAlerts), clinicDefaults.expiringBatchAlerts),
        };
        setClinicCfg(loaded);
        setInitialClinicCfg(loaded);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to load settings.'));
    } finally {
      setLoading(false);
    }
  }, [isSystemAdmin]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadSettings(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadSettings]);

  const setSystem = <K extends keyof SystemSettings>(key: K) => (value: SystemSettings[K]) => {
    setSystemCfg((current) => ({ ...current, [key]: value }));
  };

  const setClinic = <K extends keyof ClinicSettings>(key: K) => (value: ClinicSettings[K]) => {
    setClinicCfg((current) => ({ ...current, [key]: value }));
  };

  const activeCfg = isSystemAdmin ? systemCfg : clinicCfg;
  const activeInitialCfg = isSystemAdmin ? initialSystemCfg : initialClinicCfg;
  const hasChanges = useMemo(() => JSON.stringify(activeCfg) !== JSON.stringify(activeInitialCfg), [activeCfg, activeInitialCfg]);

  const validateNumeric = (value: string, label: string, min: number, max: number) => {
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
      return label + ' must be a whole number from ' + min + ' to ' + max + '.';
    }
    return '';
  };

  const validate = () => {
    if (isSystemAdmin) {
      return validateNumeric(systemCfg.maxRetryAttempts, 'Maximum retry attempts', 0, 10)
        || validateNumeric(systemCfg.sessionTimeout, 'Session timeout', 5, 480)
        || validateNumeric(systemCfg.maxFailedLogins, 'Maximum failed login attempts', 1, 20)
        || validateNumeric(systemCfg.accountLockDuration, 'Temporary account lock duration', 1, 1440);
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phonePattern = /^(\+?63|0)?[0-9\s()-]{9,18}$/;
    if (!clinicCfg.clinicName.trim()) return 'Clinic name is required.';
    if (clinicCfg.contactEmail.trim() && !emailPattern.test(clinicCfg.contactEmail.trim())) return 'Enter a valid contact email address.';
    if (clinicCfg.contactPhone.trim() && !phonePattern.test(clinicCfg.contactPhone.trim())) return 'Enter a valid contact phone number.';
    return validateNumeric(clinicCfg.reminderLeadTime, 'Reminder lead time', 0, 30);
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const keys = isSystemAdmin ? systemSettingKeys : clinicSettingKeys;
    const cfg = isSystemAdmin ? systemCfg : clinicCfg;
    const initialCfg = isSystemAdmin ? initialSystemCfg : initialClinicCfg;
    const changedEntries = (Object.keys(keys) as Array<keyof typeof keys>)
      .filter((key) => cfg[key as keyof typeof cfg] !== initialCfg[key as keyof typeof initialCfg])
      .map((key) => [keys[key], toSettingValue(cfg[key as keyof typeof cfg] as string | boolean)] as const);

    if (changedEntries.length === 0) return;

    try {
      setSaving(true);
      await Promise.all(changedEntries.map(([key, value]) => settingsAPI.update(key, value)));
      if (isSystemAdmin) setInitialSystemCfg(systemCfg);
      else setInitialClinicCfg(clinicCfg);
      toast.success('Settings saved successfully.');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to save settings.'));
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (isSystemAdmin) setSystemCfg(systemDefaults);
    else setClinicCfg(clinicDefaults);
    setShowResetConfirm(false);
    toast.success('Default values loaded. Review and save to apply changes.');
  };

  const handleCredentialSave = async () => {
    if (!credentialsForm.account_sid.trim() || !credentialsForm.auth_token.trim() || !credentialsForm.from_number.trim()) {
      toast.error('Enter the account SID, auth token, and sender number.');
      return;
    }

    try {
      setCredentialSaving(true);
      const response = await settingsAPI.updateSmsCredentials(credentialsForm);
      setSmsCredentialsConfigured(Boolean(response.meta?.sms_credentials_configured));
      setCredentialsForm({ account_sid: '', auth_token: '', from_number: '' });
      setShowCredentialsModal(false);
      toast.success('SMS credentials updated.');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to update SMS credentials.'));
    } finally {
      setCredentialSaving(false);
    }
  };

  const handleTestSms = async () => {
    if (!phMobilePattern.test(testSmsForm.phone.trim())) {
      toast.error('Enter a valid Philippine mobile number, such as 09XXXXXXXXX.');
      return;
    }

    try {
      setTestSending(true);
      await settingsAPI.testSms(testSmsForm);
      setShowTestSmsModal(false);
      toast.success('Test SMS request completed.');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to send test SMS.'));
    } finally {
      setTestSending(false);
    }
  };

  if (!isSystemAdmin && !isClinicAdmin) {
    return (
      <div className="flex-1 bg-[#f3f7f5]">
        <Header title="Settings" breadcrumbs={['Admin', 'Settings']} />
        <div className="p-6">
          <div className="rounded-2xl border border-border bg-white p-10 text-center text-sm text-muted-foreground shadow-sm">
            Settings are not available for your role.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#f3f7f5]">
      <Header title={isSystemAdmin ? 'System Settings' : 'Clinic Settings'} breadcrumbs={[isSystemAdmin ? 'Admin' : 'Clinic', 'Settings']} />

      <div className="p-6 pb-24">
        <div className="mx-auto max-w-[1440px] space-y-5">
          {loading ? (
            <div className="rounded-2xl border border-border bg-white p-10 text-center text-sm text-muted-foreground shadow-sm">
              Loading settings...
            </div>
          ) : isSystemAdmin ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
                <SettingsCard title="SMS Service Configuration" description="Provider, credential status, retry policy, and test delivery" icon={MessageSquare} tone="bg-teal-50 text-teal-700">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Select label="SMS Provider" options={smsProviderOptions} value={systemCfg.smsProvider} onChange={(event) => setSystem('smsProvider')(event.target.value)} />
                    <Input label="Sender ID" value={systemCfg.smsSenderId} onChange={(event) => setSystem('smsSenderId')(event.target.value)} placeholder="If supported by provider" />
                    <div className="rounded-xl border border-border bg-muted/30 p-3 md:col-span-2">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Twilio Credential Status</p>
                          <p className="text-xs text-muted-foreground">Credentials are securely stored on the server and are never displayed here.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ' + (smsCredentialsConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {smsCredentialsConfigured ? 'Configured' : 'Not Configured'}
                          </span>
                          <Button type="button" variant="outline" size="sm" onClick={() => setShowCredentialsModal(true)}>Update Credentials</Button>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 p-3 md:col-span-2">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Retry Failed SMS</p>
                          <p className="text-xs text-muted-foreground">Retry provider failures when supported.</p>
                        </div>
                        <Toggle checked={systemCfg.retryFailedSms} onChange={setSystem('retryFailedSms')} />
                      </div>
                    </div>
                    <Input label="Maximum Retry Attempts" type="number" min="0" max="10" value={systemCfg.maxRetryAttempts} disabled={!systemCfg.retryFailedSms} onChange={(event) => setSystem('maxRetryAttempts')(event.target.value)} />
                    <div className="flex items-end">
                      <Button type="button" variant="outline" size="md" className="w-full" onClick={() => setShowTestSmsModal(true)}>Test SMS</Button>
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard title="Security Settings" description="Password, session, and account lock policies" icon={Shield} tone="bg-rose-50 text-rose-700">
                  <div className="space-y-3">
                    <ToggleRow title="Require Strong Passwords" description="Require secure passwords for staff accounts." checked={systemCfg.strongPasswords} onChange={setSystem('strongPasswords')} />
                    <ToggleRow title="Force Password Change" description="Apply to newly approved users." checked={systemCfg.forcePasswordChange} onChange={setSystem('forcePasswordChange')} />
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Select label="Session Timeout" options={sessionTimeoutOptions} value={systemCfg.sessionTimeout} onChange={(event) => setSystem('sessionTimeout')(event.target.value)} />
                      <Input label="Maximum Failed Login Attempts" type="number" min="1" max="20" value={systemCfg.maxFailedLogins} onChange={(event) => setSystem('maxFailedLogins')(event.target.value)} />
                      <Input label="Temporary Account Lock Duration" type="number" min="1" max="1440" value={systemCfg.accountLockDuration} onChange={(event) => setSystem('accountLockDuration')(event.target.value)} helperText="Minutes" />
                    </div>
                  </div>
                </SettingsCard>
              </div>

              <SettingsCard title="Platform Alert Settings" description="Technical and security alert routing" icon={Bell} tone="bg-emerald-50 text-emerald-700">
                <div className="grid grid-cols-1 gap-x-5 gap-y-1 lg:grid-cols-2">
                  <ToggleRow title="Security Alerts" description="Access-control and account security notices." checked={systemCfg.securityAlerts} onChange={setSystem('securityAlerts')} />
                  <ToggleRow title="SMS Service Failure Alerts" description="Provider errors and failed service delivery." checked={systemCfg.smsServiceFailureAlerts} onChange={setSystem('smsServiceFailureAlerts')} />
                  <ToggleRow title="Queue Failure Alerts" description="Background worker and queue processing failures." checked={systemCfg.queueFailureAlerts} onChange={setSystem('queueFailureAlerts')} />
                  <ToggleRow title="Database or System Failure Alerts" description="Database, configuration, and platform health warnings." checked={systemCfg.systemFailureAlerts} onChange={setSystem('systemFailureAlerts')} />
                </div>
              </SettingsCard>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <SettingsCard title="Clinic Profile" description="Operational details for the private Animal Bite Center" icon={Building2} tone="bg-blue-50 text-blue-700">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input label="Clinic Name" value={clinicCfg.clinicName} onChange={(event) => setClinic('clinicName')(event.target.value)} placeholder="Enter clinic name" required />
                  <Input label="Contact Email" value={clinicCfg.contactEmail} onChange={(event) => setClinic('contactEmail')(event.target.value)} type="email" placeholder="name@example.com" />
                  <Input label="Contact Phone" value={clinicCfg.contactPhone} onChange={(event) => setClinic('contactPhone')(event.target.value)} type="tel" placeholder="09XXXXXXXXX" />
                  <Input label="Address" value={clinicCfg.address} onChange={(event) => setClinic('address')(event.target.value)} placeholder="Clinic address" />
                  <Select label="Timezone" options={timezoneOptions} value={clinicCfg.timezone} onChange={(event) => setClinic('timezone')(event.target.value)} />
                  <Select label="Language" options={languageOptions} value={clinicCfg.language} onChange={(event) => setClinic('language')(event.target.value)} />
                </div>
              </SettingsCard>

              <SettingsCard title="Clinic Operational Preferences" description="Reminder timing and inventory alert preferences" icon={Bell} tone="bg-emerald-50 text-emerald-700">
                <div className="space-y-3">
                  <ToggleRow title="SMS Reminder Preferences" description="Enable clinic PEP schedule reminder behavior." checked={clinicCfg.smsReminders} onChange={setClinic('smsReminders')} />
                  <Input label="Reminder Lead Time" type="number" min="0" max="30" value={clinicCfg.reminderLeadTime} onChange={(event) => setClinic('reminderLeadTime')(event.target.value)} helperText="Days before scheduled dose." />
                  <ToggleRow title="Low Stock Alerts" description="Alert when clinic inventory drops below thresholds." checked={clinicCfg.lowStockAlerts} onChange={setClinic('lowStockAlerts')} />
                  <ToggleRow title="Expiring Batch Alerts" description="Alert when vaccine or supply batches are nearing expiry." checked={clinicCfg.expiringBatchAlerts} onChange={setClinic('expiringBatchAlerts')} />
                </div>
              </SettingsCard>
            </div>
          )}

          <div className="sticky bottom-3 z-10 rounded-2xl border border-emerald-900/5 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {hasChanges ? 'Unsaved changes are ready to apply.' : 'No unsaved changes.'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowResetConfirm(true)} disabled={loading || saving}>
                  <RotateCcw className="h-4 w-4" />
                  Reset to Defaults
                </Button>
                <Button type="button" variant="primary" size="sm" onClick={handleSave} disabled={loading || saving || !hasChanges}>
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showResetConfirm && (
        <Modal title="Reset settings?" onClose={() => setShowResetConfirm(false)}>
          <p className="text-sm leading-6 text-muted-foreground">Default values will be loaded into the form. They will not be saved until you click Save Settings.</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outline" size="md" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
            <Button type="button" variant="danger" size="md" onClick={handleResetDefaults}>Reset Defaults</Button>
          </div>
        </Modal>
      )}

      {showCredentialsModal && (
        <Modal title="Update SMS Credentials" onClose={() => setShowCredentialsModal(false)}>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">Enter replacement credentials. Existing secrets are never shown or prefilled.</p>
            <Input label="Twilio Account SID" value={credentialsForm.account_sid} onChange={(event) => setCredentialsForm((current) => ({ ...current, account_sid: event.target.value }))} />
            <Input label="Twilio Auth Token" type="password" value={credentialsForm.auth_token} onChange={(event) => setCredentialsForm((current) => ({ ...current, auth_token: event.target.value }))} />
            <Input label="Twilio From Number" value={credentialsForm.from_number} onChange={(event) => setCredentialsForm((current) => ({ ...current, from_number: event.target.value }))} placeholder="+63..." />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="md" onClick={() => setShowCredentialsModal(false)}>Cancel</Button>
              <Button type="button" variant="primary" size="md" onClick={handleCredentialSave} disabled={credentialSaving}>{credentialSaving ? 'Saving...' : 'Update Credentials'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {showTestSmsModal && (
        <Modal title="Send Test SMS" onClose={() => setShowTestSmsModal(false)}>
          <div className="space-y-4">
            <Input label="Test Recipient Phone Number" value={testSmsForm.phone} onChange={(event) => setTestSmsForm((current) => ({ ...current, phone: event.target.value }))} placeholder="09XXXXXXXXX" />
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">Message Preview</label>
              <textarea
                value={testSmsForm.message}
                onChange={(event) => setTestSmsForm((current) => ({ ...current, message: event.target.value }))}
                className="min-h-24 w-full rounded-xl border border-input bg-input-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="md" onClick={() => setShowTestSmsModal(false)}>Cancel</Button>
              <Button type="button" variant="primary" size="md" onClick={handleTestSms} disabled={testSending}>{testSending ? 'Sending...' : 'Send Test SMS'}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
