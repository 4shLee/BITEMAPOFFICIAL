import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Bell, CalendarDays, Check, ClipboardCheck, Clock, Edit, Eye, History, MessageSquare, Phone, ShieldCheck, Syringe, X } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { inventoryAPI, notificationsAPI, pepScheduleAPI } from '../../lib/services/api';
import { canPerformAction, getStoredUser } from '../../lib/auth/roleAccess';

type DoseStatus = 'completed' | 'completed_late' | 'due_today' | 'upcoming' | 'overdue' | 'pending' | 'missed' | 'rescheduled';

type Dose = {
  id: number;
  day: number;
  date: string;
  administeredDate?: string;
  rawStatus: string;
  status: DoseStatus;
  vaccineType: string;
  lotNo: string;
  administeredBy: string;
  notes?: string;
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
  barangay?: string;
  doses: Dose[];
};

type RecordDoseForm = {
  administeredDate: string;
  vaccineType: string;
  lotNo: string;
  inventoryItemId: string;
  administeredBy: string;
  remarks: string;
};

type InventoryBatch = {
  id: number | string;
  item_name?: string;
  item_type?: string;
  current_stock?: number;
  unit?: string;
  batch_number?: string;
  lot_number?: string;
  vaccine_lot_number?: string;
  expiry_date?: string;
};

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function dateKeyFrom(value?: string) {
  return value ? String(value).split('T')[0] : '';
}

function evaluateDoseStatus(item: any): DoseStatus {
  const status = String(item.status || '').toLowerCase();
  const scheduledDate = dateKeyFrom(item.scheduled_date);
  const administeredDate = dateKeyFrom(item.administered_date);

  if (status === 'rescheduled') return 'rescheduled';
  if (administeredDate) return administeredDate > scheduledDate ? 'completed_late' : 'completed';
  if (status === 'done' || status === 'completed') return 'completed';
  if (status === 'missed') return 'missed';
  if (!scheduledDate) return 'pending';
  if (scheduledDate === todayKey()) return 'due_today';
  if (scheduledDate < todayKey()) return 'overdue';
  if (scheduledDate > todayKey()) return 'upcoming';
  return 'pending';
}

function buildScheduleGroups(rows: any[]): ScheduleGroup[] {
  const grouped = new Map<string, any[]>();

  rows.forEach((row) => {
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
      category: incident.who_category || 'Category II',
      startDate: incident.incident_date || first.scheduled_date,
      barangay: incident.barangay?.name,
      doses: items
        .sort((a, b) => a.dose_day - b.dose_day)
        .map((item) => ({
          id: item.id,
          day: item.dose_day,
          date: item.scheduled_date,
          administeredDate: item.administered_date,
          rawStatus: item.status,
          status: evaluateDoseStatus(item),
          vaccineType: item.vaccine_type || 'Anti-rabies Vaccine',
          lotNo: item.vaccine_lot_number || '',
          administeredBy: item.administrator?.name || '',
          notes: item.notes || '',
          patientId: patient.id ? String(patient.id) : undefined,
          incidentId,
        })),
    };
  });
}

function statusLabel(status: DoseStatus) {
  switch (status) {
    case 'completed': return 'Completed';
    case 'completed_late': return 'Completed Late';
    case 'due_today': return 'Due Today';
    case 'upcoming': return 'Upcoming';
    case 'overdue': return 'Overdue';
    case 'missed': return 'Missed';
    case 'rescheduled': return 'Rescheduled';
    default: return 'Pending';
  }
}

function statusVariant(status: DoseStatus) {
  switch (status) {
    case 'completed': return 'success' as const;
    case 'completed_late': return 'warning' as const;
    case 'due_today': return 'info' as const;
    case 'upcoming': return 'neutral' as const;
    case 'overdue': return 'danger' as const;
    case 'missed': return 'danger' as const;
    case 'rescheduled': return 'info' as const;
    default: return 'neutral' as const;
  }
}

function statusTone(status: DoseStatus) {
  switch (status) {
    case 'completed': return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'completed_late': return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'due_today': return 'border-sky-200 bg-sky-50 text-sky-900';
    case 'overdue': return 'border-rose-200 bg-rose-50 text-rose-900';
    case 'missed': return 'border-rose-200 bg-rose-50 text-rose-900';
    case 'rescheduled': return 'border-cyan-200 bg-cyan-50 text-cyan-900';
    case 'upcoming': return 'border-blue-100 bg-blue-50/60 text-slate-800';
    default: return 'border-border bg-white text-slate-800';
  }
}

function doseIcon(status: DoseStatus) {
  if (status === 'completed' || status === 'completed_late') return <Check className="h-4 w-4" />;
  if (status === 'overdue' || status === 'missed') return <X className="h-4 w-4" />;
  if (status === 'due_today') return <Bell className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getBatchLotNumber(item: InventoryBatch) {
  return item.batch_number || item.lot_number || item.vaccine_lot_number || '';
}

function getBatchVaccineType(item: InventoryBatch) {
  return item.item_name || item.item_type || 'Anti-rabies Vaccine';
}

function isAvailableVaccineBatch(item: InventoryBatch) {
  const stock = Number(item.current_stock || 0);
  const lotNumber = getBatchLotNumber(item);
  const expiryDate = item.expiry_date;
  const name = String(item.item_name || '').toLowerCase();
  const type = String(item.item_type || '').toLowerCase();
  const isVaccine = name.includes('vaccine') || name.includes('rabies') || type.includes('vaccine');

  return isVaccine && Boolean(lotNumber) && Boolean(expiryDate) && stock > 0 && String(expiryDate) >= todayKey();
}

export function PEPSchedule() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getStoredUser();
  const canUpdatePep = canPerformAction(currentUser?.role, 'pep.update');
  const canSendNotifications = canPerformAction(currentUser?.role, 'notifications.send');
  const [groups, setGroups] = useState<ScheduleGroup[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordDose, setRecordDose] = useState<Dose | null>(null);
  const [recordForm, setRecordForm] = useState<RecordDoseForm>({
    administeredDate: todayKey(),
    vaccineType: 'Anti-rabies Vaccine',
    lotNo: '',
    inventoryItemId: '',
    administeredBy: currentUser?.name || currentUser?.full_name || '',
    remarks: '',
  });
  const [savingDose, setSavingDose] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryBatch[]>([]);
  const requestedIncidentId = useMemo(() => {
    const queryIncidentId = new URLSearchParams(location.search).get('incident_id');
    const stateIncidentId = (location.state as { incidentId?: string | number } | null)?.incidentId;

    return queryIncidentId || (stateIncidentId != null ? String(stateIncidentId) : '');
  }, [location.search, location.state]);

  useEffect(() => {
    loadSchedule();
  }, [requestedIncidentId]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const [scheduleResponse, inventoryResponse] = await Promise.all([
        pepScheduleAPI.getAll(),
        inventoryAPI.getAll().catch(() => null),
      ]);
      if (scheduleResponse.success) {
        const nextGroups = buildScheduleGroups(scheduleResponse.data || []);
        setGroups(nextGroups);

        if (requestedIncidentId) {
          const requestedGroup = nextGroups.find((group) => group.incidentId === requestedIncidentId);
          if (requestedGroup) {
            setSelectedIncidentId(requestedGroup.incidentId);
            setSelectionNotice(null);
          } else {
            setSelectedIncidentId(nextGroups[0]?.incidentId || '');
            setSelectionNotice('No PEP schedule found for the selected incident. Showing the first available schedule instead.');
          }
        } else {
          setSelectedIncidentId((current) => (
            current && nextGroups.some((group) => group.incidentId === current)
              ? current
              : nextGroups[0]?.incidentId || ''
          ));
          setSelectionNotice(null);
        }
      }
      if (inventoryResponse?.success) {
        setInventoryItems(inventoryResponse.data || []);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load PEP schedule.');
    } finally {
      setLoading(false);
    }
  };

  const schedule = useMemo(
    () => groups.find((group) => group.incidentId === selectedIncidentId) || groups[0],
    [groups, selectedIncidentId]
  );

  const completedDoses = schedule?.doses.filter((dose) => dose.status === 'completed' || dose.status === 'completed_late').length || 0;
  const completedLateDoses = schedule?.doses.filter((dose) => dose.status === 'completed_late').length || 0;
  const overdueDoses = schedule?.doses.filter((dose) => dose.status === 'overdue' || dose.status === 'missed').length || 0;
  const dueTodayDose = schedule?.doses.find((dose) => dose.status === 'due_today');
  const nextDose = schedule?.doses.find((dose) => dose.status === 'due_today' || dose.status === 'overdue' || dose.status === 'rescheduled' || dose.status === 'upcoming' || dose.status === 'pending');
  const progress = schedule?.doses.length ? Math.round((completedDoses / schedule.doses.length) * 100) : 0;
  const overallStatus = completedDoses === (schedule?.doses.length || 0)
    ? completedLateDoses > 0 ? 'Completed Late' : 'Completed'
    : overdueDoses > 0
      ? 'Overdue'
      : dueTodayDose
        ? 'Due Today'
        : 'On Track';
  const availableVaccineBatches = useMemo(
    () => inventoryItems.filter(isAvailableVaccineBatch),
    [inventoryItems]
  );
  const selectedInventoryBatch = availableVaccineBatches.find((item) => String(item.id) === recordForm.inventoryItemId);

  const openRecordDose = (dose: Dose) => {
    const matchingBatch = availableVaccineBatches.find((item) => getBatchLotNumber(item) === dose.lotNo);
    setRecordDose(dose);
    setRecordForm({
      administeredDate: dose.administeredDate || todayKey(),
      vaccineType: matchingBatch ? getBatchVaccineType(matchingBatch) : dose.vaccineType || 'Anti-rabies Vaccine',
      lotNo: matchingBatch ? getBatchLotNumber(matchingBatch) : dose.lotNo || '',
      inventoryItemId: matchingBatch ? String(matchingBatch.id) : '',
      administeredBy: dose.administeredBy || currentUser?.name || currentUser?.full_name || '',
      remarks: dose.notes || '',
    });
  };

  const handleSendReminder = async (dose?: Dose) => {
    if (!schedule) return;
    const target = dose || nextDose;
    if (!target) {
      toast.error('No dose found to send a reminder for.');
      return;
    }
    if (!schedule.contact_number) {
      toast.error('No contact number on file for this patient.');
      return;
    }

    const message = 'BITEMAP Reminder: ' + schedule.patient + ', your Day ' + target.day + ' anti-rabies vaccination is scheduled on ' + target.date + '.';
    await notificationsAPI.sendSMS(schedule.contact_number, message, schedule.patientId, schedule.incidentId);
    toast.success('SMS reminder logged for ' + schedule.patient + '.');
    loadSchedule();
  };

  const handleRecordDose = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!recordDose) return;

    try {
      setSavingDose(true);
      await pepScheduleAPI.update(String(recordDose.id), {
        status: 'Completed',
        administered_date: recordForm.administeredDate,
        vaccine_type: recordForm.vaccineType,
        vaccine_lot_number: recordForm.lotNo,
        notes: [
          recordForm.administeredBy ? 'Administered by: ' + recordForm.administeredBy : '',
          recordForm.remarks ? 'Remarks: ' + recordForm.remarks : '',
        ].filter(Boolean).join('\n'),
      });

      if (selectedInventoryBatch) {
        await inventoryAPI.update(String(selectedInventoryBatch.id), {
          current_stock: Math.max(Number(selectedInventoryBatch.current_stock || 0) - 1, 0),
          transaction_type: 'Out',
          notes: 'Dose recorded for PEP Day ' + recordDose.day,
        });
      }

      // TODO: Add a manual Adjust Schedule workflow later. Late dose recording must not automatically regenerate remaining dose dates.
      toast.success('Dose recorded successfully.');
      setRecordDose(null);
      loadSchedule();
    } catch (error: any) {
      toast.error(error.message || 'Failed to record dose.');
    } finally {
      setSavingDose(false);
    }
  };

  const renderDoseAction = (dose: Dose) => {
    if (dose.status === 'completed_late') {
      return <span className="text-xs font-bold text-amber-700">Recorded Late</span>;
    }
    if (dose.status === 'completed') {
      return <span className="text-xs font-bold text-emerald-700">Recorded</span>;
    }
    if ((dose.status === 'due_today' || dose.status === 'overdue') && canUpdatePep) {
      return (
        <Button type="button" size="sm" onClick={() => openRecordDose(dose)}>
          Record Dose
        </Button>
      );
    }
    if (dose.status === 'upcoming' && canSendNotifications) {
      return (
        <Button type="button" variant="outline" size="sm" onClick={() => handleSendReminder(dose)} disabled={!schedule?.contact_number}>
          <MessageSquare className="h-4 w-4" />
          Send Reminder
        </Button>
      );
    }
    return <span className="text-xs font-semibold text-muted-foreground">No action</span>;
  };

  return (
    <div className="flex-1 bg-[#f6f8f7] min-h-screen">
      <Header title="PEP Schedule Management" breadcrumbs={['Patients', 'PEP Schedule']} />

      <div className="px-5 py-5 lg:px-7 lg:py-6">
        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">Loading PEP schedules...</div>
        ) : !schedule ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
            No PEP schedules yet. Create an incident first so the Day 0, 3, 7, 14, and 28 schedule can be generated.
          </div>
        ) : (
          <div className="mx-auto max-w-[1480px] space-y-4">
            {selectionNotice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                {selectionNotice}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <main className="space-y-4">
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <label className="block text-sm font-bold text-foreground">Patient Schedule</label>
                <p className="mt-0.5 text-xs text-muted-foreground">Select a patient incident to view the PEP schedule.</p>
                <select
                  value={schedule.incidentId}
                  onChange={(event) => {
                    setSelectedIncidentId(event.target.value);
                    setSelectionNotice(null);
                  }}
                  className="mt-3 w-full rounded-xl border border-input bg-input-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {groups.map((group) => (
                    <option key={group.incidentId} value={group.incidentId}>{group.patient} - Incident #{group.incidentId}</option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm shadow-emerald-950/5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-extrabold text-foreground">{schedule.patient}</h2>
                      <Badge variant={schedule.category === 'Category III' ? 'danger' : schedule.category === 'Category II' ? 'warning' : 'success'}>{schedule.category}</Badge>
                      <Badge variant={overallStatus === 'Overdue' ? 'danger' : overallStatus === 'Due Today' ? 'info' : overallStatus === 'Completed' ? 'success' : overallStatus === 'Completed Late' ? 'warning' : 'neutral'}>{overallStatus}</Badge>
                    </div>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">
                      Started {formatDate(schedule.startDate)} - {schedule.contact_number || 'No contact number'} - Incident #{schedule.incidentId}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {schedule.patientId && (
                      <Button type="button" variant="outline" size="sm" onClick={() => navigate('/patients/' + schedule.patientId)}>
                        <Eye className="h-4 w-4" />
                        View Patient
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => navigate('/incidents/' + schedule.incidentId)}>
                      <ClipboardCheck className="h-4 w-4" />
                      View Incident
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Syringe className="h-4 w-4 text-primary" />
                  <h3 className="text-base font-extrabold text-foreground">Dose Schedule</h3>
                </div>
                <p className="mb-3 text-xs font-medium text-muted-foreground">
                  Dose dates are recalculated when the incident date is corrected. Completed dose records keep their administration history.
                </p>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {schedule.doses.map((dose) => (
                    <div key={dose.id} className={'rounded-2xl border p-3 shadow-sm ' + statusTone(dose.status)}>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 shadow-sm">
                          {doseIcon(dose.status)}
                        </div>
                        <Badge variant={statusVariant(dose.status)} size="sm">{statusLabel(dose.status)}</Badge>
                      </div>
                      <p className="text-base font-extrabold text-foreground">Day {dose.day}</p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">{formatDate(dose.date)}</p>
                      <div className="mt-3">{renderDoseAction(dose)}</div>
                    </div>
                  ))}
                </div>
              </div>

              </main>

              <aside className="space-y-4 xl:self-start">
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <h3 className="text-base font-extrabold text-foreground">Compliance Summary</h3>
                </div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Overall Progress</span>
                  <span className="text-sm font-bold text-foreground">{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: progress + '%' }} />
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Completed</span><span className="font-semibold">{completedDoses} / {schedule.doses.length}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Completed Late</span><span className="font-semibold text-amber-700">{completedLateDoses}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Next Dose</span><span className="font-semibold">{nextDose ? 'Day ' + nextDose.day : '-'}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Overdue</span><span className="font-semibold text-destructive">{overdueDoses}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Status</span><Badge variant={overallStatus === 'Overdue' ? 'danger' : overallStatus === 'Due Today' ? 'info' : overallStatus === 'Completed' ? 'success' : overallStatus === 'Completed Late' ? 'warning' : 'neutral'}>{overallStatus}</Badge></div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  <h3 className="text-base font-extrabold text-emerald-950">Next Dose Reminder</h3>
                </div>
                {nextDose ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between"><span className="text-emerald-700">Dose</span><span className="font-bold text-emerald-950">Day {nextDose.day}</span></div>
                    <div className="flex items-center justify-between"><span className="text-emerald-700">Due Date</span><span className="font-bold text-emerald-950">{formatDate(nextDose.date)}</span></div>
                    <div className="flex items-center gap-2 text-emerald-900"><Phone className="h-4 w-4" /> {schedule.contact_number || 'No contact number'}</div>
                    <p className="text-xs font-medium text-emerald-700">Preferred channel: SMS. SMS consent assumed from patient contact workflow.</p>
                    {canSendNotifications && (
                      <Button type="button" className="mt-2 w-full" onClick={() => handleSendReminder(nextDose)} disabled={!schedule.contact_number}>
                        <MessageSquare className="h-4 w-4" />
                        Send Reminder
                      </Button>
                    )}
                    {!schedule.contact_number && <p className="text-xs font-semibold text-destructive">Add a contact number before sending SMS reminders.</p>}
                  </div>
                ) : (
                  <p className="text-sm text-emerald-800">No pending dose reminder needed.</p>
                )}
              </div>

              </aside>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <History className="h-4 w-4 text-primary" />
                <h3 className="text-base font-extrabold text-foreground">Dose History</h3>
              </div>
              <div className="overflow-x-auto xl:overflow-visible">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/60 text-xs font-semibold text-muted-foreground">
                      <th className="w-[8%] px-3 py-3 text-left">Dose</th>
                      <th className="w-[13%] px-3 py-3 text-left">Scheduled Date</th>
                      <th className="w-[14%] px-3 py-3 text-left">Date Administered</th>
                      <th className="w-[16%] px-3 py-3 text-left">Vaccine Type</th>
                      <th className="w-[14%] px-3 py-3 text-left">Lot/Batch Number</th>
                      <th className="w-[14%] px-3 py-3 text-left">Administered By</th>
                      <th className="w-[10%] px-3 py-3 text-left">Status</th>
                      {(canUpdatePep || canSendNotifications) && <th className="w-[11%] px-3 py-3 text-left">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {schedule.doses.map((dose) => (
                      <tr key={dose.id} className="transition-colors hover:bg-muted/40">
                        <td className="px-3 py-3 text-sm font-semibold text-foreground">Day {dose.day}</td>
                        <td className="px-3 py-3 text-sm text-muted-foreground">{formatDate(dose.date)}</td>
                        <td className="px-3 py-3 text-sm text-muted-foreground">{dose.administeredDate ? formatDate(dose.administeredDate) : '-'}</td>
                        <td className="px-3 py-3 text-sm text-muted-foreground">{dose.vaccineType || '-'}</td>
                        <td className="px-3 py-3 text-sm text-muted-foreground">{dose.lotNo || '-'}</td>
                        <td className="px-3 py-3 text-sm text-muted-foreground">{dose.administeredBy || '-'}</td>
                        <td className="px-3 py-3"><Badge variant={statusVariant(dose.status)}>{statusLabel(dose.status)}</Badge></td>
                        {(canUpdatePep || canSendNotifications) && (
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              {(dose.status === 'due_today' || dose.status === 'overdue') && canUpdatePep && (
                                <Button type="button" size="sm" onClick={() => openRecordDose(dose)}>
                                  Record
                                </Button>
                              )}
                              {(dose.status === 'upcoming' || dose.status === 'due_today') && canSendNotifications && (
                                <Button type="button" variant="outline" size="sm" onClick={() => handleSendReminder(dose)} disabled={!schedule.contact_number}>
                                  <MessageSquare className="h-4 w-4" />
                                  SMS
                                </Button>
                              )}
                              {(dose.status === 'completed' || dose.status === 'completed_late') && canUpdatePep && (
                                <Button type="button" variant="outline" size="sm" onClick={() => openRecordDose(dose)}>
                                  <Edit className="h-4 w-4" />
                                  Edit
                                </Button>
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
          </div>
        )}
      </div>

      {recordDose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Record Dose - Day {recordDose.day}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Encode administered vaccine details for this dose.</p>
              </div>
              <button type="button" onClick={() => setRecordDose(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted" aria-label="Close record dose modal">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleRecordDose} className="space-y-4 p-6">
              <Input label="Date Administered" type="date" value={recordForm.administeredDate} onChange={(event) => setRecordForm((current) => ({ ...current, administeredDate: event.target.value }))} required />
              <Input label="Vaccine Type" value={recordForm.vaccineType} onChange={(event) => setRecordForm((current) => ({ ...current, vaccineType: event.target.value }))} required />
              {availableVaccineBatches.length > 0 ? (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Lot / Batch Number</label>
                  <select
                    value={recordForm.inventoryItemId}
                    onChange={(event) => {
                      const batch = availableVaccineBatches.find((item) => String(item.id) === event.target.value);
                      setRecordForm((current) => ({
                        ...current,
                        inventoryItemId: event.target.value,
                        vaccineType: batch ? getBatchVaccineType(batch) : current.vaccineType,
                        lotNo: batch ? getBatchLotNumber(batch) : '',
                      }));
                    }}
                    className="h-10 w-full rounded-lg border border-input bg-input-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select available vaccine batch</option>
                    {availableVaccineBatches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {getBatchVaccineType(batch)} - Lot {getBatchLotNumber(batch)} - Exp {formatDate(batch.expiry_date)} - Stock {batch.current_stock}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                // TODO: Replace this fallback with inventory batch selection when batch-level inventory data is available.
                <Input label="Lot / Batch Number" value={recordForm.lotNo} onChange={(event) => setRecordForm((current) => ({ ...current, lotNo: event.target.value }))} placeholder="Enter lot or batch number" />
              )}
              <Input label="Administered By" value={recordForm.administeredBy} onChange={(event) => setRecordForm((current) => ({ ...current, administeredBy: event.target.value }))} placeholder="Staff name" />
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Remarks</label>
                <textarea
                  value={recordForm.remarks}
                  onChange={(event) => setRecordForm((current) => ({ ...current, remarks: event.target.value }))}
                  className="min-h-24 w-full rounded-lg border border-input bg-input-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Optional notes"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setRecordDose(null)} disabled={savingDose}>Cancel</Button>
                <Button type="submit" disabled={savingDose}>{savingDose ? 'Saving...' : 'Save Dose Record'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
