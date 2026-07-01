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
} from 'lucide-react';
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

function NavItem({ path, icon: Icon, label }: { path: string; icon: any; label: string }) {
  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? 'bg-primary-bg text-primary font-semibold'
            : 'text-muted-foreground hover:bg-slate-50 hover:text-foreground'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
          )}
          <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
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
  const visibleMainNav = mainNav.filter((item) => canAccessPath(currentUser?.role, item.path));
  const visibleSystemNav = systemNav
    .filter((item) => canAccessPath(currentUser?.role, item.path))
    .map((item) => (item.path === '/notifications' && isSystemAdminRole(currentUser?.role)
      ? { ...item, label: 'System Notifications' }
      : item));

  const handleLogout = () => {
    localStorage.removeItem('bitemap_access_token');
    localStorage.removeItem('bitemap_user');
    toast.success('Logged out successfully');
    navigate('/login', { replace: true });
  };

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 flex flex-col bg-sidebar border-r border-sidebar-border z-20">
      <div className="px-5 pt-6 pb-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)' }}
          >
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-foreground font-bold text-[15px] leading-tight">BITEMAP</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Bite Incident Tracking</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
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

        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-4 mb-1.5">
            General
          </p>
          <ul className="space-y-0.5">
            {visibleSystemNav.map(item => (
              <li key={item.path}><NavItem {...item} /></li>
            ))}
            <li>
              <button
                onClick={handleLogout}
                className="relative w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-slate-50 hover:text-foreground transition-all"
              >
                <LogOut className="w-[18px] h-[18px] shrink-0 text-slate-400" />
                <span>Logout</span>
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <div className="mx-3 mb-3 rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)' }}>
        <p className="text-xs font-bold mb-0.5">BITEMAP System</p>
        <p className="text-[10px] text-white/75 leading-snug mb-3">
          GIS-Based Anti-Rabies Vaccination Monitoring
        </p>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
          <span className="text-[10px] font-semibold text-green-200">Role Access Active</span>
        </div>
      </div>

      <div className="px-3 pb-4 border-t border-sidebar-border pt-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors cursor-default">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)' }}
          >
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{getRoleLabel(currentUser?.role)}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
