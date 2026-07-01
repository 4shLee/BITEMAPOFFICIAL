import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Calendar, MapPin, User, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { PatientFormModal } from '../components/Patients/PatientFormModal';
import { patientsAPI } from '../../lib/services/api';
import { canPerformAction, getStoredUser } from '../../lib/auth/roleAccess';

export function PatientDetail() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const canUpdatePatient = canPerformAction(currentUser?.role, 'patients.update');
  const { id } = useParams();
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadPatient();
  }, [id]);

  const loadPatient = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const response = await patientsAPI.getById(id);
      if (response.success) {
        setPatient(response.data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load patient record');
      setPatient(null);
    } finally {
      setLoading(false);
    }
  };

  const incidents = useMemo(() => {
    return [...(patient?.incidents || [])].sort((a, b) => {
      const aDate = a.incident_date || a.created_at || '';
      const bDate = b.incident_date || b.created_at || '';
      return String(bDate).localeCompare(String(aDate));
    });
  }, [patient]);

  const currentIncident = incidents[0];
  const pepSchedule = useMemo(() => {
    return [...(currentIncident?.pep_schedules || [])].sort((a, b) => (a.dose_day ?? 0) - (b.dose_day ?? 0));
  }, [currentIncident]);

  const completedDoses = pepSchedule.filter((dose) => dose.status === 'Done').length;
  const progress = pepSchedule.length ? Math.round((completedDoses / pepSchedule.length) * 100) : 0;
  const nextDose = pepSchedule.find((dose) => dose.status !== 'Done');

  const formatDate = (value?: string) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getCategoryVariant = (category?: string) => {
    switch (category) {
      case 'Category I': return 'success';
      case 'Category II': return 'warning';
      case 'Category III': return 'danger';
      default: return 'neutral';
    }
  };

  const getStatusVariant = (status?: string) => {
    switch (status) {
      case 'Done':
      case 'Completed': return 'success';
      case 'Upcoming':
      case 'Active': return 'info';
      case 'Missed': return 'danger';
      case 'Pending': return 'neutral';
      default: return 'neutral';
    }
  };

  const handleEditClose = (shouldReload?: boolean) => {
    setShowEditModal(false);
    if (shouldReload) loadPatient();
  };

  if (loading) {
    return (
      <div className="flex-1">
        <Header title="Patient Record" breadcrumbs={['Patients', 'Loading']} />
        <div className="p-8 text-sm text-muted-foreground">Loading patient record...</div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex-1">
        <Header title="Patient Record" breadcrumbs={['Patients', 'Not found']} />
        <div className="p-8">
          <Button variant="outline" size="sm" onClick={() => navigate('/patients')} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Patients
          </Button>
          <div className="bg-card border border-border rounded-lg p-6 text-sm text-muted-foreground">
            Patient record not found.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <Header title="Patient Record" breadcrumbs={['Patients', patient.full_name]} />

      <div className="p-8">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/patients')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Patients
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white text-2xl font-semibold">
                    {patient.full_name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground mb-1">{patient.full_name}</h2>
                    <div className="flex items-center gap-3">
                      <Badge variant={getCategoryVariant(currentIncident?.who_category)}>
                        {currentIncident?.who_category || 'No Incident'}
                      </Badge>
                      <Badge variant={getStatusVariant(currentIncident?.status)}>
                        {currentIncident?.status || 'No Status'}
                      </Badge>
                    </div>
                  </div>
                </div>
                {canUpdatePatient && (
                  <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>Edit</Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Demographics</p>
                    <p className="text-sm text-foreground">{patient.age} years old, {patient.sex}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Date Registered</p>
                    <p className="text-sm text-foreground">{formatDate(patient.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Address</p>
                    <p className="text-sm text-foreground">{patient.address}</p>
                    <p className="text-xs text-muted-foreground mt-1">{patient.barangay?.name || 'No barangay selected'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Contact</p>
                    <p className="text-sm text-foreground">{patient.contact_number || '-'}</p>
                    {patient.email && <p className="text-xs text-muted-foreground mt-1">{patient.email}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-base font-medium text-foreground mb-4">Bite Incident Summary</h3>
              {currentIncident ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Incident Date</p>
                    <p className="text-sm text-foreground">{formatDate(currentIncident.incident_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Animal Type</p>
                    <p className="text-sm text-foreground">{currentIncident.animal_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Bite Site</p>
                    <p className="text-sm text-foreground">{currentIncident.bite_site || currentIncident.bite_location || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">WHO Category</p>
                    <Badge variant={getCategoryVariant(currentIncident.who_category)}>{currentIncident.who_category}</Badge>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No bite incident recorded for this patient.</p>
              )}
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-base font-medium text-foreground">PEP Dose History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted text-xs font-medium text-muted-foreground">
                      <th className="text-left px-6 py-3">Dose</th>
                      <th className="text-left px-6 py-3">Date</th>
                      <th className="text-left px-6 py-3">Vaccine Type</th>
                      <th className="text-left px-6 py-3">Lot Number</th>
                      <th className="text-left px-6 py-3">Administered By</th>
                      <th className="text-left px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pepSchedule.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">
                          No PEP schedule found.
                        </td>
                      </tr>
                    ) : pepSchedule.map((dose) => (
                      <tr key={dose.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-foreground">Day {dose.dose_day}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(dose.scheduled_date)}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{dose.vaccine_type || '-'}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{dose.vaccine_lot_number || '-'}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{dose.administrator?.name || '-'}</td>
                        <td className="px-6 py-4">
                          <Badge variant={getStatusVariant(dose.status)}>{dose.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-base font-medium text-foreground mb-4">Compliance Status</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Overall Progress</span>
                    <span className="text-sm font-medium text-foreground">{progress}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: progress + '%' }}></div>
                  </div>
                </div>
                <div className="pt-4 border-t border-border space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Completed Doses</span>
                    <span className="font-medium text-foreground">{completedDoses} / {pepSchedule.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Next Due</span>
                    <span className="font-medium text-accent">{nextDose ? formatDate(nextDose.scheduled_date) : '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-base font-medium text-foreground">Notification Log</h3>
              </div>
              <div className="p-4 space-y-3">
                {(patient.notifications || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notifications logged.</p>
                ) : (patient.notifications || []).map((notification: any) => (
                  <div key={notification.id} className="pb-3 border-b border-border last:border-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground mb-1">{notification.message}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="success" size="sm">{notification.notification_type || notification.type}</Badge>
                          <span className="text-xs text-muted-foreground">{notification.sentAt || notification.sent_at || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showEditModal && canUpdatePatient && (
        <PatientFormModal
          patient={patient}
          onClose={handleEditClose}
        />
      )}
    </div>
  );
}
