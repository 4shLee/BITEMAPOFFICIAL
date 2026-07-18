import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, CalendarDays, Edit, MapPin, PawPrint, Stethoscope, UserRound } from 'lucide-react';
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
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground" title={String(value || 'Not recorded')}>
        {value || 'Not recorded'}
      </p>
    </div>
  );
}

function ClinicalRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="grid grid-cols-[145px_minmax(0,1fr)] gap-3 border-b border-border/70 py-2 last:border-0">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value || 'Not recorded'}</span>
    </div>
  );
}

function readNoteValue(notes: string | undefined, label: string) {
  if (!notes) return '';
  const line = notes.split('\n').find((entry) => entry.toLowerCase().startsWith(label.toLowerCase() + ':'));
  return line ? line.slice(line.indexOf(':') + 1).trim() : '';
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

  const patient = incident?.patient;
  const patientName = patient?.full_name || 'Unknown Patient';
  const ageSex = [patient?.age, patient?.sex].filter(Boolean).join(' / ');
  const contactNumber = incident?.contact_number || patient?.contact_number;
  const biteSite = incident?.bite_site || incident?.bite_location;
  const barangayName = incident?.barangay?.name;
  const hasLocationPin = Boolean(incident?.location_lat && incident?.location_lng);
  const barangayLat = incident?.barangay?.latitude ? String(incident.barangay.latitude) : '';
  const barangayLng = incident?.barangay?.longitude ? String(incident.barangay.longitude) : '';
  const incidentLat = incident?.location_lat ? String(incident.location_lat) : '';
  const incidentLng = incident?.location_lng ? String(incident.location_lng) : '';
  const savedLocationPrecision = readNoteValue(incident?.notes, 'Location Precision');
  const isApproximateBarangayPin = hasLocationPin && barangayLat === incidentLat && barangayLng === incidentLng;
  const locationPinStatus = savedLocationPrecision === 'Exact Pin'
    ? 'Exact pin selected'
    : savedLocationPrecision === 'Barangay Only'
      ? 'Barangay only'
      : hasLocationPin
        ? (isApproximateBarangayPin ? 'Barangay only' : 'Exact pin selected')
        : 'Barangay only';
  const coordinates = hasLocationPin ? 'Latitude: ' + incidentLat + ' / Longitude: ' + incidentLng : '';
  const oneLineSummary = [
    ageSex,
    contactNumber,
    incident?.animal_type,
    biteSite ? 'Bite site: ' + biteSite : '',
    barangayName ? 'Barangay: ' + barangayName : '',
  ].filter(Boolean).join(' • ');
  const clinicalNotes = [
    ['Exposure Type', readNoteValue(incident?.notes, 'Exposure Type')],
    ['Animal Status', readNoteValue(incident?.notes, 'Animal Status')],
    ['Animal Condition', readNoteValue(incident?.notes, 'Animal Condition')],
    ['Wound Washed', readNoteValue(incident?.notes, 'Wound Washed')],
    ['Date of First Consult', readNoteValue(incident?.notes, 'Date of First Consult')],
    ['SMS Consent', readNoteValue(incident?.notes, 'SMS Consent')],
  ];
  const pepSchedules = [...(incident?.pep_schedules || [])].sort((a, b) => (a.dose_day ?? 0) - (b.dose_day ?? 0));

  return (
    <div className="flex-1 bg-[#f6f8f7] min-h-screen">
      <Header title="Incident Details" breadcrumbs={['Incidents', 'View Incident']} />

      <div className="px-5 py-4 lg:px-7 lg:py-5">
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
          <div className="mx-auto max-w-6xl space-y-4">
            <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm shadow-emerald-950/5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => navigate('/incidents')}
                    className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Incidents
                </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-extrabold text-foreground">{patientName}</h2>
                    <Badge variant={categoryVariant(incident.who_category)}>{incident.who_category || 'No WHO Category'}</Badge>
                    <Badge variant={incident.status === 'Completed' ? 'success' : 'info'}>{incident.status || 'Active'}</Badge>
                  </div>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    {oneLineSummary || 'Incident #' + incident.id + ' clinical and location details.'}
                  </p>
              </div>
                {canUpdateIncident && (
                  <Button type="button" size="sm" className="shrink-0" onClick={() => navigate('/incidents/' + incident.id + '/edit')}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Incident
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="rounded-xl bg-emerald-50 p-2 text-primary">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-extrabold text-foreground">Incident Summary</h3>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  <section className="rounded-xl bg-[#f8faf9] p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-bold text-foreground">Patient</h4>
                    </div>
                    <div className="grid gap-3">
                      <DetailItem label="Full Name" value={patientName} />
                      <DetailItem label="Age / Sex" value={ageSex} />
                      <DetailItem label="Contact Number" value={contactNumber} />
                      <DetailItem label="Address" value={patient?.address} />
                    </div>
                  </section>

                  <section className="rounded-xl bg-[#f8faf9] p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <PawPrint className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-bold text-foreground">Exposure</h4>
                    </div>
                    <div className="grid gap-3">
                      <DetailItem label="Date of Incident" value={incident.incident_date} />
                      <DetailItem label="Time of Incident" value={incident.incident_time} />
                      <DetailItem label="Animal Type" value={incident.animal_type} />
                      <DetailItem label="Bite Site" value={biteSite} />
                      <DetailItem label="WHO Category" value={incident.who_category} />
                    </div>
                  </section>

                  <section className="rounded-xl bg-[#f8faf9] p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-bold text-foreground">Location</h4>
                    </div>
                    <div className="grid gap-3">
                      <DetailItem label="Barangay of Incident" value={barangayName} />
                      <DetailItem label="Location Pin Status" value={locationPinStatus} />
                      {hasLocationPin && <DetailItem label="Coordinates" value={coordinates} />}
                    </div>
                  </section>
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <h3 className="text-base font-extrabold text-foreground">PEP Schedule</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pepSchedules.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No PEP schedule found.</p>
                    ) : (
                      pepSchedules.map((dose: any) => (
                        <div key={dose.id} className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                          <p className="text-xs font-extrabold text-emerald-900">Day {dose.dose_day}</p>
                          <p className="text-xs font-semibold text-emerald-700">{dose.scheduled_date}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => navigate('/pep-schedule?incident_id=' + encodeURIComponent(String(incident.id)))}
                  >
                    Open PEP Schedule
                  </Button>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-primary" />
                    <h3 className="text-base font-extrabold text-emerald-950">Clinical Review</h3>
                  </div>
                  <p className="text-sm font-bold text-emerald-950">
                    {whoGuidance[incident.who_category] || 'WHO category guidance is unavailable for this record.'}
                  </p>
                  <p className="mt-1 text-xs font-medium text-emerald-700">
                    Final clinical decision is subject to doctor assessment and clinic protocol.
                  </p>
                </div>
              </aside>
            </div>

            <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-primary" />
                <h3 className="text-base font-extrabold text-foreground">Encoded Clinical Details</h3>
              </div>
              {incident.notes ? (
                <div className="grid gap-x-5 md:grid-cols-2">
                  {clinicalNotes.map(([label, value]) => (
                    <ClinicalRow key={label} label={label} value={value} />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-muted/30 px-3 py-2 text-sm text-muted-foreground">No encoded clinical notes recorded.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
