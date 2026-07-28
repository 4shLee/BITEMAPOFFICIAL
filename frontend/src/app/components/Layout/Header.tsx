import { useState } from 'react';
import { AlertTriangle, ArrowLeft, Bell, ChevronRight, Clock3, Search, ShieldAlert } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { canAccessPath, getStoredUser, getUserInitial, isSystemAdminRole } from '../../../lib/auth/roleAccess';
import { useHeaderAlerts } from './HeaderAlertsContext';

interface HeaderProps {
  title: string;
  breadcrumbs?: string[];
}

export function Header({ title, breadcrumbs = [] }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getStoredUser();
  const isIncidentFormPage = location.pathname === '/incidents/new' || /^\/incidents\/[^/]+\/edit$/.test(location.pathname);
  const canAccessNotifications = canAccessPath(currentUser?.role, '/notifications');
  const isSystemAdmin = isSystemAdminRole(currentUser?.role);
  const pagesWithModuleSearch = ['/incidents', '/patients', '/pep-schedule', '/inventory', '/notifications', '/users', '/audit-logs', '/settings'];
  const showGlobalSearch = !pagesWithModuleSearch.includes(location.pathname);
  const { quickAlerts, clinicPriorityCount, clinicSmsSimulation, alertsLoading } = useHeaderAlerts();
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const alertCount = quickAlerts.length;
  const priorityCount = isSystemAdmin ? (quickAlerts[0]?.count || 0) : clinicPriorityCount;
  const primaryClinicAlert = quickAlerts[0];
  const pendingClinicAlert = quickAlerts.find((alert) => alert.id === 'pending');
  const primaryClinicSummary = primaryClinicAlert?.id === 'overdue'
    ? primaryClinicAlert.count + ' overdue patient' + (primaryClinicAlert.count !== 1 ? 's require' : ' requires') + ' follow-up'
    : primaryClinicAlert?.id === 'failed'
      ? primaryClinicAlert.count + ' failed SMS ' + (primaryClinicAlert.count !== 1 ? 'jobs require' : 'job requires') + ' review'
      : primaryClinicAlert?.id === 'due-today'
        ? primaryClinicAlert.count + ' patient' + (primaryClinicAlert.count !== 1 ? 's are' : ' is') + ' due today'
        : primaryClinicAlert?.id === 'pending'
          ? primaryClinicAlert.count + ' reminder' + (primaryClinicAlert.count !== 1 ? 's are' : ' is') + (clinicSmsSimulation ? ' queued in simulation mode' : ' pending dispatch')
          : '';

  return (
    <header className="sticky top-0 z-10 border-b border-border/70 bg-background/95 px-6 py-3 backdrop-blur lg:px-8">
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          {breadcrumbs.length > 0 && (
            <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              {breadcrumbs.map((crumb, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span>{crumb}</span>
                  {i < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3" />}
                </div>
              ))}
            </div>
          )}
          <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">{title}</h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isIncidentFormPage && (
            <button
              type="button"
              onClick={() => navigate('/incidents')}
              className="hidden h-9 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold leading-none text-primary-foreground shadow-sm shadow-emerald-900/10 transition-colors hover:bg-primary-dark lg:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Incidents
            </button>
          )}

          {showGlobalSearch && (
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                aria-label="Search BITEMAP"
                placeholder="Search BITEMAP..."
                className="h-9 w-56 rounded-full border border-input bg-input-background pl-9 pr-3 text-sm shadow-sm transition-colors focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 lg:w-72"
              />
            </div>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAlertOpen((value) => !value)}
              className={'relative flex h-9 w-9 items-center justify-center rounded-full border bg-card shadow-sm transition-colors ' + (alertCount > 0 ? 'border-destructive/35 bg-destructive-bg hover:bg-destructive-bg' : 'border-border hover:border-primary/40 hover:bg-primary-bg')}
              aria-label="Open notifications"
            >
              <Bell className={'w-4 h-4 ' + (alertCount > 0 ? 'text-destructive' : 'text-muted-foreground')} />
              {alertCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
                  {priorityCount > 9 ? '9+' : priorityCount}
                </span>
              )}
            </button>

            {isAlertOpen && (
              <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-slate-900/15">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Notifications</p>
                  </div>
                  {isSystemAdmin ? <ShieldAlert className="w-4 h-4 text-primary shrink-0" /> : <Clock3 className="w-4 h-4 text-primary shrink-0" />}
                </div>

                <div className="max-h-72 overflow-y-auto">
                  {alertsLoading ? (
                    <p className="px-4 py-5 text-sm text-muted-foreground text-center">Checking notifications...</p>
                  ) : quickAlerts.length === 0 ? (
                    <p className="px-4 py-5 text-sm text-muted-foreground text-center">No unread notifications.</p>
                  ) : isSystemAdmin ? quickAlerts.map((alert) => (
                    <button
                      type="button"
                      key={alert.id}
                      onClick={() => {
                        setIsAlertOpen(false);
                        navigate('/notifications');
                      }}
                      className="w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className={'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ' + (alert.tone === 'danger' ? 'bg-destructive-bg text-destructive' : alert.tone === 'warning' ? 'bg-warning-bg text-warning' : 'bg-primary-bg text-primary')}>
                          {alert.tone === 'danger' ? <AlertTriangle className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{alert.title}</p>
                        </div>
                      </div>
                    </button>
                  )) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAlertOpen(false);
                        navigate('/notifications');
                      }}
                      className="w-full px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-start gap-3">
                        <div className={'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ' + (primaryClinicAlert?.tone === 'danger' ? 'bg-destructive-bg text-destructive' : primaryClinicAlert?.tone === 'warning' ? 'bg-warning-bg text-warning' : 'bg-primary-bg text-primary')}>
                          {primaryClinicAlert?.tone === 'danger' ? <AlertTriangle className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-5 text-foreground">{primaryClinicSummary}</p>
                          {pendingClinicAlert && primaryClinicAlert?.id !== 'pending' && (
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {pendingClinicAlert.count} reminder{pendingClinicAlert.count !== 1 ? 's' : ''} {clinicSmsSimulation ? 'queued in simulation mode' : 'pending dispatch'}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  )}
                </div>

                {canAccessNotifications && (
                  <Link
                    to="/notifications"
                    onClick={() => setIsAlertOpen(false)}
                    className="block border-t border-border px-4 py-3 text-center text-xs font-semibold text-primary hover:bg-primary-bg transition-colors"
                  >
                    Open Notifications
                  </Link>
                )}
              </div>
            )}
          </div>

          <div
            className="flex h-9 w-9 cursor-default items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm shadow-emerald-900/20"
            style={{ background: 'linear-gradient(135deg, #078C55 0%, #05603A 100%)' }}
          >
            {getUserInitial(currentUser)}
          </div>
        </div>
      </div>
    </header>
  );
}
