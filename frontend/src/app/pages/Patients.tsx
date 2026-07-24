import { useState, useEffect } from 'react';
import { Search, Filter, Plus, Edit, Eye, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { barangaysAPI, patientsAPI } from '../../lib/services/api';
import { canPerformAction, getStoredUser } from '../../lib/auth/roleAccess';
import { getPatientDisplayName } from '../../lib/patient';

export function Patients() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const canCreatePatient = canPerformAction(currentUser?.role, 'patients.create');
  const canUpdatePatient = canPerformAction(currentUser?.role, 'patients.update');
  const canDeletePatient = canPerformAction(currentUser?.role, 'patients.delete');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [barangayId, setBarangayId] = useState('');
  const [barangays, setBarangays] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState<10 | 20 | 25 | 50>(20);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
    from: null as number | null,
    to: null as number | null,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    barangaysAPI.getAll()
      .then((response) => setBarangays(Array.isArray(response.data) ? response.data : []))
      .catch(() => setBarangays([]));
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPatients() {
      try {
        setLoading(true);
        setLoadError(false);
        const response = await patientsAPI.getAll({
          page: currentPage,
          per_page: perPage,
          search: debouncedSearch,
          barangay_id: barangayId,
        }, controller.signal);
        if (!response.success || !Array.isArray(response.data)) {
          throw new Error('Unexpected Patient Registry response.');
        }

        setPatients(response.data);
        setPagination(response.pagination || {
          current_page: 1,
          last_page: 1,
          per_page: perPage,
          total: 0,
          from: null,
          to: null,
        });
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
        setPatients([]);
        setLoadError(true);
        toast.error('Failed to load patients');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadPatients();
    return () => controller.abort();
  }, [barangayId, currentPage, debouncedSearch, perPage, refreshKey]);

  const handleEdit = (patient: any) => {
    navigate('/patients/' + patient.id + '/edit');
  };

  const handleDelete = async (patient: any) => {
    if (!confirm('Delete this patient record? Related incidents, PEP schedules, and notifications will also be removed.')) return;

    try {
      await patientsAPI.delete(String(patient.id));
      toast.success('Patient deleted successfully');
      if (patients.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      } else {
        setRefreshKey((key) => key + 1);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete patient');
    }
  };

  const handleCreate = () => {
    navigate('/patients/new');
  };

  return (
    <div className="min-h-screen flex-1 bg-background">
      <Header title="Patient Registry" breadcrumbs={['Patients', 'Registry']} />

      <div className="px-5 py-5 lg:px-7 lg:py-6">
        <div className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm shadow-slate-900/5">
          <div className="border-b border-border px-5 py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search patients by name, barangay..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 w-full rounded-full border border-input bg-input-background pl-10 pr-4 text-sm shadow-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex min-w-[180px] items-center gap-2 rounded-lg border border-input bg-input-background px-3">
                <Filter className="h-4 w-4" />
                <select
                  aria-label="Filter patients by barangay"
                  value={barangayId}
                  onChange={(event) => {
                    setBarangayId(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
                >
                  <option value="">All barangays</option>
                  {barangays.map((barangay) => (
                    <option key={barangay.id} value={barangay.id}>{barangay.name}</option>
                  ))}
                </select>
              </div>
              {canCreatePatient && (
                <Button variant="primary" size="md" onClick={handleCreate}>
                  <Plus className="h-4 w-4" />
                  Add Patient
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/60 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 text-left">Patient Name</th>
                  <th className="px-5 py-3 text-left">Age</th>
                  <th className="px-5 py-3 text-left">Sex</th>
                  <th className="px-5 py-3 text-left">Barangay</th>
                  <th className="px-5 py-3 text-left">Contact Number</th>
                  <th className="px-5 py-3 text-left">Date Registered</th>
                  <th className="px-5 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: Math.min(perPage, 6) }, (_, row) => (
                    <tr key={'patient-skeleton-' + row} aria-hidden="true">
                      {Array.from({ length: 7 }, (_, column) => (
                        <td key={column} className="px-5 py-4">
                          <div className="h-4 animate-pulse rounded bg-muted" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : loadError ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center">
                      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 text-sm text-muted-foreground">
                        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
                        <div>
                          <p className="font-semibold text-foreground">Unable to load patients</p>
                          <p className="mt-1">The Patient Registry request failed. Please try again.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setRefreshKey((key) => key + 1)}>
                          <RefreshCw className="h-4 w-4" />
                          Try Again
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : patients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-muted-foreground">
                      {searchTerm.trim() ? 'No patients match your search' : 'No patients found'}
                    </td>
                  </tr>
                ) : (
                  patients.map((patient) => (
                    <tr key={patient.id} className="transition-colors hover:bg-muted/45">
                      <td className="px-5 py-4 text-sm font-semibold text-foreground">{getPatientDisplayName(patient) || 'Unknown Patient'}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{patient.age}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{patient.sex}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{patient.residence_barangay || patient.barangay?.name || 'Not recorded'}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{patient.contact_number || 'Not provided'}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {new Date(patient.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/patients/${patient.id}`)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-primary-bg text-primary shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-bg/80"
                            title="View Details"
                            aria-label="View patient details"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          {canUpdatePatient && (
                            <button
                              onClick={() => handleEdit(patient)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-primary-bg text-primary shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-bg/80"
                              title="Edit"
                              aria-label="Edit patient"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                          )}
                          {canDeletePatient && (
                            <button
                              onClick={() => handleDelete(patient)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-destructive/20 bg-destructive-bg text-destructive shadow-sm transition-colors hover:border-destructive/40 hover:bg-destructive-bg/80"
                              title="Delete"
                              aria-label="Delete patient"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {pagination.from || 0}-{pagination.to || 0} of {pagination.total} patients
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Patients per page"
                value={perPage}
                onChange={(event) => {
                  setPerPage(Number(event.target.value) as 10 | 20 | 25 | 50);
                  setCurrentPage(1);
                }}
                className="h-9 rounded-lg border border-input bg-input-background px-2 text-sm text-foreground"
              >
                {[10, 20, 25, 50].map((size) => <option key={size} value={size}>{size} per page</option>)}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={loading || pagination.current_page <= 1}
              >
                Previous
              </Button>
              <span className="px-1 text-sm text-muted-foreground">
                Page {pagination.current_page} of {pagination.last_page}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((page) => Math.min(pagination.last_page, page + 1))}
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
