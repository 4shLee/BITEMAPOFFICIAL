import { useEffect, useState } from 'react';
import { Search, UserPlus, Edit, X, Users as UsersIcon, ShieldCheck, UserCheck, UserX, CheckCircle, XCircle } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { toast } from 'sonner';
import { usersAPI } from '../../lib/services/api';
import { ASSIGNABLE_ROLES, getRoleLabel, getStoredUser, isSystemAdminRole, normalizeRoleKey } from '../../lib/auth/roleAccess';

const ROLES = ASSIGNABLE_ROLES;
function UserModal({ user, roles, onClose, onSave }: { user: any; roles: typeof ASSIGNABLE_ROLES; onClose: () => void; onSave: (data: any) => void; }) {
  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    role: normalizeRoleKey(user.role || 'nurse_vaccinator'),
    status: user.status || 'Active',
    password: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required.');
      return;
    }
    const { password, ...userData } = form;
    onSave(password.trim() ? { ...userData, password: password.trim() } : userData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Edit User</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Enter full name"
              className="w-full px-3.5 py-2.5 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
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
              className="w-full px-3.5 py-2.5 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
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

  const filtered = users.filter(u => {
    const approval = u.approval_status || 'approved';
    const term = searchTerm.toLowerCase();
    return (
      u.name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.role?.toLowerCase().includes(term) ||
      getRoleLabel(u.role).toLowerCase().includes(term) ||
      approval.toLowerCase().includes(term)
    );
  });

  const handleSave = async (formData: any) => {
    if (!editingUser) return;

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
    try {
      await usersAPI.approve(user.id, user.role);
      toast.success(user.name + ' has been approved.');
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve account.');
    }
  };

  const handleReject = async (user: any) => {
    try {
      await usersAPI.reject(user.id);
      toast.success(user.name + ' has been rejected.');
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject account.');
    }
  };

  const handleToggleStatus = async (user: any) => {
    const next = user.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await usersAPI.update(user.id, { status: next });
      toast.success(user.name + ' has been ' + (next === 'Active' ? 'activated' : 'deactivated') + '.');
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status.');
    }
  };

  const totalPending = users.filter(u => (u.approval_status || 'approved') === 'pending').length;
  const totalActive = users.filter(u => u.status === 'Active' && (u.approval_status || 'approved') === 'approved').length;
  const totalAdmins = users.filter(u => normalizeRoleKey(u.role) === 'system_admin').length;
  const totalNurses = users.filter(u => normalizeRoleKey(u.role) === 'nurse_vaccinator').length;

  return (
    <div className="flex-1">
      <Header title="User Management" breadcrumbs={['System', 'User Management']} />

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Users', value: users.length, icon: UsersIcon, color: 'text-accent', bg: 'bg-accent-bg' },
            { label: 'Pending Requests', value: totalPending, icon: UserPlus, color: 'text-warning', bg: 'bg-warning-bg' },
            { label: 'Active Users', value: totalActive, icon: UserCheck, color: 'text-success', bg: 'bg-success-bg' },
            { label: 'System Admins', value: totalAdmins, icon: ShieldCheck, color: 'text-destructive', bg: 'bg-destructive-bg' },
            { label: 'Nurse/Vaccinators', value: totalNurses, icon: UserX, color: 'text-primary', bg: 'bg-primary-bg' },
          ].map(s => (
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
                placeholder="Search by name, email, role, or approval status..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
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
                ) : filtered.map(user => {
                  const approval = user.approval_status || 'approved';
                  const isPending = approval === 'pending';
                  const isRejected = approval === 'rejected';
                  const canManageUser = currentUserIsSystemAdmin || normalizeRoleKey(user.role) !== 'system_admin';

                  return (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
                            {user.name?.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-foreground">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{user.email}</td>
                      <td className="px-6 py-4"><Badge variant={getRoleVariant(user.role)}>{getRoleLabel(user.role)}</Badge></td>
                      <td className="px-6 py-4"><Badge variant={getApprovalVariant(approval)}>{formatApproval(approval)}</Badge></td>
                      <td className="px-6 py-4"><Badge variant={user.status === 'Active' ? 'success' : 'neutral'}>{user.status}</Badge></td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">{user.lastLogin || 'Never'}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {canManageUser && (
                            <button
                              onClick={() => { setEditingUser(user); setShowModal(true); }}
                              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-primary font-medium hover:bg-primary-bg transition-colors"
                            >
                              <Edit className="w-3.5 h-3.5" /> Edit
                            </button>
                          )}

                          {canManageUser && (isPending || isRejected) && (
                            <button
                              onClick={() => handleApprove(user)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success-bg px-2.5 py-1.5 text-xs text-success font-medium hover:bg-success/10 transition-colors"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Approve
                            </button>
                          )}

                          {canManageUser && isPending && (
                            <button
                              onClick={() => handleReject(user)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive-bg px-2.5 py-1.5 text-xs text-destructive font-medium hover:bg-destructive/10 transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          )}

                          {canManageUser && !isPending && !isRejected && (
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

          <div className="px-6 py-4 border-t border-border">
            <p className="text-sm text-muted-foreground">Showing {filtered.length} of {users.length} users</p>
          </div>
        </div>
      </div>

      {showModal && (
        <UserModal
          user={editingUser}
          roles={assignableRoles}
          onClose={() => { setShowModal(false); setEditingUser(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
