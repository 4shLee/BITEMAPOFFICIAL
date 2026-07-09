import { useState, useEffect } from 'react';
import {
  Users, Syringe, Clock, MapPin, AlertTriangle,
  ChevronRight, RefreshCw, CalendarDays, Package,
  Bell, ClipboardPlus, UserCheck
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/UI/Badge';
import { AlertBanner } from '../components/UI/AlertBanner';
import { dashboardAPI } from '../../lib/services/api';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { toast } from 'sonner';
import { canPerformAction, getStoredUser, normalizeRoleKey } from '../../lib/auth/roleAccess';

// ─── Chart & static data ───────────────────────────────────────────────────

const monthlyTrendData = [
  { month: 'Dec', cases: 14, vaccinated: 12 },
  { month: 'Jan', cases: 18, vaccinated: 15 },
  { month: 'Feb', cases: 22, vaccinated: 19 },
  { month: 'Mar', cases: 19, vaccinated: 18 },
  { month: 'Apr', cases: 28, vaccinated: 24 },
  { month: 'May', cases: 15, vaccinated: 11 },
];

const barangayCasesData = [
  { name: 'Aplaya',      cases: 23, fill: '#C0392B' },
  { name: 'San Jose',   cases: 18, fill: '#D85A30' },
  { name: 'Poblacion',  cases: 15, fill: '#BA7517' },
  { name: 'Cogon',      cases: 12, fill: '#BA7517' },
  { name: 'Dulangan',   cases: 10, fill: '#0EA5E9' },
  { name: 'San Agustin',cases: 8,  fill: '#0EA5E9' },
  { name: 'Tiguman',    cases: 6,  fill: '#16A34A' },
  { name: 'Ruparan',    cases: 4,  fill: '#16A34A' },
];

const vaccinationComplianceData = [
  { name: 'Completed',   value: 128, color: '#16A34A' },
  { name: 'In Progress', value: 23,  color: '#0EA5E9' },
  { name: 'Pending',     value: 27,  color: '#BA7517' },
  { name: 'Missed Dose', value: 18,  color: '#D85A30' },
];

const animalTypeData = [
  { type: 'Dog',   count: 89, pct: 67, color: '#D85A30' },
  { type: 'Cat',   count: 31, pct: 23, color: '#0EA5E9' },
  { type: 'Other', count: 13, pct: 10, color: '#BA7517' },
];

const highRiskBarangays = [
  { name: 'Aplaya',    cases: 23, level: 'Critical', dotColor: '#C0392B',  badgeClass: 'text-destructive bg-destructive-bg' },
  { name: 'San Jose',  cases: 18, level: 'High',     dotColor: '#D85A30',  badgeClass: 'text-warning bg-warning-bg' },
  { name: 'Poblacion', cases: 15, level: 'High',     dotColor: '#D85A30',  badgeClass: 'text-warning bg-warning-bg' },
  { name: 'Cogon',     cases: 12, level: 'Moderate', dotColor: '#0EA5E9',  badgeClass: 'text-accent bg-accent-bg' },
  { name: 'Dulangan',  cases: 10, level: 'Moderate', dotColor: '#0EA5E9',  badgeClass: 'text-accent bg-accent-bg' },
];

const inventoryItems = [
  { name: 'Anti-Rabies Vaccine',    stock: 45,  max: 100, unit: 'vials', status: 'low'      },
  { name: 'Equine RIG (eRIG)',       stock: 120, max: 150, unit: 'vials', status: 'ok'       },
  { name: 'Human RIG (hRIG)',        stock: 8,   max: 30,  unit: 'vials', status: 'critical' },
  { name: 'Tetanus Toxoid',          stock: 85,  max: 120, unit: 'vials', status: 'ok'       },
  { name: 'Anti-Tetanus Serum',      stock: 22,  max: 50,  unit: 'vials', status: 'low'      },
  { name: 'Syringes (5 ml)',         stock: 0,   max: 200, unit: 'pcs',   status: 'critical' },
];

const STATUS_COLOR: Record<string, string> = {
  ok:       '#16A34A',
  low:      '#BA7517',
  critical: '#D85A30',
};

const STATUS_LABEL: Record<string, string> = {
  ok:       'Adequate',
  low:      'Low Stock',
  critical: 'Critical',
};

// ─── Shared chart tooltip ──────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs min-w-[110px]">
      {label && <p className="font-semibold text-foreground mb-1.5">{label}</p>}
      {payload.map((p: any) => (
        <div key={p.dataKey ?? p.name} className="flex items-center justify-between gap-3">
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

// ─── Choropleth heatmap — Digos City barangays ────────────────────────────────

// Color scale: green (low) → yellow → orange → red (high), matching choropleth convention
function choroColor(cases: number): string {
  if (cases >= 20) return '#B71C1C';
  if (cases >= 16) return '#E53935';
  if (cases >= 12) return '#F4511E';
  if (cases >= 9)  return '#FF7043';
  if (cases >= 6)  return '#FFA726';
  if (cases >= 3)  return '#FDD835';
  if (cases >= 1)  return '#9CCC65';
  return '#43A047';
}

function labelColor(cases: number): string {
  return cases >= 9 ? '#fff' : '#222';
}

function HeatmapPreview() {
  // Each barangay: name, case count, SVG rect coords, label position
  // Layout: coast (water) on left, urban core centre-left, rural inland right
  // viewBox 0 0 310 220
  // Water strip x=0..28
  // Grid x=28..304, y=12..208  → 276×196 split into rows/cols

  // 5 rows × varied columns = ~27 barangays (all of Digos City)
  const cells: { name: string; cases: number; x: number; y: number; w: number; h: number }[] = [
    // ── Row 1  y=12..56 (northern belt) ──────────────────────────────────────
    { name: 'Balabag',        cases: 5,  x: 28,  y: 12, w: 46, h: 44 },
    { name: 'Napungas',       cases: 3,  x: 74,  y: 12, w: 44, h: 44 },
    { name: 'Nueva Vida N.',  cases: 3,  x: 118, y: 12, w: 44, h: 44 },
    { name: 'Kapatagan',      cases: 2,  x: 162, y: 12, w: 44, h: 44 },
    { name: 'Kiagot',         cases: 2,  x: 206, y: 12, w: 46, h: 44 },
    { name: 'Matutungan',     cases: 1,  x: 252, y: 12, w: 52, h: 44 },

    // ── Row 2  y=56..100 ──────────────────────────────────────────────────────
    { name: 'Tiguman',        cases: 6,  x: 28,  y: 56, w: 46, h: 44 },
    { name: 'Dulangan',       cases: 10, x: 74,  y: 56, w: 44, h: 44 },
    { name: 'Zone I–III',     cases: 13, x: 118, y: 56, w: 52, h: 44 },
    { name: 'Dawis Norte',    cases: 4,  x: 170, y: 56, w: 44, h: 44 },
    { name: 'Nueva Vida S.',  cases: 2,  x: 214, y: 56, w: 44, h: 44 },
    { name: 'Lungag',         cases: 1,  x: 258, y: 56, w: 46, h: 44 },

    // ── Row 3  y=100..144  (urban core) ──────────────────────────────────────
    { name: 'Aplaya',         cases: 23, x: 28,  y: 100, w: 46, h: 44 },
    { name: 'San Jose',       cases: 18, x: 74,  y: 100, w: 44, h: 44 },
    { name: 'Cogon',          cases: 12, x: 118, y: 100, w: 44, h: 44 },
    { name: 'Poblacion',      cases: 15, x: 162, y: 100, w: 44, h: 44 },
    { name: 'S. Agustin',     cases: 8,  x: 206, y: 100, w: 46, h: 44 },
    { name: 'Dawis Sur',      cases: 3,  x: 252, y: 100, w: 52, h: 44 },

    // ── Row 4  y=144..188 ────────────────────────────────────────────────────
    { name: 'Ruparan',        cases: 4,  x: 28,  y: 144, w: 46, h: 44 },
    { name: 'Pagalungan',     cases: 3,  x: 74,  y: 144, w: 44, h: 44 },
    { name: 'Mahayahay',      cases: 7,  x: 118, y: 144, w: 44, h: 44 },
    { name: 'Matti',          cases: 5,  x: 162, y: 144, w: 44, h: 44 },
    { name: 'Goma',           cases: 2,  x: 206, y: 144, w: 46, h: 44 },
    { name: 'Pangubatan',     cases: 1,  x: 252, y: 144, w: 52, h: 44 },

    // ── Row 5  y=188..208 (southern fringe) ──────────────────────────────────
    { name: 'Pampanga',       cases: 2,  x: 28,  y: 188, w: 70, h: 20 },
    { name: 'Palili',         cases: 1,  x: 98,  y: 188, w: 70, h: 20 },
    { name: 'Pandaitan',      cases: 1,  x: 168, y: 188, w: 68, h: 20 },
    { name: 'Binaton',        cases: 1,  x: 236, y: 188, w: 68, h: 20 },
  ];

  const legendSteps = [
    { color: '#B71C1C', label: '20+' },
    { color: '#E53935', label: '16–19' },
    { color: '#F4511E', label: '12–15' },
    { color: '#FF7043', label: '9–11' },
    { color: '#FFA726', label: '6–8' },
    { color: '#FDD835', label: '3–5' },
    { color: '#9CCC65', label: '1–2' },
    { color: '#43A047', label: '0' },
  ];

  return (
    <div className="relative w-full h-full">
      <svg viewBox="0 0 310 220" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">

        {/* Sea background */}
        <rect x="0" y="0" width="310" height="220" fill="#D6EAF3" />

        {/* Land background behind cells */}
        <rect x="28" y="12" width="276" height="196" fill="#f5f5f5" />

        {/* Choropleth cells */}
        {cells.map((c) => (
          <g key={c.name}>
            <rect
              x={c.x} y={c.y} width={c.w} height={c.h}
              fill={choroColor(c.cases)}
              stroke="#fff"
              strokeWidth="1.2"
            />
            {/* Barangay name */}
            <text
              x={c.x + c.w / 2}
              y={c.h >= 40 ? c.y + c.h / 2 - 3 : c.y + c.h / 2 + 1}
              textAnchor="middle"
              fontSize={c.name.length > 9 ? 4.6 : 5.2}
              fontWeight="600"
              fill={labelColor(c.cases)}
              style={{ pointerEvents: 'none' }}
            >
              {c.name}
            </text>
            {/* Case count badge (only for taller cells) */}
            {c.h >= 40 && (
              <text
                x={c.x + c.w / 2}
                y={c.y + c.h / 2 + 8}
                textAnchor="middle"
                fontSize="4.4"
                fill={labelColor(c.cases)}
                style={{ pointerEvents: 'none', opacity: 0.85 }}
              >
                {c.cases} cases
              </text>
            )}
          </g>
        ))}

        {/* City outer border */}
        <rect x="28" y="12" width="276" height="196" fill="none" stroke="#666" strokeWidth="1" />

        {/* Water label */}
        <text x="14" y="110" textAnchor="middle" fontSize="5" fill="#3a7ea8" fontWeight="600"
          transform="rotate(-90 14 110)">Davao Gulf</text>

        {/* North indicator */}
        <g transform="translate(298, 22)">
          <circle cx="0" cy="0" r="8" fill="white" stroke="#aaa" strokeWidth="0.8" />
          <text x="0" y="3.5" textAnchor="middle" fontSize="7" fill="#333" fontWeight="800">N</text>
        </g>
      </svg>

      {/* Graduated legend — right side, matching reference image */}
      <div className="absolute top-2 right-2 bg-white/95 border border-gray-200 rounded shadow-sm px-2 py-1.5">
        <p className="text-[9px] font-bold text-gray-600 mb-1 uppercase tracking-wide">Bite Cases</p>
        <div className="space-y-0.5">
          {legendSteps.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className="w-4 h-3 rounded-sm inline-block shrink-0" style={{ background: s.color }} />
              <span className="text-[9px] text-gray-600 tabular-nums">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Ranked bar row ────────────────────────────────────────────────────────

function RankedBar({ rank, name, value, max, color }: {
  rank: number; name: string; value: number; max: number; color: string;
}) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3 group">
      <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0
        bg-muted text-muted-foreground group-hover:bg-border transition-colors tabular-nums">
        {rank}
      </span>
      <span className="text-xs font-medium text-foreground w-[88px] truncate">{name}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold text-foreground w-6 text-right tabular-nums">{value}</span>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

function NurseKpiCard({ title, value, helper, icon: Icon, tone }: {
  title: string;
  value: number | string;
  helper: string;
  icon: any;
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

function NurseDashboard({
  stats,
  recentIncidents,
  lowStockItems,
  lastUpdated,
  getCategoryVariant,
  canCreateIncident,
}: {
  stats: any;
  recentIncidents: any[];
  lowStockItems: any[];
  lastUpdated: string;
  getCategoryVariant: (cat: string) => any;
  canCreateIncident: boolean;
}) {
  const todaySchedule = recentIncidents.slice(0, 5).map((incident, index) => ({
    id: incident.id,
    patient: incident.patient?.full_name || 'Patient record pending',
    dose: ['Day 0', 'Day 3', 'Day 7', 'Day 14', 'Day 28'][index % 5],
    time: ['08:30 AM', '09:15 AM', '10:00 AM', '01:30 PM', '02:15 PM'][index % 5],
    status: index === 0 ? 'Due today' : 'Scheduled',
  }));
  const scheduleRows = todaySchedule.length > 0 ? todaySchedule : [
    { id: 'empty-1', patient: 'No PEP schedules queued', dose: 'Today', time: '--', status: 'Clear' },
  ];
  const supplyRows = (lowStockItems.length > 0 ? lowStockItems : inventoryItems.filter((item) => item.status !== 'ok')).slice(0, 5);
  const lowStockCount = lowStockItems.length || supplyRows.length;
  const overdueDoses = vaccinationComplianceData.find((item) => item.name === 'Missed Dose')?.value || 0;
  const followUpPatients = Math.max(stats.activeCases || 0, recentIncidents.length);
  const dueToday = stats.pendingDoses || todaySchedule.length;
  const reminderSent = Math.max(0, dueToday - 1);
  const reminderPending = dueToday > 0 ? 1 : 0;

  return (
    <div className="flex-1 min-w-0 bg-[#f3f7f5]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Header title="Dashboard" breadcrumbs={['Home', 'Dashboard']} />

      <div className="p-6 space-y-4">
        {lowStockItems.length > 0 && (
          <AlertBanner
            variant="warning"
            message={`Inventory attention needed: ${lowStockItems[0].item_name} has ${lowStockItems[0].current_stock} ${lowStockItems[0].unit} remaining.`}
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
          <NurseKpiCard title="Doses Due Today" value={dueToday} helper="Patients scheduled for PEP dose administration." icon={CalendarDays} tone="emerald" />
          <NurseKpiCard title="Overdue Doses" value={overdueDoses} helper="Missed or delayed doses needing immediate follow-up." icon={Clock} tone="rose" />
          <NurseKpiCard title="Patients for Follow-up" value={followUpPatients} helper="Active cases requiring patient contact or schedule review." icon={UserCheck} tone="teal" />
          <NurseKpiCard title="Low Stock Items" value={lowStockCount} helper="Inventory items below reorder or critical level." icon={Package} tone="amber" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-slate-950">Today's PEP Schedule</h2>
                <p className="text-[12px] font-normal text-slate-500 mt-0.5">Patients due for vaccination or schedule review</p>
              </div>
              <a href="/pep-schedule" className="text-[13px] text-emerald-700 font-bold flex items-center gap-0.5 hover:underline">
                Open schedule <ChevronRight className="w-3 h-3" />
              </a>
            </div>
            <div className="divide-y divide-slate-100">
              {scheduleRows.map((row) => (
                <div key={row.id} className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-emerald-50/40 transition-colors">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-slate-900 truncate">{row.patient}</p>
                    <p className="text-[12px] font-normal text-slate-500 mt-0.5">{row.dose} dose - {row.time}</p>
                  </div>
                  <Badge variant={row.status === 'Clear' ? 'success' : row.status === 'Due today' ? 'warning' : 'info'}>
                    {row.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <div className="px-6 pt-4 pb-3 border-b border-slate-100">
              <h2 className="text-[16px] font-bold text-slate-950">Reminder Status</h2>
              <p className="text-[12px] font-normal text-slate-500 mt-0.5">SMS reminder activity today</p>
            </div>
            <div className="p-5 space-y-3.5">
              {[
                { label: 'Sent reminders', value: reminderSent, color: '#16A34A' },
                { label: 'Pending sends', value: reminderPending, color: '#0EA5E9' },
                { label: 'Needs follow-up', value: overdueDoses, color: '#D85A30' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-medium text-slate-500">{item.label}</span>
                    <span className="text-[13px] font-semibold text-slate-900 tabular-nums">{item.value}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(8, item.value * 8))}%`, background: item.color }} />
                  </div>
                </div>
              ))}
              <a href="/notifications" className="mt-1 inline-flex items-center gap-1 text-[13px] font-bold text-emerald-700 hover:underline">
                View notifications <ChevronRight className="w-3 h-3" />
              </a>
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
                <a href="/incidents/new" className="text-[13px] text-emerald-700 font-bold flex items-center gap-1 hover:underline">
                  <ClipboardPlus className="w-3.5 h-3.5" />
                  Record Incident
                </a>
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
                          {new Date(incident.incident_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-5 py-3 text-[13px] font-medium text-slate-900">{incident.patient?.full_name || '-'}</td>
                        <td className="px-5 py-3">
                          <Badge variant={getCategoryVariant(incident.who_category)}>
                            {incident.who_category?.replace('Category ', 'Cat ') || '-'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={incident.status === 'Active' ? 'info' : 'success'}>{incident.status}</Badge>
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
              <a href="/inventory" className="text-[13px] text-emerald-700 font-bold flex items-center gap-0.5 hover:underline">
                Inventory <ChevronRight className="w-3 h-3" />
              </a>
            </div>
            <div className="p-5 space-y-3.5">
              {supplyRows.length === 0 ? (
                <p className="text-[12px] font-normal text-slate-500 text-center py-5">All vaccine and supply levels are adequate.</p>
              ) : supplyRows.map((item) => {
                const name = item.item_name || item.name;
                const stock = item.current_stock ?? item.stock;
                const unit = item.unit || 'units';
                const status = item.status || (stock <= 10 ? 'critical' : 'low');
                const color = STATUS_COLOR[status] || STATUS_COLOR.low;
                return (
                  <div key={name} className="rounded-2xl bg-slate-50/70 px-3 py-3">
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

function ClinicAdminDashboard({
  stats,
  recentIncidents,
  lowStockItems,
  barangayFilter,
  setBarangayFilter,
  visibleBarangays,
  lastUpdated,
  complianceRate,
  getCategoryVariant,
}: {
  stats: any;
  recentIncidents: any[];
  lowStockItems: any[];
  barangayFilter: 'top5' | 'all';
  setBarangayFilter: (filter: 'top5' | 'all') => void;
  visibleBarangays: typeof barangayCasesData;
  lastUpdated: string;
  complianceRate: number;
  getCategoryVariant: (cat: string) => any;
}) {
  const highRiskWatchlist = highRiskBarangays.slice(0, 5);
  const highRiskAlertCount = highRiskWatchlist.filter((barangay) => barangay.level === 'Critical' || barangay.level === 'High').length;
  const displayedHighRiskCount = Math.max(Number(stats.highRiskBarangays || 0), highRiskAlertCount);
  const clinicSupplyRows = (lowStockItems.length > 0 ? lowStockItems : inventoryItems.filter((item) => item.status !== 'ok')).slice(0, 5);
  const recentIncidentRows = recentIncidents.slice(0, 5);

  return (
    <div className="flex-1 min-w-0 bg-[#f3f7f5]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Header title="Dashboard" breadcrumbs={['Home', 'Dashboard']} />

      <div className="p-6 space-y-4">
        {lowStockItems.length > 0 && (
          <AlertBanner
            variant="warning"
            message={`Inventory attention needed: ${lowStockItems[0].item_name} has ${lowStockItems[0].current_stock} ${lowStockItems[0].unit} remaining.`}
          />
        )}

        <div className="rounded-3xl bg-gradient-to-r from-emerald-700 to-teal-600 px-6 py-4 text-white shadow-[0_18px_45px_rgba(4,120,87,0.18)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[28px] font-bold leading-[32px]">Clinic Operations Overview</p>
            <p className="mt-1 text-[13px] font-normal text-emerald-50/90">Clinic-wide monitoring for incidents, PEP compliance, inventory, GIS, and reports.</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-2xl bg-white/12 px-3 py-2 text-[12px] font-semibold text-emerald-50">
            <RefreshCw className="w-3 h-3" />
            <span>Updated {lastUpdated}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <NurseKpiCard title="Total Bite Cases" value={stats.totalCases} helper="All bite incidents logged for clinic monitoring." icon={Users} tone="emerald" />
          <NurseKpiCard title="Completed PEP" value={stats.completedVaccinations} helper={`${complianceRate}% of tracked PEP cycles completed.`} icon={Syringe} tone="teal" />
          <NurseKpiCard title="Pending Follow-ups" value={stats.pendingDoses} helper="Upcoming or pending PEP doses needing review." icon={Clock} tone="amber" />
          <NurseKpiCard title="High-Risk Barangays" value={displayedHighRiskCount} helper="Critical or high areas under active monitoring." icon={MapPin} tone="rose" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-slate-950">Monthly Bite Incident Trends</h2>
                <p className="text-[12px] font-normal text-slate-500 mt-0.5">Cases reported vs. vaccinated for the last 6 months</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#D85A30' }} /> Bite Cases</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#16A34A' }} /> Vaccinated</span>
              </div>
            </div>
            <div className="px-5 pt-4 pb-5">
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={monthlyTrendData} barGap={3} barCategoryGap="28%" margin={{ top: 2, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid key="bc-grid" strokeDasharray="3 3" stroke="#E8E5DC" vertical={false} />
                  <XAxis key="bc-xaxis" dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis key="bc-yaxis" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip key="bc-tooltip" content={<ChartTooltip />} cursor={{ fill: '#ECFDF5' }} />
                  <Bar key="bc-bar-cases" dataKey="cases" name="Bite Cases" fill="#D85A30" radius={[5, 5, 0, 0]} />
                  <Bar key="bc-bar-vaccinated" dataKey="vaccinated" name="Vaccinated" fill="#16A34A" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
                    <Pie key="pc-pie" data={vaccinationComplianceData} cx={80} cy={80} innerRadius={50} outerRadius={72} paddingAngle={2} dataKey="value" stroke="none">
                      {vaccinationComplianceData.map((entry) => <Cell key={`cell-${entry.name}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip key="pc-tooltip" content={<ChartTooltip />} />
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[26px] font-bold leading-none text-slate-950">{complianceRate}%</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-500">Completed</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                {vaccinationComplianceData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                      {item.name}
                    </span>
                    <span className="text-[12px] font-semibold text-slate-900 tabular-nums">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-slate-950">Bite Cases Per Barangay</h2>
                <p className="text-[12px] font-normal text-slate-500 mt-0.5">Incident density by location for {new Date().getFullYear()}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-xl bg-emerald-50 p-0.5 text-[12px] font-semibold">
                  {(['top5', 'all'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setBarangayFilter(filter)}
                      className={'rounded-lg px-3 py-1 transition-colors ' + (barangayFilter === filter ? 'bg-white text-emerald-800 shadow-sm' : 'text-emerald-700/70 hover:text-emerald-900')}
                    >
                      {filter === 'top5' ? 'Top 5' : 'All'}
                    </button>
                  ))}
                </div>
                <a href="/gis-map" className="text-[13px] text-emerald-700 font-bold flex items-center gap-0.5 hover:underline">
                  View GIS map <ChevronRight className="w-3 h-3" />
                </a>
              </div>
            </div>
            <div className="px-6 py-4 space-y-3">
              {visibleBarangays.map((barangay, index) => (
                <RankedBar key={barangay.name} rank={index + 1} name={barangay.name} value={barangay.cases} max={barangayCasesData[0].cases} color={barangay.fill} />
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-bold text-slate-950">High-Risk Areas</h2>
                <p className="text-[12px] font-normal text-slate-500 mt-0.5">Top barangays needing oversight</p>
              </div>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">{displayedHighRiskCount} active</span>
            </div>
            <div className="divide-y divide-slate-100">
              {highRiskWatchlist.map((barangay) => (
                <div key={barangay.name} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-emerald-50/40 transition-colors">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: barangay.dotColor }} />
                    <span className="truncate text-[13px] font-semibold text-slate-900">{barangay.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[12px] text-slate-500 tabular-nums">{barangay.cases} cases</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${barangay.badgeClass}`}>{barangay.level}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 px-5 py-3">
              <a href="/reports" className="text-[13px] text-emerald-700 font-bold flex items-center gap-0.5 hover:underline">
                Open reports <ChevronRight className="w-3 h-3" />
              </a>
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
              <a href="/incidents" className="text-[13px] text-emerald-700 font-bold flex items-center gap-0.5 hover:underline">
                View all incidents <ChevronRight className="w-3 h-3" />
              </a>
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
                          {new Date(incident.incident_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-3 text-[13px] font-semibold text-slate-900">{incident.patient?.full_name || '-'}</td>
                        <td className="px-5 py-3 text-[12px] text-slate-500">{incident.barangay?.name || '-'}</td>
                        <td className="px-5 py-3"><Badge variant={getCategoryVariant(incident.who_category)}>{incident.who_category?.replace('Category ', 'Cat ') || '-'}</Badge></td>
                        <td className="px-5 py-3"><Badge variant={incident.status === 'Active' ? 'info' : 'success'}>{incident.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-bold text-slate-950">Vaccine & Supply Status</h2>
                <p className="text-[12px] font-normal text-slate-500 mt-0.5">Low and critical stock watchlist</p>
              </div>
              <a href="/inventory" className="text-[13px] text-emerald-700 font-bold flex items-center gap-0.5 hover:underline">
                Inventory <ChevronRight className="w-3 h-3" />
              </a>
            </div>
            <div className="p-5 space-y-3">
              {clinicSupplyRows.length === 0 ? (
                <p className="py-5 text-center text-[13px] text-slate-500">All vaccine and supply levels are adequate.</p>
              ) : clinicSupplyRows.map((item) => {
                const name = item.item_name || item.name;
                const stock = item.current_stock ?? item.stock;
                const unit = item.unit || 'units';
                const status = item.status || (stock <= 10 ? 'critical' : 'low');
                const color = STATUS_COLOR[status] || STATUS_COLOR.low;
                return (
                  <div key={name} className="rounded-2xl bg-slate-50/80 px-3 py-3">
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
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-[16px] font-bold text-slate-950">Biting Animal Types</h2>
              <p className="text-[12px] font-normal text-slate-500 mt-0.5">Distribution of reported incidents</p>
            </div>
            <div className="px-5 py-4 space-y-4">
              {animalTypeData.map((animal) => (
                <div key={animal.type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
                      <span className="w-2 h-2 rounded-full" style={{ background: animal.color }} />
                      {animal.type}
                    </span>
                    <span className="text-[12px] text-slate-500 tabular-nums">{animal.count} / {animal.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${animal.pct}%`, background: animal.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="xl:col-span-2 overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-bold text-slate-950">GIS Summary</h2>
                <p className="text-[12px] font-normal text-slate-500 mt-0.5">Barangay hotspot overview for clinic planning</p>
              </div>
              <a href="/gis-map" className="text-[13px] text-emerald-700 font-bold flex items-center gap-0.5 hover:underline">
                View GIS map <ChevronRight className="w-3 h-3" />
              </a>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="h-56 overflow-hidden rounded-2xl bg-slate-100">
                <HeatmapPreview />
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                  <p className="text-[12px] font-semibold text-emerald-800">Priority area</p>
                  <p className="mt-1 text-[24px] font-bold leading-none text-slate-950">{highRiskWatchlist[0]?.name || 'None'}</p>
                  <p className="mt-1 text-[12px] text-slate-500">{highRiskWatchlist[0]?.cases || 0} cases in the current watchlist.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-[12px] font-semibold text-slate-700">Operational links</p>
                  <div className="mt-2 flex flex-col gap-2">
                    <a href="/reports" className="text-[13px] text-emerald-700 font-bold flex items-center gap-0.5 hover:underline">Open reports <ChevronRight className="w-3 h-3" /></a>
                    <a href="/notifications" className="text-[13px] text-emerald-700 font-bold flex items-center gap-0.5 hover:underline">View notifications <ChevronRight className="w-3 h-3" /></a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [stats, setStats] = useState({
    totalCases: 0,
    activeCases: 0,
    completedVaccinations: 0,
    pendingDoses: 0,
    highRiskBarangays: 0,
  });
  const [recentIncidents, setRecentIncidents] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [barangayFilter, setBarangayFilter] = useState<'top5' | 'all'>('top5');

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    try {
      const result = await dashboardAPI.getStats();
      if (result.success) {
        setStats(result.stats);
        setRecentIncidents(result.recentIncidents);
        setLowStockItems(result.lowStockItems);
      } else {
        toast.error('Failed to load dashboard data');
      }
    } catch (error: any) {
      toast.error('Error loading dashboard: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryVariant = (cat: string) => {
    if (cat?.includes('III')) return 'danger';
    if (cat?.includes('II')) return 'warning';
    return 'success';
  };

  const totalCompliance = vaccinationComplianceData.reduce((s, d) => s + d.value, 0);
  const complianceRate  = Math.round((vaccinationComplianceData[0].value / totalCompliance) * 100);
  const visibleBarangays = barangayFilter === 'top5' ? barangayCasesData.slice(0, 5) : barangayCasesData;
  const lastUpdated = new Date().toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const currentUser = getStoredUser();
  const isNurseDashboard = normalizeRoleKey(currentUser?.role) === 'nurse_vaccinator';
  const canCreateIncident = canPerformAction(currentUser?.role, 'incidents.create');

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>;
  }

  if (isNurseDashboard) {
    return (
      <NurseDashboard
        stats={stats}
        recentIncidents={recentIncidents}
        lowStockItems={lowStockItems}
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
      barangayFilter={barangayFilter}
      setBarangayFilter={setBarangayFilter}
      visibleBarangays={visibleBarangays}
      lastUpdated={lastUpdated}
      complianceRate={complianceRate}
      getCategoryVariant={getCategoryVariant}
    />
  );
}
