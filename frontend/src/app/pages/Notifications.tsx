import { useEffect, useMemo, useState } from 'react';
import { Bell, Mail, MessageSquare } from 'lucide-react';
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
  created_at?: string;
  read?: boolean;
  patient_id?: number | string;
  incident_id?: number | string;
  patient?: {
    id?: number | string;
    full_name?: string;
    contact_number?: string;
    email?: string;
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
    email?: string;
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
  email: string;
  patientId?: string;
  incidentId?: string;
};

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
      email: row.patient?.email || '',
      patientId: row.patient?.id ? String(row.patient.id) : undefined,
      incidentId: row.incident_id ? String(row.incident_id) : undefined,
    }))
    .slice(0, 8);
};

export function Notifications() {
  const currentUser = getStoredUser();
  const isSystemAdmin = isSystemAdminRole(currentUser?.role);
  const canSendNotifications = canPerformAction(currentUser?.role, 'notifications.send');
  const [filter, setFilter] = useState<'all' | 'unread' | 'sent'>('all');
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

  const filtered = notifications.filter((notification) => {
    const type = normalizeNotificationType(notification);
    const isUnread = notification.read === false || notification.status === 'Pending';

    if (filter === 'unread') return isUnread;
    if (filter === 'sent') return notification.status === 'Sent' || notification.status === 'Delivered';
    return type === 'SMS' || type === 'Email' || type === 'Both';
  });

  const unreadCount = notifications.filter((notification) => notification.read === false || notification.status === 'Pending').length;
  const todayKey = toDateKey(new Date());
  const todaysNotifications = notifications.filter((notification) => getSentAt(notification).slice(0, 10) === todayKey);

  const statistics = useMemo(() => ([
    {
      label: 'Total Sent (Today)',
      value: todaysNotifications.filter((notification) => notification.status === 'Sent' || notification.status === 'Delivered').length,
      color: 'text-foreground'
    },
    {
      label: 'SMS Sent',
      value: notifications.filter((notification) => normalizeNotificationType(notification) === 'SMS' && (notification.status === 'Sent' || notification.status === 'Delivered')).length,
      color: 'text-foreground'
    },
    {
      label: 'Emails Sent',
      value: notifications.filter((notification) => normalizeNotificationType(notification) === 'Email' && (notification.status === 'Sent' || notification.status === 'Delivered')).length,
      color: 'text-foreground'
    },
    {
      label: 'Failed',
      value: notifications.filter((notification) => notification.status === 'Failed').length,
      color: 'text-destructive'
    },
    {
      label: 'Pending',
      value: notifications.filter((notification) => notification.status === 'Pending').length,
      color: 'text-warning'
    },
  ]), [notifications, todayKey]);

  const sendReminder = async (reminder: UpcomingReminder, channel: 'SMS' | 'Email') => {
    const message = 'BITEMAP Reminder: ' + reminder.patient + ', your Day ' + reminder.doseDay + ' anti-rabies vaccination is scheduled on ' + reminder.dueDate + '.';

    if (channel === 'SMS') {
      if (!reminder.contact) {
        toast.error('No contact number on file for ' + reminder.patient + '.');
        return;
      }

      await notificationsAPI.sendSMS(reminder.contact, message, reminder.patientId, reminder.incidentId);
      toast.success('SMS reminder logged for ' + reminder.patient + '.');
      return;
    }

    if (!reminder.email) {
      toast.error('No email address on file for ' + reminder.patient + '.');
      return;
    }

    await notificationsAPI.sendEmail(reminder.email, 'BITEMAP PEP Reminder', message, reminder.patientId, reminder.incidentId);
    toast.success('Email reminder logged for ' + reminder.patient + '.');
  };

  const handleSendReminder = async (reminder: UpcomingReminder, channel: 'SMS' | 'Email') => {
    try {
      setSending(reminder.id);
      await sendReminder(reminder, channel);
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

      if (type === 'Email') {
        await notificationsAPI.sendEmail(notification.recipient, 'BITEMAP PEP Reminder', notification.message, patientId ? String(patientId) : undefined, incidentId ? String(incidentId) : undefined);
      } else {
        await notificationsAPI.sendSMS(notification.recipient, notification.message, patientId ? String(patientId) : undefined, incidentId ? String(incidentId) : undefined);
      }

      toast.success(type + ' reminder logged again.');
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
        await sendReminder(reminder, 'SMS');
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
              <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-foreground">Notification Log</h2>
                  {unreadCount > 0 && (
                    <span className="text-xs font-semibold text-primary bg-primary-bg px-2 py-0.5 rounded-full">
                      {unreadCount} pending
                    </span>
                  )}
                </div>
                <div className="flex bg-muted rounded-lg p-0.5 gap-0.5 text-xs">
                  {(['all', 'unread', 'sent'] as const).map((item) => (
                    <button
                      key={item}
                      onClick={() => setFilter(item)}
                      className={
                        'px-2.5 py-1 rounded-md transition-colors font-medium capitalize ' +
                        (filter === item ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')
                      }
                    >
                      {item === 'unread' ? 'Pending' : item}
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
                  <p className="px-6 py-10 text-center text-sm text-muted-foreground">No notifications recorded yet.</p>
                ) : filtered.map((notification) => {
                  const type = normalizeNotificationType(notification);
                  const Icon = type === 'SMS' ? MessageSquare : Mail;
                  const isUnread = notification.read === false || notification.status === 'Pending';

                  return (
                    <div
                      key={notification.id}
                      className={'p-5 hover:bg-muted/30 transition-colors ' + (isUnread ? 'bg-primary-bg/20' : '')}
                    >
                      <div className="flex items-start gap-4">
                        <div className={
                          'w-9 h-9 rounded-full flex items-center justify-center shrink-0 ' +
                          (type === 'SMS' ? 'bg-accent-bg' : 'bg-primary-bg')
                        }>
                          <Icon className={'w-4 h-4 ' + (type === 'SMS' ? 'text-accent' : 'text-primary')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="neutral" size="sm">{type}</Badge>
                              <Badge variant={getStatusVariant(notification.status)} size="sm">{notification.status}</Badge>
                              {isUnread && <span className="w-2 h-2 bg-primary rounded-full inline-block" />}
                            </div>
                            {canSendNotifications && notification.status === 'Failed' && (
                              <button
                                onClick={() => handleResend(notification)}
                                className="text-xs text-primary font-medium hover:underline shrink-0"
                              >
                                Resend
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">{notification.recipient}</p>
                          <p className="text-sm text-foreground mb-1">{notification.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {getSentAt(notification) ? 'Sent: ' + getSentAt(notification) : 'Pending send'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-6 py-4 border-t border-border flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {filtered.length} notification{filtered.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Upcoming Reminders</h3>
              </div>
              <div className="space-y-4">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading PEP schedules...</p>
                ) : upcomingReminders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming PEP reminders in the next 7 days.</p>
                ) : upcomingReminders.map((reminder) => (
                  <div key={reminder.id} className="pb-4 border-b border-border last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-foreground mb-0.5">{reminder.patient}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Day {reminder.doseDay} dose - {formatDate(reminder.dueDate)}
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">{reminder.contact || 'No contact number'}</p>
                    {canSendNotifications && (
                      <div className="flex gap-2">
                        <button
                          disabled={sending === reminder.id || !reminder.contact}
                          onClick={() => handleSendReminder(reminder, 'SMS')}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-primary-bg hover:border-primary/30 hover:text-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <MessageSquare className="w-3 h-3" /> SMS
                        </button>
                        <button
                          disabled={sending === reminder.id || !reminder.email}
                          onClick={() => handleSendReminder(reminder, 'Email')}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-primary-bg hover:border-primary/30 hover:text-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <Mail className="w-3 h-3" /> Email
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
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
