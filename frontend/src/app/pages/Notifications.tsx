import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Eye,
  Info,
  MessageSquare,
  Search,
  ShieldAlert,
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
const UPCOMING_REMINDER_LIMIT = 5;
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
    .filter((row) => row.incident?.sms_consent !== false)
    .filter((row) => {
      const scheduleDate = parseDateOnly(row.scheduled_date.slice(0, 10));
      return scheduleDate >= today && scheduleDate <= nextWeek;
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
    }));
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
  const currentUser = getStoredUser();
  const isSystemAdmin = isSystemAdminRole(currentUser?.role);
  const canSendNotifications = canPerformAction(currentUser?.role, 'notifications.send');
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'failed'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [upcomingReminders, setUpcomingReminders] = useState<UpcomingReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<number | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
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
        setUpcomingReminders([]);
        return;
      }

      const [notificationResponse, scheduleResponse] = await Promise.all([
        notificationsAPI.getAll(),
        pepScheduleAPI.getAll(),
      ]);

      setNotifications(notificationResponse.data || []);
      setUpcomingReminders(buildUpcomingReminders(scheduleResponse.data || []));
    } catch (loadError: any) {
      setError(loadError.message || 'Failed to load live notifications.');
      setNotifications([]);
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
  const pendingCount = smsNotifications.filter((notification) => normalizeStatus(notification.status) === 'Pending').length;
  const todayKey = toDateKey(new Date());
  const todaysNotifications = smsNotifications.filter((notification) => getBestTimestamp(notification).slice(0, 10) === todayKey);
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
  const visibleUpcomingReminders = upcomingReminders.slice(0, UPCOMING_REMINDER_LIMIT);
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

  const statistics = useMemo(() => ([
    {
      label: 'Total SMS Sent Today',
      value: todaysNotifications.filter((notification) => normalizeStatus(notification.status) === 'Sent').length,
      color: 'text-foreground'
    },
    {
      label: 'Pending SMS',
      value: filterCounts.pending,
      color: 'text-warning'
    },
    {
      label: 'Sent SMS',
      value: filterCounts.sent,
      color: 'text-foreground'
    },
    {
      label: 'Failed SMS',
      value: filterCounts.failed,
      color: 'text-destructive'
    },
  ]), [smsNotifications, todayKey]);

  const sendReminder = async (reminder: UpcomingReminder) => {
    const message = 'BITEMAP Reminder: ' + reminder.patient + ', your Day ' + reminder.doseDay + ' anti-rabies vaccination is scheduled on ' + reminder.dueDate + '.';

    if (!reminder.contact) {
      toast.error('No contact number on file for ' + reminder.patient + '.');
      return;
    }

    await notificationsAPI.sendSMS(reminder.contact, message, reminder.patientId, reminder.incidentId);
    toast.success('SMS reminder logged for ' + reminder.patient + '.');
  };

  const handleSendReminder = async (reminder: UpcomingReminder) => {
    try {
      setSending(reminder.id);
      await sendReminder(reminder);
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

      await notificationsAPI.sendSMS(notification.recipient, notification.message, patientId ? String(patientId) : undefined, incidentId ? String(incidentId) : undefined);
      toast.success('SMS reminder logged again.');
      await loadLiveData(false);
    } catch (resendError: any) {
      toast.error(resendError.message || 'Failed to resend notification.');
    }
  };

  const handleBulkReminder = async () => {
    const sendable = upcomingReminders.filter((reminder) => reminder.contact);

    if (sendable.length === 0) {
      toast.error('No upcoming reminders with contact numbers.');
      return;
    }

    try {
      setBulkSending(true);
      for (const reminder of sendable) {
        await sendReminder(reminder);
      }
      toast.success('Bulk SMS reminders logged for ' + sendable.length + ' patient' + (sendable.length !== 1 ? 's' : '') + '.');
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

  return (
    <div className="flex-1">
      <Header title="Notifications & Reminders" breadcrumbs={['System', 'Notifications']} />

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between gap-4 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 px-6 py-4 text-white shadow-sm">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-white">Notification Log</h2>
                  {pendingCount > 0 && (
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-emerald-50 ring-1 ring-white/20">
                      {pendingCount} pending
                    </span>
                  )}
                </div>
                <div className="flex rounded-lg bg-white/12 p-0.5 text-xs ring-1 ring-white/15">
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
                  const type = normalizeNotificationType(notification);
                  const status = normalizeStatus(notification.status);
                  const isUnread = notification.read === false || status === 'Pending';
                  const patientName = notification.patient?.full_name;
                  const contactLabel = patientName ? patientName + ' - ' + notification.recipient : notification.recipient;

                  return (
                    <div
                      key={notification.id}
                      className={'p-5 hover:bg-muted/30 transition-colors ' + (isUnread ? 'bg-primary-bg/20' : '')}
                    >
                      <div className="flex items-start gap-4">
                        <div className={
                          'w-9 h-9 rounded-full flex items-center justify-center shrink-0 ' +
                          'bg-accent-bg'
                        }>
                          <MessageSquare className="w-4 h-4 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="neutral" size="sm">{type}</Badge>
                              <Badge variant={getStatusVariant(status)} size="sm">{status}</Badge>
                              {isUnread && <span className="w-2 h-2 bg-primary rounded-full inline-block" />}
                            </div>
                            {canSendNotifications && status === 'Failed' && (
                              <button
                                onClick={() => handleResend(notification)}
                                className="text-xs text-primary font-medium hover:underline shrink-0"
                              >
                                Resend
                              </button>
                            )}
                          </div>
                          <p className="hidden">
                            {patientName ? patientName + ' • ' : ''}{notification.recipient}
                          </p>
                          <p className="text-xs text-muted-foreground mb-1">{contactLabel}</p>
                          <p className="text-sm text-foreground mb-1">{notification.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {getTimestampLabel(notification)}
                          </p>
                        </div>
                      </div>
                    </div>
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
          </div>

          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="mb-4 flex items-center gap-2 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 px-5 py-4 text-white shadow-sm">
                <Bell className="w-4 h-4 text-emerald-50" />
                <h3 className="text-sm font-semibold text-white">Upcoming Reminders</h3>
              </div>
              <div className="relative px-5 pb-5">
                <div className="space-y-4">
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Loading PEP schedules...</p>
                  ) : upcomingReminders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No upcoming PEP reminders in the next 7 days.</p>
                  ) : visibleUpcomingReminders.map((reminder) => (
                    <div key={reminder.id} className="pb-4 border-b border-border last:border-0 last:pb-0">
                      <p className="text-sm font-medium text-foreground mb-0.5">{reminder.patient}</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Day {reminder.doseDay} dose - {formatDate(reminder.dueDate)}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">{reminder.contact || 'No contact number'}</p>
                      {canSendNotifications && (
                        <button
                          disabled={sending === reminder.id || !reminder.contact}
                          onClick={() => handleSendReminder(reminder)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs font-medium transition-colors hover:border-primary/30 hover:bg-primary-bg hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <MessageSquare className="w-3 h-3" /> Send SMS
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {upcomingReminders.length > UPCOMING_REMINDER_LIMIT && (
                  <p className="mt-4 rounded-full bg-muted px-3 py-1.5 text-center text-xs font-semibold text-muted-foreground">
                    Showing next {UPCOMING_REMINDER_LIMIT} reminders
                  </p>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-3">Statistics</h3>
              <div className="space-y-2.5">
                {statistics.map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{stat.label}</span>
                    <span className={'font-semibold ' + stat.color}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {canSendNotifications && (
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={handleBulkReminder}
                disabled={bulkSending || upcomingReminders.length === 0}
              >
                <Bell className="w-4 h-4 mr-2" />
                {bulkSending ? 'Sending...' : 'Send Bulk Reminder'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
