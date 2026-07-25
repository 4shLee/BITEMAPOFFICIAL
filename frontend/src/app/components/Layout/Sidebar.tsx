import {
  LayoutDashboard,
  AlertCircle,
  Users,
  Package,
  Map,
  FileText,
  UserCog,
  Settings,
  Syringe,
  Bell,
  LogOut,
  ClipboardList,
  ChevronUp,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { canAccessPath, getRoleLabel, getStoredUser, getUserDisplayName, getUserInitial, isSystemAdminRole } from '../../../lib/auth/roleAccess';

const mainNav = [
  { path: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/incidents',    icon: AlertCircle,     label: 'Incident Management' },
  { path: '/patients',     icon: Users,           label: 'Patient Registry' },
  { path: '/pep-schedule', icon: Syringe,         label: 'PEP Schedule' },
  { path: '/inventory',    icon: Package,         label: 'Inventory' },
  { path: '/gis-map',      icon: Map,             label: 'GIS Map' },
  { path: '/reports',      icon: FileText,        label: 'Reports' },
];

const systemNav = [
  { path: '/notifications', icon: Bell,     label: 'Notifications' },
  { path: '/audit-logs',    icon: ClipboardList, label: 'Audit Logs' },
  { path: '/users',         icon: UserCog,  label: 'User Management' },
  { path: '/settings',      icon: Settings, label: 'System Settings' },
];

function NavItem({ path, icon: Icon, label }: { path: string; icon: LucideIcon; label: string }) {
  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
          isActive
            ? 'bg-primary-bg text-primary shadow-sm shadow-emerald-900/5'
            : 'text-muted-foreground hover:bg-slate-50 hover:text-foreground'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-primary" />
          )}
          <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const displayName = getUserDisplayName(currentUser);
  const userInitial = getUserInitial(currentUser);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const visibleMainNav = mainNav.filter((item) => canAccessPath(currentUser?.role, item.path));
  const visibleSystemNav = systemNav
    .filter((item) => canAccessPath(currentUser?.role, item.path))
    .map((item) => {
      if (item.path === '/notifications' && isSystemAdminRole(currentUser?.role)) {
        return { ...item, label: 'System Notifications' };
      }
      if (item.path === '/settings' && !isSystemAdminRole(currentUser?.role)) {
        return { ...item, label: 'Clinic Settings' };
      }
      return item;
    });

  const handleLogout = () => {
    localStorage.removeItem('bitemap_access_token');
    localStorage.removeItem('bitemap_user');
    toast.success('Logged out successfully');
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen]);

  return (
    <aside
      className="fixed left-0 top-0 z-20 flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar"
    >
      <div className="border-b border-sidebar-border px-5 pb-5 pt-6">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm shadow-emerald-900/20"
            style={{ background: 'linear-gradient(135deg, #078C55 0%, #05603A 100%)' }}
          >
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[16px] font-extrabold leading-tight text-foreground">BITEMAP</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Bite Incident Tracking</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {visibleMainNav.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-4 mb-1.5">
              Menu
            </p>
            <ul className="space-y-0.5">
              {visibleMainNav.map(item => (
                <li key={item.path}><NavItem {...item} /></li>
              ))}
            </ul>
          </div>
        )}

        {visibleSystemNav.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-4 mb-1.5">
              General
            </p>
            <ul className="space-y-0.5">
              {visibleSystemNav.map(item => (
                <li key={item.path}><NavItem {...item} /></li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      <div className="mx-3 mb-3 rounded-3xl p-4 text-white shadow-lg shadow-emerald-900/15" style={{ background: 'radial-gradient(circle at top right, rgba(52, 211, 153, 0.55), transparent 35%), linear-gradient(135deg, #078C55 0%, #05603A 100%)' }}>
        <p className="text-xs font-bold mb-0.5">BITEMAP System</p>
        <p className="text-[10px] text-white/75 leading-snug mb-3">
          GIS-Based Anti-Rabies Vaccination Monitoring
        </p>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-300" />
          <span className="text-[10px] font-semibold text-green-200">Role Access Active</span>
        </div>
      </div>

      <div ref={userMenuRef} className="relative border-t border-sidebar-border px-3 pb-4 pt-3">
        {isUserMenuOpen && (
          <div className="absolute bottom-[76px] left-3 right-3 z-30 rounded-2xl border border-border bg-white p-2 shadow-xl shadow-slate-900/15">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{getRoleLabel(currentUser?.role)}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-1 w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive-bg transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsUserMenuOpen((value) => !value)}
          aria-expanded={isUserMenuOpen}
          className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-slate-50"
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #078C55 0%, #05603A 100%)' }}
          >
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{getRoleLabel(currentUser?.role)}</p>
          </div>
          <ChevronUp className={'w-4 h-4 shrink-0 text-slate-400 transition-transform ' + (isUserMenuOpen ? 'rotate-180' : '')} />
        </button>
      </div>
    </aside>
  );
}
