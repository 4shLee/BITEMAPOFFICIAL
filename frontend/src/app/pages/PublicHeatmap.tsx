import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  Activity,
  LogIn,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Info,
  MapPin,
  Maximize2,
  PawPrint,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { publicAPI } from '../../lib/services/api';
import { getDefaultPathForRole, getStoredUser, hasAuthSession } from '../../lib/auth/roleAccess';
import { AnimatedGISBackground } from '../components/Brand/AnimatedGISBackground';
import { BITEMAP_FONT_FAMILY, BITEMAP_LOGO_SRC } from '../components/Brand/brand';
import { DIGOS_BARANGAY_POINTS, DIGOS_CENTER } from '../../data/digos-geography';
import { DIGOS_MAX_BOUNDS } from '../../lib/maplibre/basemap';
import { loadDigosBoundaries, validLatitude, validLongitude, type BarangayBoundaries } from '../../lib/maplibre/geo';
import { useMapLibre } from '../../lib/maplibre/useMapLibre';
import { addPublicLayers, registerPublicInteractions, updatePublicData } from '../components/Gis/publicLayers';

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
const initialMaxMonth = Math.max(3, currentMonth);
const initialFilters: Filters = {
  year: String(currentYear),
  monthStart: '1',
  monthEnd: String(initialMaxMonth),
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

function getMonthName(monthNumber: number): string {
  const index = Math.max(0, Math.min(months.length - 1, Math.trunc(monthNumber) - 1));
  return months[index] ?? 'January';
}

function classifyCountRisk(count: number, suppressed: boolean): RiskLevel {
  if (count <= 0) return 'NO DATA';
  if (suppressed || count < 5) return 'SUPPRESSED';
  if (count <= 10) return 'LOW';
  if (count <= 20) return 'MODERATE';
  return 'HIGH';
}

function normalizeRiskLevel(rawRisk: unknown, count?: number | null, suppressed?: boolean): RiskLevel {
  if (suppressed) return 'SUPPRESSED';
  if (typeof count === 'number' && Number.isFinite(count)) {
    return classifyCountRisk(count, Boolean(suppressed));
  }

  if (typeof rawRisk === 'string') {
    const cleaned = rawRisk.trim().toUpperCase().replace(/\s+RISK$/, '');
    if (cleaned === 'LOW' || cleaned === 'MODERATE' || cleaned === 'HIGH' || cleaned === 'SUPPRESSED' || cleaned === 'NO DATA') {
      return cleaned;
    }
    if (cleaned === 'MEDIUM') return 'MODERATE';
    if (cleaned === 'NONE' || cleaned === 'NODATA') return 'NO DATA';
  }

  return 'NO DATA';
}

function getRiskStyle(riskLevel: unknown): { color: string; label: string } {
  if (typeof riskLevel === 'string' && riskLevel in RISK_STYLES) {
    return RISK_STYLES[riskLevel as RiskLevel];
  }
  return RISK_STYLES[normalizeRiskLevel(riskLevel)];
}

function normalizePublicHeatmapResponse(raw: unknown, filters: Filters): PublicHeatmapResponse {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawItems = Array.isArray(record.data) ? record.data : [];
  const hasServerSummary = Boolean(record.summary && typeof record.summary === 'object');

  const parsedItems = rawItems.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    const name = typeof item.barangay_name === 'string' ? item.barangay_name.trim() : '';
    if (!name) return [];

    const fallbackCoords = DIGOS_BARANGAY_POINTS[name];
    const latitude = validLatitude(item.latitude) ?? fallbackCoords?.lat ?? null;
    const longitude = validLongitude(item.longitude) ?? fallbackCoords?.lng ?? null;
    if (latitude === null || longitude === null) return [];

    const rawTotalCount =
      typeof item.total_incident_count === 'number' && Number.isFinite(item.total_incident_count)
        ? item.total_incident_count
        : typeof item.total_incidents === 'number' && Number.isFinite(item.total_incidents)
          ? item.total_incidents
          : typeof item.incident_count === 'number' && Number.isFinite(item.incident_count)
            ? item.incident_count
            : null;

    const suppressed =
      typeof item.suppressed === 'boolean'
        ? item.suppressed
        : rawTotalCount !== null && rawTotalCount > 0 && rawTotalCount < 5;

    const effectiveCount = rawTotalCount ?? (suppressed ? null : 0);
    const riskLevel = normalizeRiskLevel(item.risk_level, rawTotalCount, suppressed);

    const countLabel =
      typeof item.count_label === 'string' && item.count_label.trim() !== ''
        ? item.count_label
        : suppressed
          ? 'Fewer than 5 incidents'
          : (effectiveCount ?? 0) <= 0
            ? 'No recorded data'
            : `${effectiveCount} incidents`;

    const rawAnimal =
      typeof item.most_common_animal === 'string'
        ? item.most_common_animal
        : typeof item.top_animal_type === 'string'
          ? item.top_animal_type
          : null;
    const mostCommonAnimal =
      !suppressed && (effectiveCount === null || effectiveCount > 0) && rawAnimal && rawAnimal !== 'N/A'
        ? rawAnimal
        : null;

    const incidentRate =
      typeof item.incident_rate_per_1000 === 'number' && Number.isFinite(item.incident_rate_per_1000)
        ? item.incident_rate_per_1000
        : null;

    const comparison =
      typeof item.comparison_to_city_average === 'number' && Number.isFinite(item.comparison_to_city_average)
        ? item.comparison_to_city_average
        : null;

    const pepRate =
      typeof item.pep_compliance_rate === 'number' && Number.isFinite(item.pep_compliance_rate)
        ? item.pep_compliance_rate
        : null;

    return [{
      barangay_name: name,
      latitude,
      longitude,
      incident_count: suppressed ? null : (effectiveCount ?? 0),
      count_label: countLabel,
      suppressed,
      risk_level: riskLevel,
      incident_rate_per_1000: suppressed ? null : incidentRate,
      most_common_animal: mostCommonAnimal,
      comparison_to_city_average: suppressed ? null : comparison,
      _rawCount: rawTotalCount ?? (suppressed ? 1 : 0),
      _pepRate: pepRate,
    }];
  });

  // If the backend returned a legacy payload (only barangays with incidents, no summary object),
  // expand to all 26 Digos barangays and compute the privacy-safe summary client-side.
  const recordedItems = parsedItems.filter((item) => item._rawCount > 0 || item.suppressed);
  const cityTotal = recordedItems.reduce((sum, item) => sum + item._rawCount, 0);
  const recordedCount = recordedItems.length;
  const cityAverage = recordedCount > 0 ? Math.round((cityTotal / recordedCount) * 10) / 10 : 0;

  let fullList: PublicBarangayAggregate[];
  if (!hasServerSummary) {
    const byName = new Map(parsedItems.map((item) => [item.barangay_name, item]));
    const allNames = Object.keys(DIGOS_BARANGAY_POINTS).sort((a, b) => a.localeCompare(b));
    fullList = allNames.map((name) => {
      const existing = byName.get(name);
      if (existing) {
        const { _rawCount, _pepRate, ...clean } = existing;
        void _pepRate;
        return {
          ...clean,
          comparison_to_city_average:
            clean.suppressed || _rawCount <= 0
              ? null
              : clean.comparison_to_city_average ?? Math.round((_rawCount - cityAverage) * 10) / 10,
        };
      }
      const coords = DIGOS_BARANGAY_POINTS[name];
      return {
        barangay_name: name,
        latitude: coords.lat,
        longitude: coords.lng,
        incident_count: 0,
        count_label: 'No recorded data',
        suppressed: false,
        risk_level: 'NO DATA',
        incident_rate_per_1000: null,
        most_common_animal: null,
        comparison_to_city_average: null,
      };
    });

    const requestedRisk = filters.riskLevel.trim().toUpperCase();
    if (requestedRisk && requestedRisk !== 'ALL') {
      fullList = fullList.filter((b) => b.risk_level === requestedRisk);
    }
  } else {
    fullList = parsedItems.map(({ _rawCount, _pepRate, ...clean }) => {
      void _rawCount;
      void _pepRate;
      return clean;
    });
  }

  const highestItem = [...recordedItems].sort((a, b) => b._rawCount - a._rawCount)[0] ?? null;
  const pepItems = recordedItems.filter((item) => item._pepRate !== null && item._rawCount > 0);
  const weightedPep =
    pepItems.length > 0 && cityTotal > 0
      ? Math.round(
          (pepItems.reduce((acc, item) => acc + (item._pepRate ?? 0) * item._rawCount, 0) / cityTotal) * 10,
        ) / 10
      : null;

  const rawSummary = (record.summary && typeof record.summary === 'object' ? record.summary : null) as Record<string, unknown> | null;
  const summary = {
    total_incidents:
      rawSummary && typeof rawSummary.total_incidents === 'number'
        ? rawSummary.total_incidents
        : cityTotal >= 5
          ? cityTotal
          : null,
    total_incidents_label:
      rawSummary && typeof rawSummary.total_incidents_label === 'string'
        ? rawSummary.total_incidents_label
        : cityTotal > 0 && cityTotal < 5
          ? 'Fewer than 5 incidents'
          : cityTotal === 0
            ? 'No recorded data'
            : `${cityTotal} incidents`,
    barangays_with_recorded_incidents:
      rawSummary && typeof rawSummary.barangays_with_recorded_incidents === 'number'
        ? rawSummary.barangays_with_recorded_incidents
        : recordedCount,
    highest_reported_barangay:
      rawSummary && typeof rawSummary.highest_reported_barangay === 'string'
        ? rawSummary.highest_reported_barangay
        : highestItem?.barangay_name ?? null,
    pep_completion_rate:
      rawSummary && typeof rawSummary.pep_completion_rate === 'number'
        ? rawSummary.pep_completion_rate
        : weightedPep,
    city_average_incidents:
      rawSummary && typeof rawSummary.city_average_incidents === 'number'
        ? rawSummary.city_average_incidents
        : recordedCount > 0
          ? cityAverage
          : null,
  };

  const fromMonth = Math.max(1, Math.min(12, Number(filters.monthStart) || 1));
  const toMonth = Math.max(fromMonth, Math.min(12, Number(filters.monthEnd) || initialMaxMonth));
  const reportingYear = Number(filters.year) || currentYear;
  const rawPeriod = (record.reporting_period && typeof record.reporting_period === 'object' ? record.reporting_period : null) as Record<string, unknown> | null;

  const reportingPeriod = {
    year: rawPeriod && typeof rawPeriod.year === 'number' ? rawPeriod.year : reportingYear,
    month_start: rawPeriod && typeof rawPeriod.month_start === 'number' ? rawPeriod.month_start : fromMonth,
    month_end: rawPeriod && typeof rawPeriod.month_end === 'number' ? rawPeriod.month_end : toMonth,
    label:
      rawPeriod && typeof rawPeriod.label === 'string' && rawPeriod.label.trim() !== ''
        ? rawPeriod.label
        : `${getMonthName(fromMonth)}–${getMonthName(toMonth)} ${reportingYear}`,
  };

  return {
    success: Boolean(record.success),
    reporting_period: reportingPeriod,
    classification_basis:
      typeof record.classification_basis === 'string'
        ? record.classification_basis
        : 'Case count: Low 5–10, Moderate 11–20, High 21+. Counts below 5 are suppressed.',
    summary,
    data: fullList,
  };
}

function LoadingCard() {
  return <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-4 h-9 w-9 rounded-xl bg-slate-200" /><div className="mb-2 h-6 w-24 rounded bg-slate-200" /><div className="h-3 w-36 max-w-full rounded bg-slate-100" /></div>;
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</span>
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
  const user = useMemo(() => (hasAuthSession() ? getStoredUser() : null), []);
  const authDestination = user ? getDefaultPathForRole(user.role) : '/login';
  const authLabel = user ? 'Dashboard' : 'Log In';
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const { map, basemapError } = useMapLibre(mapContainerRef, {
    center: [DIGOS_CENTER[1], DIGOS_CENTER[0]],
    zoom: 11,
    minZoom: 10,
    maxZoom: 16,
    maxBounds: DIGOS_MAX_BOUNDS,
  });
  const [boundaries, setBoundaries] = useState<BarangayBoundaries | null>(null);
  const [boundaryError, setBoundaryError] = useState('');
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
      const rawResult = await publicAPI.getHeatmap({
        year: filters.year,
        month_start: filters.monthStart,
        month_end: filters.monthEnd,
        risk_level: filters.riskLevel,
        animal_type: filters.animalType,
      });

      const result = normalizePublicHeatmapResponse(rawResult, filters);
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
    let cancelled = false;
    loadDigosBoundaries()
      .then((collection) => { if (!cancelled) setBoundaries(collection); })
      .catch(() => { if (!cancelled) setBoundaryError('Barangay boundaries could not be loaded.'); });
    return () => { cancelled = true; };
  }, []);

  const selectRef = useRef(setSelectedBarangay);
  useEffect(() => {
    if (!map) return;
    addPublicLayers(map);
    return registerPublicInteractions(map, () => selectRef.current);
  }, [map]);

  const visibleData = useMemo(() => response?.data ?? [], [response]);
  const mapData = useMemo(() => visibleData.flatMap((item) => {
    const latitude = validLatitude(item.latitude);
    const longitude = validLongitude(item.longitude);
    return latitude === null || longitude === null ? [] : [{ ...item, latitude, longitude }];
  }), [visibleData]);

  useEffect(() => {
    if (!map) return;
    updatePublicData(map, boundaries, mapData, selectedBarangay);
  }, [map, boundaries, mapData, selectedBarangay]);

  const selected = useMemo(() => visibleData.find((item) => item.barangay_name === selectedBarangay) ?? null, [visibleData, selectedBarangay]);
  const sortedBarangays = useMemo(() => {
    return [...visibleData].sort((a, b) => {
      const countA = a.incident_count ?? (a.suppressed ? 1 : 0);
      const countB = b.incident_count ?? (b.suppressed ? 1 : 0);
      if (countB !== countA) return countB - countA;
      return a.barangay_name.localeCompare(b.barangay_name);
    });
  }, [visibleData]);

  const handleSelectBarangay = (name: string) => {
    if (!name) {
      setSelectedBarangay(null);
      return;
    }
    setSelectedBarangay(name);
    const item = mapData.find((d) => d.barangay_name === name);
    if (map && item) {
      map.flyTo({
        center: [item.longitude, item.latitude],
        zoom: Math.max(map.getZoom(), 13),
        essential: true,
      });
    }
  };

  const handleResetMapView = () => {
    if (!map) return;
    map.flyTo({
      center: [DIGOS_CENTER[1], DIGOS_CENTER[0]],
      zoom: 11,
      essential: true,
    });
  };

  const selectedYearMaxMonth = Number(filters.year) === currentYear ? initialMaxMonth : 12;
  const startMonthOptions = months.slice(0, Math.max(1, selectedYearMaxMonth - 2));
  const endMonthOptions = months.slice(Number(filters.monthStart) + 1, selectedYearMaxMonth);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === 'year') {
        const maxMonth = Number(value) === currentYear ? initialMaxMonth : 12;
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
            <Link
              to={authDestination}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-teal-700/30 bg-white px-3 text-xs font-extrabold text-teal-800 shadow-xs hover:border-teal-700 hover:bg-teal-50 transition-colors sm:px-4"
              title={user ? 'Go to Staff Dashboard' : 'Staff Log In'}
            >
              <LogIn className="h-4 w-4 text-teal-700" />
              <span>{authLabel}</span>
            </Link>
            
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
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><h2 id="map-summary-title" className="text-lg font-extrabold text-slate-900">Aggregated public summary</h2><p className="text-sm font-bold text-teal-700">{response?.reporting_period?.label || `${getMonthName(Number(filters.monthStart))}–${getMonthName(Number(filters.monthEnd))} ${filters.year}`}</p></div>
            {isLoading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><LoadingCard /><LoadingCard /><LoadingCard /><LoadingCard /></div> : error ? <div className="rounded-2xl border border-rose-200 bg-white p-5"><div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div><p className="font-extrabold text-slate-900">Unable to load aggregated map data</p><p className="mt-1 text-sm text-slate-600">{error}</p></div><button type="button" onClick={() => setRetryKey((key) => key + 1)} className="inline-flex h-10 items-center gap-2 rounded-full bg-teal-700 px-5 text-sm font-extrabold text-white hover:bg-teal-800"><RefreshCw className="h-4 w-4" /> Retry</button></div></div> : !hasRecordedData ? <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center"><Activity className="mx-auto h-7 w-7 text-teal-600" /><p className="mt-2 font-extrabold">No data available</p><p className="mt-1 text-sm text-slate-500">No aggregated records are available for the selected broad reporting period.</p></div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
              ['Total Recorded Incidents', summary?.total_incidents_label || 'No data', Activity],
              ['Barangays with Recorded Incidents', String(summary?.barangays_with_recorded_incidents ?? 0), MapPin],
              ['Highest Reported Barangay', summary?.highest_reported_barangay || 'Not available', TrendingUp],
              ['PEP Completion Rate', summary?.pep_completion_rate == null ? 'Not available' : `${summary.pep_completion_rate}%`, CheckCircle2],
            ].map(([label, value, Icon]) => <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-teal-950/5"><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Icon className="h-4 w-4" /></div><p className="text-xl font-extrabold text-teal-900">{String(value)}</p><h3 className="mt-1 text-xs font-bold leading-relaxed text-slate-500">{String(label)}</h3></article>)}</div>}
          </section>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)]">
            <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-teal-950/5" aria-labelledby="map-title">
              <div className="flex shrink-0 flex-col gap-2 border-b border-slate-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 id="map-title" className="font-extrabold text-slate-900">Digos City Barangay Map</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Barangay areas are shaded by aggregated totals, never individual incidents.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetMapView}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    title="Center map back to Digos City"
                  >
                    <Maximize2 className="h-3.5 w-3.5 text-slate-500" />
                    Reset view
                  </button>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Read-only public map</span>
                </div>
              </div>
              <div className="relative flex-1 min-h-[500px] sm:min-h-[580px] lg:min-h-[640px]">
                {/* Inline positioning ensures position: absolute and width/height 100% prevail
                    over unlayered .maplibregl-map { position: relative } in Tailwind v4 */}
                <div
                  ref={mapContainerRef}
                  className="h-full w-full"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                  aria-label="Interactive aggregated barangay incident map"
                />
                {(basemapError || boundaryError) && <div className="pointer-events-none absolute left-1/2 top-3 z-[5] max-w-xs -translate-x-1/2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-center text-xs font-semibold text-amber-800 shadow">{basemapError || boundaryError}</div>}
                {isLoading && <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70 backdrop-blur-[1px]"><div className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-teal-800 shadow-lg">Updating aggregated map…</div></div>}
                {error && <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/75 p-5"><div className="max-w-sm rounded-2xl border border-rose-200 bg-white p-5 text-center shadow-lg"><p className="font-extrabold text-slate-900">Map data unavailable</p><p className="mt-1 text-sm text-slate-500">Use Retry above to request the aggregated data again.</p></div></div>}
                <div className="absolute bottom-7 left-3 z-[450] max-w-[230px] rounded-2xl border border-white/70 bg-white/95 p-3 shadow-lg backdrop-blur-sm sm:left-4">
                  <p className="text-xs font-extrabold text-slate-800">Case-count classification</p><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">{(['LOW','MODERATE','HIGH','SUPPRESSED','NO DATA'] as RiskLevel[]).map((risk) => <div key={risk} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: RISK_STYLES[risk].color }} /><span className="text-xs font-bold text-slate-600">{RISK_STYLES[risk].label}</span></div>)}</div><p className="mt-2 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-500">Low 5–10 · Moderate 11–20 · High 21+ · Counts below 5 suppressed</p>
                </div>
              </div>
            </section>

            <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-teal-950/5" aria-labelledby="selected-summary-title">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <h2 id="selected-summary-title" className="text-base font-extrabold text-slate-900">
                    {selected ? 'Barangay Profile' : 'Select Barangay'}
                  </h2>
                  {selected && (
                    <button
                      type="button"
                      onClick={() => setSelectedBarangay(null)}
                      className="text-xs font-bold text-teal-700 hover:text-teal-900 hover:underline"
                    >
                      View all list
                    </button>
                  )}
                </div>

                <div className="mt-3">
                  <label className="block">
                    <span className="sr-only">Quick search barangay</span>
                    <div className="relative">
                      <select
                        value={selectedBarangay || ''}
                        onChange={(e) => handleSelectBarangay(e.target.value)}
                        className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-8 text-xs font-bold text-slate-700 outline-none transition focus:border-teal-600 focus:bg-white"
                      >
                        <option value="">-- Jump to a barangay ({visibleData.length}) --</option>
                        {visibleData.map((item) => (
                          <option key={item.barangay_name} value={item.barangay_name}>
                            {item.barangay_name} ({getRiskStyle(item.risk_level).label})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    </div>
                  </label>
                </div>

                {selected ? (
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xl font-extrabold text-teal-900">{selected.barangay_name}</p>
                          <p className="mt-1 text-sm font-bold text-slate-500">{selected.count_label}</p>
                        </div>
                        <span
                          className="rounded-full px-3 py-1 text-xs font-extrabold text-white"
                          style={{ backgroundColor: getRiskStyle(selected.risk_level).color }}
                        >
                          {getRiskStyle(selected.risk_level).label}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">Incident rate</p>
                        <p className="mt-1 text-sm font-extrabold text-slate-900">
                          {selected.incident_rate_per_1000 == null ? 'Not available' : `${selected.incident_rate_per_1000} per 1,000`}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">Top animal</p>
                        <p className="mt-1 text-sm font-extrabold text-slate-900">
                          {selected.most_common_animal || 'Not available'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5 border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-500">Risk level</span>
                        <strong>{getRiskStyle(selected.risk_level).label}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-500">City comparison</span>
                        <strong>
                          {selected.comparison_to_city_average == null
                            ? 'Not available'
                            : `${Math.abs(selected.comparison_to_city_average)} ${selected.comparison_to_city_average >= 0 ? 'above' : 'below'} average`}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-500">Reporting period</span>
                        <strong className="text-right">{response?.reporting_period?.label}</strong>
                      </div>
                    </div>

                    {selected.suppressed && (
                      <div className="rounded-2xl bg-slate-100 p-3 text-xs font-semibold leading-relaxed text-slate-600">
                        This barangay’s exact value and derived statistics are hidden because the filtered count is below five.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-slate-500">Top barangays in this period:</p>
                    <div className="mt-2.5 max-h-56 space-y-1.5 overflow-y-auto pr-1">
                      {sortedBarangays.slice(0, 8).map((b) => (
                        <button
                          key={b.barangay_name}
                          type="button"
                          onClick={() => handleSelectBarangay(b.barangay_name)}
                          className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-left text-xs transition hover:border-teal-300 hover:bg-teal-50/50"
                        >
                          <span className="font-bold text-slate-800">{b.barangay_name}</span>
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getRiskStyle(b.risk_level).color }} />
                            <span className="font-semibold text-slate-500">{b.count_label}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-center gap-2 text-emerald-900">
                  <PawPrint className="h-5 w-5" />
                  <h2 className="font-extrabold">Prevention Reminder</h2>
                </div>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-emerald-900/80">
                  <li>• Avoid unfamiliar or aggressive animals.</li>
                  <li>• Keep pets vaccinated against rabies.</li>
                  <li>• Supervise children around pets.</li>
                  <li>• Seek medical assessment after a bite or scratch.</li>
                </ul>
                <div className="mt-4 border-t border-emerald-200/80 pt-3">
                  <Link
                    to="/public/clinics"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:underline"
                  >
                    View Vaccination Clinics & Contacts →
                  </Link>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-start gap-3">
                  <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
                  <div>
                    <h2 className="font-extrabold text-slate-900">How classification works</h2>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      {response?.classification_basis ||
                        'Classification is based on broad case-count thresholds. Exact values below five are suppressed.'}
                    </p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
