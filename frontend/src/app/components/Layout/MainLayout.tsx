import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  canAccessPath,
  clearAuthSessionStorage,
  getStoredUser,
  hasAuthSession,
  isSystemAdminRole,
  recordUserActivity,
} from '../../../lib/auth/roleAccess';
import { auditLogsAPI, authAPI, notificationsAPI } from '../../../lib/services/api';
import { HeaderAlertsProvider, type QuickAlert } from './HeaderAlertsContext';
import { Sidebar } from './Sidebar';

type HeaderAuditLog = {
  id: number | string;
  action?: string | null;
  module?: string | null;
  description?: string | null;
};

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  const currentUser = getStoredUser();
  const canAccessNotifications = canAccessPath(currentUser?.role, '/notifications');
  const isSystemAdmin = isSystemAdminRole(currentUser?.role);
  const [quickAlerts, setQuickAlerts] = useState<QuickAlert[]>([]);
  const [clinicPriorityCount, setClinicPriorityCount] = useState(0);
  const [clinicSmsSimulation, setClinicSmsSimulation] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(canAccessNotifications);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0 });
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.documentElement.classList.add('bitemap-app-shell');
    document.body.classList.add('bitemap-app-shell');

    return () => {
      document.documentElement.classList.remove('bitemap-app-shell');
      document.body.classList.remove('bitemap-app-shell');
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let lastRecordedAt = 0;

    const handleSessionExpired = () => {
      if (!isMounted) return;
      clearAuthSessionStorage();
      toast.error('Your session has expired. Please sign in again.');
      navigate('/login', { replace: true });
    };

    const handleUserInteraction = () => {
      const now = Date.now();
      if (now - lastRecordedAt < 15000) {
        return;
      }
      if (!hasAuthSession()) {
        handleSessionExpired();
        return;
      }
      lastRecordedAt = now;
      recordUserActivity(now);
    };

    const verifyActiveSession = () => {
      if (!hasAuthSession()) {
        handleSessionExpired();
      }
    };

    authAPI.getSession().then((result) => {
      if (isMounted && !result.success) {
        handleSessionExpired();
      }
    });

    const events: Array<keyof WindowEventMap> = ['mousedown', 'keydown', 'touchstart', 'wheel'];
    events.forEach((eventName) => {
      window.addEventListener(eventName, handleUserInteraction, { passive: true });
    });
    window.addEventListener('focus', verifyActiveSession);
    document.addEventListener('visibilitychange', verifyActiveSession);

    const sessionCheckTimer = window.setInterval(verifyActiveSession, 15000);

    return () => {
      isMounted = false;
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserInteraction);
      });
      window.removeEventListener('focus', verifyActiveSession);
      document.removeEventListener('visibilitychange', verifyActiveSession);
      window.clearInterval(sessionCheckTimer);
    };
  }, [navigate]);

  useEffect(() => {
    let isMounted = true;

    async function loadNotificationAlerts(showLoadingSpinner = false) {
      if (!canAccessNotifications || !hasAuthSession()) {
        if (isMounted) setAlertsLoading(false);
        return;
      }

      try {
        if (isMounted && showLoadingSpinner) setAlertsLoading(true);
        if (isSystemAdmin) {
          const response = await auditLogsAPI.getAll({ per_page: 25 }, { backgroundPoll: true });
          const platformAlerts = ((response.data || []) as HeaderAuditLog[])
            .filter((log) => {
              const moduleName = String(log.module || '');
              const text = [log.action, log.module, log.description].filter(Boolean).join(' ').toLowerCase();
              return ['Authentication', 'User Management', 'Settings', 'Audit Logs'].includes(moduleName)
                || (moduleName === 'Notifications' && /(failed|error|queue|service)/.test(text));
            })
            .slice(0, 5)
            .map((log) => ({
              id: 'system-' + log.id,
              title: log.action || 'System alert',
              detail: log.description || log.module || 'Platform activity requires review.',
              tone: /(failed|error|critical|unauthorized|blocked)/i.test([log.action, log.description].join(' ')) ? 'danger' as const : 'info' as const,
              count: 1,
            }));
          if (isMounted) setQuickAlerts(platformAlerts);
        } else {
          const notificationResponse = await notificationsAPI.getSummary({ backgroundPoll: true });
          const summary = notificationResponse.meta.summary;
          const priorityAlert = notificationResponse.meta.priority_alert;
          const overdue = Number(summary.overdue_patients || 0);
          const failed = Number(summary.failed_sms || 0);
          const dueToday = Number(summary.due_today_patients || 0);
          const pending = Number(summary.pending_sms || 0);
          const alerts: QuickAlert[] = [];

          if (overdue > 0) alerts.push({ id: 'overdue', title: overdue + ' Overdue Patient' + (overdue !== 1 ? 's' : ''), detail: 'Follow-up reminders may be required.', tone: 'danger', count: overdue });
          if (failed > 0) alerts.push({ id: 'failed', title: failed + ' Failed SMS', detail: 'Review the notification history.', tone: 'danger', count: failed });
          if (dueToday > 0) alerts.push({ id: 'due-today', title: dueToday + ' Patient' + (dueToday !== 1 ? 's' : '') + ' Due Today', detail: 'Review today’s vaccination reminders.', tone: 'warning', count: dueToday });
          if (pending > 0) alerts.push({ id: 'pending', title: pending + ' Pending SMS', detail: 'SMS records are waiting for dispatch.', tone: 'info', count: pending });
          if (isMounted) {
            setQuickAlerts(alerts);
            setClinicPriorityCount(Number(priorityAlert.count || 0));
            setClinicSmsSimulation(notificationResponse.meta.sms_service.mode !== 'enabled');
          }
        }
      } catch {
        if (isMounted) {
          if (!hasAuthSession()) {
            navigate('/login', { replace: true });
            return;
          }
          setQuickAlerts([]);
          setClinicPriorityCount(0);
          setClinicSmsSimulation(true);
        }
      } finally {
        if (isMounted) setAlertsLoading(false);
      }
    }

    loadNotificationAlerts(true);
    const interval = window.setInterval(() => loadNotificationAlerts(false), 60000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [canAccessNotifications, isSystemAdmin, navigate]);

  return (
    <HeaderAlertsProvider value={{ quickAlerts, clinicPriorityCount, clinicSmsSimulation, alertsLoading }}>
      <div className="flex h-dvh overflow-hidden bg-[#eef3ef]">
        <div className="max-md:hidden">
          <Sidebar />
        </div>
        <div
          ref={contentRef}
          data-primary-scroll-container
          className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background md:ml-64"
        >
          <Outlet />
        </div>
      </div>
    </HeaderAlertsProvider>
  );
}
