import { useCallback, useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  Users, Syringe, Clock, MapPin, AlertTriangle,
  ChevronRight, RefreshCw, CalendarDays, Package,
  Bell, ClipboardPlus, UserCheck, ShieldAlert,
  Database, MessageSquare, ServerCog, Settings2, Activity, UserCog, type LucideIcon
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/ui/Badge';
import { AlertBanner } from '../components/ui/AlertBanner';
import { auditLogsAPI, dashboardAPI, getErrorMessage, notificationsAPI, settingsAPI, usersAPI } from '../../lib/services/api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { toast } from 'sonner';
import { canPerformAction, getRoleLabel, getStoredUser, normalizeRoleKey } from '../../lib/auth/roleAccess';

// ─── Constants & Types ────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  ok:       '#0D9488',
  low:      '#F59E0B',
  critical: '#F43F5E',
};

const STATUS_LABEL: Record<string, string> = {
  ok:       'Adequate',
  low:      'Low Stock',
  critical: 'Critical',
};

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

type DashboardStats = {
  totalCases: number;
  activeCases: number;
  completedVaccinations: number;
  pendingDoses: number;
  highRiskBarangays: number;
  dosesDueToday?: number;
  overdueDoses?: number;
  remindersSentToday?: number;
  remindersPending?: number;
  totalNotifications?: number;
  complianceRate?: number;
};

type DashboardIncident = {
  id: number | string;
  patient?: { full_name?: string | null } | null;
  incident_date?: string | null;
  who_category?: string | null;
  status?: string | null;
  barangay?: { name?: string | null } | null;
};

type DashboardInventoryItem = {
  id?: number | string;
  item_name?: string | null;
  current_stock?: number | string | null;
  unit?: string | null;
  name?: string;
  stock?: number;
  max?: number;
  status?: string;
};

type DashboardUser = {
  role?: string | null;
  status?: string | null;
  approval_status?: string | null;
  approvalStatus?: string | null;
};

type DashboardAuditLog = {
  id?: number | string;
  user_name?: string | null;
  user_role?: string | null;
  action?: string | null;
  module?: string | null;
  description?: string | null;
  timestamp?: string | null;
  created_at?: string | null;
};

type DashboardSetting = {
  setting_key: string;
  setting_value: unknown;
};

type MonthlyTrend = {
  month: string;
  cases: number;
  vaccinated: number;
};

type ComplianceItem = {
  name: string;
  value: number;
  color: string;
};

type AnimalTypeItem = {
  type: string;
  count: number;
  pct: number;
  color: string;
};

type HighRiskBarangay = {
  name: string;
  cases: number;
  level: string;
  dotColor: string;
  badgeClass: string;
};

type TodayScheduleItem = {
  id: number | string;
  patient: string;
  dose: string;
  time?: string;
  status: string;
};

type ChartTooltipEntry = {
  dataKey?: string | number;
  name?: ReactNode;
  color?: string;
  fill?: string;
  value?: ReactNode;
};

function getDefaultMonthlyTrends(): MonthlyTrend[] {
  const months: MonthlyTrend[] = [];
  const date = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    months.push({
      month: d.toLocaleString('en-US', { month: 'short' }),
      cases: 0,
      vaccinated: 0,
    });
  }
  return months;
}

const defaultVaccinationCompliance: ComplianceItem[] = [
  { name: 'Completed',   value: 0, color: '#0D9488' },
  { name: 'In Progress', value: 0, color: '#06B6D4' },
  { name: 'Pending',     value: 0, color: '#F59E0B' },
  { name: 'Missed Dose', value: 0, color: '#F43F5E' },
];

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: ChartTooltipEntry[]; label?: ReactNode }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs min-w-[110px]">
      {label && <p className="font-semibold text-foreground mb-1.5">{label}</p>}
      {payload.map((p) => (
        <div key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: String(p.color ?? p.fill) }} />
            {p.name}
          </span>
          <span className="font-semibold text-foreground tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Shared KPI Card ────────────────────────────────────────────────────────

function NurseKpiCard({ title, value, helper, icon: Icon, tone }: {
  title: string;
  value: number | string;
  helper: string;
  icon: LucideIcon;
  tone: 'emerald' | 'teal' | 'amber' | 'rose';
}) {
  const toneClass = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    teal: 'bg-teal-50 text-teal-700 border-teal-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
  }[tone];

  return (
    <div className="rounded-3xl border border-emerald-900/5 bg-white p-5 shadow-[0_14px_35px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_18px_42px_rgba(15,23,42,0.09)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[14px] font-semibold text-slate-600">{title}</p>
          <p className="mt-2 text-[36px] font-semibold leading-[40px] tracking-tight text-slate-950 tabular-nums">{value}</p>
        </div>
        <div className={'w-12 h-12 rounded-2xl border flex items-center justify-center shadow-sm ' + toneClass}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="mt-2.5 text-[12px] font-normal leading-snug text-slate-500">{helper}</p>
    </div>
  );
}

// ─── Nurse Dashboard ─────────────────────────────────────────────────────────

function NurseDashboard({
  stats,
  recentIncidents,
  lowStockItems,
  todaySchedules,
  lastUpdated,
  getCategoryVariant,
  canCreateIncident,
}: {
  stats: DashboardStats;
  recentIncidents: DashboardIncident[];
  lowStockItems: DashboardInventoryItem[];
  todaySchedules: TodayScheduleItem[];
  lastUpdated: string;
  getCategoryVariant: (cat?: string | null) => BadgeVariant;
  canCreateIncident: boolean;
}) {
  const dueToday = Number(stats.dosesDueToday ?? todaySchedules.length);
  const overdueDoses = Number(stats.overdueDoses ?? 0);
  const followUpPatients = Number(stats.activeCases ?? recentIncidents.length);
  const lowStockCount = lowStockItems.length;
  const reminderSent = Number(stats.remindersSentToday ?? 0);
  const reminderPending = Number(stats.remindersPending ?? 0);
  const maxReminderValue = Math.max(1, reminderSent, reminderPending, overdueDoses);

  return (
    <div className="flex-1 min-w-0 bg-[#f3f7f5]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Header title="Dashboard" breadcrumbs={['Home', 'Dashboard']} />

      <div className="p-6 space-y-4">
        {lowStockItems.length > 0 && (
          <AlertBanner
            variant="warning"
            message={`Inventory attention needed: ${lowStockItems[0].item_name || lowStockItems[0].name} has ${lowStockItems[0].current_stock ?? lowStockItems[0].stock} ${lowStockItems[0].unit || 'units'} remaining.`}
          />
        )}

        <div className="rounded-3xl bg-gradient-to-r from-emerald-700 to-teal-600 px-6 py-4 text-white shadow-[0_18px_45px_rgba(4,120,87,0.18)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[28px] font-bold leading-[32px]">Daily Clinic Workflow</p>
            <p className="mt-1 text-[13px] font-normal text-emerald-50/90">PEP schedules, follow-ups, reminders, and supplies for today.</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-2xl bg-white/12 px-3 py-2 text-[12px] font-semibold text-emerald-50">
            <RefreshCw className="w-3 h-3" />
            <span>Updated {lastUpdated}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <NurseKpiCard
            title="Doses Due Today"
            value={dueToday}
            helper={dueToday > 0 ? `${dueToday} patient(s) scheduled for PEP dose administration today.` : 'No PEP doses scheduled for administration today.'}
            icon={CalendarDays}
            tone="emerald"
          />
          <NurseKpiCard
            title="Overdue Doses"
            value={overdueDoses}
            helper={overdueDoses > 0 ? `${overdueDoses} delayed dose(s) needing contact or schedule review.` : 'No overdue vaccination doses.'}
            icon={Clock}
            tone={overdueDoses > 0 ? 'rose' : 'teal'}
          />
          <NurseKpiCard
            title="Patients for Follow-up"
            value={followUpPatients}
            helper={followUpPatients > 0 ? `${followUpPatients} active case(s) requiring follow-up monitoring.` : 'No active bite cases requiring follow-up.'}
            icon={UserCheck}
            tone="teal"
          />
          <NurseKpiCard
            title="Low Stock Items"
            value={lowStockCount}
            helper={lowStockCount > 0 ? `${lowStockCount} item(s) below reorder threshold.` : 'All vaccine & supply levels adequate.'}
            icon={Package}
            tone={lowStockCount > 0 ? 'amber' : 'emerald'}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-slate-950">Today's PEP Schedule</h2>
                <p className="text-[12px] font-normal text-slate-500 mt-0.5">Patients due for vaccination or schedule review today</p>
              </div>
              <Link to="/pep-schedule" className="text-[13px] text-emerald-700 font-bold flex items-center gap-0.5 hover:underline">
                Open schedule <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {todaySchedules.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <div className="mx-auto mb-2.5 w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <p className="text-[14px] font-semibold text-slate-900">No PEP schedules due today</p>
                <p className="text-[12px] font-normal text-slate-500 mt-1">Vaccination appointments scheduled for today will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {todaySchedules.map((row) => (
                  <div key={row.id} className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-emerald-50/40 transition-colors">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-slate-900 truncate">{row.patient}</p>
                      <p className="text-[12px] font-normal text-slate-500 mt-0.5">{row.dose} dose - {row.time || 'Clinic Hours'}</p>
                    </div>
                    <Badge variant={row.status === 'Clear' ? 'success' : row.status === 'Due today' ? 'warning' : 'info'}>
                      {row.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <div className="px-6 pt-4 pb-3 border-b border-slate-100">
              <h2 className="text-[16px] font-bold text-slate-950">Reminder Status</h2>
              <p className="text-[12px] font-normal text-slate-500 mt-0.5">SMS reminder activity today</p>
            </div>
            <div className="p-5 space-y-3.5">
              {[
                { label: 'Sent reminders', value: reminderSent, color: '#0D9488' },
                { label: 'Pending sends', value: reminderPending, color: '#06B6D4' },
                { label: 'Needs follow-up', value: overdueDoses, color: '#F43F5E' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-medium text-slate-500">{item.label}</span>
                    <span className="text-[13px] font-semibold text-slate-900 tabular-nums">{item.value}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: item.value > 0 ? `${Math.min(100, Math.max(10, Math.round((item.value / maxReminderValue) * 100)))}%` : '0%',
                        background: item.color
                      }}
                    />
                  </div>
                </div>
              ))}
              {reminderSent === 0 && reminderPending === 0 && overdueDoses === 0 && (
                <p className="text-[11px] text-slate-400 text-center pt-1">No reminder activity queued for today.</p>
              )}
              <Link to="/notifications" className="mt-1 inline-flex items-center gap-1 text-[13px] font-bold text-emerald-700 hover:underline">
                View notifications <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-slate-950">Recent Incidents</h2>
                <p className="text-[12px] font-normal text-slate-500 mt-0.5">Latest cases for clinic encoding and follow-up</p>
              </div>
              {canCreateIncident && (
                <Link to="/incidents/new" className="text-[13px] text-emerald-700 font-bold flex items-center gap-1 hover:underline">
                  <ClipboardPlus className="w-3.5 h-3.5" />
                  Record Incident
                </Link>
              )}
            </div>
            {recentIncidents.length === 0 ? (
              <div className="px-6 py-6 text-center">
                <div className="mx-auto mb-3 w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <ClipboardPlus className="w-5 h-5" />
                </div>
                <p className="text-[14px] font-semibold text-slate-900">No recent incidents recorded today.</p>
                <p className="text-[12px] font-normal text-slate-500 mt-1">Use Record Incident when a new bite case arrives.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      <th className="text-left px-5 py-2.5">Date</th>
                      <th className="text-left px-5 py-2.5">Patient</th>
                      <th className="text-left px-5 py-2.5">Category</th>
                      <th className="text-left px-5 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentIncidents.slice(0, 5).map((incident) => (
                      <tr key={incident.id} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="px-5 py-3 text-[13px] font-normal text-slate-500 whitespace-nowrap">
                          {incident.incident_date ? new Date(incident.incident_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '-'}
                        </td>
                        <td className="px-5 py-3 text-[13px] font-medium text-slate-900">{incident.patient?.full_name || '-'}</td>
                        <td className="px-5 py-3">
                          <Badge variant={getCategoryVariant(incident.who_category)}>
                            {incident.who_category?.replace('Category ', 'Cat ') || '-'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={incident.status === 'Active' ? 'info' : 'success'}>{incident.status || '-'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-slate-950">Vaccine & Supply Status</h2>
                <p className="text-[12px] font-normal text-slate-500 mt-0.5">Low and critical stock watchlist</p>
              </div>
              <Link to="/inventory" className="text-[13px] text-emerald-700 font-bold flex items-center gap-0.5 hover:underline">
                Inventory <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-5 space-y-3.5">
              {lowStockItems.length === 0 ? (
                <div className="py-6 text-center">
                  <div className="mx-auto mb-2 w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <p className="text-[13px] font-semibold text-slate-800">All supplies adequate</p>
                  <p className="text-[11px] font-normal text-slate-400 mt-0.5">No vaccine or supply items currently below reorder levels.</p>
                </div>
              ) : lowStockItems.slice(0, 5).map((item) => {
                const name = item.item_name || item.name || 'Unnamed Item';
                const stock = item.current_stock ?? item.stock ?? 0;
                const unit = item.unit || 'units';
                const status = item.status || (Number(stock) <= 10 ? 'critical' : 'low');
                const color = STATUS_COLOR[status] || STATUS_COLOR.low;
                return (
                  <div key={String(item.id || name)} className="rounded-2xl bg-slate-50/70 px-3 py-3">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <p className="text-[13px] font-semibold text-slate-900 leading-tight">{name}</p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ color, background: color + '1A' }}>
                        {STATUS_LABEL[status] || 'Low Stock'}
                      </span>
                    </div>
                    <p className="text-[12px] font-normal text-slate-500">
                      <span className="font-semibold text-slate-900 tabular-nums">{stock}</span> {unit} remaining
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-[16px] font-bold text-slate-950">Recent Notifications / SMS Reminders</h2>
            <p className="text-[12px] font-normal text-slate-500 mt-0.5">Quick activity summary for patient reminders</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {[
              { icon: Bell, label: 'Today reminders prepared', value: dueToday },
              { icon: Syringe, label: 'PEP doses monitored', value: stats.pendingDoses },
              { icon: AlertTriangle, label: 'Missed-dose follow-ups', value: overdueDoses },
            ].map((item) => (
              <div key={item.label} className="p-5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <item.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[22px] font-semibold leading-none text-slate-950 tabular-nums">{item.value}</p>
                  <p className="mt-1 text-[12px] font-normal text-slate-500">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Clinic Admin & Doctor Dashboard ──────────────────────────────────────────

function ClinicAdminDashboard({
  stats,
  recentIncidents,
  lowStockItems,
  monthlyTrends,
  vaccinationCompliance,
  animalTypeDistribution,
  highRiskBarangaysList,
  lastUpdated,
  complianceRate,
  getCategoryVariant,
  isDoctor,
}: {
  stats: DashboardStats;
  recentIncidents: DashboardIncident[];
  lowStockItems: DashboardInventoryItem[];
  monthlyTrends: MonthlyTrend[];
  vaccinationCompliance: ComplianceItem[];
  animalTypeDistribution: AnimalTypeItem[];
  highRiskBarangaysList: HighRiskBarangay[];
  lastUpdated: string;
  complianceRate: number;
  getCategoryVariant: (cat?: string | null) => BadgeVariant;
  isDoctor?: boolean;
}) {
  const highRiskWatchlist = highRiskBarangaysList.slice(0, 5);
  const highRiskAlertCount = highRiskWatchlist.filter((barangay) => barangay.level === 'Critical' || barangay.level === 'High').length;
  const displayedHighRiskCount = Math.max(Number(stats.highRiskBarangays || 0), highRiskAlertCount);
  const clinicSupplyRows = lowStockItems.slice(0, 5);
  const recentIncidentRows = recentIncidents.slice(0, 5);

  const totalTrendCases = monthlyTrends.reduce((s, m) => s + m.cases + m.vaccinated, 0);
  const hasMonthlyData = totalTrendCases > 0;

  const totalCompliance = vaccinationCompliance.reduce((s, d) => s + d.value, 0);
  const hasComplianceData = totalCompliance > 0;
  const complianceChartData = hasComplianceData
    ? vaccinationCompliance.filter((d) => d.value > 0)
    : [{ name: 'No PEP records', value: 1, color: '#E2E8F0' }];

  return (
    <div className="flex-1 min-w-0 bg-[#f3f7f5]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Header title="Dashboard" breadcrumbs={['Home', 'Dashboard']} />

      <div className="p-6 space-y-4">
        {lowStockItems.length > 0 && (
          <AlertBanner
            variant="warning"
            message={`Inventory attention needed: ${lowStockItems[0].item_name || lowStockItems[0].name} has ${lowStockItems[0].current_stock ?? lowStockItems[0].stock} ${lowStockItems[0].unit || 'units'} remaining.`}
          />
        )}

        <div className="rounded-3xl bg-gradient-to-r from-emerald-700 to-teal-600 px-6 py-4 text-white shadow-[0_18px_45px_rgba(4,120,87,0.18)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[28px] font-bold leading-[32px]">{isDoctor ? 'Clinical & Epidemiological Overview' : 'Clinic Operations Overview'}</p>
            <p className="mt-1 text-[13px] font-normal text-emerald-50/90">
              {isDoctor
                ? 'Medical oversight for rabies exposures, patient PEP adherence, animal vectors, and GIS incidence.'
                : 'Clinic-wide monitoring for incidents, PEP compliance, inventory, GIS, and reports.'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-2xl bg-white/12 px-3 py-2 text-[12px] font-semibold text-emerald-50">
            <RefreshCw className="w-3 h-3" />
            <span>Updated {lastUpdated}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <NurseKpiCard
            title="Total Bite Cases"
            value={stats.totalCases}
            helper={stats.totalCases > 0 ? 'All bite incidents logged for clinic monitoring.' : 'No bite incident cases logged yet.'}
            icon={Users}
            tone="emerald"
          />
          <NurseKpiCard
            title="Completed PEP"
            value={stats.completedVaccinations}
            helper={hasComplianceData ? `${complianceRate}% of tracked PEP cycles completed.` : 'No PEP vaccination cycles tracked yet.'}
            icon={Syringe}
            tone="teal"
          />
          <NurseKpiCard
            title="Pending Follow-ups"
            value={stats.pendingDoses}
            helper={stats.pendingDoses > 0 ? 'Upcoming or pending PEP doses needing review.' : 'No pending PEP doses queued.'}
            icon={Clock}
            tone="amber"
          />
          <NurseKpiCard
            title="High-Risk Barangays"
            value={displayedHighRiskCount}
            helper={displayedHighRiskCount > 0 ? `${displayedHighRiskCount} critical/high area(s) under active monitoring.` : 'All monitored areas within safe threshold.'}
            icon={MapPin}
            tone={displayedHighRiskCount > 0 ? 'rose' : 'emerald'}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-slate-950">Monthly Bite Incident Trends</h2>
                <p className="text-[12px] font-normal text-slate-500 mt-0.5">Cases reported vs. vaccinated for the last 6 months</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#64748B' }} /> Bite Cases</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#0D9488' }} /> Vaccinated</span>
              </div>
            </div>
            <div className="px-5 pt-4 pb-5">
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={monthlyTrends} barGap={3} barCategoryGap="28%" margin={{ top: 2, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid key="bc-grid" strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis key="bc-xaxis" dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis key="bc-yaxis" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip key="bc-tooltip" content={<ChartTooltip />} cursor={{ fill: '#F0FDFA' }} />
                  <Bar key="bc-bar-cases" dataKey="cases" name="Bite Cases" fill="#64748B" radius={[5, 5, 0, 0]} />
                  <Bar key="bc-bar-vaccinated" dataKey="vaccinated" name="Vaccinated" fill="#0D9488" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {!hasMonthlyData && (
                <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                    No bite incidents or vaccinations recorded in the last 6 months.
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">Displaying zero baseline</span>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-[16px] font-bold text-slate-950">Vaccination Compliance</h2>
              <p className="text-[12px] font-normal text-slate-500 mt-0.5">Current PEP cycle status</p>
            </div>
            <div className="px-5 py-4">
              <div className="flex justify-center">
                <div className="relative" style={{ width: 160, height: 160 }}>
                  <PieChart width={160} height={160}>
                    <Pie
                      key="pc-pie"
                      data={complianceChartData}
                      cx={80}
                      cy={80}
                      innerRadius={50}
                      outerRadius={72}
                      paddingAngle={hasComplianceData ? 2 : 0}
                      dataKey="value"
                      stroke="none"
                    >
                      {complianceChartData.map((entry) => <Cell key={`cell-${entry.name}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip key="pc-tooltip" content={hasComplianceData ? <ChartTooltip /> : () => null} />
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className={`text-[26px] font-bold leading-none ${hasComplianceData ? 'text-slate-950' : 'text-slate-400'}`}>
                      {hasComplianceData ? `${complianceRate}%` : '0%'}
                    </p>
                    <p className={`mt-1 text-[11px] font-medium ${hasComplianceData ? 'text-slate-500' : 'text-slate-400'}`}>
                      {hasComplianceData ? 'Completed' : 'No records'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                {vaccinationCompliance.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                      {item.name}
                    </span>
                    <span className="text-[12px] font-semibold text-slate-900 tabular-nums">{item.value}</span>
                  </div>
                ))}
                {!hasComplianceData && (
                  <p className="text-center text-[11px] text-slate-400 pt-1">No vaccination records to display yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-bold text-slate-950">Recent Incidents</h2>
                <p className="text-[12px] font-normal text-slate-500 mt-0.5">Latest 5 bite cases reported</p>
              </div>
              <Link to="/incidents" className="text-[13px] text-emerald-700 font-bold flex items-center gap-0.5 hover:underline">
                View all incidents <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {recentIncidentRows.length === 0 ? (
              <div className="px-6 py-7 text-center">
                <div className="mx-auto mb-3 w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <ClipboardPlus className="w-5 h-5" />
                </div>
                <p className="text-[14px] font-semibold text-slate-900">No recent incidents recorded.</p>
                <p className="mt-1 text-[12px] text-slate-500">New clinic-wide cases will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-2.5 text-left">Date</th>
                      <th className="px-5 py-2.5 text-left">Patient</th>
                      <th className="px-5 py-2.5 text-left">Barangay</th>
                      <th className="px-5 py-2.5 text-left">Category</th>
                      <th className="px-5 py-2.5 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentIncidentRows.map((incident) => (
                      <tr key={incident.id} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="px-5 py-3 text-[12px] text-slate-500 whitespace-nowrap">
                          {incident.incident_date ? new Date(incident.incident_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                        </td>
                        <td className="px-5 py-3 text-[13px] font-semibold text-slate-900">{incident.patient?.full_name || '-'}</td>
                        <td className="px-5 py-3 text-[12px] text-slate-500">{incident.barangay?.name || '-'}</td>
                        <td className="px-5 py-3"><Badge variant={getCategoryVariant(incident.who_category)}>{incident.who_category?.replace('Category ', 'Cat ') || '-'}</Badge></td>
                        <td className="px-5 py-3"><Badge variant={incident.status === 'Active' ? 'info' : 'success'}>{incident.status || '-'}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!isDoctor && (
            <div className="overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-bold text-slate-950">Vaccine & Supply Status</h2>
                  <p className="text-[12px] font-normal text-slate-500 mt-0.5">Low and critical stock watchlist</p>
                </div>
                <Link to="/inventory" className="text-[13px] text-emerald-700 font-bold flex items-center gap-0.5 hover:underline">
                  Inventory <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-5 space-y-3">
                {clinicSupplyRows.length === 0 ? (
                  <div className="py-6 text-center">
                    <div className="mx-auto mb-2 w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <Package className="w-4 h-4" />
                    </div>
                    <p className="text-[13px] font-semibold text-slate-800">All supplies adequate</p>
                    <p className="text-[11px] font-normal text-slate-400 mt-0.5">No vaccine or supply items currently below reorder levels.</p>
                  </div>
                ) : clinicSupplyRows.map((item) => {
                  const name = item.item_name || item.name || 'Unnamed Item';
                  const stock = item.current_stock ?? item.stock ?? 0;
                  const unit = item.unit || 'units';
                  const status = item.status || (Number(stock) <= 10 ? 'critical' : 'low');
                  const color = STATUS_COLOR[status] || STATUS_COLOR.low;
                  return (
                    <div key={String(item.id || name)} className="rounded-2xl bg-slate-50/80 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[13px] font-semibold leading-tight text-slate-900">{name}</p>
                        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ color, background: color + '1A' }}>
                          {STATUS_LABEL[status] || 'Low Stock'}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-slate-500"><span className="font-semibold text-slate-900 tabular-nums">{stock}</span> {unit} remaining</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isDoctor && (
            <div className="overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)] flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-bold text-slate-950">GIS Overview</h2>
                  <p className="text-[12px] font-normal text-slate-500 mt-0.5">Geographic incident monitoring</p>
                </div>
                <Link to="/gis-map" className="text-[13px] text-emerald-700 font-bold flex items-center gap-0.5 hover:underline whitespace-nowrap">
                  View GIS map <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-5 space-y-4 flex-1">
                <div>
                  <p className="text-[12px] font-semibold text-slate-700 uppercase tracking-wide">High-risk areas</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={`flex items-center justify-center font-bold text-[18px] w-8 h-8 rounded-lg ${highRiskAlertCount > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {highRiskAlertCount}
                    </span>
                    <span className="text-[13px] font-medium text-slate-900">active Critical/High barangays</span>
                  </div>
                </div>
                {highRiskWatchlist.length === 0 || highRiskWatchlist.every((b) => b.cases === 0) ? (
                  <div className="rounded-2xl bg-slate-50/70 p-3.5 text-center">
                    <p className="text-[13px] font-medium text-slate-700">All barangays currently at Low risk</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">0 bite incidents reported across monitored areas.</p>
                  </div>
                ) : (
                  <>
                    {highRiskWatchlist[0] && (
                      <div>
                        <p className="text-[12px] font-semibold text-slate-700 uppercase tracking-wide">Top area</p>
                        <p className="mt-1 text-[16px] font-bold text-slate-950">{highRiskWatchlist[0].name}</p>
                        <p className="text-[13px] text-slate-500">{highRiskWatchlist[0].cases} case{highRiskWatchlist[0].cases !== 1 ? 's' : ''}</p>
                      </div>
                    )}
                    {highRiskWatchlist.length > 1 && (
                      <div>
                        <p className="text-[12px] font-semibold text-slate-700 uppercase tracking-wide mb-1.5">Other monitored areas</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
                          {highRiskWatchlist.slice(1, 4).map((b) => (
                            <span key={b.name} className="text-slate-600">
                              <span className="font-semibold text-slate-900">{b.name}</span> &middot; {b.cases}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-[16px] font-bold text-slate-950">Biting Animal Types</h2>
              <p className="text-[12px] font-normal text-slate-500 mt-0.5">Distribution of reported incidents</p>
            </div>
            <div className="px-5 py-4 space-y-4">
              {animalTypeDistribution.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-2 w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                  <p className="text-[13px] font-semibold text-slate-800">No animal bite records yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Distribution by animal vector (Dog, Cat, etc.) will appear once incidents are recorded.</p>
                </div>
              ) : (
                animalTypeDistribution.map((animal) => (
                  <div key={animal.type}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
                        <span className="w-2 h-2 rounded-full" style={{ background: animal.color }} />
                        {animal.type}
                      </span>
                      <span className="text-[12px] text-slate-500 tabular-nums">{animal.count} / {animal.pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(4, animal.pct)}%`, background: animal.color }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {!isDoctor && (
            <div className="overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)] flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-bold text-slate-950">GIS Overview</h2>
                  <p className="text-[12px] font-normal text-slate-500 mt-0.5">Geographic incident monitoring</p>
                </div>
                <Link to="/gis-map" className="text-[13px] text-emerald-700 font-bold flex items-center gap-0.5 hover:underline whitespace-nowrap">
                  View GIS map <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-5 space-y-4 flex-1">
                <div>
                  <p className="text-[12px] font-semibold text-slate-700 uppercase tracking-wide">High-risk areas</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={`flex items-center justify-center font-bold text-[18px] w-8 h-8 rounded-lg ${highRiskAlertCount > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {highRiskAlertCount}
                    </span>
                    <span className="text-[13px] font-medium text-slate-900">active Critical/High barangays</span>
                  </div>
                </div>
                {highRiskWatchlist.length === 0 || highRiskWatchlist.every((b) => b.cases === 0) ? (
                  <div className="rounded-2xl bg-slate-50/70 p-3.5 text-center">
                    <p className="text-[13px] font-medium text-slate-700">All barangays currently at Low risk</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">0 bite incidents reported across monitored areas.</p>
                  </div>
                ) : (
                  <>
                    {highRiskWatchlist[0] && (
                      <div>
                        <p className="text-[12px] font-semibold text-slate-700 uppercase tracking-wide">Top area</p>
                        <p className="mt-1 text-[16px] font-bold text-slate-950">{highRiskWatchlist[0].name}</p>
                        <p className="text-[13px] text-slate-500">{highRiskWatchlist[0].cases} case{highRiskWatchlist[0].cases !== 1 ? 's' : ''}</p>
                      </div>
                    )}
                    {highRiskWatchlist.length > 1 && (
                      <div>
                        <p className="text-[12px] font-semibold text-slate-700 uppercase tracking-wide mb-1.5">Other monitored areas</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
                          {highRiskWatchlist.slice(1, 4).map((b) => (
                            <span key={b.name} className="text-slate-600">
                              <span className="font-semibold text-slate-900">{b.name}</span> &middot; {b.cases}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── System Admin Dashboard ───────────────────────────────────────────────────

function SystemMetricCard({ title, value, helper, icon: Icon, tone }: {
  title: string;
  value: number | string;
  helper: string;
  icon: LucideIcon;
  tone: 'emerald' | 'teal' | 'amber' | 'rose' | 'slate';
}) {
  const toneClass = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    teal: 'bg-teal-50 text-teal-700 border-teal-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  }[tone];

  return (
    <div className="rounded-3xl border border-emerald-900/5 bg-white p-5 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-slate-600">{title}</p>
          <p className="mt-2 text-[30px] font-bold leading-none tracking-tight text-slate-950 tabular-nums">{value}</p>
        </div>
        <div className={'flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm ' + toneClass}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-snug text-slate-500">{helper}</p>
    </div>
  );
}

function SystemPanel({ title, helper, children }: { title: string; helper?: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-[16px] font-bold text-slate-950">{title}</h2>
        {helper && <p className="mt-0.5 text-[12px] text-slate-500">{helper}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function SystemAdminDashboard({
  users,
  auditLogs,
  auditSummary,
  settings,
  systemNotificationsCount,
  lastUpdated,
}: {
  users: DashboardUser[];
  auditLogs: DashboardAuditLog[];
  auditSummary: { total: number; today: number; critical: number };
  settings: DashboardSetting[];
  systemNotificationsCount: number;
  lastUpdated: string;
}) {
  const getApprovalStatus = (user: DashboardUser) => user.approval_status || user.approvalStatus || 'approved';
  const activeUsers = users.filter((user) => user.status === 'Active' && getApprovalStatus(user) === 'approved').length;
  const pendingUsers = users.filter((user) => getApprovalStatus(user) === 'pending').length;
  const deactivatedAccounts = users.filter((user) => user.status !== 'Active').length;
  const failedLoginAttempts = auditLogs.filter((log) => {
    const haystack = [log.action, log.module, log.description].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes('failed') || haystack.includes('invalid') || haystack.includes('suspicious');
  }).length;
  const todayKey = new Date().toISOString().slice(0, 10);
  const failedToday = auditLogs.filter((log) => {
    const timestamp = String(log.timestamp || log.created_at || '');
    const haystack = [log.action, log.module, log.description].filter(Boolean).join(' ').toLowerCase();
    return timestamp.startsWith(todayKey) && (haystack.includes('failed') || haystack.includes('invalid') || haystack.includes('suspicious'));
  }).length;
  const settingMap = new Map(settings.map((setting) => [setting.setting_key, setting.setting_value]));
  const smsEnabled = settingMap.get('sms_reminders_enabled');
  const roleOrder = [
    { key: 'system_admin', label: 'System Admin' },
    { key: 'clinic_admin', label: 'Clinic Admin' },
    { key: 'doctor', label: 'Doctor' },
    { key: 'nurse_vaccinator', label: 'Nurse/Vaccinator' },
  ];
  const roleDistribution = roleOrder.map((role) => ({
    ...role,
    count: users.filter((user) => normalizeRoleKey(user.role) === role.key).length,
  }));
  const maxRoleCount = Math.max(1, ...roleDistribution.map((role) => role.count));
  const recentActivity = auditLogs.slice(0, 5);
  const statusRows = [
    { label: 'Database status', value: users.length || auditLogs.length ? 'Connected' : 'No signal', tone: users.length || auditLogs.length ? 'success' : 'neutral' },
    { label: 'SMS service status', value: smsEnabled === 'true' ? 'Enabled' : smsEnabled === 'false' ? 'Disabled' : 'Not configured', tone: smsEnabled === 'true' ? 'success' : smsEnabled === 'false' ? 'warning' : 'neutral' },
    { label: 'Queue worker status', value: 'Ready', tone: 'neutral' },
    { label: 'Last successful system check', value: users.length || auditLogs.length || settings.length ? lastUpdated : 'No source available', tone: users.length || auditLogs.length || settings.length ? 'success' : 'neutral' },
  ];
  const securityRows = [
    { label: 'Active sessions', value: activeUsers > 0 ? `${activeUsers} active` : '0', helper: 'Stateless session tokens (Sanctum).' },
    { label: 'Failed login attempts today', value: failedToday, helper: failedToday ? 'Review authentication logs.' : 'No failed attempts found in audit logs.' },
    { label: 'Deactivated accounts', value: deactivatedAccounts, helper: 'Based on user account status.' },
    { label: 'Critical audit events', value: auditSummary.critical || 0, helper: 'From audit log summary.' },
  ];

  return (
    <div className="flex-1 min-w-0 bg-[#f3f7f5]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Header title="System Administrator Dashboard" breadcrumbs={['System', 'Dashboard']} />

      <div className="space-y-5 p-6">
        <div className="rounded-3xl bg-gradient-to-r from-emerald-800 to-teal-700 px-6 py-4 text-white shadow-[0_18px_45px_rgba(4,120,87,0.18)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[26px] font-bold leading-tight">Platform Administration</p>
              <p className="mt-1 text-[13px] text-emerald-50/90">Security, access control, audit activity, and system configuration only.</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl bg-white/12 px-3 py-2 text-[12px] font-semibold text-emerald-50">
              <RefreshCw className="h-3 w-3" />
              <span>Updated {lastUpdated}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SystemMetricCard title="Total Users" value={users.length} helper="All platform and clinic accounts." icon={Users} tone="emerald" />
          <SystemMetricCard title="Active Users" value={activeUsers} helper="Approved active accounts." icon={UserCheck} tone="teal" />
          <SystemMetricCard title="Pending Account Requests" value={pendingUsers} helper="Awaiting administrator review." icon={UserCog} tone="amber" />
          <SystemMetricCard title="Failed / Suspicious Logins" value={failedLoginAttempts} helper={failedLoginAttempts ? `${failedLoginAttempts} detected in audit logs.` : 'No matching audit entries.'} icon={ShieldAlert} tone={failedLoginAttempts ? 'rose' : 'slate'} />
          <SystemMetricCard title="System Notifications" value={systemNotificationsCount} helper={systemNotificationsCount > 0 ? `${systemNotificationsCount} system notifications logged.` : 'No system notifications logged.'} icon={Bell} tone={systemNotificationsCount > 0 ? 'teal' : 'slate'} />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <SystemPanel title="Recent System Activity" helper="Latest 5 audit log entries.">
              {recentActivity.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No audit activity available.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-2.5 text-left">Timestamp</th>
                        <th className="px-4 py-2.5 text-left">User</th>
                        <th className="px-4 py-2.5 text-left">Role</th>
                        <th className="px-4 py-2.5 text-left">Action</th>
                        <th className="px-4 py-2.5 text-left">Module</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentActivity.map((log) => (
                        <tr key={log.id} className="hover:bg-emerald-50/40">
                          <td className="whitespace-nowrap px-4 py-3 text-[12px] text-slate-500">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                          <td className="px-4 py-3 text-[13px] font-semibold text-slate-900">{log.user_name || 'System'}</td>
                          <td className="px-4 py-3 text-[12px] text-slate-500">{getRoleLabel(log.user_role)}</td>
                          <td className="px-4 py-3 text-[12px] font-semibold text-slate-700">{log.action || '-'}</td>
                          <td className="px-4 py-3 text-[12px] text-slate-500">{log.module || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SystemPanel>
          </div>

          <SystemPanel title="User Distribution by Role" helper="Current account mix.">
            <div className="space-y-4">
              {roleDistribution.map((role) => (
                <div key={role.key}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-slate-800">{role.label}</span>
                    <span className="text-[12px] font-bold text-slate-500 tabular-nums">{role.count}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(4, (role.count / maxRoleCount) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </SystemPanel>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <SystemPanel title="System Status" helper="Live checks where sources exist.">
            <div className="space-y-3">
              {statusRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    {row.label.includes('Database') ? <Database className="h-4 w-4 text-emerald-700" /> : row.label.includes('SMS') ? <MessageSquare className="h-4 w-4 text-emerald-700" /> : row.label.includes('Queue') ? <ServerCog className="h-4 w-4 text-slate-400" /> : <Activity className="h-4 w-4 text-emerald-700" />}
                    <span className="text-[13px] font-semibold text-slate-700">{row.label}</span>
                  </div>
                  <span className={'rounded-full px-2 py-1 text-[11px] font-bold ' + (row.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : row.tone === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500')}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </SystemPanel>

          <SystemPanel title="Security Overview" helper="Account and audit security signals.">
            <div className="grid grid-cols-1 gap-3">
              {securityRows.map((row) => (
                <div key={row.label} className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-semibold text-slate-700">{row.label}</p>
                    <p className="text-[18px] font-bold text-slate-950 tabular-nums">{row.value}</p>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{row.helper}</p>
                </div>
              ))}
            </div>
          </SystemPanel>

          <SystemPanel title="Quick Actions" helper="Platform administration shortcuts.">
            <div className="grid grid-cols-1 gap-3">
              {[
                { href: '/users', label: 'Review pending users', icon: UserCog },
                { href: '/audit-logs', label: 'View audit logs', icon: ClipboardPlus },
                { href: '/settings', label: 'Open system settings', icon: Settings2 },
                { href: '/notifications', label: 'View system notifications', icon: Bell },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.href} to={action.href} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 text-[13px] font-bold text-slate-700 shadow-sm transition-colors hover:bg-emerald-50 hover:text-emerald-800">
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-emerald-700" />
                      {action.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                );
              })}
            </div>
          </SystemPanel>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

export function Dashboard() {
  const currentUser = getStoredUser();
  const currentRole = normalizeRoleKey(currentUser?.role);
  const isSystemAdminDashboard = currentRole === 'system_admin';
  const isNurseDashboard = currentRole === 'nurse_vaccinator';
  const isDoctor = currentRole === 'doctor';

  const [stats, setStats] = useState<DashboardStats>({
    totalCases: 0,
    activeCases: 0,
    completedVaccinations: 0,
    pendingDoses: 0,
    highRiskBarangays: 0,
    dosesDueToday: 0,
    overdueDoses: 0,
    remindersSentToday: 0,
    remindersPending: 0,
    totalNotifications: 0,
    complianceRate: 0,
  });
  const [recentIncidents, setRecentIncidents] = useState<DashboardIncident[]>([]);
  const [lowStockItems, setLowStockItems] = useState<DashboardInventoryItem[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>(getDefaultMonthlyTrends());
  const [vaccinationCompliance, setVaccinationCompliance] = useState<ComplianceItem[]>(defaultVaccinationCompliance);
  const [animalTypeDistribution, setAnimalTypeDistribution] = useState<AnimalTypeItem[]>([]);
  const [highRiskBarangaysList, setHighRiskBarangaysList] = useState<HighRiskBarangay[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<TodayScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [systemUsers, setSystemUsers] = useState<DashboardUser[]>([]);
  const [systemAuditLogs, setSystemAuditLogs] = useState<DashboardAuditLog[]>([]);
  const [systemAuditSummary, setSystemAuditSummary] = useState({ total: 0, today: 0, critical: 0 });
  const [systemSettings, setSystemSettings] = useState<DashboardSetting[]>([]);
  const [systemNotificationsCount, setSystemNotificationsCount] = useState<number>(0);

  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);

      if (isSystemAdminDashboard) {
        const [usersResult, auditResult, settingsResult, notificationsResult] = await Promise.all([
          usersAPI.getAll(),
          auditLogsAPI.getAll(),
          settingsAPI.getAll().catch(() => ({ success: false, data: [] })),
          notificationsAPI.getAll().catch(() => ({ success: false, data: [] })),
        ]);

        if (usersResult.success) {
          setSystemUsers((usersResult.data || []) as DashboardUser[]);
        } else {
          setSystemUsers([]);
        }

        if (auditResult.success) {
          setSystemAuditLogs((auditResult.data || []) as DashboardAuditLog[]);
          setSystemAuditSummary(auditResult.summary || { total: 0, today: 0, critical: 0 });
        } else {
          setSystemAuditLogs([]);
          setSystemAuditSummary({ total: 0, today: 0, critical: 0 });
        }

        if (settingsResult.success) {
          setSystemSettings((settingsResult.data || []) as DashboardSetting[]);
        } else {
          setSystemSettings([]);
        }

        if (notificationsResult.success) {
          const list = (notificationsResult.data || []) as unknown[];
          setSystemNotificationsCount(list.length);
        } else {
          setSystemNotificationsCount(0);
        }

        return;
      }

      const result = await dashboardAPI.getStats();
      if (result.success) {
        setStats(result.stats as DashboardStats);
        setRecentIncidents((result.recentIncidents || []) as DashboardIncident[]);
        setLowStockItems((result.lowStockItems || []) as DashboardInventoryItem[]);

        if (result.monthlyTrends && Array.isArray(result.monthlyTrends) && result.monthlyTrends.length > 0) {
          setMonthlyTrends(result.monthlyTrends as MonthlyTrend[]);
        } else {
          setMonthlyTrends(getDefaultMonthlyTrends());
        }

        if (result.vaccinationCompliance && Array.isArray(result.vaccinationCompliance)) {
          setVaccinationCompliance(result.vaccinationCompliance as ComplianceItem[]);
        }

        if (result.animalTypeDistribution && Array.isArray(result.animalTypeDistribution)) {
          setAnimalTypeDistribution(result.animalTypeDistribution as AnimalTypeItem[]);
        }

        if (result.highRiskBarangaysList && Array.isArray(result.highRiskBarangaysList)) {
          setHighRiskBarangaysList(result.highRiskBarangaysList as HighRiskBarangay[]);
        }

        if (result.todaySchedules && Array.isArray(result.todaySchedules)) {
          setTodaySchedules(result.todaySchedules as TodayScheduleItem[]);
        }
      } else {
        toast.error('Failed to load dashboard data');
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Error loading dashboard.'));
    } finally {
      setIsLoading(false);
    }
  }, [isSystemAdminDashboard]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadDashboardData(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadDashboardData]);

  const getCategoryVariant = (cat?: string | null): BadgeVariant => {
    if (cat?.includes('III')) return 'danger';
    if (cat?.includes('II')) return 'warning';
    return 'success';
  };

  const totalCompliance = vaccinationCompliance.reduce((s, d) => s + d.value, 0);
  const complianceRate = totalCompliance > 0
    ? Math.round(((vaccinationCompliance.find((d) => d.name === 'Completed')?.value || 0) / totalCompliance) * 100)
    : Number(stats.complianceRate || 0);

  const lastUpdated = new Date().toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const canCreateIncident = canPerformAction(currentUser?.role, 'incidents.create');

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>;
  }

  if (isSystemAdminDashboard) {
    return (
      <SystemAdminDashboard
        users={systemUsers}
        auditLogs={systemAuditLogs}
        auditSummary={systemAuditSummary}
        settings={systemSettings}
        systemNotificationsCount={systemNotificationsCount}
        lastUpdated={lastUpdated}
      />
    );
  }

  if (isNurseDashboard) {
    return (
      <NurseDashboard
        stats={stats}
        recentIncidents={recentIncidents}
        lowStockItems={lowStockItems}
        todaySchedules={todaySchedules}
        lastUpdated={lastUpdated}
        getCategoryVariant={getCategoryVariant}
        canCreateIncident={canCreateIncident}
      />
    );
  }

  return (
    <ClinicAdminDashboard
      stats={stats}
      recentIncidents={recentIncidents}
      lowStockItems={lowStockItems}
      monthlyTrends={monthlyTrends}
      vaccinationCompliance={vaccinationCompliance}
      animalTypeDistribution={animalTypeDistribution}
      highRiskBarangaysList={highRiskBarangaysList}
      lastUpdated={lastUpdated}
      complianceRate={complianceRate}
      getCategoryVariant={getCategoryVariant}
      isDoctor={isDoctor}
    />
  );
}
