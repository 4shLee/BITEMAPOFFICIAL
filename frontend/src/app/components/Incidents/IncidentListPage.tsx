import { useState, useEffect } from 'react';
import { Search, Filter, Plus, Edit, Trash2, Eye, ClipboardCheck, Stethoscope, RefreshCw, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Header } from '../Layout/Header';
import { Badge } from '../UI/Badge';
import { Button } from '../UI/Button';
import { incidentsAPI } from '../../../lib/services/api';
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
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewIncident, setReviewIncident] = useState<any>(null);

  useEffect(() => {
    loadIncidents();
  }, [location.state]);

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const response = await incidentsAPI.getAll();
      if (response.success) {
        setIncidents(response.data);
      }
    } catch (error) {
      toast.error('Failed to load incidents');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this incident? The patient record will also be removed if this is their only incident.')) return;

    try {
      await incidentsAPI.delete(id);
      toast.success('Incident deleted successfully');
      loadIncidents();
    } catch (error) {
      toast.error('Failed to delete incident');
    }
  };

  const handleEdit = (incident: any) => {
    navigate('/incidents/' + incident.id + '/edit');
  };

  const handleCreate = () => {
    navigate('/incidents/new');
  };

  const getCategoryVariant = (category: string) => {
    switch (category) {
      case 'Category I': return 'success';
      case 'Category II': return 'warning';
      case 'Category III': return 'danger';
      default: return 'neutral';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Active': return 'info';
      case 'Completed': return 'success';
      case 'Pending': return 'warning';
      default: return 'neutral';
    }
  };

  const getReviewStatus = (incident: any) => {
    const status = incident.status || 'Active';
    if (status === 'Completed') return { label: 'PEP Approved', variant: 'success' as const };
    if (status === 'Missed' || status === 'Lost to Follow-up') return { label: 'Needs Follow-up', variant: 'warning' as const };
    if (status === 'Reviewed') return { label: 'Reviewed', variant: 'info' as const };
    return { label: 'Pending Review', variant: 'neutral' as const };
  };

  const handleReview = (incident: any) => {
    setReviewIncident(incident);
  };

  const handlePepRecommendation = (incident: any) => {
    navigate('/pep-schedule?incident_id=' + encodeURIComponent(String(incident.id)), {
      state: { incidentId: incident.id, patientId: incident.patient?.id },
    });
  };

  const filteredIncidents = incidents.filter((incident) =>
    getPatientDisplayName(incident.patient || {}).toLowerCase().includes(searchTerm.toLowerCase()) ||
    incident.barangay?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    incident.animal_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    incident.who_category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1">
      <Header title="Incident Management" breadcrumbs={['Incidents', 'All Incidents']} />

      <div className="p-8">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search incidents by patient, barangay..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-input-background border border-input rounded-lg text-sm"
                />
              </div>
              <Button variant="outline" size="md">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
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
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-muted-foreground">
                      Loading incidents...
                    </td>
                  </tr>
                ) : filteredIncidents.length === 0 ? (
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
                            <Button type="button" variant="outline" size="sm" onClick={loadIncidents}>
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
                  filteredIncidents.map((incident) => {
                    const reviewStatus = getReviewStatus(incident);

                    return (
                    <tr key={incident.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">
                        {getPatientDisplayName(incident.patient || {}) || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(incident.incident_date).toLocaleDateString()}
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

          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredIncidents.length} incident{filteredIncidents.length !== 1 ? 's' : ''}
            </p>
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
                    {whoGuidance[reviewIncident.who_category] || 'Select or verify a WHO category to view recommendation guidance.'}
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
