import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { canAccessPath, getStoredUser, isSystemAdminRole } from '../../../lib/auth/roleAccess';
import { auditLogsAPI, notificationsAPI } from '../../../lib/services/api';
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

    async function loadNotificationAlerts() {
      if (!canAccessNotifications) {
        if (isMounted) setAlertsLoading(false);
        return;
      }

      try {
        if (isMounted) setAlertsLoading(true);
        if (isSystemAdmin) {
          const response = await auditLogsAPI.getAll({ per_page: 30 });
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
              tone: /(failed|error|critical|unauthorized)/i.test([log.action, log.description].join(' ')) ? 'danger' as const : 'info' as const,
              count: 1,
            }));
          if (isMounted) setQuickAlerts(platformAlerts);
        } else {
          const notificationResponse = await notificationsAPI.getSummary();
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
          setQuickAlerts([]);
          setClinicPriorityCount(0);
          setClinicSmsSimulation(true);
        }
      } finally {
        if (isMounted) setAlertsLoading(false);
      }
    }

    loadNotificationAlerts();
    const interval = window.setInterval(loadNotificationAlerts, 60000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [canAccessNotifications, isSystemAdmin]);

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
