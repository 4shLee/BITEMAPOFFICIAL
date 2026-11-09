export type UserRole = 'system_admin' | 'clinic_admin' | 'doctor' | 'nurse_vaccinator' | 'Clinic Admin' | 'Doctor' | 'Nurse/Vaccinator' | 'Admin' | 'Health Officer' | 'Nurse' | 'Vaccinator' | 'nurse' | 'vaccinator' | string;

export interface CurrentUser {
  id?: number | string;
  name?: string;
  full_name?: string;
  email?: string;
  role?: UserRole;
  status?: string;
}

export type PermissionAction =
  | 'dashboard.view'
  | 'records.view_supervision'
  | 'patients.create'
  | 'patients.update'
  | 'patients.delete'
  | 'incidents.create'
  | 'incidents.update'
  | 'incidents.delete'
  | 'pep.update'
  | 'inventory.create'
  | 'inventory.update'
  | 'inventory.delete'
  | 'inventory.adjust_stock'
  | 'inventory.record_usage'
  | 'notifications.send'
  | 'reports.view'
  | 'audit_logs.view'
  | 'settings.configure'
  | 'users.manage'
  | 'users.assign_roles'
  | 'users.activate_deactivate'
  | 'users.reset_passwords'
  | 'activity.monitor';

const ROLE_LABELS: Record<string, string> = {
  system_admin: 'System Administrator',
  clinic_admin: 'Clinic Administrator',
  doctor: 'Doctor',
  nurse_vaccinator: 'Nurse/Vaccinator',
};

export const ASSIGNABLE_ROLES = [
  { value: 'system_admin', label: 'System Administrator' },
  { value: 'clinic_admin', label: 'Clinic Administrator' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'nurse_vaccinator', label: 'Nurse/Vaccinator' },
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  system_admin: [
    '/dashboard',
    '/users',
    '/settings',
    '/audit-logs',
    '/notifications',
  ],
  clinic_admin: [
    '/dashboard',
    '/incidents',
    '/incidents/new',
    '/patients',
    '/pep-schedule',
    '/inventory',
    '/gis-map',
    '/reports',
    '/notifications',
    '/users',
    '/settings',
    '/audit-logs',
  ],
  doctor: [
    '/dashboard',
    '/incidents',
    '/patients',
    '/pep-schedule',
    '/inventory',
    '/gis-map',
    '/reports',
    '/notifications',
  ],
  nurse_vaccinator: [
    '/dashboard',
    '/incidents',
    '/incidents/new',
    '/patients',
    '/pep-schedule',
    '/inventory',
    '/notifications',
  ],
};

const ACTION_PERMISSIONS: Record<PermissionAction, string[]> = {
  'dashboard.view': ['clinic_admin', 'doctor', 'nurse_vaccinator'],
  'records.view_supervision': ['clinic_admin', 'doctor'],
  'patients.create': ['clinic_admin', 'nurse_vaccinator'],
  'patients.update': ['clinic_admin', 'nurse_vaccinator'],
  'patients.delete': ['clinic_admin'],
  'incidents.create': ['clinic_admin', 'nurse_vaccinator'],
  'incidents.update': ['clinic_admin', 'nurse_vaccinator'],
  'incidents.delete': ['clinic_admin'],
  'pep.update': ['clinic_admin', 'nurse_vaccinator'],
  'inventory.create': ['clinic_admin'],
  'inventory.update': ['clinic_admin'],
  'inventory.delete': ['clinic_admin'],
  'inventory.adjust_stock': ['clinic_admin'],
  'inventory.record_usage': ['nurse_vaccinator'],
  'notifications.send': ['clinic_admin', 'nurse_vaccinator'],
  'reports.view': ['clinic_admin', 'doctor'],
  'audit_logs.view': ['system_admin', 'clinic_admin'],
  'settings.configure': ['system_admin', 'clinic_admin'],
  'users.manage': ['system_admin', 'clinic_admin'],
  'users.assign_roles': ['system_admin', 'clinic_admin'],
  'users.activate_deactivate': ['system_admin', 'clinic_admin'],
  'users.reset_passwords': ['system_admin', 'clinic_admin'],
  'activity.monitor': ['system_admin'],
};

const PATH_ACTION_GUARDS: Array<{ pattern: RegExp; action: PermissionAction }> = [
  { pattern: /^\/incidents\/new$/, action: 'incidents.create' },
  { pattern: /^\/incidents\/[^/]+\/edit$/, action: 'incidents.update' },
  { pattern: /^\/patients\/new$/, action: 'patients.create' },
  { pattern: /^\/patients\/[^/]+\/edit$/, action: 'patients.update' },
];

export const AUTH_TOKEN_STORAGE_KEY = 'bitemap_access_token';
export const AUTH_USER_STORAGE_KEY = 'bitemap_user';
export const AUTH_EXPIRES_AT_STORAGE_KEY = 'bitemap_token_expires_at';
export const AUTH_LAST_ACTIVITY_STORAGE_KEY = 'bitemap_last_activity_at';
export const AUTH_TIMEOUT_MINUTES_STORAGE_KEY = 'bitemap_session_timeout_minutes';
export const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;

export function clearAuthSessionStorage() {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  localStorage.removeItem(AUTH_EXPIRES_AT_STORAGE_KEY);
  localStorage.removeItem(AUTH_LAST_ACTIVITY_STORAGE_KEY);
  localStorage.removeItem(AUTH_TIMEOUT_MINUTES_STORAGE_KEY);
}

export function recordUserActivity(timestampMs: number = Date.now()) {
  if (localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    localStorage.setItem(AUTH_LAST_ACTIVITY_STORAGE_KEY, String(timestampMs));
  }
}

export function getSessionTimeoutMinutes(): number {
  const raw = Number(localStorage.getItem(AUTH_TIMEOUT_MINUTES_STORAGE_KEY));
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_IDLE_TIMEOUT_MINUTES;
  }

  return Math.max(5, Math.min(480, Math.round(raw)));
}

export function isAuthSessionExpired(nowMs: number = Date.now()): boolean {
  const expiresAtRaw = localStorage.getItem(AUTH_EXPIRES_AT_STORAGE_KEY);
  if (expiresAtRaw) {
    const expiresAtMs = Date.parse(expiresAtRaw);
    if (Number.isFinite(expiresAtMs) && nowMs >= expiresAtMs) {
      return true;
    }
  }

  const lastActivityRaw = localStorage.getItem(AUTH_LAST_ACTIVITY_STORAGE_KEY);
  if (lastActivityRaw) {
    const lastActivityMs = Number(lastActivityRaw);
    const idleTimeoutMs = getSessionTimeoutMinutes() * 60 * 1000;
    if (Number.isFinite(lastActivityMs) && nowMs - lastActivityMs >= idleTimeoutMs) {
      return true;
    }
  }

  return false;
}

export function normalizeRoleKey(role?: string) {
  const key = (role || '').trim().replace(/\s+/g, '_').replace(/[-/]+/g, '_').toLowerCase();

  if (key === 'admin') return 'system_admin';
  if (key === 'health_officer') return 'doctor';
  if (key === 'nurse' || key === 'vaccinator' || key === 'nurse_vaccinator') return 'nurse_vaccinator';

  return key;
}

export function getRoleLabel(role?: string) {
  return ROLE_LABELS[normalizeRoleKey(role)] || role || 'Authorized User';
}

export function isSystemAdminRole(role?: string) {
  return normalizeRoleKey(role) === 'system_admin';
}

export function getStoredUser(): CurrentUser | null {
  const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasAuthSession() {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  const user = getStoredUser();

  if (!token || !user) {
    return false;
  }

  if (isAuthSessionExpired()) {
    clearAuthSessionStorage();
    return false;
  }

  return true;
}

export function getRolePermissions(role?: string) {
  return ROLE_PERMISSIONS[normalizeRoleKey(role)] || [];
}

export function getDefaultPathForRole(role?: string) {
  return getRolePermissions(role)[0] || '/login';
}

export function canAccessPath(role: string | undefined, path: string) {
  const cleanPath = path.split('?')[0].replace(/\/+$/, '') || '/';
  const guardedPath = PATH_ACTION_GUARDS.find((guard) => guard.pattern.test(cleanPath));

  if (guardedPath) {
    return canPerformAction(role, guardedPath.action);
  }

  const allowedPaths = getRolePermissions(role);

  return allowedPaths.some((allowedPath) => (
    cleanPath === allowedPath || cleanPath.startsWith(allowedPath + '/')
  ));
}

export function canPerformAction(role: string | undefined, action: PermissionAction) {
  return (ACTION_PERMISSIONS[action] || []).includes(normalizeRoleKey(role));
}

export function getUserDisplayName(user: CurrentUser | null) {
  return user?.name || user?.full_name || user?.email || 'Authorized User';
}

export function getUserInitial(user: CurrentUser | null) {
  const label = getUserDisplayName(user).trim();
  return (label[0] || 'U').toUpperCase();
}
