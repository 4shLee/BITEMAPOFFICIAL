import { useEffect, useMemo, useState } from 'react';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/UI/Badge';
import { Check, Clock, X, Bell, Phone, MessageSquare, Info } from 'lucide-react';
import { Button } from '../components/UI/Button';
import { toast } from 'sonner';
import { notificationsAPI, pepScheduleAPI } from '../../lib/services/api';
import { canPerformAction, getStoredUser } from '../../lib/auth/roleAccess';

type Dose = {
  id: number;
  day: number;
  date: string;
  status: string;
  vaccineType: string;
  lotNo: string;
  administeredBy: string;
  patientId?: string;
  incidentId?: string;
};

type ScheduleGroup = {
  incidentId: string;
  patient: string;
  patientId?: string;
  contact_number: string;
  category: string;
  startDate: string;
  doses: Dose[];
};

function normalizeStatus(status: string) {
  return status.toLowerCase();
}

function buildScheduleGroups(rows: any[]): ScheduleGroup[] {
  const grouped = new Map<string, any[]>();

  rows.forEach(row => {
    const key = String(row.incident_id);
    grouped.set(key, [...(grouped.get(key) || []), row]);
  });

  return Array.from(grouped.entries()).map(([incidentId, items]) => {
    const first = items[0];
    const patient = first.patient || {};
    const incident = first.incident || {};

    return {
      incidentId,
      patient: patient.full_name || 'Unknown Patient',
      patientId: patient.id ? String(patient.id) : undefined,
      contact_number: patient.contact_number || '',
      category: (incident.who_category || 'Category II').replace('Category ', ''),
      startDate: incident.incident_date || first.scheduled_date,
      doses: items
        .sort((a, b) => a.dose_day - b.dose_day)
        .map(item => ({
          id: item.id,
          day: item.dose_day,
          date: item.scheduled_date,
          status: normalizeStatus(item.status),
          vaccineType: item.vaccine_type || 'Anti-rabies Vaccine',
          lotNo: item.vaccine_lot_number || '-',
          administeredBy: item.administrator?.name || '-',
          patientId: patient.id ? String(patient.id) : undefined,
          incidentId,
        })),
    };
  });
}

export function PEPSchedule() {
  const currentUser = getStoredUser();
  const canUpdatePep = canPerformAction(currentUser?.role, 'pep.update');
  const canSendNotifications = canPerformAction(currentUser?.role, 'notifications.send');
  const [groups, setGroups] = useState<ScheduleGroup[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const response = await pepScheduleAPI.getAll();
      if (response.success) {
        const nextGroups = buildScheduleGroups(response.data || []);
        setGroups(nextGroups);
        setSelectedIncidentId(current => current || nextGroups[0]?.incidentId || '');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load PEP schedule.');
    } finally {
      setLoading(false);
    }
  };

  const schedule = useMemo(
    () => groups.find(group => group.incidentId === selectedIncidentId) || groups[0],
    [groups, selectedIncidentId]
  );

  const nextDose = schedule?.doses.find(d => d.status === 'upcoming' || d.status === 'pending');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return <Check className="w-5 h-5" />;
      case 'upcoming': return <Clock className="w-5 h-5" />;
      case 'missed': return <X className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5 opacity-40" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-success text-success-foreground';
      case 'upcoming': return 'bg-accent text-accent-foreground';
      case 'missed': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleSendReminder = async (dose?: Dose) => {
    if (!schedule) return;
    const target = dose || nextDose;
    if (!target) {
      toast.error('No upcoming dose found to send a reminder for.');
      return;
    }
    if (!schedule.contact_number) {
      toast.error('No contact number on file for this patient.');
      return;
    }

    const message = 'BITEMAP Reminder: ' + schedule.patient + ', your Day ' + target.day + ' anti-rabies vaccination is scheduled on ' + target.date + '.';
    await notificationsAPI.sendSMS(schedule.contact_number, message, schedule.patientId, schedule.incidentId);
    toast.success('SMS reminder logged for ' + schedule.patient + '.');
  };

  const handleMarkDone = async (dose: Dose) => {
    try {
      await pepScheduleAPI.update(String(dose.id), {
        status: 'Done',
        administered_date: new Date().toISOString().split('T')[0],
      });
      toast.success('Dose marked as done.');
      loadSchedule();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update dose.');
    }
  };

  return (
    <div className="flex-1">
      <Header title="PEP Schedule Management" breadcrumbs={['Patients', 'PEP Schedule']} />

      <div className="p-8 max-w-5xl space-y-6">
        {loading ? (
          <div className="bg-card border border-border rounded-lg p-8 text-sm text-muted-foreground text-center">Loading PEP schedules...</div>
        ) : !schedule ? (
          <div className="bg-card border border-border rounded-lg p-8 text-sm text-muted-foreground text-center">
            No PEP schedules yet. Create an incident first so the Day 0, 3, 7, 14, and 28 schedule can be generated.
          </div>
        ) : (
          <>
            {groups.length > 1 && (
              <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
                <label className="text-sm font-medium text-foreground">Patient Schedule</label>
                <select
                  value={schedule.incidentId}
                  onChange={e => setSelectedIncidentId(e.target.value)}
                  className="px-3 py-2 bg-input-background border border-input rounded-lg text-sm"
                >
                  {groups.map(group => (
                    <option key={group.incidentId} value={group.incidentId}>{group.patient} - Incident #{group.incidentId}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="space-y-1.5">
                  <h2 className="text-lg font-medium text-foreground">{schedule.patient}</h2>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="danger">WHO Category {schedule.category}</Badge>
                    <span className="text-sm text-muted-foreground">Started: {schedule.startDate}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    {schedule.contact_number ? (
                      <span className="text-sm text-foreground font-medium">{schedule.contact_number}</span>
                    ) : (
                      <span className="text-sm text-destructive flex items-center gap-1">
                        <Info className="w-3.5 h-3.5" /> No contact number on file
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">(SMS reminders use this number)</span>
                  </div>
                </div>

                {canSendNotifications && (
                  <Button variant="outline" size="sm" onClick={() => handleSendReminder()} disabled={!schedule.contact_number}>
                    <Bell className="w-4 h-4 mr-2" />
                    Send Reminder
                  </Button>
                )}
              </div>

              <div className="relative overflow-x-auto pb-2">
                <div className="absolute top-8 left-0 right-0 h-0.5 bg-border" />
                <div className="relative flex justify-between min-w-[620px]">
                  {schedule.doses.map(dose => (
                    <div key={dose.id} className="flex flex-col items-center">
                      <div className={'w-16 h-16 rounded-full ' + getStatusColor(dose.status) + ' flex items-center justify-center mb-3 relative z-10'}>
                        {getStatusIcon(dose.status)}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground mb-1">Day {dose.day}</p>
                        <p className="text-xs text-muted-foreground mb-1">{dose.date}</p>
                        {dose.status === 'done' && <Badge variant="success" size="sm">Completed</Badge>}
                        {dose.status === 'upcoming' && <Badge variant="info" size="sm">Due Soon</Badge>}
                        {dose.status === 'pending' && <Badge variant="neutral" size="sm">Pending</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-base font-medium text-foreground">Dose History</h3>
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
                      {(canUpdatePep || canSendNotifications) && <th className="text-left px-6 py-3">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {schedule.doses.map(dose => (
                      <tr key={dose.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-foreground">Day {dose.day}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{dose.date}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{dose.vaccineType}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{dose.lotNo}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{dose.administeredBy}</td>
                        <td className="px-6 py-4">
                          {dose.status === 'done' && <Badge variant="success">Done</Badge>}
                          {dose.status === 'upcoming' && <Badge variant="info">Upcoming</Badge>}
                          {dose.status === 'pending' && <Badge variant="neutral">Pending</Badge>}
                          {dose.status === 'missed' && <Badge variant="danger">Missed</Badge>}
                        </td>
                        {(canUpdatePep || canSendNotifications) && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {canUpdatePep && dose.status !== 'done' && (
                                <button onClick={() => handleMarkDone(dose)} className="text-xs font-medium text-success hover:underline">
                                  Mark Done
                                </button>
                              )}
                              {canSendNotifications && dose.status !== 'done' && (
                                <button onClick={() => handleSendReminder(dose)} disabled={!schedule.contact_number} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-dark disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors">
                                  <MessageSquare className="w-3.5 h-3.5" /> SMS
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {nextDose && (
              <div className="bg-accent-bg border border-accent/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Bell className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-accent mb-1">Next Dose Reminder</p>
                    <p className="text-sm text-accent">
                      Day {nextDose.day} dose is due on {nextDose.date}. {schedule.contact_number ? 'An SMS reminder can be sent now.' : 'No contact number on file.'}
                    </p>
                  </div>
                  {canSendNotifications && schedule.contact_number && (
                    <Button variant="outline" size="sm" onClick={() => handleSendReminder(nextDose)}>
                      <MessageSquare className="w-4 h-4 mr-1.5" /> Send Now
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
