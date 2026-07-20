import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Bell, CalendarDays, Check, ClipboardCheck, Clock, Eye, History, MessageSquare, Phone, RefreshCw, ShieldCheck, Syringe, X } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { inventoryAPI, notificationsAPI, pepScheduleAPI } from '../../lib/services/api';
import { canPerformAction, getStoredUser } from '../../lib/auth/roleAccess';
import { getPatientDisplayName } from '../../lib/patient';

type DoseStatus = 'completed' | 'completed_late' | 'due_today' | 'upcoming' | 'overdue' | 'pending' | 'missed' | 'rescheduled';

type Dose = {
  id: number;
  day: number;
  date: string;
  administeredDate?: string;
  rawStatus: string;
  status: DoseStatus;
  vaccineType: string;
  administrationRoute?: string;
  lotNo: string;
  administeredBy: string;
  notes?: string;
  inventoryLinkageStatus?: string;
  patientId?: string;
  incidentId?: string;
};

type ScheduleGroup = {
  incidentId: string;
  patient: string;
  patientId?: string;
  contact_number: string;
  smsConsent: boolean;
  category: string;
  startDate: string;
  barangay?: string;
  doses: Dose[];
};

type RecordDoseForm = {
  administeredDate: string;
  administrationRoute: string;
  inventoryItemId: string;
  inventoryBatchId: string;
  remarks: string;
};

type RescheduleDoseForm = {
  scheduledDate: string;
  reason: string;
};

type InventoryBatch = {
  id: number | string;
  inventory_id: number | string;
  batch_number?: string;
  lot_number?: string;
  quantity_remaining?: number;
  expiry_date?: string;
};

type InventoryItem = {
  id: number | string;
  item_name?: string;
  item_type?: string;
  current_stock?: number;
  batches?: InventoryBatch[];
};

type VaccineBatchOption = InventoryBatch & {
  inventoryItemId: string;
};

function todayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function dateKeyFrom(value?: string) {
  return value ? String(value).split('T')[0] : '';
}

function evaluateDoseStatus(item: any): DoseStatus {
  const status = String(item.status || '').toLowerCase();
  const scheduledDate = dateKeyFrom(item.scheduled_date);
  const administeredDate = dateKeyFrom(item.administered_date);

  if (administeredDate) return administeredDate > scheduledDate ? 'completed_late' : 'completed';
  if (status === 'done' || status === 'completed') return 'completed';
  if (status === 'missed') return 'missed';
  if (!scheduledDate) return 'pending';
  if (scheduledDate === todayKey()) return 'due_today';
  if (scheduledDate < todayKey()) return 'overdue';
  if (status === 'rescheduled') return 'rescheduled';
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
      patient: getPatientDisplayName(patient) || 'Unknown Patient',
      patientId: patient.id ? String(patient.id) : undefined,
      contact_number: patient.contact_number || '',
      smsConsent: incident.sms_consent === true,
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
          administrationRoute: item.administration_route || undefined,
          lotNo: item.vaccine_lot_number || '',
          administeredBy: item.administrator?.name || '',
          notes: item.notes || '',
          inventoryLinkageStatus: item.inventory_linkage_status,
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
  return item.batch_number || item.lot_number || '';
}

function isEligiblePepVaccineInventoryItem(item: InventoryItem) {
  const itemType = String(item.item_type || '').trim().toLowerCase();
  const itemName = String(item.item_name || '').trim().toLowerCase();

  return itemType === 'vaccine'
    && !itemName.includes('immunoglobulin')
    && !/(^|[^a-z])(?:e|h)?rig([^a-z]|$)/i.test(itemName)
    && !itemName.includes('tetanus');
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
    administrationRoute: '',
    inventoryItemId: '',
    inventoryBatchId: '',
    remarks: '',
  });
  const [savingDose, setSavingDose] = useState(false);
  const [rescheduleDose, setRescheduleDose] = useState<Dose | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState<RescheduleDoseForm>({ scheduledDate: todayKey(), reason: '' });
  const [savingReschedule, setSavingReschedule] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
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
  const nextDose = schedule?.doses.find((dose) => dose.status === 'due_today')
    || schedule?.doses.find((dose) => dose.status === 'overdue' || dose.status === 'missed')
    || schedule?.doses.find((dose) => dose.status === 'rescheduled' || dose.status === 'upcoming' || dose.status === 'pending');
  const progress = schedule?.doses.length ? Math.round((completedDoses / schedule.doses.length) * 100) : 0;
  const overallStatus = completedDoses === (schedule?.doses.length || 0)
    ? completedLateDoses > 0 ? 'Completed Late' : 'Completed'
    : overdueDoses > 0
      ? 'Overdue'
      : dueTodayDose
        ? 'Due Today'
        : 'On Track';
  const eligibleVaccineProducts = useMemo(() => inventoryItems
    .filter((item) => isEligiblePepVaccineInventoryItem(item) && Number(item.current_stock || 0) > 0), [inventoryItems]);
  const selectedVaccineProduct = eligibleVaccineProducts.find((item) => String(item.id) === recordForm.inventoryItemId);
  const availableVaccineBatches = useMemo<VaccineBatchOption[]>(() => selectedVaccineProduct
    ? (selectedVaccineProduct.batches || [])
      .filter((batch) => (
        Number(batch.quantity_remaining || 0) > 0
        && Boolean(batch.expiry_date)
        && String(batch.expiry_date) >= todayKey()
      ))
      .map((batch) => ({
        ...batch,
        inventoryItemId: String(selectedVaccineProduct.id),
      }))
    : [], [selectedVaccineProduct]);
  const selectedInventoryBatch = availableVaccineBatches.find((batch) => (
    String(batch.id) === recordForm.inventoryBatchId
    && batch.inventoryItemId === recordForm.inventoryItemId
  ));

  const openRecordDose = (dose: Dose) => {
    if (dose.status === 'completed' || dose.status === 'completed_late') return;
    setRecordDose(dose);
    setRecordForm({
      administeredDate: dose.administeredDate || todayKey(),
      administrationRoute: '',
      inventoryItemId: '',
      inventoryBatchId: '',
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
    if (!schedule.smsConsent) {
      toast.error('SMS consent was declined for this incident.');
      return;
    }

    const message = 'BITEMAP Reminder: ' + schedule.patient + ', your Day ' + target.day + ' anti-rabies vaccination is scheduled on ' + target.date + '.';
    await notificationsAPI.sendSMS(schedule.contact_number, message, schedule.patientId, schedule.incidentId);
    toast.success('SMS reminder logged for ' + schedule.patient + '.');
    loadSchedule();
  };

  const handleRecordDose = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !recordDose
      || savingDose
      || !recordForm.administeredDate
      || !recordForm.administrationRoute
      || !recordForm.inventoryItemId
      || !selectedInventoryBatch
    ) return;

    try {
      setSavingDose(true);
      await pepScheduleAPI.recordDose(String(recordDose.id), {
        administered_date: recordForm.administeredDate,
        administration_route: recordForm.administrationRoute as 'Intradermal' | 'Intramuscular',
        inventory_id: Number(recordForm.inventoryItemId),
        inventory_batch_id: Number(recordForm.inventoryBatchId),
        remarks: recordForm.remarks || undefined,
      });

      // TODO: Add a manual Adjust Schedule workflow later. Late dose recording must not automatically regenerate remaining dose dates.
      toast.success('Dose recorded successfully. Record the actual vaccine stock consumed in the Inventory module.');
      setRecordDose(null);
      await loadSchedule();
    } catch (error: any) {
      toast.error(error.message || 'Failed to record dose.');
    } finally {
      setSavingDose(false);
    }
  };

  const openRescheduleDose = (dose: Dose) => {
    setRescheduleDose(dose);
    setRescheduleForm({ scheduledDate: todayKey(), reason: '' });
  };

  const handleRescheduleDose = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rescheduleDose) return;

    try {
      setSavingReschedule(true);
      await pepScheduleAPI.reschedule(String(rescheduleDose.id), rescheduleForm.scheduledDate, rescheduleForm.reason);
      toast.success('Day ' + rescheduleDose.day + ' was rescheduled. Future doses were not changed.');
      setRescheduleDose(null);
      loadSchedule();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reschedule dose.');
    } finally {
      setSavingReschedule(false);
    }
  };

  const renderDoseAction = (dose: Dose) => {
    if (dose.status === 'completed_late') {
      return <span className="text-xs font-bold text-amber-700">Recorded Late</span>;
    }
    if (dose.status === 'completed') {
      return <span className="text-xs font-bold text-emerald-700">Recorded</span>;
    }
    if (dose.status === 'due_today' || dose.status === 'overdue' || dose.status === 'missed') {
      return (
        <div className="flex flex-wrap gap-1.5">
          {canUpdatePep && (
            <Button type="button" size="sm" onClick={() => openRecordDose(dose)}>Record Dose</Button>
          )}
          {canSendNotifications && (
            <Button type="button" variant="outline" size="sm" onClick={() => handleSendReminder(dose)} disabled={!schedule?.contact_number}>
              <MessageSquare className="h-4 w-4" />
              Send Reminder
            </Button>
          )}
          {(dose.status === 'overdue' || dose.status === 'missed') && canUpdatePep && (
            <Button type="button" variant="outline" size="sm" onClick={() => openRescheduleDose(dose)}>
              <RefreshCw className="h-4 w-4" />
              Reschedule
            </Button>
          )}
        </div>
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
                <p className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                  Missed doses are flagged for follow-up. Staff may record a late dose or manually reschedule according to clinic protocol.
                </p>
                {overdueDoses > 0 && (
                  <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900">
                    This patient has an overdue dose that needs follow-up.
                  </div>
                )}
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
                    <p className="text-xs font-medium text-emerald-700">SMS Reminder Permission: {schedule.smsConsent ? 'Enabled' : 'Disabled'}</p>
                    {canSendNotifications && (
                      <Button type="button" className="mt-2 w-full" onClick={() => handleSendReminder(nextDose)} disabled={!schedule.contact_number || !schedule.smsConsent}>
                        <MessageSquare className="h-4 w-4" />
                        Send Reminder
                      </Button>
                    )}
                    {!schedule.contact_number && <p className="text-xs font-semibold text-destructive">Add a contact number before sending SMS reminders.</p>}
                    {!schedule.smsConsent && <p className="text-xs font-semibold text-destructive">Patient SMS reminders are disabled because permission was not provided.</p>}
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
                      <th className="w-[14%] px-3 py-3 text-left">Vaccine Type</th>
                      <th className="w-[12%] px-3 py-3 text-left">Administration Route</th>
                      <th className="w-[13%] px-3 py-3 text-left">Lot/Batch Number</th>
                      <th className="w-[13%] px-3 py-3 text-left">Administered By</th>
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
                        <td className="px-3 py-3 text-sm text-muted-foreground">
                          {dose.administrationRoute || ((dose.status === 'completed' || dose.status === 'completed_late') ? 'Not recorded' : '-')}
                        </td>
                        <td className="px-3 py-3 text-sm text-muted-foreground">
                          <span>{dose.lotNo || '-'}</span>
                          {dose.inventoryLinkageStatus === 'Unavailable / not recorded' && (
                            <span className="mt-1 block text-xs text-amber-700">Batch link unavailable / not recorded</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-muted-foreground">{dose.administeredBy || '-'}</td>
                        <td className="px-3 py-3"><Badge variant={statusVariant(dose.status)}>{statusLabel(dose.status)}</Badge></td>
                        {(canUpdatePep || canSendNotifications) && (
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              {(dose.status === 'due_today' || dose.status === 'overdue' || dose.status === 'missed') && canUpdatePep && (
                                <Button type="button" size="sm" onClick={() => openRecordDose(dose)}>
                                  Record
                                </Button>
                              )}
                              {(dose.status === 'upcoming' || dose.status === 'due_today' || dose.status === 'overdue' || dose.status === 'missed') && canSendNotifications && (
                                <Button type="button" variant="outline" size="sm" onClick={() => handleSendReminder(dose)} disabled={!schedule.contact_number}>
                                  <MessageSquare className="h-4 w-4" />
                                  SMS
                                </Button>
                              )}
                              {(dose.status === 'overdue' || dose.status === 'missed') && canUpdatePep && (
                                <Button type="button" variant="outline" size="sm" onClick={() => openRescheduleDose(dose)}>
                                  <RefreshCw className="h-4 w-4" />
                                  Reschedule
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
                <h2 className="text-lg font-bold text-foreground">Record Anti-rabies Vaccine Dose — Day {recordDose.day}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Encode administered vaccine details for this dose.</p>
              </div>
              <button type="button" onClick={() => setRecordDose(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted" aria-label="Close record dose modal">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleRecordDose} className="space-y-4 p-6">
              <div>
                <Input label="Date Administered" type="date" max={todayKey()} value={recordForm.administeredDate} onChange={(event) => setRecordForm((current) => ({ ...current, administeredDate: event.target.value }))} required />
                {!recordForm.administeredDate && <p className="mt-1.5 text-xs font-medium text-destructive">Date administered is required.</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Administration Route</label>
                <select
                  value={recordForm.administrationRoute}
                  onChange={(event) => setRecordForm((current) => ({ ...current, administrationRoute: event.target.value }))}
                  disabled={savingDose}
                  required
                  className="h-10 w-full rounded-lg border border-input bg-input-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Select administration route</option>
                  <option value="Intradermal">Intradermal</option>
                  <option value="Intramuscular">Intramuscular</option>
                </select>
                {!recordForm.administrationRoute && <p className="mt-1.5 text-xs font-medium text-destructive">Administration route is required.</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Vaccine Product</label>
                <select
                  value={recordForm.inventoryItemId}
                  onChange={(event) => setRecordForm((current) => ({
                    ...current,
                    inventoryItemId: event.target.value,
                    inventoryBatchId: '',
                  }))}
                  disabled={savingDose || eligibleVaccineProducts.length === 0}
                  required
                  className="h-10 w-full rounded-lg border border-input bg-input-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Select vaccine product</option>
                  {eligibleVaccineProducts.map((item) => (
                    <option key={item.id} value={item.id}>{item.item_name || 'Unnamed vaccine'}</option>
                  ))}
                </select>
                {!recordForm.inventoryItemId && <p className="mt-1.5 text-xs font-medium text-destructive">Vaccine product is required.</p>}
                {eligibleVaccineProducts.length === 0 && (
                  <p className="mt-2 text-sm text-amber-700">No eligible vaccine product is currently available.</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Vaccine Lot / Batch</label>
                <select
                  value={recordForm.inventoryBatchId}
                  onChange={(event) => setRecordForm((current) => ({ ...current, inventoryBatchId: event.target.value }))}
                  disabled={savingDose || !selectedVaccineProduct || availableVaccineBatches.length === 0}
                  required
                  className="h-10 w-full rounded-lg border border-input bg-input-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Select available vaccine batch</option>
                  {availableVaccineBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      Lot/Batch {getBatchLotNumber(batch)} — Exp {formatDate(batch.expiry_date)} — Available stock {batch.quantity_remaining}
                    </option>
                  ))}
                </select>
                {!recordForm.inventoryBatchId && <p className="mt-1.5 text-xs font-medium text-destructive">Vaccine lot/batch is required.</p>}
                {selectedVaccineProduct && availableVaccineBatches.length === 0 && (
                  <p className="mt-2 text-sm text-amber-700">No unexpired vaccine batch with available stock is currently available.</p>
                )}
              </div>
              <Input label="Administered By" value={currentUser?.name || currentUser?.full_name || ''} readOnly />
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
                <span className="font-semibold">Inventory notice:</span> This records the vaccine product and batch used. Stock is not automatically deducted because the clinic’s intradermal and intramuscular vial-consumption rules are still under validation. Record actual stock usage in the Inventory module.
              </div>
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
                <Button type="submit" disabled={savingDose || !recordForm.administeredDate || !recordForm.administrationRoute || !recordForm.inventoryItemId || !selectedInventoryBatch}>{savingDose ? 'Saving...' : 'Save Dose Record'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rescheduleDose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Reschedule Dose - Day {rescheduleDose.day}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Only this dose will be moved. Future dose dates will remain unchanged.</p>
              </div>
              <button type="button" onClick={() => setRescheduleDose(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted" aria-label="Close reschedule dose modal">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleRescheduleDose} className="space-y-4 p-6">
              <Input label="Dose" value={'Day ' + rescheduleDose.day} disabled />
              <Input label="Original Scheduled Date" value={formatDate(rescheduleDose.date)} disabled />
              <Input label="New Scheduled Date" type="date" min={todayKey()} value={rescheduleForm.scheduledDate} onChange={(event) => setRescheduleForm((current) => ({ ...current, scheduledDate: event.target.value }))} required />
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Reason for Reschedule</label>
                <textarea
                  value={rescheduleForm.reason}
                  onChange={(event) => setRescheduleForm((current) => ({ ...current, reason: event.target.value }))}
                  className="min-h-24 w-full rounded-lg border border-input bg-input-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter the reason for manually rescheduling this dose"
                  maxLength={1000}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setRescheduleDose(null)} disabled={savingReschedule}>Cancel</Button>
                <Button type="submit" disabled={savingReschedule}>{savingReschedule ? 'Saving...' : 'Save Reschedule'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
