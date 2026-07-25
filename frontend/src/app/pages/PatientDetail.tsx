import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, CalendarDays, Edit, Mail, MapPin, Phone, ShieldCheck, Syringe, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { getErrorMessage, patientsAPI, type RegistryPatient } from '../../lib/services/api';
import { canPerformAction, getStoredUser } from '../../lib/auth/roleAccess';
import { composePatientAddress, composePatientFullName } from '../../lib/patient';

function DetailItem({ label, value }: { label: string; value?: string | number | null }) {
  const displayValue = value === null || value === undefined || value === '' ? 'Not recorded' : value;
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground" title={String(displayValue)}>
        {displayValue}
      </p>
    </div>
  );
}

function getCategoryVariant(category?: string) {
  switch (category) {
    case 'Category I': return 'success';
    case 'Category II': return 'warning';
    case 'Category III': return 'danger';
    default: return 'neutral';
  }
}

function getStatusVariant(status?: string) {
  switch (status) {
    case 'Done':
    case 'Completed': return 'success';
    case 'Upcoming':
    case 'Active': return 'info';
    case 'Missed': return 'danger';
    case 'Pending': return 'neutral';
    default: return 'neutral';
  }
}

type PatientPepSchedule = {
  id: number | string;
  dose_day?: number | string | null;
  scheduled_date?: string | null;
  status?: string | null;
};

type PatientIncident = {
  id: number | string;
  incident_date?: string | null;
  created_at?: string | null;
  animal_type?: string | null;
  bite_site?: string | null;
  bite_location?: string | null;
  who_category?: string | null;
  status?: string | null;
  pep_schedules?: PatientPepSchedule[];
};

type PatientNotification = {
  id: number | string;
  message?: string | null;
  notification_type?: string | null;
  type?: string | null;
  sentAt?: string | null;
  sent_at?: string | null;
};

type PatientDetailRecord = RegistryPatient & {
  email?: string | null;
  address?: string | null;
  address_line?: string | null;
  city_municipality?: string | null;
  province?: string | null;
  incidents?: PatientIncident[];
  notifications?: PatientNotification[];
};

export function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const canUpdatePatient = canPerformAction(currentUser?.role, 'patients.update');
  const [patient, setPatient] = useState<PatientDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPatient() {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);
        const response = await patientsAPI.getById(id);
        setPatient(response.data);
      } catch (loadError: unknown) {
        toast.error(getErrorMessage(loadError, 'Failed to load patient record.'));
        setError(getErrorMessage(loadError, 'Unable to load patient record.'));
      } finally {
        setLoading(false);
      }
    }

    loadPatient();
  }, [id]);

  const incidents = useMemo(() => {
    return [...(patient?.incidents || [])].sort((a, b) => {
      const aDate = a.incident_date || a.created_at || '';
      const bDate = b.incident_date || b.created_at || '';
      return String(bDate).localeCompare(String(aDate));
    });
  }, [patient]);

  const latestIncident = incidents[0];
  const pepSchedule = useMemo(() => {
    return [...(latestIncident?.pep_schedules || [])].sort((a, b) => (a.dose_day ?? 0) - (b.dose_day ?? 0));
  }, [latestIncident]);
  const notifications = patient?.notifications || [];
  const completedDoses = pepSchedule.filter((dose) => dose.status === 'Done' || dose.status === 'Completed').length;
  const progress = pepSchedule.length ? Math.round((completedDoses / pepSchedule.length) * 100) : 0;
  const nextDose = pepSchedule.find((dose) => dose.status !== 'Done' && dose.status !== 'Completed');

  const formatDate = (value?: string | null) => {
    if (!value) return 'Not recorded';
    return new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const patientName = composePatientFullName(patient || {}) || 'Unknown Patient';
  const patientAddress = composePatientAddress(patient || {});
  const ageSex = [patient?.age, patient?.sex].filter((value) => value !== null && value !== undefined && value !== '').join(' / ');
  const summary = [
    ageSex,
    patient?.contact_number,
    patient?.residence_barangay || patient?.barangay?.name,
    incidents.length ? incidents.length + ' incident' + (incidents.length !== 1 ? 's' : '') : 'No incidents',
  ].filter(Boolean).join(' - ');

  return (
    <div className="flex-1 bg-[#f6f8f7] min-h-screen">
      <Header title="Patient Record" breadcrumbs={['Patients', 'View Patient']} />

      <div className="px-5 py-4 lg:px-7 lg:py-5">
        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
            Loading patient record...
          </div>
        ) : error || !patient ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive-bg p-8 text-center">
            <p className="text-sm font-semibold text-destructive">{error || 'Patient record not found.'}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => navigate('/patients')}>
              Back to Patients
            </Button>
          </div>
        ) : (
          <div className="mx-auto max-w-6xl space-y-4">
            <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm shadow-emerald-950/5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => navigate('/patients')}
                    className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Patients
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-extrabold text-foreground">{patientName}</h2>
                    <Badge variant={latestIncident ? getCategoryVariant(latestIncident.who_category) : 'neutral'}>
                      {latestIncident?.who_category || 'No Incident'}
                    </Badge>
                    <Badge variant={latestIncident ? getStatusVariant(latestIncident.status) : 'neutral'}>
                      {latestIncident?.status || 'Registry Record'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    {summary || 'Patient registry profile and related clinical activity.'}
                  </p>
                </div>
                {canUpdatePatient && (
                  <Button type="button" size="sm" className="shrink-0" onClick={() => navigate('/patients/' + patient.id + '/edit')}>
                    <Edit className="h-4 w-4" />
                    Edit Patient
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="rounded-xl bg-emerald-50 p-2 text-primary">
                      <UserRound className="h-4 w-4" />
                    </div>
                    <h3 className="text-base font-extrabold text-foreground">Patient Profile Summary</h3>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
                    <section className="rounded-xl bg-[#f8faf9] p-3">
                      <div className="mb-3 flex items-center gap-2">
                        <UserRound className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-bold text-foreground">Demographics</h4>
                      </div>
                      <div className="grid gap-3">
                        <DetailItem label="Full Name" value={patientName} />
                        <DetailItem label="Age / Sex" value={ageSex} />
                        <DetailItem label="Date Registered" value={formatDate(patient.created_at)} />
                      </div>
                    </section>

                    <section className="rounded-xl bg-[#f8faf9] p-3">
                      <div className="mb-3 flex items-center gap-2">
                        <Phone className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-bold text-foreground">Contact</h4>
                      </div>
                      <div className="grid gap-3">
                        <DetailItem label="Contact Number" value={patient.contact_number} />
                        <DetailItem label="Email" value={patient.email} />
                        <DetailItem label="Notification Logs" value={notifications.length} />
                      </div>
                    </section>

                    <section className="rounded-xl bg-[#f8faf9] p-3">
                      <div className="mb-3 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-bold text-foreground">Location</h4>
                      </div>
                      <div className="grid gap-3">
                        <DetailItem label="Patient Residential Address" value={patientAddress} />
                        <DetailItem label="Barangay" value={patient.residence_barangay || patient.barangay?.name} />
                      </div>
                    </section>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <h3 className="text-base font-extrabold text-foreground">Related Incident Summary</h3>
                  </div>
                  {latestIncident ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <DetailItem label="Latest Incident" value={formatDate(latestIncident.incident_date)} />
                      <DetailItem label="Animal Type" value={latestIncident.animal_type} />
                      <DetailItem label="Bite Site" value={latestIncident.bite_site || latestIncident.bite_location} />
                      <DetailItem label="WHO Category" value={latestIncident.who_category} />
                    </div>
                  ) : (
                    <p className="rounded-xl bg-muted/30 px-3 py-3 text-sm text-muted-foreground">No bite incident recorded for this patient.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Syringe className="h-4 w-4 text-primary" />
                    <h3 className="text-base font-extrabold text-foreground">PEP Dose History</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pepSchedule.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No PEP schedule found.</p>
                    ) : pepSchedule.map((dose) => (
                      <div key={dose.id} className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                        <p className="text-xs font-extrabold text-emerald-900">Day {dose.dose_day}</p>
                        <p className="text-xs font-semibold text-emerald-700">{formatDate(dose.scheduled_date)}</p>
                        <Badge variant={getStatusVariant(dose.status)} size="sm">{dose.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <h3 className="text-base font-extrabold text-foreground">Compliance Status</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Overall Progress</span>
                        <span className="text-sm font-bold text-foreground">{progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary" style={{ width: progress + '%' }} />
                      </div>
                    </div>
                    <div className="space-y-2 border-t border-border pt-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Completed Doses</span>
                        <span className="font-semibold text-foreground">{completedDoses} / {pepSchedule.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Next Due</span>
                        <span className="font-semibold text-primary">{nextDose ? formatDate(nextDose.scheduled_date) : '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <h3 className="text-base font-extrabold text-foreground">Notification Log</h3>
                  </div>
                  <div className="space-y-3">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No notifications logged.</p>
                    ) : notifications.slice(0, 5).map((notification) => (
                      <div key={notification.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                        <p className="text-sm font-medium text-foreground">{notification.message || 'Reminder notification'}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant="success" size="sm">{notification.notification_type || notification.type || 'SMS'}</Badge>
                          <span className="text-xs text-muted-foreground">{notification.sentAt || notification.sent_at || '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
