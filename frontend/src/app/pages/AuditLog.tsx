import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search, XCircle } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/UI/Badge';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Button } from '../components/UI/Button';
import { auditLogsAPI, getErrorMessage } from '../../lib/services/api';
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
  { value: 'Create record', label: 'Create Record' },
  { value: 'Edit record', label: 'Edit Record' },
  { value: 'Delete record', label: 'Delete Record' },
  { value: 'Approve user', label: 'Approve User' },
  { value: 'Reject user', label: 'Reject User' },
  { value: 'Update role', label: 'Update Role' },
  { value: 'Send SMS', label: 'Send SMS' },
  { value: 'Export report', label: 'Export Report' },
  { value: 'Update inventory', label: 'Update Inventory' },
  { value: 'Mark vaccination as completed', label: 'Mark Vaccination as Completed' },
  { value: 'Reschedule appointment', label: 'Reschedule Appointment' },
  { value: 'Cancel appointment', label: 'Cancel Appointment' },
];

const today = new Date().toISOString().split('T')[0];
const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
const pageSizeOptions = [10, 15, 25, 50];
const DEFAULT_PAGE_SIZE = 10;
const defaultFilters = {
  search: '',
  date_from: firstDay,
  date_to: today,
  user: '',
  role: 'All',
  module: 'All',
  action: 'All',
};

const getRoleVariant = (role: string) => {
  switch (getRoleLabel(role)) {
    case 'System Administrator': return 'danger';
    case 'Clinic Administrator':
    case 'Doctor': return 'info';
    case 'Nurse/Vaccinator': return 'success';
    default: return 'neutral';
  }
};

const toTitleCaseAction = (value?: string) => {
  if (!value) return '-';
  if (value === 'Send SMS') return value;
  return value
    .split(' ')
    .map((word) => word.length <= 2 ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const formatManilaTimestamp = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value.replace(' ', 'T') + '+08:00');
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getPageNumbers = (currentPage: number, totalPages: number) => {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  const adjustedStart = Math.max(1, end - 4);
  return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
};

export function AuditLog() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [pagination, setPagination] = useState({ current_page: 1, per_page: DEFAULT_PAGE_SIZE, total: 0, last_page: 1, from: 0, to: 0 });
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<'PDF' | 'Excel' | ''>('');
  const [filters, setFilters] = useState(defaultFilters);
  const [searchInput, setSearchInput] = useState(defaultFilters.search);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFilters((current) => ({ ...current, search: searchInput }));
      setCurrentPage(1);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const queryFilters = useMemo(() => ({
    search: filters.search,
    date_from: filters.date_from,
    date_to: filters.date_to,
    user: filters.user,
    role: filters.role,
    module: filters.module,
    action: filters.action,
    page: currentPage,
    per_page: pageSize,
  }), [filters, currentPage, pageSize]);

  const exportFilters = useMemo(() => ({
    search: filters.search,
    date_from: filters.date_from,
    date_to: filters.date_to,
    user: filters.user,
    role: filters.role,
    module: filters.module,
    action: filters.action,
  }), [filters]);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await auditLogsAPI.getAll(queryFilters);
      if (response.success) {
        setLogs(response.data || []);
        setPagination(response.pagination || { current_page: 1, per_page: pageSize, total: 0, last_page: 1, from: 0, to: 0 });
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to load audit logs.'));
    } finally {
      setLoading(false);
    }
  }, [pageSize, queryFilters]);

  const handleDownload = async (format: 'PDF' | 'Excel') => {
    try {
      setDownloading(format);
      const result = await auditLogsAPI.download(exportFilters, format);
      const url = window.URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Audit log ' + format + ' export downloaded.');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to download audit logs.'));
    } finally {
      setDownloading('');
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadLogs(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadLogs]);

  const updateFilters = (nextFilters: Partial<typeof filters>) => {
    setFilters((current) => ({ ...current, ...nextFilters }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput(defaultFilters.search);
    setFilters(defaultFilters);
    setCurrentPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
  };

  const totalEntries = pagination.total || 0;
  const showingFrom = totalEntries === 0 ? 0 : (pagination.from || ((pagination.current_page - 1) * pagination.per_page) + 1);
  const showingTo = totalEntries === 0 ? 0 : (pagination.to || Math.min(pagination.current_page * pagination.per_page, totalEntries));
  const pageNumbers = getPageNumbers(pagination.current_page || currentPage, pagination.last_page || 1);

  return (
    <div className="flex-1">
      <Header title="Audit Log / System Activity" breadcrumbs={['Admin', 'Audit Log']} />

      <div className="p-8 space-y-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Search Activity Logs</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by user, action, module, description, or record ID..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-input-background pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary-bg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <Input type="date" label="Date From" value={filters.date_from} onChange={(e) => updateFilters({ date_from: e.target.value })} />
              <Input type="date" label="Date To" value={filters.date_to} onChange={(e) => updateFilters({ date_to: e.target.value })} />
              <Input type="text" label="User" value={filters.user} onChange={(e) => updateFilters({ user: e.target.value })} placeholder="All users" />
              <Select label="Role" options={roleOptions} value={filters.role} onChange={(e) => updateFilters({ role: e.target.value })} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <Select label="Module" options={moduleOptions} value={filters.module} onChange={(e) => updateFilters({ module: e.target.value })} />
              <Select label="Action" options={actionOptions} value={filters.action} onChange={(e) => updateFilters({ action: e.target.value })} />
              <Select
                label="Page Size"
                options={pageSizeOptions.map((size) => ({ value: String(size), label: String(size) + ' entries' }))}
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              />
              <div className="hidden lg:block" />
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" size="md" onClick={handleClearFilters} disabled={loading || Boolean(downloading)}>
                <XCircle className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleDownload('PDF')} disabled={Boolean(downloading)}>
                  <Download className="w-4 h-4 mr-2" />
                  {downloading === 'PDF' ? 'Exporting PDF...' : 'PDF'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDownload('Excel')} disabled={Boolean(downloading)}>
                  <Download className="w-4 h-4 mr-2" />
                  {downloading === 'Excel' ? 'Exporting Excel...' : 'Excel'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-medium text-foreground">System Activity Log</h2>
              <Badge variant="neutral" size="sm">{totalEntries} result{totalEntries !== 1 ? 's' : ''}</Badge>
            </div>
            <Badge variant="neutral" size="sm">Live database data</Badge>
          </div>

          <div className="max-h-[620px] overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
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
                    <td className="px-6 py-4 text-xs text-muted-foreground font-mono whitespace-nowrap">{formatManilaTimestamp(log.timestamp)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground whitespace-nowrap">{log.user_name}</td>
                    <td className="px-6 py-4"><Badge variant={getRoleVariant(log.user_role)} size="sm">{getRoleLabel(log.user_role)}</Badge></td>
                    <td className="px-6 py-4 text-sm text-foreground whitespace-nowrap">{toTitleCaseAction(log.action)}</td>
                    <td className="px-6 py-4"><Badge variant="neutral" size="sm">{log.module}</Badge></td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">{log.record_id || '-'}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground min-w-[260px]">{log.description || '-'}</td>
                    <td className="px-6 py-4 text-xs text-muted-foreground font-mono">{log.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {showingFrom}-{showingTo} of {totalEntries} audit entries
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={loading || pagination.current_page <= 1}
              >
                Previous
              </Button>
              {pageNumbers.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  disabled={loading}
                  className={
                    'h-8 min-w-8 rounded-lg border px-3 text-xs font-semibold transition-colors ' +
                    (page === pagination.current_page
                      ? 'border-primary bg-primary-bg text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-primary-bg hover:text-primary')
                  }
                >
                  {page}
                </button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((page) => Math.min(pagination.last_page || 1, page + 1))}
                disabled={loading || pagination.current_page >= pagination.last_page}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
