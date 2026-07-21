import { useEffect, useState } from 'react';
import { Search, UserPlus, Edit, X, Users as UsersIcon, ShieldCheck, UserCheck, UserX, CheckCircle, XCircle, Stethoscope } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { toast } from 'sonner';
import { usersAPI } from '../../lib/services/api';
import { ASSIGNABLE_ROLES, getRoleLabel, getStoredUser, isSystemAdminRole, normalizeRoleKey } from '../../lib/auth/roleAccess';
import { composeUserName, getUserDisplayName } from '../../lib/userName';

const ROLES = ASSIGNABLE_ROLES;
const USERS_PER_PAGE = 10;

function UserModal({ user, roles, isCurrentUser, onClose, onSave }: { user: any; roles: typeof ASSIGNABLE_ROLES; isCurrentUser: boolean; onClose: () => void; onSave: (data: any) => void; }) {
  const [form, setForm] = useState({
    name: getUserDisplayName(user),
    firstName: user.first_name || '',
    middleName: user.middle_name || '',
    lastName: user.last_name || '',
    suffix: user.suffix || '',
    email: user.email || '',
    phone: user.phone || '',
    role: normalizeRoleKey(user.role || 'nurse_vaccinator'),
    status: user.status || 'Active',
    password: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasStructuredName = Boolean(form.firstName.trim() || form.middleName.trim() || form.lastName.trim() || form.suffix.trim());
    if ((hasStructuredName && (!form.firstName.trim() || !form.lastName.trim())) || (!hasStructuredName && !form.name.trim()) || !form.email.trim()) {
      toast.error('Name and email are required.');
      return;
    }
    if (isCurrentUser && form.status === 'Inactive') {
      toast.error('You cannot deactivate your own account.');
      return;
    }
    const { password, firstName, middleName, lastName, suffix, ...baseUserData } = form;
    const userData = hasStructuredName
      ? {
          ...baseUserData,
          name: composeUserName({ firstName, middleName, lastName, suffix }),
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          suffix,
        }
      : baseUserData;
    onSave(password.trim() ? { ...userData, password: password.trim() } : userData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Edit User</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-6">
          {!user.first_name && !user.last_name && (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Legacy name: <span className="font-semibold text-foreground">{getUserDisplayName(user)}</span>. Add structured fields to modernize this record, or leave them blank to preserve it.
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">First Name</label>
              <input type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="First name" className="w-full px-3.5 py-2.5 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Middle Name <span className="font-normal text-muted-foreground">(optional)</span></label>
              <input type="text" value={form.middleName} onChange={e => setForm({ ...form, middleName: e.target.value })} placeholder="Middle name" className="w-full px-3.5 py-2.5 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Last Name</label>
              <input type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" className="w-full px-3.5 py-2.5 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Suffix <span className="font-normal text-muted-foreground">(optional)</span></label>
              <input type="text" value={form.suffix} onChange={e => setForm({ ...form, suffix: e.target.value })} placeholder="Jr., Sr., II, III, IV" className="w-full px-3.5 py-2.5 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
              placeholder="user@health.gov.ph"
              className="w-full px-3.5 py-2.5 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="09xx xxx xxxx"
              className="w-full px-3.5 py-2.5 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Role</label>
            <select
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            >
              {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
            {user?.approval_status === 'pending' && (
              <p className="mt-1.5 text-xs text-muted-foreground">You can change the requested role before approving this account.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
              disabled={isCurrentUser}
              className="w-full px-3.5 py-2.5 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            {isCurrentUser && (
              <p className="mt-1.5 text-xs text-muted-foreground">You cannot deactivate your own account.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Reset Password</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              minLength={8}
              placeholder="Leave blank to keep current password"
              className="w-full px-3.5 py-2.5 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">Enter at least 8 characters to reset this user's password.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary">Save Changes</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const getRoleVariant = (role: string) => {
  const map: Record<string, string> = {
    system_admin: 'danger',
    health_officer: 'info',
    doctor: 'info',
    nurse_vaccinator: 'success',
  };
  return (map[normalizeRoleKey(role)] || 'neutral') as any;
};

const getApprovalVariant = (status: string) => {
  const map: Record<string, string> = {
    approved: 'success',
    pending: 'warning',
    rejected: 'danger',
  };
  return (map[status] || 'neutral') as any;
};

const formatApproval = (status: string) => {
  if (status === 'pending') return 'Pending';
  if (status === 'rejected') return 'Rejected';
  return 'Approved';
};

export function Users() {
  const currentUser = getStoredUser();
  const currentUserIsSystemAdmin = isSystemAdminRole(currentUser?.role);
  const assignableRoles = currentUserIsSystemAdmin
    ? ROLES
    : ROLES.filter((role) => normalizeRoleKey(role.value) !== 'system_admin');
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAll();
      if (response.success) setUsers(response.data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  const visibleUsers = currentUserIsSystemAdmin
    ? users
    : users.filter(u => normalizeRoleKey(u.role) !== 'system_admin');

  const canManageUser = (user: any) => (
    currentUserIsSystemAdmin || normalizeRoleKey(user.role) !== 'system_admin'
  );

  const isCurrentUser = (user: any) => {
    const currentId = currentUser?.id;
    if (currentId !== undefined && currentId !== null && user?.id !== undefined && user?.id !== null) {
      return String(user.id) === String(currentId);
    }

    return Boolean(currentUser?.email && user?.email && user.email.toLowerCase() === currentUser.email.toLowerCase());
  };

  const filtered = visibleUsers.filter(u => {
    const approval = u.approval_status || 'approved';
    const status = u.status || '';
    const term = searchTerm.toLowerCase();
    return (
      getUserDisplayName(u).toLowerCase().includes(term) ||
      u.first_name?.toLowerCase().includes(term) ||
      u.middle_name?.toLowerCase().includes(term) ||
      u.last_name?.toLowerCase().includes(term) ||
      u.suffix?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.role?.toLowerCase().includes(term) ||
      getRoleLabel(u.role).toLowerCase().includes(term) ||
      approval.toLowerCase().includes(term) ||
      status.toLowerCase().includes(term)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / USERS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * USERS_PER_PAGE;
  const pageEndIndex = Math.min(pageStartIndex + USERS_PER_PAGE, filtered.length);
  const paginatedUsers = filtered.slice(pageStartIndex, pageEndIndex);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleSave = async (formData: any) => {
    if (!editingUser) return;
    if (!canManageUser(editingUser)) {
      toast.error('System Administrator accounts can only be managed by System Admin.');
      return;
    }
    if (!currentUserIsSystemAdmin && normalizeRoleKey(formData.role) === 'system_admin') {
      toast.error('Clinic Admin cannot assign System Administrator roles.');
      return;
    }
    if (isCurrentUser(editingUser) && formData.status === 'Inactive') {
      toast.error('You cannot deactivate your own account.');
      return;
    }

    try {
      await usersAPI.update(editingUser.id, formData);
      toast.success(formData.name + ' updated successfully.');
      setShowModal(false);
      setEditingUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save user.');
    }
  };

  const handleApprove = async (user: any) => {
    if (!canManageUser(user)) {
      toast.error('System Administrator accounts can only be managed by System Admin.');
      return;
    }

    try {
      await usersAPI.approve(user.id, user.role);
      toast.success(user.name + ' has been approved.');
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve account.');
    }
  };

  const handleReject = async (user: any) => {
    if (!canManageUser(user)) {
      toast.error('System Administrator accounts can only be managed by System Admin.');
      return;
    }

    try {
      await usersAPI.reject(user.id);
      toast.success(user.name + ' has been rejected.');
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject account.');
    }
  };

  const handleToggleStatus = async (user: any) => {
    if (!canManageUser(user)) {
      toast.error('System Administrator accounts can only be managed by System Admin.');
      return;
    }
    if (isCurrentUser(user) && user.status === 'Active') {
      toast.error('You cannot deactivate your own account.');
      return;
    }

    const next = user.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await usersAPI.update(user.id, { status: next });
      toast.success(user.name + ' has been ' + (next === 'Active' ? 'activated' : 'deactivated') + '.');
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status.');
    }
  };

  const totalPending = visibleUsers.filter(u => (u.approval_status || 'approved') === 'pending').length;
  const totalActive = visibleUsers.filter(u => u.status === 'Active' && (u.approval_status || 'approved') === 'approved').length;
  const totalAdmins = users.filter(u => normalizeRoleKey(u.role) === 'system_admin').length;
  const totalDoctors = visibleUsers.filter(u => normalizeRoleKey(u.role) === 'doctor').length;
  const totalNurses = visibleUsers.filter(u => normalizeRoleKey(u.role) === 'nurse_vaccinator').length;
  const stats = currentUserIsSystemAdmin
    ? [
        { label: 'Total Users', value: users.length, icon: UsersIcon, color: 'text-accent', bg: 'bg-accent-bg' },
        { label: 'Pending Requests', value: totalPending, icon: UserPlus, color: 'text-warning', bg: 'bg-warning-bg' },
        { label: 'Active Users', value: totalActive, icon: UserCheck, color: 'text-success', bg: 'bg-success-bg' },
        { label: 'System Admins', value: totalAdmins, icon: ShieldCheck, color: 'text-destructive', bg: 'bg-destructive-bg' },
        { label: 'Nurse/Vaccinators', value: totalNurses, icon: UserX, color: 'text-primary', bg: 'bg-primary-bg' },
      ]
    : [
        { label: 'Total Staff', value: visibleUsers.length, icon: UsersIcon, color: 'text-accent', bg: 'bg-accent-bg' },
        { label: 'Pending Requests', value: totalPending, icon: UserPlus, color: 'text-warning', bg: 'bg-warning-bg' },
        { label: 'Active Staff', value: totalActive, icon: UserCheck, color: 'text-success', bg: 'bg-success-bg' },
        { label: 'Doctors', value: totalDoctors, icon: Stethoscope, color: 'text-accent', bg: 'bg-accent-bg' },
        { label: 'Nurse/Vaccinators', value: totalNurses, icon: UserX, color: 'text-primary', bg: 'bg-primary-bg' },
      ];

  return (
    <div className="flex-1">
      <Header title="User Management" breadcrumbs={['System', 'User Management']} />

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className={'w-9 h-9 rounded-lg ' + s.bg + ' flex items-center justify-center mb-3'}>
                <s.icon className={'w-4.5 h-4.5 ' + s.color} />
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-border flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, email, role, approval, or status..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-input-background border border-input rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-6 py-3">Name</th>
                  <th className="text-left px-6 py-3">Email</th>
                  <th className="text-left px-6 py-3">Role</th>
                  <th className="text-left px-6 py-3">Approval</th>
                  <th className="text-left px-6 py-3">Status</th>
                  <th className="text-left px-6 py-3">Last Login</th>
                  <th className="text-left px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-muted-foreground">Loading users...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-muted-foreground">No users found.</td></tr>
                ) : paginatedUsers.map(user => {
                  const approval = user.approval_status || 'approved';
                  const displayName = getUserDisplayName(user);
                  const isPending = approval === 'pending';
                  const isRejected = approval === 'rejected';
                  const userCanBeManaged = canManageUser(user);
                  const userIsCurrentUser = isCurrentUser(user);

                  return (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
                            {displayName.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-foreground">{displayName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{user.email}</td>
                      <td className="px-6 py-4"><Badge variant={getRoleVariant(user.role)}>{getRoleLabel(user.role)}</Badge></td>
                      <td className="px-6 py-4"><Badge variant={getApprovalVariant(approval)}>{formatApproval(approval)}</Badge></td>
                      <td className="px-6 py-4"><Badge variant={user.status === 'Active' ? 'success' : 'neutral'}>{user.status}</Badge></td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">{user.lastLogin || 'Never'}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {userCanBeManaged && (
                            <button
                              onClick={() => { setEditingUser(user); setShowModal(true); }}
                              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-primary font-medium hover:bg-primary-bg transition-colors"
                            >
                              <Edit className="w-3.5 h-3.5" /> Edit
                            </button>
                          )}

                          {userCanBeManaged && (isPending || isRejected) && (
                            <button
                              onClick={() => handleApprove(user)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success-bg px-2.5 py-1.5 text-xs text-success font-medium hover:bg-success/10 transition-colors"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Approve
                            </button>
                          )}

                          {userCanBeManaged && isPending && (
                            <button
                              onClick={() => handleReject(user)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive-bg px-2.5 py-1.5 text-xs text-destructive font-medium hover:bg-destructive/10 transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          )}

                          {userCanBeManaged && !userIsCurrentUser && !isPending && !isRejected && (
                            <button
                              onClick={() => handleToggleStatus(user)}
                              className={'inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ' + (user.status === 'Active' ? 'border-destructive/30 bg-destructive-bg text-destructive hover:bg-destructive/10' : 'border-success/30 bg-success-bg text-success hover:bg-success/10')}
                            >
                              {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading users...</p>
            ) : filtered.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Showing {pageStartIndex + 1}-{pageEndIndex} of {filtered.length} user{filtered.length !== 1 ? 's' : ''}
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

      {showModal && (
        <UserModal
          user={editingUser}
          roles={assignableRoles}
          isCurrentUser={isCurrentUser(editingUser)}
          onClose={() => { setShowModal(false); setEditingUser(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
