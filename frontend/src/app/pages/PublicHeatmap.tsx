import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Info,
  LockKeyhole,
  MapPin,
  PawPrint,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { publicAPI } from '../../lib/services/api';
import { AnimatedGISBackground } from '../components/Brand/AnimatedGISBackground';
import { BITEMAP_FONT_FAMILY, BITEMAP_LOGO_SRC } from '../components/Brand/brand';
import { DIGOS_BOUNDS, DIGOS_CENTER } from '../../data/digos-geography';

type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SUPPRESSED' | 'NO DATA';

type PublicBarangayAggregate = {
  barangay_name: string;
  latitude: number;
  longitude: number;
  incident_count: number | null;
  count_label: string;
  suppressed: boolean;
  risk_level: RiskLevel;
  incident_rate_per_1000: number | null;
  most_common_animal: string | null;
  comparison_to_city_average: number | null;
};

type PublicHeatmapResponse = {
  success: boolean;
  error?: string;
  reporting_period?: { year: number; month_start: number; month_end: number; label: string };
  classification_basis?: string;
  summary?: {
    total_incidents: number | null;
    total_incidents_label: string;
    barangays_with_recorded_incidents: number;
    highest_reported_barangay: string | null;
    pep_completion_rate: number | null;
    city_average_incidents: number | null;
  };
  data?: PublicBarangayAggregate[];
};

type Filters = {
  year: string;
  monthStart: string;
  monthEnd: string;
  riskLevel: string;
  animalType: string;
};

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;
const initialFilters: Filters = {
  year: String(currentYear),
  monthStart: '1',
  monthEnd: String(currentMonth),
  riskLevel: 'All',
  animalType: 'All',
};

const RISK_STYLES: Record<RiskLevel, { color: string; label: string }> = {
  LOW: { color: '#6FCFA9', label: 'Low' },
  MODERATE: { color: '#E7B85C', label: 'Moderate' },
  HIGH: { color: '#D97868', label: 'High' },
  SUPPRESSED: { color: '#94A3B8', label: 'Suppressed' },
  'NO DATA': { color: '#CBD5E1', label: 'No data' },
};

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function escapeHtml(value: string | number) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function LoadingCard() {
  return <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-4 h-9 w-9 rounded-xl bg-slate-200" /><div className="mb-2 h-6 w-24 rounded bg-slate-200" /><div className="h-3 w-36 max-w-full rounded bg-slate-100" /></div>;
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="relative block">
        <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm font-bold text-slate-700 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-500/15">
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </span>
    </label>
  );
}

export function PublicHeatmap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const aggregateLayerRef = useRef<L.LayerGroup | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [response, setResponse] = useState<PublicHeatmapResponse | null>(null);
  const [selectedBarangay, setSelectedBarangay] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const loadAggregates = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await publicAPI.getHeatmap({
        year: filters.year,
        month_start: filters.monthStart,
        month_end: filters.monthEnd,
        risk_level: filters.riskLevel,
        animal_type: filters.animalType,
      }) as PublicHeatmapResponse;

      if (!result.success) throw new Error('Public map request failed.');
      setResponse(result);
      setSelectedBarangay((current) => current && result.data?.some((item) => item.barangay_name === current) ? current : null);
    } catch {
      setResponse(null);
      setSelectedBarangay(null);
      setError('Unable to load map data. Public statistics are temporarily unavailable. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadAggregates(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadAggregates, retryKey]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: DIGOS_CENTER,
      zoom: 11,
      minZoom: 10,
      maxZoom: 16,
      maxBounds: L.latLngBounds(DIGOS_BOUNDS),
      maxBoundsViscosity: 0.9,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    aggregateLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    window.setTimeout(() => map.invalidateSize(), 0);

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => map.invalidateSize());
    observer?.observe(mapContainerRef.current);
    return () => {
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      aggregateLayerRef.current = null;
    };
  }, []);

  const visibleData = useMemo(() => response?.data ?? [], [response]);

  useEffect(() => {
    const layer = aggregateLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    visibleData.forEach((item) => {
      const center: [number, number] = [Number(item.latitude), Number(item.longitude)];
      if (!Number.isFinite(center[0]) || !Number.isFinite(center[1])) return;
      const selected = item.barangay_name === selectedBarangay;
      const style = RISK_STYLES[item.risk_level] || RISK_STYLES['NO DATA'];
      const circle = L.circle(center, {
        radius: selected ? 1250 : 1050,
        color: selected ? '#0F766E' : '#FFFFFF',
        weight: selected ? 4 : 2,
        fillColor: style.color,
        fillOpacity: item.risk_level === 'NO DATA' ? 0.42 : 0.64,
      });
      circle.bindTooltip(`<strong>${escapeHtml(item.barangay_name)}</strong><br>${escapeHtml(item.count_label)}<br>${escapeHtml(style.label)}`, { sticky: true, direction: 'top' });
      circle.on('click', () => setSelectedBarangay(item.barangay_name));
      circle.addTo(layer);
    });
  }, [visibleData, selectedBarangay]);

  const selected = useMemo(() => visibleData.find((item) => item.barangay_name === selectedBarangay) ?? null, [visibleData, selectedBarangay]);
  const selectedYearMaxMonth = Number(filters.year) === currentYear ? currentMonth : 12;
  const startMonthOptions = months.slice(0, Math.max(1, selectedYearMaxMonth - 2));
  const endMonthOptions = months.slice(Number(filters.monthStart) + 1, selectedYearMaxMonth);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === 'year') {
        const maxMonth = Number(value) === currentYear ? currentMonth : 12;
        next.monthStart = '1';
        next.monthEnd = String(maxMonth);
      }
      if (key === 'monthStart' && Number(next.monthEnd) < Number(value) + 2) next.monthEnd = String(Number(value) + 2);
      return next;
    });
  };

  const summary = response?.summary;
  const hasRecordedData = Boolean(summary && summary.barangays_with_recorded_incidents > 0);

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900" style={{ fontFamily: BITEMAP_FONT_FAMILY }}>
      <header className="sticky top-0 z-[1000] border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <Link to="/public" className="flex min-w-0 items-center gap-3" aria-label="BITEMAP Public Portal home">
            <img src={BITEMAP_LOGO_SRC} alt="BITEMAP logo" className="h-11 w-11 shrink-0 object-contain sm:h-12 sm:w-12" />
            <div className="min-w-0"><p className="truncate text-[17px] font-extrabold leading-tight text-teal-800 sm:text-xl">BITEMAP Public Portal</p><p className="hidden truncate text-xs font-medium text-slate-500 md:block">Animal Bite Incident Tracking and Vaccination Monitoring</p></div>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/public" className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50 sm:px-4"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Public Portal</span></Link>
            <Link to="/login" className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-teal-700/40 bg-white px-3 text-xs font-extrabold text-teal-800 hover:bg-teal-50 sm:px-4"><LockKeyhole className="h-4 w-4" /><span className="hidden md:inline">Authorized Staff Login</span><span className="md:hidden">Staff</span></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden">
          <AnimatedGISBackground tintClassName="bg-gradient-to-r from-teal-950/72 via-teal-900/52 to-teal-800/32" />
          <div className="relative z-10 mx-auto max-w-7xl px-4 py-10 text-white sm:px-6 sm:py-12 lg:px-8">
            <div className="max-w-3xl"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-teal-950/20 px-3 py-1.5 text-xs font-bold text-teal-50"><ShieldCheck className="h-3.5 w-3.5" /> Public view — privacy-safe aggregation</div><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Animal Bite Incident Heatmap</h1><p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-teal-50/90 sm:text-base">Explore aggregated barangay-level animal bite incident patterns for the selected reporting period.</p></div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-teal-200/80 bg-teal-50 px-4 py-3.5 text-teal-900"><Info className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" /><div><p className="text-sm font-extrabold">Barangay-level aggregated data only.</p><p className="mt-0.5 text-sm leading-relaxed text-teal-800">Exact incident locations and personal patient information are not displayed.</p></div></div>

          <section aria-label="Public map filters" className="mb-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-teal-950/5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[0.8fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
              <FilterSelect label="Reporting year" value={filters.year} onChange={(value) => updateFilter('year', value)}>{[0,1,2,3,4,5].map((offset) => <option key={currentYear-offset} value={currentYear-offset}>{currentYear-offset}</option>)}</FilterSelect>
              <FilterSelect label="From month" value={filters.monthStart} onChange={(value) => updateFilter('monthStart', value)}>{startMonthOptions.map((month, index) => <option key={month} value={index+1}>{month}</option>)}</FilterSelect>
              <FilterSelect label="To month" value={filters.monthEnd} onChange={(value) => updateFilter('monthEnd', value)}>{endMonthOptions.map((month, index) => { const value = Number(filters.monthStart)+2+index; return <option key={month} value={value}>{month}</option>; })}</FilterSelect>
              <FilterSelect label="Risk level" value={filters.riskLevel} onChange={(value) => updateFilter('riskLevel', value)}><option value="All">All classifications</option><option value="LOW">Low</option><option value="MODERATE">Moderate</option><option value="HIGH">High</option></FilterSelect>
              <FilterSelect label="Animal type" value={filters.animalType} onChange={(value) => updateFilter('animalType', value)}><option value="All">All animals</option><option value="Dog">Dog</option><option value="Cat">Cat</option><option value="Other">Other</option></FilterSelect>
              <button type="button" onClick={() => setFilters(initialFilters)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-100"><RotateCcw className="h-4 w-4" /> Reset</button>
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500"><CalendarDays className="h-4 w-4 text-teal-600" /> Public reporting ranges are limited to broad periods of at least three months.</p>
          </section>

          <section aria-labelledby="map-summary-title" className="mb-5">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><h2 id="map-summary-title" className="text-lg font-extrabold text-slate-900">Aggregated public summary</h2><p className="text-sm font-bold text-teal-700">{response?.reporting_period?.label || `${months[Number(filters.monthStart)-1]}–${months[Number(filters.monthEnd)-1]} ${filters.year}`}</p></div>
            {isLoading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><LoadingCard /><LoadingCard /><LoadingCard /><LoadingCard /></div> : error ? <div className="rounded-2xl border border-rose-200 bg-white p-5"><div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div><p className="font-extrabold text-slate-900">Unable to load aggregated map data</p><p className="mt-1 text-sm text-slate-600">{error}</p></div><button type="button" onClick={() => setRetryKey((key) => key + 1)} className="inline-flex h-10 items-center gap-2 rounded-full bg-teal-700 px-5 text-sm font-extrabold text-white hover:bg-teal-800"><RefreshCw className="h-4 w-4" /> Retry</button></div></div> : !hasRecordedData ? <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center"><Activity className="mx-auto h-7 w-7 text-teal-600" /><p className="mt-2 font-extrabold">No data available</p><p className="mt-1 text-sm text-slate-500">No aggregated records are available for the selected broad reporting period.</p></div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
              ['Total Recorded Incidents', summary?.total_incidents_label || 'No data', Activity],
              ['Barangays with Recorded Incidents', String(summary?.barangays_with_recorded_incidents ?? 0), MapPin],
              ['Highest Reported Barangay', summary?.highest_reported_barangay || 'Not available', TrendingUp],
              ['PEP Completion Rate', summary?.pep_completion_rate == null ? 'Not available' : `${summary.pep_completion_rate}%`, CheckCircle2],
            ].map(([label, value, Icon]) => <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-teal-950/5"><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Icon className="h-4 w-4" /></div><p className="text-xl font-extrabold text-teal-900">{String(value)}</p><h3 className="mt-1 text-xs font-bold leading-relaxed text-slate-500">{String(label)}</h3></article>)}</div>}
          </section>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)]">
            <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-teal-950/5" aria-labelledby="map-title">
              <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 id="map-title" className="font-extrabold text-slate-900">Digos City Barangay Map</h2><p className="mt-0.5 text-xs text-slate-500">Broad area circles represent aggregated barangay totals, never individual incidents.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Read-only public map</span></div>
              <div className="relative h-[480px] sm:h-[560px] lg:h-[620px]">
                <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" aria-label="Interactive aggregated barangay incident map" />
                {isLoading && <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70 backdrop-blur-[1px]"><div className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-teal-800 shadow-lg">Updating aggregated map…</div></div>}
                {error && <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/75 p-5"><div className="max-w-sm rounded-2xl border border-rose-200 bg-white p-5 text-center shadow-lg"><p className="font-extrabold text-slate-900">Map data unavailable</p><p className="mt-1 text-sm text-slate-500">Use Retry above to request the aggregated data again.</p></div></div>}
                <div className="absolute bottom-7 left-3 z-[450] max-w-[230px] rounded-2xl border border-white/70 bg-white/95 p-3 shadow-lg backdrop-blur-sm sm:left-4">
                  <p className="text-xs font-extrabold text-slate-800">Case-count classification</p><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">{(['LOW','MODERATE','HIGH','NO DATA'] as RiskLevel[]).map((risk) => <div key={risk} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: RISK_STYLES[risk].color }} /><span className="text-[11px] font-bold text-slate-600">{RISK_STYLES[risk].label}</span></div>)}</div><p className="mt-2 border-t border-slate-100 pt-2 text-[10px] leading-relaxed text-slate-500">Low 5–10 · Moderate 11–20 · High 21+ · Counts below 5 suppressed</p>
                </div>
              </div>
            </section>

            <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-teal-950/5" aria-labelledby="selected-summary-title">
                <h2 id="selected-summary-title" className="text-base font-extrabold text-slate-900">Selected Barangay Summary</h2>
                {selected ? <div className="mt-5 space-y-5"><div><div className="flex items-start justify-between gap-3"><div><p className="text-xl font-extrabold text-teal-900">{selected.barangay_name}</p><p className="mt-1 text-sm font-bold text-slate-500">{selected.count_label}</p></div><span className="rounded-full px-3 py-1 text-xs font-extrabold text-white" style={{ backgroundColor: RISK_STYLES[selected.risk_level].color }}>{RISK_STYLES[selected.risk_level].label}</span></div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Incident rate</p><p className="mt-1 text-sm font-extrabold text-slate-900">{selected.incident_rate_per_1000 == null ? 'Not available' : `${selected.incident_rate_per_1000} per 1,000`}</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Top animal</p><p className="mt-1 text-sm font-extrabold text-slate-900">{selected.most_common_animal || 'Not available'}</p></div></div><div className="space-y-3 border-t border-slate-100 pt-4"><div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">Risk level</span><strong>{RISK_STYLES[selected.risk_level].label}</strong></div><div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">City comparison</span><strong>{selected.comparison_to_city_average == null ? 'Not available' : `${Math.abs(selected.comparison_to_city_average)} ${selected.comparison_to_city_average >= 0 ? 'above' : 'below'} average`}</strong></div><div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">Reporting period</span><strong className="text-right">{response?.reporting_period?.label}</strong></div></div>{selected.suppressed && <div className="rounded-2xl bg-slate-100 p-3 text-xs font-semibold leading-relaxed text-slate-600">This barangay’s exact value and derived statistics are hidden because the filtered count is below five.</div>}</div> : <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-8 text-center"><MapPin className="mx-auto h-7 w-7 text-teal-600" /><p className="mx-auto mt-3 max-w-56 text-sm font-semibold leading-relaxed text-slate-600">Select a barangay on the map to view its aggregated statistics.</p></div>}
              </section>

              <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-center gap-2 text-emerald-900"><PawPrint className="h-5 w-5" /><h2 className="font-extrabold">Prevention Reminder</h2></div><ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-emerald-900/80"><li>• Avoid unfamiliar or aggressive animals.</li><li>• Keep pets vaccinated.</li><li>• Supervise children around animals.</li><li>• Seek medical assessment after a bite or scratch.</li></ul></section>
              <section className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex items-start gap-3"><BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" /><div><h2 className="font-extrabold text-slate-900">How classification works</h2><p className="mt-2 text-xs leading-relaxed text-slate-500">{response?.classification_basis || 'Classification is based on broad case-count thresholds. Exact values below five are suppressed.'}</p></div></div></section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
