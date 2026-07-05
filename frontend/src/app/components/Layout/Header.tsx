import { useEffect, useState } from 'react';
import { ArrowLeft, Bell, ChevronRight, CalendarClock } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { canAccessPath, getStoredUser, getUserInitial, isSystemAdminRole } from '../../../lib/auth/roleAccess';
import { notificationsAPI } from '../../../lib/services/api';

interface HeaderProps {
  title: string;
  breadcrumbs?: string[];
}

type TodayScheduleAlert = {
  id: number | string;
  patient_name?: string;
  barangay?: string;
  dose_day?: number | string;
  status?: string;
  scheduled_date?: string;
};

export function Header({ title, breadcrumbs = [] }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getStoredUser();
  const isIncidentFormPage = location.pathname === '/incidents/new' || /^\/incidents\/[^/]+\/edit$/.test(location.pathname);
  const canViewScheduleAlerts = canAccessPath(currentUser?.role, '/notifications') && !isSystemAdminRole(currentUser?.role);
  const [todaySchedules, setTodaySchedules] = useState<TodayScheduleAlert[]>([]);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadTodayScheduleAlerts() {
      if (!canViewScheduleAlerts) return;

      try {
        setAlertsLoading(true);
        const response = await notificationsAPI.getTodaySchedules();
        if (isMounted) setTodaySchedules(response.data || []);
      } catch {
        if (isMounted) setTodaySchedules([]);
      } finally {
        if (isMounted) setAlertsLoading(false);
      }
    }

    loadTodayScheduleAlerts();
    const interval = window.setInterval(loadTodayScheduleAlerts, 60000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [canViewScheduleAlerts]);

  const todayScheduleCount = todaySchedules.length;

  return (
    <header className="bg-background border-b border-border px-8 py-4 sticky top-0 z-10">
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          {breadcrumbs.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-0.5">
              {breadcrumbs.map((crumb, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span>{crumb}</span>
                  {i < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3" />}
                </div>
              ))}
            </div>
          )}
          <h1 className="text-xl font-bold text-foreground tracking-tight">{title}</h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isIncidentFormPage && (
            <button
              type="button"
              onClick={() => navigate('/incidents')}
              className="hidden h-9 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold leading-none text-primary-foreground shadow-sm transition-colors hover:bg-primary-dark lg:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Incidents
            </button>
          )}

          {canViewScheduleAlerts && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAlertOpen((value) => !value)}
                className={'relative w-9 h-9 flex items-center justify-center bg-card border rounded-xl transition-colors shadow-sm ' + (todayScheduleCount > 0 ? 'border-destructive/35 bg-destructive-bg hover:bg-destructive-bg' : 'border-border hover:border-primary/40 hover:bg-primary-bg')}
                aria-label="Open schedule notifications"
              >
                <Bell className={'w-4 h-4 ' + (todayScheduleCount > 0 ? 'text-destructive' : 'text-muted-foreground')} />
                {todayScheduleCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
                    {todayScheduleCount > 9 ? '9+' : todayScheduleCount}
                  </span>
                )}
              </button>

              {isAlertOpen && (
                <div className="absolute right-0 top-11 w-80 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Today's PEP Schedules</p>
                      <p className="text-xs text-muted-foreground">
                        {todayScheduleCount > 0 ? todayScheduleCount + ' patient' + (todayScheduleCount !== 1 ? 's' : '') + ' due today' : 'No schedules due today'}
                      </p>
                    </div>
                    <CalendarClock className="w-4 h-4 text-primary shrink-0" />
                  </div>

                  <div className="max-h-72 overflow-y-auto">
                    {alertsLoading ? (
                      <p className="px-4 py-5 text-sm text-muted-foreground text-center">Checking today schedules...</p>
                    ) : todayScheduleCount === 0 ? (
                      <p className="px-4 py-5 text-sm text-muted-foreground text-center">No PEP schedules for today.</p>
                    ) : todaySchedules.slice(0, 6).map((schedule) => (
                      <button
                        type="button"
                        key={schedule.id}
                        onClick={() => {
                          setIsAlertOpen(false);
                          navigate('/pep-schedule');
                        }}
                        className="w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{schedule.patient_name || 'Unknown Patient'}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Day {schedule.dose_day ?? '-'} dose - {schedule.barangay || 'Unknown barangay'}
                            </p>
                          </div>
                          <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[10px] font-semibold text-warning shrink-0">
                            {schedule.status || 'Pending'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <Link
                    to="/notifications"
                    onClick={() => setIsAlertOpen(false)}
                    className="block border-t border-border px-4 py-3 text-center text-xs font-semibold text-primary hover:bg-primary-bg transition-colors"
                  >
                    Open Notifications
                  </Link>
                </div>
              )}
            </div>
          )}

          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold cursor-default shadow-sm"
            style={{ background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)' }}
          >
            {getUserInitial(currentUser)}
          </div>
        </div>
      </div>
    </header>
  );
}
