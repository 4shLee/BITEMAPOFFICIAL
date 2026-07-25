import { useState, useEffect } from 'react';
import { Search, Filter, Plus, Edit, Trash2, Eye, ClipboardCheck, Stethoscope, RefreshCw, X, AlertCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Header } from '../Layout/Header';
import { Badge } from '../UI/Badge';
import { Button } from '../UI/Button';
import {
  barangaysAPI,
  incidentsAPI,
  type BarangayListItem,
  type RegistryIncident,
  type RegistryPagination,
} from '../../../lib/services/api';
import { canPerformAction, getStoredUser, normalizeRoleKey } from '../../../lib/auth/roleAccess';
import { getPatientDisplayName } from '../../../lib/patient';

const whoGuidance: Record<string, string> = {
  'Category I': 'No PEP required if reliable history. Provide health advice.',
  'Category II': 'PEP vaccination recommended.',
  'Category III': 'PEP vaccination and RIG evaluation recommended.',
};

export function IncidentListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getStoredUser();
  const currentRole = normalizeRoleKey(currentUser?.role);
  const isDoctor = currentRole === 'doctor';
  const canCreateIncident = canPerformAction(currentUser?.role, 'incidents.create');
  const canUpdateIncident = canPerformAction(currentUser?.role, 'incidents.update');
  const canDeleteIncident = canPerformAction(currentUser?.role, 'incidents.delete');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [barangayId, setBarangayId] = useState('');
  const [barangays, setBarangays] = useState<BarangayListItem[]>([]);
  const [incidents, setIncidents] = useState<RegistryIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reviewIncident, setReviewIncident] = useState<RegistryIncident | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState<10 | 20 | 25 | 50>(20);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pagination, setPagination] = useState<RegistryPagination>({
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

    async function loadIncidents() {
      try {
        setLoading(true);
        setLoadError(false);
        const response = await incidentsAPI.getAll({
          page: currentPage,
          per_page: perPage,
          search: debouncedSearch,
          status,
          barangay_id: barangayId,
        }, controller.signal);
        if (!response.success || !Array.isArray(response.data)) {
          throw new Error('Unexpected Incident Management response.');
        }

        setIncidents(response.data);
        setPagination(response.pagination);
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setIncidents([]);
        setLoadError(true);
        toast.error('Failed to load incidents');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadIncidents();
    return () => controller.abort();
  }, [barangayId, currentPage, debouncedSearch, location.key, perPage, refreshKey, status]);

  const handleDelete = async (id: number | string) => {
    if (!confirm('Delete this incident? The patient record will also be removed if this is their only incident.')) return;

    try {
      await incidentsAPI.delete(String(id));
      toast.success('Incident deleted successfully');
      if (incidents.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      } else {
        setRefreshKey((key) => key + 1);
      }
    } catch {
      toast.error('Failed to delete incident');
    }
  };

  const handleEdit = (incident: RegistryIncident) => {
    navigate('/incidents/' + incident.id + '/edit');
  };

  const handleCreate = () => {
    navigate('/incidents/new');
  };

  const getCategoryVariant = (category?: string | null) => {
    switch (category) {
      case 'Category I': return 'success';
      case 'Category II': return 'warning';
      case 'Category III': return 'danger';
      default: return 'neutral';
    }
  };

  const getStatusVariant = (status?: string | null) => {
    switch (status) {
      case 'Active': return 'info';
      case 'Completed': return 'success';
      case 'Pending': return 'warning';
      default: return 'neutral';
    }
  };

  const getReviewStatus = (incident: RegistryIncident) => {
    const status = incident.status || 'Active';
    if (status === 'Completed') return { label: 'PEP Approved', variant: 'success' as const };
    if (status === 'Missed' || status === 'Lost to Follow-up') return { label: 'Needs Follow-up', variant: 'warning' as const };
    if (status === 'Reviewed') return { label: 'Reviewed', variant: 'info' as const };
    return { label: 'Pending Review', variant: 'neutral' as const };
  };

  const handleReview = (incident: RegistryIncident) => {
    setReviewIncident(incident);
  };

  const handlePepRecommendation = (incident: RegistryIncident) => {
    navigate('/pep-schedule?incident_id=' + encodeURIComponent(String(incident.id)), {
      state: { incidentId: incident.id, patientId: incident.patient?.id },
    });
  };

  return (
    <div className="flex-1">
      <Header title="Incident Management" breadcrumbs={['Incidents', 'All Incidents']} />

      <div className="p-8">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search incidents by patient, barangay..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-input-background border border-input rounded-lg text-sm"
                />
              </div>
              <div className="flex min-w-[160px] items-center gap-2 rounded-lg border border-input bg-input-background px-3">
                <Filter className="h-4 w-4" />
                <select
                  aria-label="Filter incidents by status"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
                >
                  <option value="">All statuses</option>
                  {['Active', 'Completed', 'Missed', 'Lost to Follow-up'].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>
              <select
                aria-label="Filter incidents by barangay"
                value={barangayId}
                onChange={(event) => {
                  setBarangayId(event.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 min-w-[160px] rounded-lg border border-input bg-input-background px-3 text-sm text-foreground outline-none"
              >
                <option value="">All barangays</option>
                {barangays.map((barangay) => (
                  <option key={barangay.id} value={barangay.id}>{barangay.name}</option>
                ))}
              </select>
              {canCreateIncident && (
                <Button variant="primary" size="md" onClick={handleCreate}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Incident
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted text-xs font-medium text-muted-foreground">
                  <th className="text-left px-6 py-3">Patient Name</th>
                  <th className="text-left px-6 py-3">Date of Incident</th>
                  <th className="text-left px-6 py-3">Animal Type</th>
                  <th className="text-left px-6 py-3">Bite Site</th>
                  <th className="text-left px-6 py-3">Barangay</th>
                  <th className="text-left px-6 py-3">WHO Category</th>
                  <th className="text-left px-6 py-3">{isDoctor ? 'Review Status' : 'Status'}</th>
                  <th className="text-left px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: Math.min(perPage, 6) }, (_, row) => (
                    <tr key={'incident-skeleton-' + row} aria-hidden="true">
                      {Array.from({ length: 8 }, (_, column) => (
                        <td key={column} className="px-6 py-4">
                          <div className="h-4 animate-pulse rounded bg-muted" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : loadError ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center">
                      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 text-sm text-muted-foreground">
                        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
                        <div>
                          <p className="font-semibold text-foreground">Unable to load incidents</p>
                          <p className="mt-1">The Incident Management request failed. Please try again.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setRefreshKey((key) => key + 1)}>
                          <RefreshCw className="h-4 w-4" />
                          Try Again
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : incidents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12">
                      {isDoctor ? (
                        <div className="mx-auto max-w-md text-center">
                          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-bg text-primary">
                            <ClipboardCheck className="h-6 w-6" />
                          </div>
                          <h3 className="text-sm font-bold text-foreground">No incident reports for review</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Incident reports created by Nurse/Vaccinator will appear here for clinical review, WHO category validation, and PEP recommendation.
                          </p>
                          <div className="mt-4 flex justify-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setRefreshKey((key) => key + 1)}>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Refresh
                            </Button>
                            {canCreateIncident && (
                              <Button type="button" size="sm" onClick={handleCreate}>
                                Create Incident Report
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-center text-sm text-muted-foreground">No incidents found</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  incidents.map((incident) => {
                    const reviewStatus = getReviewStatus(incident);

                    return (
                    <tr key={incident.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">
                        {getPatientDisplayName(incident.patient || {}) || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {incident.incident_date ? new Date(incident.incident_date).toLocaleDateString() : 'Not recorded'}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{incident.animal_type}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{incident.bite_location}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {incident.barangay?.name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={getCategoryVariant(incident.who_category)}>
                          {incident.who_category}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={isDoctor ? reviewStatus.variant : getStatusVariant(incident.status)}>
                          {isDoctor ? reviewStatus.label : incident.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => navigate('/incidents/' + incident.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/15"
                            title="View incident"
                            aria-label="View incident"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          {isDoctor && (
                            <>
                              <button
                                onClick={() => handleReview(incident)}
                                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-3 text-xs font-semibold leading-none text-primary shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/15"
                                title="Review Incident"
                              >
                                <Stethoscope className="w-4 h-4" />
                                Review
                              </button>
                              <button
                                onClick={() => handlePepRecommendation(incident)}
                                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-accent/20 bg-accent-bg px-3 text-xs font-semibold leading-none text-accent shadow-sm transition-colors hover:border-accent/40"
                                title="PEP Recommendation"
                              >
                                <ClipboardCheck className="w-4 h-4" />
                                PEP
                              </button>
                            </>
                          )}
                          {canUpdateIncident && (
                            <button
                              onClick={() => handleEdit(incident)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/15"
                              title="Edit incident"
                              aria-label="Edit incident"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                          )}
                          {canDeleteIncident && (
                            <button
                              onClick={() => handleDelete(incident.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-destructive/20 bg-destructive/10 text-destructive shadow-sm transition-colors hover:border-destructive/40 hover:bg-destructive/15"
                              title="Delete"
                              aria-label="Delete incident"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {pagination.from || 0}-{pagination.to || 0} of {pagination.total} incidents
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Incidents per page"
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

      {reviewIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Clinical Incident Review</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Doctor validation workspace for encoded incident details and PEP recommendation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewIncident(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                aria-label="Close review"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border p-4">
                  <h3 className="text-sm font-bold text-foreground mb-3">Patient Information</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Patient:</span> <span className="font-semibold">{getPatientDisplayName(reviewIncident.patient || {}) || 'Unknown'}</span></p>
                    <p><span className="text-muted-foreground">Contact:</span> {reviewIncident.contact_number || reviewIncident.patient?.contact_number || 'Not provided'}</p>
                    <p><span className="text-muted-foreground">Barangay:</span> {reviewIncident.barangay?.name || 'Unknown'}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <h3 className="text-sm font-bold text-foreground mb-3">Exposure Details</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Incident Date:</span> {reviewIncident.incident_date || 'Not recorded'}</p>
                    <p><span className="text-muted-foreground">Animal Type:</span> {reviewIncident.animal_type || 'Not recorded'}</p>
                    <p><span className="text-muted-foreground">Bite Site:</span> {reviewIncident.bite_site || reviewIncident.bite_location || 'Not recorded'}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <h3 className="text-sm font-bold text-foreground mb-3">WHO Category Validation</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs font-semibold text-muted-foreground">Encoded WHO Category</p>
                      <p className="mt-1 text-sm font-bold text-foreground">{reviewIncident.who_category || 'Not selected'}</p>
                    </div>
                    <div className="rounded-lg bg-primary-bg p-3">
                      <p className="text-xs font-semibold text-primary">Doctor Validated Category</p>
                      <p className="mt-1 text-sm font-bold text-primary">{reviewIncident.who_category || 'Pending validation'}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Category adjustment is shown as clinical review context only until backend support for a separate validated category is added.
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <h3 className="text-sm font-bold text-emerald-950 mb-2">PEP Recommendation Guide</h3>
                  <p className="text-sm font-semibold text-emerald-900">
                    {whoGuidance[reviewIncident.who_category || ''] || 'Select or verify a WHO category to view recommendation guidance.'}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-emerald-700">
                    Final clinical decision is subject to doctor assessment and clinic protocol.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-border p-4">
                <h3 className="text-sm font-bold text-foreground mb-2">Doctor Assessment / Clinical Notes</h3>
                <textarea
                  className="min-h-28 w-full rounded-lg border border-input bg-input-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Add clinical review notes locally for reference. Backend saving for doctor notes is not enabled yet."
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => handlePepRecommendation(reviewIncident)}>
                    Open PEP Schedule
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/patients/${reviewIncident.patient?.id}`)}>
                    View Patient Details
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setReviewIncident(null)}>
                    Close Review
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
