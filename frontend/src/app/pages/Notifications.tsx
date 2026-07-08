import { useEffect, useMemo, useState } from 'react';
import { Bell, MessageSquare } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { toast } from 'sonner';
import { notificationsAPI, pepScheduleAPI } from '../../lib/services/api';
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

const NOTIFICATIONS_PER_PAGE = 10;
const UPCOMING_REMINDER_LIMIT = 5;

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

  const loadLiveData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      if (isSystemAdmin) {
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

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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

  if (isSystemAdmin) {
    return (
      <div className="flex-1">
        <Header title="System Notifications" breadcrumbs={['System', 'Notifications']} />

        <div className="p-8">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary-bg flex items-center justify-center text-primary">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">System Notifications</h2>
                <p className="text-xs text-muted-foreground">Technical platform notices and access-control alerts.</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">No system notifications recorded.</p>
          </div>
        </div>
      </div>
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
