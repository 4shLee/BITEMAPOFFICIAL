import { useEffect, useMemo, useState } from 'react';
import { Download, Search, ShieldCheck } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/UI/Badge';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Button } from '../components/UI/Button';
import { auditLogsAPI } from '../../lib/services/api';
import { toast } from 'sonner';
import { getRoleLabel } from '../../lib/auth/roleAccess';

type AuditLogRow = {
  id: number;
  timestamp: string;
  user_name: string;
  user_role: string;
  action: string;
  module: string;
  record_id?: string;
  description?: string;
  ip_address?: string;
};

const roleOptions = [
  { value: 'All', label: 'All Roles' },
  { value: 'system_admin', label: 'System Administrator' },
  { value: 'Clinic Admin', label: 'Clinic Administrator' },
  { value: 'Doctor', label: 'Doctor' },
  { value: 'Nurse/Vaccinator', label: 'Nurse/Vaccinator' },
  { value: 'System', label: 'System' },
];

const moduleOptions = [
  { value: 'All', label: 'All Modules' },
  { value: 'Authentication', label: 'Authentication' },
  { value: 'User Management', label: 'User Management' },
  { value: 'Patients', label: 'Patients' },
  { value: 'Incidents', label: 'Incidents' },
  { value: 'PEP Schedule', label: 'PEP Schedule' },
  { value: 'Inventory', label: 'Inventory' },
  { value: 'Notifications', label: 'Notifications' },
  { value: 'Reports', label: 'Reports' },
  { value: 'Audit Logs', label: 'Audit Logs' },
  { value: 'Settings', label: 'Settings' },
];

const actionOptions = [
  { value: 'All', label: 'All Actions' },
  { value: 'Login', label: 'Login' },
  { value: 'Logout', label: 'Logout' },
  { value: 'Create record', label: 'Create record' },
  { value: 'Edit record', label: 'Edit record' },
  { value: 'Delete record', label: 'Delete record' },
  { value: 'Approve user', label: 'Approve user' },
  { value: 'Reject user', label: 'Reject user' },
  { value: 'Update role', label: 'Update role' },
  { value: 'Send SMS', label: 'Send SMS' },
  { value: 'Export report', label: 'Export report' },
  { value: 'Update inventory', label: 'Update inventory' },
  { value: 'Mark vaccination as completed', label: 'Mark vaccination as completed' },
  { value: 'Reschedule appointment', label: 'Reschedule appointment' },
  { value: 'Cancel appointment', label: 'Cancel appointment' },
];

const today = new Date().toISOString().split('T')[0];
const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

const getRoleVariant = (role: string) => {
  switch (getRoleLabel(role)) {
    case 'System Administrator': return 'danger';
    case 'Clinic Administrator':
    case 'Doctor': return 'info';
    case 'Nurse/Vaccinator': return 'success';
    default: return 'neutral';
  }
};

export function AuditLog() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [summary, setSummary] = useState({ total: 0, today: 0, critical: 0 });
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<'PDF' | 'Excel' | ''>('');
  const [filters, setFilters] = useState({
    search: '',
    date_from: firstDay,
    date_to: today,
    user: '',
    role: 'All',
    module: 'All',
    action: 'All',
  });

  const queryFilters = useMemo(() => ({
    search: filters.search,
    date_from: filters.date_from,
    date_to: filters.date_to,
    user: filters.user,
    role: filters.role,
    module: filters.module,
    action: filters.action,
  }), [filters]);

  useEffect(() => {
    loadLogs();
  }, [queryFilters]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await auditLogsAPI.getAll(queryFilters);
      if (response.success) {
        setLogs(response.data || []);
        setSummary(response.summary || { total: 0, today: 0, critical: 0 });
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format: 'PDF' | 'Excel') => {
    try {
      setDownloading(format);
      const result = await auditLogsAPI.download(queryFilters, format);
      const url = window.URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Audit log ' + format + ' export downloaded.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to download audit logs.');
    } finally {
      setDownloading('');
    }
  };

  return (
    <div className="flex-1">
      <Header title="Audit Log / System Activity" breadcrumbs={['Admin', 'Audit Log']} />

      <div className="p-8 space-y-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search logs..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 bg-input-background border border-input rounded-lg text-sm"
              />
            </div>
            <Input type="date" label="Date From" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
            <Input type="date" label="Date To" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
            <Input type="text" label="User" value={filters.user} onChange={(e) => setFilters({ ...filters, user: e.target.value })} placeholder="All users" />
            <Select label="Role" options={roleOptions} value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })} />
            <Select label="Module" options={moduleOptions} value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })} />
            <Select label="Action" options={actionOptions} value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} />
            <div className="flex items-end gap-2">
              <Button variant="outline" size="md" onClick={() => handleDownload('PDF')} disabled={Boolean(downloading)}>
                <Download className="w-4 h-4 mr-2" />
                {downloading === 'PDF' ? 'PDF...' : 'PDF'}
              </Button>
              <Button variant="outline" size="md" onClick={() => handleDownload('Excel')} disabled={Boolean(downloading)}>
                <Download className="w-4 h-4 mr-2" />
                {downloading === 'Excel' ? 'Excel...' : 'Excel'}
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-base font-medium text-foreground">System Activity Log</h2>
            <Badge variant="neutral" size="sm">Live database data</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted text-xs font-medium text-muted-foreground">
                  <th className="text-left px-6 py-3">Timestamp</th>
                  <th className="text-left px-6 py-3">User</th>
                  <th className="text-left px-6 py-3">Role</th>
                  <th className="text-left px-6 py-3">Action</th>
                  <th className="text-left px-6 py-3">Module</th>
                  <th className="text-left px-6 py-3">Record</th>
                  <th className="text-left px-6 py-3">Description</th>
                  <th className="text-left px-6 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={8} className="px-6 py-10 text-center text-sm text-muted-foreground">Loading audit logs...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-10 text-center text-sm text-muted-foreground">No audit logs found.</td></tr>
                ) : logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 text-xs text-muted-foreground font-mono whitespace-nowrap">{log.timestamp}</td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground whitespace-nowrap">{log.user_name}</td>
                    <td className="px-6 py-4"><Badge variant={getRoleVariant(log.user_role)} size="sm">{getRoleLabel(log.user_role)}</Badge></td>
                    <td className="px-6 py-4 text-sm text-foreground whitespace-nowrap">{log.action}</td>
                    <td className="px-6 py-4"><Badge variant="neutral" size="sm">{log.module}</Badge></td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">{log.record_id || '-'}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground min-w-[260px]">{log.description || '-'}</td>
                    <td className="px-6 py-4 text-xs text-muted-foreground font-mono">{log.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-border">
            <p className="text-sm text-muted-foreground">Showing {logs.length} audit entries</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-xs text-muted-foreground mb-2">Filtered Activities</p>
            <p className="text-2xl font-semibold text-foreground">{summary.total}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-xs text-muted-foreground mb-2">Activities Today</p>
            <p className="text-2xl font-semibold text-foreground">{summary.today}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-warning" />
              <p className="text-xs text-muted-foreground">Critical Actions</p>
            </div>
            <p className="text-2xl font-semibold text-warning">{summary.critical}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
