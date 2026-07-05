import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, CalendarDays, Edit, MapPin, PawPrint, Stethoscope, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Layout/Header';
import { Button } from '../components/UI/Button';
import { Badge } from '../components/UI/Badge';
import { incidentsAPI } from '../../lib/services/api';
import { canPerformAction, getStoredUser } from '../../lib/auth/roleAccess';

const whoGuidance: Record<string, string> = {
  'Category I': 'No PEP required if reliable history. Provide health advice.',
  'Category II': 'PEP vaccination recommended.',
  'Category III': 'PEP vaccination and RIG evaluation recommended.',
};

function categoryVariant(category?: string) {
  switch (category) {
    case 'Category I': return 'success';
    case 'Category II': return 'warning';
    case 'Category III': return 'danger';
    default: return 'neutral';
  }
}

function DetailItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value || 'Not recorded'}</p>
    </div>
  );
}

export function IncidentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const canUpdateIncident = canPerformAction(currentUser?.role, 'incidents.update');
  const [incident, setIncident] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadIncident() {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);
        const response = await incidentsAPI.getById(id);
        setIncident(response.data);
      } catch (loadError: any) {
        setError(loadError.message || 'Unable to load incident report.');
      } finally {
        setLoading(false);
      }
    }

    loadIncident();
  }, [id]);

  return (
    <div className="flex-1 bg-[#f6f8f7] min-h-screen">
      <Header title="Incident Details" breadcrumbs={['Incidents', 'View Incident']} />

      <div className="px-5 py-5 lg:px-7 lg:py-6">
        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
            Loading incident report...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive-bg p-8 text-center">
            <p className="text-sm font-semibold text-destructive">{error}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => navigate('/incidents')}>
              Back to Incidents
            </Button>
          </div>
        ) : (
          <div className="mx-auto max-w-6xl space-y-5">
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <button
                  type="button"
                  onClick={() => navigate('/incidents')}
                  className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Incidents
                </button>
                <h2 className="text-xl font-bold text-foreground">{incident.patient?.full_name || 'Unknown Patient'}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Incident #{incident.id} clinical and location details.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={categoryVariant(incident.who_category)}>{incident.who_category || 'No WHO Category'}</Badge>
                <Badge variant={incident.status === 'Completed' ? 'success' : 'info'}>{incident.status || 'Active'}</Badge>
                {canUpdateIncident && (
                  <Button type="button" size="sm" onClick={() => navigate('/incidents/' + incident.id + '/edit')}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Incident
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <UserRound className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">Patient Information</h3>
                </div>
                <div className="grid gap-4">
                  <DetailItem label="Full Name" value={incident.patient?.full_name} />
                  <DetailItem label="Age / Sex" value={[incident.patient?.age, incident.patient?.sex].filter(Boolean).join(' / ')} />
                  <DetailItem label="Contact Number" value={incident.contact_number || incident.patient?.contact_number} />
                  <DetailItem label="Address" value={incident.patient?.address} />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <PawPrint className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">Exposure Details</h3>
                </div>
                <div className="grid gap-4">
                  <DetailItem label="Date of Incident" value={incident.incident_date} />
                  <DetailItem label="Time of Incident" value={incident.incident_time} />
                  <DetailItem label="Animal Type" value={incident.animal_type} />
                  <DetailItem label="Bite Site" value={incident.bite_site || incident.bite_location} />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">Incident Location</h3>
                </div>
                <div className="grid gap-4">
                  <DetailItem label="Barangay of Incident" value={incident.barangay?.name} />
                  <DetailItem label="Coordinates" value={incident.location_lat && incident.location_lng ? incident.location_lat + ', ' + incident.location_lng : 'Barangay only'} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">Clinical Review Context</h3>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-bold text-emerald-950">
                    {whoGuidance[incident.who_category] || 'WHO category guidance is unavailable for this record.'}
                  </p>
                  <p className="mt-2 text-xs text-emerald-700">
                    Final clinical decision is subject to doctor assessment and clinic protocol.
                  </p>
                </div>
                {incident.notes && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-muted-foreground">Encoded Notes</p>
                    <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-muted/40 p-4 text-sm text-foreground">{incident.notes}</pre>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">PEP Schedule</h3>
                </div>
                <div className="space-y-2">
                  {(incident.pep_schedules || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No PEP schedule found.</p>
                  ) : (
                    incident.pep_schedules.map((dose: any) => (
                      <div key={dose.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                        <span className="font-semibold text-foreground">Day {dose.dose_day}</span>
                        <span className="text-muted-foreground">{dose.scheduled_date}</span>
                      </div>
                    ))
                  )}
                </div>
                <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => navigate('/pep-schedule')}>
                  Open PEP Schedule
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
