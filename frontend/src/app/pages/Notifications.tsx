import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  History,
  Info,
  MessageSquare,
  Phone,
  Search,
  ShieldAlert,
  UserRound,
  X,
} from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { toast } from 'sonner';
import { auditLogsAPI, notificationsAPI, pepScheduleAPI } from '../../lib/services/api';
import { canPerformAction, getStoredUser, isSystemAdminRole } from '../../lib/auth/roleAccess';

type NotificationLog = {
  id: number;
  type?: string;
  notification_type?: string;
  recipient: string;
  message: string;
  status: 'Pending' | 'Sent' | 'Failed' | 'Delivered' | string;
  sentAt?: string;
  sent_at?: string;
  failed_at?: string;
  updated_at?: string;
  created_at?: string;
  read?: boolean;
  patient_id?: number | string;
  incident_id?: number | string;
  pep_schedule_id?: number | string;
  reminder_type?: string;
  scheduled_date?: string;
  patient?: {
    id?: number | string;
    full_name?: string;
    contact_number?: string;
  };
};

type PepScheduleRow = {
  id: number;
  incident_id: number | string;
  dose_day: number;
  scheduled_date: string;
  status: string;
  patient?: {
    id?: number | string;
    full_name?: string;
    contact_number?: string;
  };
  incident?: {
    id?: number | string;
    sms_consent?: boolean;
  };
};

type UpcomingReminder = {
  id: number;
  patient: string;
  doseDay: number;
  dueDate: string;
  contact: string;
  patientId?: string;
  incidentId?: string;
  reminderStatus: 'Overdue' | 'Due Today' | 'Upcoming';
  smsConsent: boolean;
};

type PatientReminderGroup = {
  key: string;
  patient: string;
  patientId?: string;
  contact: string;
  incidentId?: string;
  smsConsent: boolean;
  overdue: UpcomingReminder[];
  dueToday: UpcomingReminder[];
  upcoming: UpcomingReminder[];
};

type SmsServiceState = {
  enabled: boolean;
  mode: 'simulation' | 'enabled';
  provider?: string | null;
};

type NotificationSummary = {
  overdue_patients: number;
  failed_sms: number;
  due_today_patients: number;
  pending_sms: number;
};

type SystemSeverity = 'info' | 'warning' | 'critical';
type SystemNotificationType = 'Security' | 'User Access' | 'System' | 'SMS Service' | 'Queue' | 'Database';
type SystemNotificationStatus = 'unread' | 'read' | 'resolved';

type SystemNotification = {
  id: string;
  severity: SystemSeverity;
  title: string;
  description: string;
  category: SystemNotificationType;
  timestamp: string;
  status: SystemNotificationStatus;
  source?: any;
};

const NOTIFICATIONS_PER_PAGE = 10;
const UPCOMING_REMINDER_LIMIT = 8;
const SYSTEM_NOTIFICATION_TYPES: Array<'All' | SystemNotificationType> = ['All', 'Security', 'User Access', 'System', 'SMS Service', 'Queue', 'Database'];
const SYSTEM_SEVERITIES: Array<'All' | 'Info' | 'Warning' | 'Critical'> = ['All', 'Info', 'Warning', 'Critical'];
const SYSTEM_STATUSES: Array<'All' | 'Unread' | 'Read' | 'Resolved'> = ['All', 'Unread', 'Read', 'Resolved'];

const getStatusVariant = (status: string): any => {
  if (status === 'Sent' || status === 'Delivered') return 'success';
  if (status === 'Pending') return 'warning';
  return 'danger';
};

const normalizeNotificationType = (notification: NotificationLog) => {
  return notification.type || notification.notification_type || 'SMS';
};

const getSentAt = (notification: NotificationLog) => {
  return notification.sentAt || notification.sent_at || notification.created_at || '';
};

const isSentStatus = (status: string) => status === 'Sent' || status === 'Delivered';

const normalizeStatus = (status: string) => {
  if (isSentStatus(status)) return 'Sent';
  if (status === 'Failed') return 'Failed';
  return 'Pending';
};

const getBestTimestamp = (notification: NotificationLog) => {
  const status = normalizeStatus(notification.status);

  if (status === 'Sent') {
    return notification.sentAt || notification.sent_at || notification.created_at || '';
  }

  if (status === 'Failed') {
    return notification.failed_at || notification.updated_at || notification.sentAt || notification.sent_at || notification.created_at || '';
  }

  return notification.created_at || notification.sentAt || notification.sent_at || '';
};

const formatDateTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const datePart = date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const timePart = date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return datePart + ' • ' + timePart;
};

const formatReadableDateTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const datePart = date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const timePart = date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return datePart + ' - ' + timePart;
};

const getTimestampLabel = (notification: NotificationLog) => {
  const timestamp = formatReadableDateTime(getBestTimestamp(notification));
  const status = normalizeStatus(notification.status);

  if (!timestamp) {
    return status === 'Pending' ? 'Pending SMS send' : 'Timestamp unavailable';
  }

  if (status === 'Sent') return 'Sent: ' + timestamp;
  if (status === 'Failed') return 'Failed: ' + timestamp;
  return 'Created: ' + timestamp;
};

const toDateKey = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
};

const parseDateOnly = (value: string) => new Date(value + 'T00:00:00');

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = value.includes('T') ? new Date(value) : parseDateOnly(value.slice(0, 10));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const buildUpcomingReminders = (rows: PepScheduleRow[]): UpcomingReminder[] => {
  const today = parseDateOnly(toDateKey(new Date()));
  const nextWeek = addDays(today, 7);

  return rows
    .filter((row) => row.scheduled_date && row.status !== 'Done')
    .filter((row) => {
      const scheduleDate = parseDateOnly(row.scheduled_date.slice(0, 10));
      return scheduleDate <= nextWeek;
    })
    .sort((a, b) => parseDateOnly(a.scheduled_date).getTime() - parseDateOnly(b.scheduled_date).getTime())
    .map((row) => ({
      id: row.id,
      patient: row.patient?.full_name || 'Unknown Patient',
      doseDay: row.dose_day,
      dueDate: row.scheduled_date,
      contact: row.patient?.contact_number || '',
      patientId: row.patient?.id ? String(row.patient.id) : undefined,
      incidentId: row.incident_id ? String(row.incident_id) : undefined,
      smsConsent: row.incident?.sms_consent === true,
      reminderStatus: parseDateOnly(row.scheduled_date.slice(0, 10)) < today
        ? 'Overdue'
        : parseDateOnly(row.scheduled_date.slice(0, 10)).getTime() === today.getTime()
          ? 'Due Today'
          : 'Upcoming',
    }));
};

const getDaysOverdue = (value: string) => {
  const scheduled = parseDateOnly(value.slice(0, 10));
  const today = parseDateOnly(toDateKey(new Date()));
  return Math.max(0, Math.floor((today.getTime() - scheduled.getTime()) / 86400000));
};

const getDaysUntil = (value: string) => {
  const scheduled = parseDateOnly(value.slice(0, 10));
  const today = parseDateOnly(toDateKey(new Date()));
  return Math.max(0, Math.ceil((scheduled.getTime() - today.getTime()) / 86400000));
};

const groupRemindersByPatient = (reminders: UpcomingReminder[]): PatientReminderGroup[] => {
  const groups = new Map<string, PatientReminderGroup>();

  reminders.forEach((reminder) => {
    const key = reminder.patientId || reminder.patient.toLowerCase();
    const group = groups.get(key) || {
      key,
      patient: reminder.patient,
      patientId: reminder.patientId,
      contact: reminder.contact,
      incidentId: reminder.incidentId,
      smsConsent: reminder.smsConsent,
      overdue: [],
      dueToday: [],
      upcoming: [],
    };

    if (reminder.reminderStatus === 'Overdue') group.overdue.push(reminder);
    else if (reminder.reminderStatus === 'Due Today') group.dueToday.push(reminder);
    else group.upcoming.push(reminder);

    groups.set(key, group);
  });

  return Array.from(groups.values()).sort((a, b) => {
    const priorityA = a.overdue.length > 0 ? 0 : a.dueToday.length > 0 ? 1 : 2;
    const priorityB = b.overdue.length > 0 ? 0 : b.dueToday.length > 0 ? 1 : 2;
    if (priorityA !== priorityB) return priorityA - priorityB;
    const dateA = [...a.overdue, ...a.dueToday, ...a.upcoming][0]?.dueDate || '';
    const dateB = [...b.overdue, ...b.dueToday, ...b.upcoming][0]?.dueDate || '';
    return dateA.localeCompare(dateB);
  });
};

const getNotificationSchedule = (notification: NotificationLog, rows: PepScheduleRow[]) => {
  const incidentId = String(notification.incident_id || '');
  const doseMatch = notification.message?.match(/Day\s+(\d+)/i);
  const doseDay = doseMatch ? Number(doseMatch[1]) : null;
  const incidentRows = rows.filter((row) => String(row.incident_id) === incidentId);

  if (doseDay !== null) {
    const exactDose = incidentRows.find((row) => Number(row.dose_day) === doseDay);
    if (exactDose) return exactDose;
  }

  const dateMatch = notification.message?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateMatch) {
    const exactDate = incidentRows.find((row) => row.scheduled_date?.slice(0, 10) === dateMatch);
    if (exactDate) return exactDate;
  }

  return incidentRows.find((row) => !['Done', 'Completed', 'Cancelled', 'Skipped'].includes(row.status)) || incidentRows[0];
};

const getSystemTimestamp = (log: any) => log.timestamp || log.created_at || log.updated_at || '';

const detectSystemNotificationCategory = (log: any): SystemNotificationType => {
  const moduleName = String(log.module || '').toLowerCase();
  const haystack = [log.action, log.module, log.description].filter(Boolean).join(' ').toLowerCase();

  if (haystack.includes('database')) return 'Database';
  if (haystack.includes('queue')) return 'Queue';
  if (moduleName.includes('notification') || haystack.includes('sms')) return 'SMS Service';
  if (moduleName.includes('auth') || haystack.includes('login') || haystack.includes('suspicious') || haystack.includes('unauthorized')) return 'Security';
  if (moduleName.includes('user') || haystack.includes('role') || haystack.includes('approve') || haystack.includes('reject') || haystack.includes('deactivate') || haystack.includes('access')) return 'User Access';
  return 'System';
};

const detectSystemNotificationSeverity = (log: any): SystemSeverity => {
  const haystack = [log.action, log.module, log.description].filter(Boolean).join(' ').toLowerCase();

  if (haystack.includes('critical') || haystack.includes('suspicious') || haystack.includes('unauthorized') || haystack.includes('failed') || haystack.includes('error') || haystack.includes('delete')) {
    return 'critical';
  }

  if (haystack.includes('warning') || haystack.includes('reject') || haystack.includes('deactivate') || haystack.includes('update role') || haystack.includes('settings') || haystack.includes('config')) {
    return 'warning';
  }

  return 'info';
};

const isSystemNotificationSource = (log: any) => {
  const moduleName = String(log.module || '');
  const haystack = [log.action, log.module, log.description].filter(Boolean).join(' ').toLowerCase();
  const platformModules = ['Authentication', 'User Management', 'Settings', 'Audit Logs'];
  const platformSignal = /(failed|suspicious|unauthorized|invalid|error|critical|database|queue|system|config|role|approve|reject|deactivate|login|logout|access)/.test(haystack);
  const smsServiceSignal = moduleName === 'Notifications' && /(failed|error|service|provider|queue)/.test(haystack);

  return (platformModules.includes(moduleName) && platformSignal) || smsServiceSignal;
};

const buildSystemNotificationTitle = (log: any, category: SystemNotificationType, severity: SystemSeverity) => {
  const action = log.action || 'System activity';

  if (category === 'SMS Service') return severity === 'critical' ? 'SMS service alert' : 'SMS service notice';
  if (category === 'Security') return severity === 'critical' ? 'Security alert recorded' : 'Security activity recorded';
  if (category === 'User Access') return 'User access activity recorded';
  if (category === 'Database') return 'Database alert recorded';
  if (category === 'Queue') return 'Queue worker alert recorded';
  return action;
};

const buildSystemNotificationDescription = (log: any, category: SystemNotificationType) => {
  if (category === 'SMS Service') {
    return 'A notification delivery or SMS service issue was recorded in audit activity.';
  }

  return log.description || [log.user_name || 'System', log.action, log.module].filter(Boolean).join(' - ') || 'System activity requires administrator review.';
};

const buildSystemNotifications = (logs: any[]): SystemNotification[] => {
  return logs
    .filter(isSystemNotificationSource)
    .map((log) => {
      const category = detectSystemNotificationCategory(log);
      const severity = detectSystemNotificationSeverity(log);

      return {
        id: 'audit-' + log.id,
        severity,
        title: buildSystemNotificationTitle(log, category, severity),
        description: buildSystemNotificationDescription(log, category),
        category,
        timestamp: getSystemTimestamp(log),
        status: 'unread' as SystemNotificationStatus,
        source: log,
      };
    });
};

const getSeverityMeta = (severity: SystemSeverity, status?: SystemNotificationStatus) => {
  if (status === 'resolved') {
    return {
      icon: CheckCircle2,
      label: 'Resolved',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      iconWrap: 'bg-emerald-50 text-emerald-700',
    };
  }

  if (severity === 'critical') {
    return {
      icon: ShieldAlert,
      label: 'Critical',
      badge: 'bg-red-50 text-red-700 border-red-100',
      iconWrap: 'bg-red-50 text-red-700',
    };
  }

  if (severity === 'warning') {
    return {
      icon: AlertTriangle,
      label: 'Warning',
      badge: 'bg-amber-50 text-amber-700 border-amber-100',
      iconWrap: 'bg-amber-50 text-amber-700',
    };
  }

  return {
    icon: Info,
    label: 'Info',
    badge: 'bg-blue-50 text-blue-700 border-blue-100',
    iconWrap: 'bg-blue-50 text-blue-700',
  };
};

function SystemNotificationsView({
  loading,
  error,
  systemSummary,
  systemFilters,
  setSystemFilters,
  filteredSystemNotifications,
  systemNotifications,
  paginatedSystemNotifications,
  systemPageStartIndex,
  systemPageEndIndex,
  safeSystemPage,
  systemTotalPages,
  setSystemPage,
  handleMarkAllSystemRead,
  updateSystemNotificationStatus,
  selectedSystemNotification,
  setSelectedSystemNotification,
}: any) {
  return (
    <div className="flex-1 bg-[#f3f7f5]">
      <Header title="System Notifications" breadcrumbs={['System', 'Notifications']} />

      <div className="space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Unread Notifications', value: systemSummary.unread, icon: Bell, color: 'bg-blue-50 text-blue-700 border-blue-100' },
            { label: 'Critical Alerts', value: systemSummary.critical, icon: ShieldAlert, color: 'bg-red-50 text-red-700 border-red-100' },
            { label: 'Security Alerts', value: systemSummary.security, icon: ShieldAlert, color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
            { label: 'System Warnings', value: systemSummary.warnings, icon: AlertTriangle, color: 'bg-amber-50 text-amber-700 border-amber-100' },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-2xl border border-emerald-900/5 bg-white p-5 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-600">{card.label}</p>
                    <p className="mt-2 text-3xl font-bold leading-none text-slate-950 tabular-nums">{card.value}</p>
                  </div>
                  <div className={'flex h-10 w-10 items-center justify-center rounded-2xl border ' + card.color}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-emerald-900/5 bg-white p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={systemFilters.search}
                onChange={(event) => setSystemFilters((filters: any) => ({ ...filters, search: event.target.value }))}
                placeholder="Search system notifications..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <select
              value={systemFilters.severity}
              onChange={(event) => setSystemFilters((filters: any) => ({ ...filters, severity: event.target.value }))}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            >
              {SYSTEM_SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity === 'All' ? 'All severities' : severity}</option>)}
            </select>
            <select
              value={systemFilters.type}
              onChange={(event) => setSystemFilters((filters: any) => ({ ...filters, type: event.target.value }))}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            >
              {SYSTEM_NOTIFICATION_TYPES.map((type) => <option key={type} value={type}>{type === 'All' ? 'All types' : type}</option>)}
            </select>
            <select
              value={systemFilters.status}
              onChange={(event) => setSystemFilters((filters: any) => ({ ...filters, status: event.target.value }))}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            >
              {SYSTEM_STATUSES.map((status) => <option key={status} value={status}>{status === 'All' ? 'All statuses' : status}</option>)}
            </select>
            {systemSummary.unread > 0 && (
              <Button type="button" variant="outline" size="sm" className="h-10 whitespace-nowrap" onClick={handleMarkAllSystemRead}>
                <Check className="mr-2 h-4 w-4" />
                Mark All as Read
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-950">Platform Alert Log</h2>
            <p className="mt-0.5 text-xs text-slate-500">Technical alerts, security notices, access-control events, and platform warnings.</p>
          </div>

          {loading ? (
            <p className="px-6 py-12 text-center text-sm text-slate-500">Loading system notifications...</p>
          ) : error ? (
            <p className="px-6 py-12 text-center text-sm text-destructive">{error}</p>
          ) : systemNotifications.length === 0 ? (
            <div className="flex justify-center px-6 py-14">
              <div className="max-w-sm text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Bell className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-950">No system notifications</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">Technical alerts, security notices, and platform warnings will appear here.</p>
              </div>
            </div>
          ) : filteredSystemNotifications.length === 0 ? (
            <div className="flex justify-center px-6 py-14">
              <div className="max-w-sm text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
                  <Bell className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-950">No matching system notifications</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">Adjust the filters to review other platform alerts.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3">Severity</th>
                      <th className="px-5 py-3">Notification</th>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3">Timestamp</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedSystemNotifications.map((notification: SystemNotification) => {
                      const meta = getSeverityMeta(notification.severity, notification.status);
                      const Icon = meta.icon;
                      const statusLabel = notification.status === 'unread' ? 'Unread' : notification.status === 'read' ? 'Read' : 'Resolved';

                      return (
                        <tr key={notification.id} className={notification.status === 'unread' ? 'bg-emerald-50/25' : 'hover:bg-slate-50/70'}>
                          <td className="px-5 py-4">
                            <span className={'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-bold ' + meta.badge}>
                              <Icon className="h-3.5 w-3.5" />
                              {meta.label}
                            </span>
                          </td>
                          <td className="max-w-xl px-5 py-4">
                            <p className="text-sm font-bold text-slate-950">{notification.title}</p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{notification.description}</p>
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-slate-700">{notification.category}</td>
                          <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{formatReadableDateTime(notification.timestamp) || 'Timestamp unavailable'}</td>
                          <td className="px-5 py-4">
                            <span className={'rounded-full px-2.5 py-1 text-xs font-bold ' + (notification.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : notification.status === 'unread' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600')}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              {notification.status === 'unread' && (
                                <Button type="button" variant="outline" size="sm" onClick={() => updateSystemNotificationStatus(notification.id, 'read')}>
                                  Mark as Read
                                </Button>
                              )}
                              {notification.status !== 'resolved' && (
                                <Button type="button" variant="outline" size="sm" onClick={() => updateSystemNotificationStatus(notification.id, 'resolved')}>
                                  Resolve
                                </Button>
                              )}
                              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedSystemNotification(notification)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 lg:hidden">
                {paginatedSystemNotifications.map((notification: SystemNotification) => {
                  const meta = getSeverityMeta(notification.severity, notification.status);
                  const Icon = meta.icon;
                  const statusLabel = notification.status === 'unread' ? 'Unread' : notification.status === 'read' ? 'Read' : 'Resolved';

                  return (
                    <div key={notification.id} className={'p-5 ' + (notification.status === 'unread' ? 'bg-emerald-50/25' : '')}>
                      <div className="flex items-start gap-3">
                        <div className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ' + meta.iconWrap}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className={'rounded-full border px-2.5 py-1 text-xs font-bold ' + meta.badge}>{meta.label}</span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{notification.category}</span>
                            <span className={'rounded-full px-2.5 py-1 text-xs font-bold ' + (notification.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : notification.status === 'unread' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600')}>{statusLabel}</span>
                          </div>
                          <p className="text-sm font-bold text-slate-950">{notification.title}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{notification.description}</p>
                          <p className="mt-2 text-xs text-slate-400">{formatReadableDateTime(notification.timestamp) || 'Timestamp unavailable'}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {notification.status === 'unread' && (
                              <Button type="button" variant="outline" size="sm" onClick={() => updateSystemNotificationStatus(notification.id, 'read')}>
                                Mark as Read
                              </Button>
                            )}
                            {notification.status !== 'resolved' && (
                              <Button type="button" variant="outline" size="sm" onClick={() => updateSystemNotificationStatus(notification.id, 'resolved')}>
                                Resolve
                              </Button>
                            )}
                            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedSystemNotification(notification)}>
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!loading && filteredSystemNotifications.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing {systemPageStartIndex + 1}-{systemPageEndIndex} of {filteredSystemNotifications.length} notification{filteredSystemNotifications.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSystemPage((page: number) => Math.max(1, page - 1))} disabled={safeSystemPage === 1}>
                  Previous
                </Button>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                  Page {safeSystemPage} of {systemTotalPages}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={() => setSystemPage((page: number) => Math.min(systemTotalPages, page + 1))} disabled={safeSystemPage === systemTotalPages}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        {selectedSystemNotification && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl border border-white/70 bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">System Notification</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-950">{selectedSystemNotification.title}</h3>
                </div>
                <button type="button" onClick={() => setSelectedSystemNotification(null)} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200">
                  Close
                </button>
              </div>
              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">Description</p>
                  <p className="mt-1 leading-6 text-slate-700">{selectedSystemNotification.description}</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase text-slate-500">Category</p>
                    <p className="mt-1 font-semibold text-slate-900">{selectedSystemNotification.category}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase text-slate-500">Timestamp</p>
                    <p className="mt-1 font-semibold text-slate-900">{formatReadableDateTime(selectedSystemNotification.timestamp) || 'Timestamp unavailable'}</p>
                  </div>
                </div>
                {selectedSystemNotification.source?.user_name && (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase text-slate-500">Source User</p>
                    <p className="mt-1 font-semibold text-slate-900">{selectedSystemNotification.source.user_name}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Notifications() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const isSystemAdmin = isSystemAdminRole(currentUser?.role);
  const canSendNotifications = canPerformAction(currentUser?.role, 'notifications.send');
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'failed'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [scheduleRows, setScheduleRows] = useState<PepScheduleRow[]>([]);
  const [upcomingReminders, setUpcomingReminders] = useState<UpcomingReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkScope, setBulkScope] = useState<'overdue' | 'due_today' | 'both'>('both');
  const [confirmationGroup, setConfirmationGroup] = useState<PatientReminderGroup | null>(null);
  const [smsService, setSmsService] = useState<SmsServiceState>({ enabled: false, mode: 'simulation', provider: null });
  const [notificationSummary, setNotificationSummary] = useState<NotificationSummary>({ overdue_patients: 0, failed_sms: 0, due_today_patients: 0, pending_sms: 0 });
  const [error, setError] = useState<string | null>(null);
  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([]);
  const [systemFilters, setSystemFilters] = useState({
    search: '',
    severity: 'All',
    type: 'All',
    status: 'All',
  });
  const [systemPage, setSystemPage] = useState(1);
  const [selectedSystemNotification, setSelectedSystemNotification] = useState<SystemNotification | null>(null);

  const loadLiveData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      if (isSystemAdmin) {
        const auditResponse = await auditLogsAPI.getAll({ per_page: 50 });
        setSystemNotifications(buildSystemNotifications(auditResponse.data || []));
        setNotifications([]);
        setScheduleRows([]);
        setUpcomingReminders([]);
        return;
      }

      const [notificationResponse, scheduleResponse] = await Promise.all([
        notificationsAPI.getAll(),
        pepScheduleAPI.getAll(),
      ]);

      setNotifications(notificationResponse.data || []);
      setSmsService(notificationResponse.meta?.sms_service || { enabled: false, mode: 'simulation', provider: null });
      setNotificationSummary(notificationResponse.meta?.summary || { overdue_patients: 0, failed_sms: 0, due_today_patients: 0, pending_sms: 0 });
      setScheduleRows(scheduleResponse.data || []);
      setUpcomingReminders(buildUpcomingReminders(scheduleResponse.data || []));
    } catch (loadError: any) {
      setError(loadError.message || 'Failed to load live notifications.');
      setNotifications([]);
      setSmsService({ enabled: false, mode: 'simulation', provider: null });
      setNotificationSummary({ overdue_patients: 0, failed_sms: 0, due_today_patients: 0, pending_sms: 0 });
      setScheduleRows([]);
      setUpcomingReminders([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadLiveData();
  }, [isSystemAdmin]);

  useEffect(() => {
    setSystemPage(1);
  }, [systemFilters.search, systemFilters.severity, systemFilters.type, systemFilters.status]);

  const smsNotifications = notifications.filter((notification) => normalizeNotificationType(notification) === 'SMS');
  const pendingCount = notificationSummary.pending_sms;
  const filterCounts = {
    all: smsNotifications.length,
    pending: pendingCount,
    sent: smsNotifications.filter((notification) => normalizeStatus(notification.status) === 'Sent').length,
    failed: smsNotifications.filter((notification) => normalizeStatus(notification.status) === 'Failed').length,
  };
  const filtered = smsNotifications
    .filter((notification) => {
      const status = normalizeStatus(notification.status);

      if (filter === 'pending') return status === 'Pending';
      if (filter === 'sent') return status === 'Sent';
      if (filter === 'failed') return status === 'Failed';
      return true;
    })
    .sort((a, b) => {
      const timestampA = new Date(getBestTimestamp(a)).getTime() || 0;
      const timestampB = new Date(getBestTimestamp(b)).getTime() || 0;
      return timestampB - timestampA;
    });
  const totalPages = Math.max(1, Math.ceil(filtered.length / NOTIFICATIONS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * NOTIFICATIONS_PER_PAGE;
  const pageEndIndex = Math.min(pageStartIndex + NOTIFICATIONS_PER_PAGE, filtered.length);
  const paginatedNotifications = filtered.slice(pageStartIndex, pageEndIndex);
  const patientReminderGroups = groupRemindersByPatient(upcomingReminders);
  const visiblePatientReminderGroups = patientReminderGroups.slice(0, UPCOMING_REMINDER_LIMIT);
  const dueTodayCount = notificationSummary.due_today_patients;
  const overduePatientCount = notificationSummary.overdue_patients;
  const getGroupActionTarget = (group: PatientReminderGroup) => group.overdue[0] || group.dueToday[0] || group.upcoming[0];
  const hasPendingReminder = (group: PatientReminderGroup) => {
    const target = getGroupActionTarget(group);
    return Boolean(target && notifications.some((notification) =>
      normalizeStatus(notification.status) === 'Pending'
      && String(notification.pep_schedule_id || getNotificationSchedule(notification, scheduleRows)?.id || '') === String(target.id)
      && String(notification.incident_id || '') === String(target.incidentId || group.incidentId || '')
    ));
  };
  const scopedBulkGroups = patientReminderGroups.filter((group) => {
    if (bulkScope === 'overdue') return group.overdue.length > 0;
    if (bulkScope === 'due_today') return group.dueToday.length > 0;
    return group.overdue.length > 0 || group.dueToday.length > 0;
  });
  const bulkMissingContactCount = scopedBulkGroups.filter((group) => !/^(09|\+639)\d{9}$/.test(group.contact)).length;
  const bulkDeclinedConsentCount = scopedBulkGroups.filter((group) => !group.smsConsent).length;
  const bulkAlreadyQueuedCount = scopedBulkGroups.filter(hasPendingReminder).length;
  const bulkEligibleGroups = scopedBulkGroups.filter((group) => /^(09|\+639)\d{9}$/.test(group.contact) && group.smsConsent && !hasPendingReminder(group));
  const bulkTargetCount = bulkEligibleGroups.length;
  const bulkReminderCount = bulkEligibleGroups.length;
  const filteredSystemNotifications = systemNotifications.filter((notification) => {
    const haystack = [
      notification.title,
      notification.description,
      notification.category,
      notification.status,
      notification.severity,
    ].join(' ').toLowerCase();
    const matchesSearch = !systemFilters.search.trim() || haystack.includes(systemFilters.search.trim().toLowerCase());
    const matchesSeverity = systemFilters.severity === 'All' || notification.severity === systemFilters.severity.toLowerCase();
    const matchesType = systemFilters.type === 'All' || notification.category === systemFilters.type;
    const matchesStatus = systemFilters.status === 'All' || notification.status === systemFilters.status.toLowerCase();

    return matchesSearch && matchesSeverity && matchesType && matchesStatus;
  });
  const systemTotalPages = Math.max(1, Math.ceil(filteredSystemNotifications.length / NOTIFICATIONS_PER_PAGE));
  const safeSystemPage = Math.min(systemPage, systemTotalPages);
  const systemPageStartIndex = (safeSystemPage - 1) * NOTIFICATIONS_PER_PAGE;
  const systemPageEndIndex = Math.min(systemPageStartIndex + NOTIFICATIONS_PER_PAGE, filteredSystemNotifications.length);
  const paginatedSystemNotifications = filteredSystemNotifications.slice(systemPageStartIndex, systemPageEndIndex);
  const systemSummary = {
    unread: systemNotifications.filter((notification) => notification.status === 'unread').length,
    critical: systemNotifications.filter((notification) => notification.status !== 'resolved' && notification.severity === 'critical').length,
    security: systemNotifications.filter((notification) => notification.status !== 'resolved' && notification.category === 'Security').length,
    warnings: systemNotifications.filter((notification) => notification.status !== 'resolved' && notification.severity === 'warning').length,
  };

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (systemPage > systemTotalPages) {
      setSystemPage(systemTotalPages);
    }
  }, [systemPage, systemTotalPages]);

  const handleFilterChange = (nextFilter: typeof filter) => {
    setFilter(nextFilter);
    setCurrentPage(1);
  };

  const sendPatientReminder = async (group: PatientReminderGroup, scope: 'overdue' | 'due_today' | 'both' | 'all' = 'all') => {
    const selectedDoses = scope === 'overdue'
      ? group.overdue
      : scope === 'due_today'
        ? group.dueToday
        : scope === 'both'
          ? [...group.overdue, ...group.dueToday]
          : [...group.overdue, ...group.dueToday, ...group.upcoming];
    const target = selectedDoses[0];

    if (!group.smsConsent) {
      throw new Error('Reminder skipped because explicit SMS consent is not available.');
    }

    if (!/^(09|\+639)\d{9}$/.test(group.contact) || !target) {
      throw new Error('Reminder skipped because a valid contact number is not available.');
    }

    const reminderType = group.overdue.length > 0 && scope !== 'due_today'
      ? 'Missed Appointment Follow-up'
      : scope === 'due_today'
        ? 'Due Today Vaccination Reminder'
        : 'Upcoming Vaccination Reminder';
    const existingPending = notifications.find((notification) =>
      normalizeStatus(notification.status) === 'Pending'
      && String(notification.pep_schedule_id || getNotificationSchedule(notification, scheduleRows)?.id || '') === String(target.id)
      && String(notification.incident_id || '') === String(target.incidentId || group.incidentId || '')
      && (notification.reminder_type || reminderType) === reminderType
    );

    if (existingPending) {
      throw new Error('This reminder is already queued. No duplicate was created.');
    }

    const doseSummary = selectedDoses.map((dose) => 'Day ' + dose.doseDay).join(', ');
    const message = group.overdue.length > 0 && scope !== 'due_today'
      ? 'BITEMAP Follow-up: ' + group.patient + ', your overdue anti-rabies vaccination dose(s) are ' + doseSummary + '. Please contact or visit the clinic.'
      : 'BITEMAP Reminder: ' + group.patient + ', your anti-rabies vaccination dose(s) ' + doseSummary + ' require attention based on your PEP schedule.';

    return notificationsAPI.sendSMS(group.contact, message, group.patientId, target.incidentId || group.incidentId, {
      pepScheduleId: String(target.id),
      reminderType,
      scheduledDate: target.dueDate.slice(0, 10),
    });
  };

  const handleSendReminder = async (group: PatientReminderGroup) => {
    try {
      setSending(group.key);
      const scope = group.overdue.length > 0 ? 'overdue' : group.dueToday.length > 0 ? 'due_today' : 'all';
      await sendPatientReminder(group, scope);
      toast.success((smsService.enabled ? 'SMS reminder sent for ' : 'Reminder queued for ') + group.patient + '.');
      await loadLiveData(false);
    } catch (sendError: any) {
      toast.error(sendError.message || 'Failed to send reminder.');
    } finally {
      setSending(null);
    }
  };

  const handleResend = async (notification: NotificationLog) => {
    try {
      const type = normalizeNotificationType(notification);
      const patientId = notification.patient_id || notification.patient?.id;
      const incidentId = notification.incident_id;

      if (type !== 'SMS') {
        toast.error('Only SMS reminders are supported in this module.');
        return;
      }

      await notificationsAPI.sendSMS(notification.recipient, notification.message, patientId ? String(patientId) : undefined, incidentId ? String(incidentId) : undefined, {
        pepScheduleId: notification.pep_schedule_id ? String(notification.pep_schedule_id) : undefined,
        reminderType: notification.reminder_type,
        scheduledDate: notification.scheduled_date,
        retryNotificationId: String(notification.id),
      });
      toast.success(smsService.enabled ? 'SMS retry processed.' : 'Reminder returned to the simulation queue.');
      await loadLiveData(false);
    } catch (resendError: any) {
      toast.error(resendError.message || 'Failed to resend notification.');
    }
  };

  const handleBulkReminder = async () => {
    const sendable = bulkEligibleGroups;

    if (sendable.length === 0) {
      toast.error('No eligible patients with contact numbers for the selected group.');
      return;
    }

    try {
      setBulkSending(true);
      for (const group of sendable) {
        await sendPatientReminder(group, bulkScope);
      }
      toast.success((smsService.enabled ? 'Bulk SMS reminders processed for ' : 'Bulk reminders queued for ') + sendable.length + ' patient' + (sendable.length !== 1 ? 's' : '') + '.');
      setBulkModalOpen(false);
      await loadLiveData(false);
    } catch (bulkError: any) {
      toast.error(bulkError.message || 'Failed to send bulk reminders.');
    } finally {
      setBulkSending(false);
    }
  };

  const updateSystemNotificationStatus = (id: string, status: SystemNotificationStatus) => {
    setSystemNotifications((items) => items.map((item) => item.id === id ? { ...item, status } : item));
  };

  const handleMarkAllSystemRead = () => {
    setSystemNotifications((items) => items.map((item) => item.status === 'unread' ? { ...item, status: 'read' } : item));
    toast.success('System notifications marked as read.');
  };

  if (isSystemAdmin) {
    return (
      <SystemNotificationsView
        loading={loading}
        error={error}
        systemSummary={systemSummary}
        systemFilters={systemFilters}
        setSystemFilters={setSystemFilters}
        filteredSystemNotifications={filteredSystemNotifications}
        systemNotifications={systemNotifications}
        paginatedSystemNotifications={paginatedSystemNotifications}
        systemPageStartIndex={systemPageStartIndex}
        systemPageEndIndex={systemPageEndIndex}
        safeSystemPage={safeSystemPage}
        systemTotalPages={systemTotalPages}
        setSystemPage={setSystemPage}
        handleMarkAllSystemRead={handleMarkAllSystemRead}
        updateSystemNotificationStatus={updateSystemNotificationStatus}
        selectedSystemNotification={selectedSystemNotification}
        setSelectedSystemNotification={setSelectedSystemNotification}
      />
    );
  }

  const dashboardCards = [
    { label: 'Pending SMS', value: pendingCount, icon: Clock3, tone: 'border-amber-100 bg-amber-50 text-amber-700' },
    { label: 'Patients Due Today', value: dueTodayCount, icon: CalendarDays, tone: 'border-blue-100 bg-blue-50 text-blue-700' },
    { label: 'Overdue Patients', value: overduePatientCount, icon: AlertTriangle, tone: 'border-red-100 bg-red-50 text-red-700' },
    smsService.enabled
      ? { label: 'Successfully Sent SMS', value: filterCounts.sent, description: 'SMS reminders are delivered through ' + (smsService.provider || 'the configured provider') + '.', icon: CheckCircle2, tone: 'border-emerald-100 bg-emerald-50 text-emerald-700' }
      : {
          label: 'SMS Service Status',
          value: 'Simulation Mode',
          description: 'No real SMS messages are sent. Reminders are recorded as Pending for testing and review.',
          icon: ShieldAlert,
          tone: 'border-slate-200 bg-slate-50 text-slate-700',
          statusCard: true,
        },
  ];

  return (
    <div className="min-h-screen flex-1 bg-[#f4f7f5]">
      <Header title="Notifications & Reminders" breadcrumbs={['Clinic Workflow', 'Notifications']} />

      <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <section aria-labelledby="notifications-dashboard-heading">
          <div className="mb-3">
            <h2 id="notifications-dashboard-heading" className="text-lg font-extrabold text-foreground">Notifications Dashboard</h2>
            <p className="mt-1 text-sm text-muted-foreground">A quick view of reminder delivery and PEP appointments needing attention.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {dashboardCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">{card.label}</p>
                      <p className="mt-2 text-3xl font-extrabold tabular-nums text-foreground">{loading ? '—' : card.value}</p>
                    </div>
                    <div className={'flex h-11 w-11 items-center justify-center rounded-2xl border ' + card.tone}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  {card.description && <p className="mt-2 text-xs leading-5 text-muted-foreground">{card.description}</p>}
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="notification-history-heading" className="order-2 space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex flex-col gap-4 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 px-5 py-4 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2"><History className="h-4 w-4" /><h2 id="notification-history-heading" className="text-base font-bold text-white">Notification History</h2></div>
                    <p className="mt-1 text-xs text-emerald-50/80">SMS delivery records linked to patient vaccination schedules.</p>
                  </div>
                  {pendingCount > 0 && (
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-emerald-50 ring-1 ring-white/20">
                      {pendingCount} pending
                    </span>
                  )}
                </div>
                <div className="flex max-w-full overflow-x-auto rounded-lg bg-white/12 p-0.5 text-xs ring-1 ring-white/15">
                  {(['all', 'pending', 'sent', 'failed'] as const).map((item) => (
                    <button
                      key={item}
                      onClick={() => handleFilterChange(item)}
                      className={
                        'px-2.5 py-1 rounded-md transition-colors font-medium capitalize ' +
                        (filter === item ? 'bg-white text-emerald-900 shadow-sm' : 'text-emerald-50/80 hover:text-white')
                      }
                    >
                      {item} <span className={(filter === item ? 'text-emerald-700' : 'text-emerald-50/70') + ' text-[10px]'}>({filterCounts[item]})</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-border">
                {loading ? (
                  <p className="px-6 py-10 text-center text-sm text-muted-foreground">Loading live notifications...</p>
                ) : error ? (
                  <p className="px-6 py-10 text-center text-sm text-destructive">{error}</p>
                ) : filtered.length === 0 ? (
                  <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                    {filter === 'pending' && 'No pending SMS reminders.'}
                    {filter === 'sent' && 'No sent SMS reminders.'}
                    {filter === 'failed' && 'No failed SMS reminders.'}
                    {filter === 'all' && 'No SMS reminders recorded yet.'}
                  </p>
                ) : paginatedNotifications.map((notification) => {
                  const status = normalizeStatus(notification.status);
                  const schedule = getNotificationSchedule(notification, scheduleRows);
                  const patientName = notification.patient?.full_name || 'Unknown Patient';
                  const isOverdueReminder = schedule?.scheduled_date && parseDateOnly(schedule.scheduled_date.slice(0, 10)) < parseDateOnly(toDateKey(new Date()));
                  const reminderType = isOverdueReminder ? 'Missed Appointment Follow-up' : 'Vaccination Reminder';

                  return (
                    <article key={notification.id} className="px-5 py-4 transition-colors hover:bg-muted/25">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="neutral" size="sm">SMS</Badge>
                              <Badge variant={getStatusVariant(status)} size="sm">{status}</Badge>
                            </div>
                          </div>
                          <p className="hidden">
                            {patientName ? patientName + ' • ' : ''}{notification.recipient}
                          </p>
                          <h3 className="mt-2 text-sm font-bold text-foreground">{patientName}</h3>
                          <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 text-xs sm:grid-cols-4">
                            <div><p className="font-semibold uppercase tracking-wide text-muted-foreground">Dose</p><p className="mt-1 font-medium text-foreground">{schedule ? 'Day ' + schedule.dose_day : 'PEP Dose'}</p></div>
                            <div><p className="font-semibold uppercase tracking-wide text-muted-foreground">Reminder Type</p><p className="mt-1 font-medium text-foreground">{reminderType}</p></div>
                            <div><p className="font-semibold uppercase tracking-wide text-muted-foreground">Scheduled</p><p className="mt-1 font-medium text-foreground">{schedule ? formatDate(schedule.scheduled_date) : 'Not linked'}</p></div>
                            <div><p className="font-semibold uppercase tracking-wide text-muted-foreground">Created</p><p className="mt-1 font-medium text-foreground">{formatDate(notification.created_at || getSentAt(notification))}</p></div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                            <p className={'text-xs font-medium ' + (status === 'Sent' ? 'text-emerald-700' : status === 'Failed' ? 'text-destructive' : 'text-amber-700')}>
                              {status === 'Sent' ? 'Delivered successfully.' : status === 'Failed' ? 'SMS delivery failed.' : smsService.enabled ? 'SMS is pending dispatch.' : 'Reminder queued in simulation mode.'}
                            </p>
                            {canSendNotifications && status === 'Pending' && (
                              <Button type="button" variant="outline" size="sm" disabled>
                                <Check className="mr-2 h-4 w-4" /> {smsService.enabled ? 'Pending' : 'Queued'}
                              </Button>
                            )}
                            {canSendNotifications && status === 'Failed' && (
                              <Button type="button" variant="outline" size="sm" onClick={() => handleResend(notification)}>
                                <MessageSquare className="mr-2 h-4 w-4" /> {smsService.enabled ? 'Retry SMS' : 'Retry Queue'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading notifications...</p>
                ) : filtered.length > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Showing {pageStartIndex + 1}-{pageEndIndex} of {filtered.length} notification{filtered.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        disabled={safeCurrentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                        Page {safeCurrentPage} of {totalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                        disabled={safeCurrentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </section>

          <section aria-labelledby="upcoming-reminders-heading" className="order-1 space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-2 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 px-5 py-4 text-white shadow-sm">
                <Bell className="w-4 h-4 text-emerald-50" />
                <div>
                  <h2 id="upcoming-reminders-heading" className="text-base font-bold text-white">Upcoming Reminders</h2>
                  <p className="mt-1 text-xs text-emerald-50/80">Overdue, due today, and upcoming doses within seven days.</p>
                </div>
              </div>
              <div className="relative p-2 sm:p-5">
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Loading PEP schedules...</p>
                  ) : patientReminderGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No upcoming PEP reminders in the next 7 days.</p>
                  ) : visiblePatientReminderGroups.map((group) => (
                    <article key={group.key} data-reminder-card className="min-w-0 self-start overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                      <div className="border-b border-border/70 px-2 py-3 sm:px-4 sm:py-3.5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-start gap-2 sm:gap-2.5">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-bg text-primary sm:h-8 sm:w-8">
                              <UserRound className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="break-words text-[13px] font-bold leading-5 text-foreground sm:text-sm">{group.patient}</h3>
                              <p className="mt-0.5 flex items-center gap-0.5 text-[9px] tracking-tight text-muted-foreground sm:gap-1.5 sm:text-xs sm:tracking-normal"><Phone className="hidden h-3.5 w-3.5 shrink-0 sm:block" /> {group.contact || 'No contact number'}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 sm:justify-end">
                            {group.overdue.length > 0 && <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 sm:px-2.5 sm:text-[11px]">{group.overdue.length} Overdue</span>}
                            {group.dueToday.length > 0 && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 sm:px-2.5 sm:text-[11px]">{group.dueToday.length > 1 ? group.dueToday.length + ' Due Today' : 'Due Today'}</span>}
                            {group.upcoming.length > 0 && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 sm:px-2.5 sm:text-[11px]">{group.upcoming.length} Upcoming</span>}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 px-2 py-3 sm:px-4 sm:py-3.5">
                        {group.overdue.length > 0 && (
                          <section className="overflow-hidden rounded-lg border border-rose-100 bg-rose-50/55">
                            <p className="border-b border-rose-100 px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-rose-700 sm:px-3">Overdue</p>
                            <div className="divide-y divide-rose-100/80">
                              {group.overdue.map((dose) => (
                                <div key={dose.id} data-schedule-row className="grid gap-0.5 px-2 py-2.5 text-[10px] sm:grid-cols-[4rem_minmax(7rem,1fr)_auto] sm:items-center sm:gap-3 sm:px-3 sm:text-xs">
                                  <span className="font-bold text-foreground">Day {dose.doseDay}</span>
                                  <span className="text-muted-foreground">{formatDate(dose.dueDate)}</span>
                                  <span className="whitespace-nowrap font-semibold text-rose-700 sm:text-right">{getDaysOverdue(dose.dueDate)} day{getDaysOverdue(dose.dueDate) !== 1 ? 's' : ''} overdue</span>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}
                        {group.dueToday.length > 0 && (
                          <section className="overflow-hidden rounded-lg border border-amber-100 bg-amber-50/55">
                            <p className="border-b border-amber-100 px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-700 sm:px-3">Due Today</p>
                            <div className="divide-y divide-amber-100/80">
                              {group.dueToday.map((dose) => (
                                <div key={dose.id} data-schedule-row className="grid gap-0.5 px-2 py-2.5 text-[10px] sm:grid-cols-[4rem_minmax(7rem,1fr)_auto] sm:items-center sm:gap-3 sm:px-3 sm:text-xs">
                                  <span className="font-bold text-foreground">Day {dose.doseDay}</span>
                                  <span className="text-muted-foreground">{formatDate(dose.dueDate)}</span>
                                  <span className="font-semibold text-amber-700 sm:whitespace-nowrap sm:text-right">Due today</span>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}
                        {group.upcoming.length > 0 && (
                          <section className="overflow-hidden rounded-lg border border-emerald-100 bg-emerald-50/50">
                            <p className="border-b border-emerald-100 px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700 sm:px-3">Upcoming</p>
                            <div className="divide-y divide-emerald-100/80">
                              {group.upcoming.map((dose) => (
                                <div key={dose.id} data-schedule-row className="grid gap-0.5 px-2 py-2.5 text-[10px] sm:grid-cols-[4rem_minmax(7rem,1fr)_auto] sm:items-center sm:gap-3 sm:px-3 sm:text-xs">
                                  <span className="font-bold text-foreground">Day {dose.doseDay}</span>
                                  <span className="text-muted-foreground">{formatDate(dose.dueDate)}</span>
                                  <span className="font-semibold text-emerald-700 sm:whitespace-nowrap sm:text-right">In {getDaysUntil(dose.dueDate)} day{getDaysUntil(dose.dueDate) !== 1 ? 's' : ''}</span>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}
                      </div>

                      {(!group.smsConsent || (group.smsConsent && !/^(09|\+639)\d{9}$/.test(group.contact)) || hasPendingReminder(group)) && (
                        <div className="mx-4 mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                          {!group.smsConsent ? 'Reminder unavailable: explicit SMS consent was declined or not recorded.' : !/^(09|\+639)\d{9}$/.test(group.contact) ? 'Reminder unavailable: a valid contact number is required.' : 'This reminder is already queued.'}
                        </div>
                      )}
                      <div className="flex flex-col gap-2 border-t border-border/70 bg-muted/15 px-2 py-3 sm:flex-row sm:flex-wrap sm:px-4">
                        {group.patientId && <Button type="button" variant="outline" size="sm" className="h-auto min-h-8 max-w-full !whitespace-normal break-words px-2 py-2 text-center text-[10px] leading-4 sm:text-xs" onClick={() => navigate('/patients/' + group.patientId)}>View Patient</Button>}
                        {group.incidentId && <Button type="button" variant="outline" size="sm" className="h-auto min-h-8 max-w-full !whitespace-normal break-words px-2 py-2 text-center text-[10px] leading-4 sm:text-xs" onClick={() => navigate('/pep-schedule?incident_id=' + encodeURIComponent(group.incidentId || ''))}>Open PEP Schedule</Button>}
                        {canSendNotifications && (
                          <Button type="button" size="sm" className="h-auto min-h-8 max-w-full !whitespace-normal break-words px-2 py-2 text-center text-[10px] leading-4 sm:ml-auto sm:text-xs" disabled={sending === group.key || !group.smsConsent || !/^(09|\+639)\d{9}$/.test(group.contact) || hasPendingReminder(group)} onClick={() => setConfirmationGroup(group)}>
                            <MessageSquare className="mr-2 hidden h-4 w-4 sm:block" /> {hasPendingReminder(group) ? (smsService.enabled ? 'Pending' : 'Queued') : group.overdue.length > 0 ? (smsService.enabled ? 'Send Follow-up Reminder' : 'Queue Follow-up Reminder') : (smsService.enabled ? 'Send Reminder' : 'Queue Reminder')}
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                {patientReminderGroups.length > UPCOMING_REMINDER_LIMIT && (
                  <p className="mt-4 rounded-full bg-muted px-3 py-1.5 text-center text-xs font-semibold text-muted-foreground">
                    Showing the first {UPCOMING_REMINDER_LIMIT} patients requiring attention
                  </p>
                )}
              </div>
            </div>

            {canSendNotifications && (
              <Button
                variant="primary"
                size="md"
                className="h-auto min-h-10 w-full max-w-full !whitespace-normal px-2 py-2 leading-4 sm:px-4"
                onClick={() => setBulkModalOpen(true)}
                disabled={bulkSending || (overduePatientCount === 0 && dueTodayCount === 0)}
              >
                <Bell className="mr-2 hidden h-4 w-4 sm:block" />
                {bulkSending ? 'Processing...' : smsService.enabled ? 'Send Bulk Reminder' : 'Queue Bulk Reminders'}
              </Button>
            )}
          </section>
        </div>
      </main>

      {confirmationGroup && canSendNotifications && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="follow-up-reminder-title">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="follow-up-reminder-title" className="text-lg font-extrabold text-foreground">{smsService.enabled ? 'Send Follow-up Reminder?' : 'Queue Follow-up Reminder?'}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Review the patient and reminder details before continuing.</p>
              </div>
              <button type="button" aria-label="Close follow-up reminder" onClick={() => setConfirmationGroup(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient</p>
              <p className="mt-1 text-sm font-bold text-foreground">{confirmationGroup.patient}</p>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact Number</p><p className="mt-1 font-medium text-foreground">{confirmationGroup.contact}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SMS Service Mode</p><p className="mt-1 font-medium text-foreground">{smsService.enabled ? 'SMS Service Enabled' : 'Simulation Mode'}</p></div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {confirmationGroup.overdue.length > 0 && <div>
                  <p className="text-xs font-bold text-red-700">Overdue Doses</p>
                  <ul className="mt-1 space-y-1 text-sm text-foreground">
                    {confirmationGroup.overdue.map((dose) => <li key={dose.id}>- Day {dose.doseDay} ({formatDate(dose.dueDate)})</li>)}
                  </ul>
                </div>}
                {confirmationGroup.dueToday.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-amber-700">Due Today</p>
                    <ul className="mt-1 space-y-1 text-sm text-foreground">
                      {confirmationGroup.dueToday.map((dose) => <li key={dose.id}>- Day {dose.doseDay} ({formatDate(dose.dueDate)})</li>)}
                    </ul>
                  </div>
                )}
                {confirmationGroup.upcoming.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-emerald-700">Upcoming</p>
                    <ul className="mt-1 space-y-1 text-sm text-foreground">
                      {confirmationGroup.upcoming.map((dose) => <li key={dose.id}>- Day {dose.doseDay} ({formatDate(dose.dueDate)})</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Message Preview</p>
              <p className="mt-2 text-sm leading-6 text-emerald-950">
                {confirmationGroup.overdue.length > 0
                  ? 'You have missed your scheduled anti-rabies vaccination appointment. Please visit the clinic immediately.'
                  : 'This is a reminder that your scheduled anti-rabies vaccination requires attention. Please visit the clinic as scheduled.'}
              </p>
            </div>

            {!smsService.enabled && <p className="mt-3 text-xs text-muted-foreground">Simulation Mode: this reminder will be queued locally and no actual SMS will be sent.</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmationGroup(null)}>Cancel</Button>
              <Button type="button" disabled={sending === confirmationGroup.key} onClick={async () => { await handleSendReminder(confirmationGroup); setConfirmationGroup(null); }}>
                {sending === confirmationGroup.key ? 'Processing...' : smsService.enabled ? 'Confirm and Send SMS' : 'Confirm Queue'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {bulkModalOpen && canSendNotifications && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="bulk-reminder-title">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="bulk-reminder-title" className="text-lg font-extrabold text-foreground">{smsService.enabled ? 'Send Bulk Reminder' : 'Queue Bulk Reminders'}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Review the scope and eligibility summary before confirming.</p>
              </div>
              <button type="button" aria-label="Close bulk reminder" onClick={() => setBulkModalOpen(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-red-100 bg-red-50 p-3"><p className="text-2xl font-extrabold text-red-700">{overduePatientCount}</p><p className="text-xs font-semibold text-red-700">Overdue Patients</p></div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="text-2xl font-extrabold text-amber-700">{dueTodayCount}</p><p className="text-xs font-semibold text-amber-700">Due Today</p></div>
            </div>

            <fieldset className="mt-5 space-y-2">
              <legend className="mb-2 text-sm font-bold text-foreground">Send reminders to</legend>
              {[
                { value: 'overdue', label: 'Overdue only' },
                { value: 'due_today', label: 'Due Today only' },
                { value: 'both', label: 'Both' },
              ].map((option) => (
                <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-sm font-medium text-foreground hover:bg-muted/30">
                  <input type="radio" name="bulk-reminder-scope" value={option.value} checked={bulkScope === option.value} onChange={() => setBulkScope(option.value as typeof bulkScope)} className="h-4 w-4 text-primary focus:ring-primary" />
                  {option.label}
                </label>
              ))}
            </fieldset>

            <div className="mt-4 grid gap-2 rounded-xl border border-border bg-muted/20 p-3 text-xs sm:grid-cols-2">
              <p><span className="font-semibold text-foreground">Selected scope:</span> {bulkScope === 'overdue' ? 'Overdue only' : bulkScope === 'due_today' ? 'Due Today only' : 'Overdue and Due Today'}</p>
              <p><span className="font-semibold text-foreground">Current SMS mode:</span> {smsService.enabled ? 'SMS Service Enabled' : 'Simulation Mode'}</p>
              <p><span className="font-semibold text-foreground">Eligible patients:</span> {bulkTargetCount}</p>
              <p><span className="font-semibold text-foreground">Reminders:</span> {bulkReminderCount}</p>
              <p><span className="font-semibold text-foreground">Skipped — missing/invalid number:</span> {bulkMissingContactCount}</p>
              <p><span className="font-semibold text-foreground">Skipped — consent unavailable:</span> {bulkDeclinedConsentCount}</p>
              <p><span className="font-semibold text-foreground">Skipped — already queued:</span> {bulkAlreadyQueuedCount}</p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Skipped patients are summarized by reason; no patient details are exposed here.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setBulkModalOpen(false)} disabled={bulkSending}>Cancel</Button>
              <Button type="button" onClick={handleBulkReminder} disabled={bulkSending || bulkTargetCount === 0}>{bulkSending ? 'Processing...' : smsService.enabled ? 'Confirm and Send SMS' : 'Confirm Queue'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
