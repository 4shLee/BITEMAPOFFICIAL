import { useEffect, useRef, useState } from 'react';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { gisAPI } from '../../lib/services/api';
import { DIGOS_CENTER } from '../../data/digos-geography';
import { DIGOS_MAX_BOUNDS } from '../../lib/maplibre/basemap';
import { loadDigosBoundaries, validLatitude, validLongitude, type BarangayBoundaries } from '../../lib/maplibre/geo';
import { useMapLibre } from '../../lib/maplibre/useMapLibre';
import {
  CHOROPLETH_CLASSES,
  GIS_LAYER_DEFS,
  RISK_COLORS,
  addGisLayers,
  registerGisInteractions,
  setGisLayerVisibility,
  updateGisData,
  type BarangayData,
  type GisLayerKey,
  type HeatPoint,
  type IncidentPoint,
} from '../components/Gis/gisLayers';

const validBarangayData = (value: unknown): BarangayData[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];

    const record = item as Record<string, unknown>;
    const latitude = validLatitude(record.latitude);
    const longitude = validLongitude(record.longitude);
    const barangayName = typeof record.barangay_name === 'string' ? record.barangay_name.trim() : '';

    if (latitude === null || longitude === null || !barangayName) return [];

    return [{
      ...record,
      barangay_name: barangayName,
      latitude,
      longitude,
      incident_id: typeof record.incident_id === 'number' ? record.incident_id : null,
      incident_ids: Array.isArray(record.incident_ids)
        ? record.incident_ids.filter((id): id is number => typeof id === 'number')
        : [],
      total_incident_count: Number(record.total_incident_count) || 0,
      total_incidents: Number(record.total_incidents) || 0,
      top_animal_type: typeof record.top_animal_type === 'string' ? record.top_animal_type : 'N/A',
      pep_compliance_rate: Number(record.pep_compliance_rate) || 0,
      risk_level: ['LOW RISK', 'MODERATE RISK', 'HIGH RISK'].includes(String(record.risk_level))
        ? record.risk_level as BarangayData['risk_level']
        : 'LOW RISK',
    } as BarangayData];
  });
};

const validHeatPoints = (value: unknown): HeatPoint[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];

    const record = item as Record<string, unknown>;
    const latitude = validLatitude(record.latitude);
    const longitude = validLongitude(record.longitude);
    const barangayName = typeof record.barangay_name === 'string' ? record.barangay_name.trim() : '';

    if (latitude === null || longitude === null || !barangayName) return [];

    return [{
      barangay_name: barangayName,
      latitude,
      longitude,
      intensity: Math.min(1, Math.max(0, Number(record.intensity) || 0)),
      total_incident_count: Number(record.total_incident_count) || 0,
    }];
  });
};

const validIncidentPoints = (value: unknown): IncidentPoint[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const latitude = validLatitude(record.latitude);
    const longitude = validLongitude(record.longitude);
    const incidentId = Number(record.incident_id);
    const barangayName = typeof record.barangay_name === 'string' ? record.barangay_name.trim() : '';
    return latitude === null || longitude === null || !Number.isFinite(incidentId) || !barangayName
      ? []
      : [{ incident_id: incidentId, barangay_name: barangayName, latitude, longitude }];
  });
};

const defaultLayerState = GIS_LAYER_DEFS.reduce(
  (state, def) => ({ ...state, [def.key]: def.defaultOn }),
  {} as Record<GisLayerKey, boolean>,
);

export function GISMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const { map, basemapError } = useMapLibre(mapContainerRef, {
    center: [DIGOS_CENTER[1], DIGOS_CENTER[0]],
    zoom: 11,
    minZoom: 10,
    maxZoom: 18,
    maxBounds: DIGOS_MAX_BOUNDS,
  });

  const [selectedBarangay, setSelectedBarangay] = useState<string | null>(null);
  const [barangayData, setBarangayData] = useState<BarangayData[]>([]);
  const [heatPoints, setHeatPoints] = useState<HeatPoint[]>([]);
  const [incidentPoints, setIncidentPoints] = useState<IncidentPoint[]>([]);
  const [boundaries, setBoundaries] = useState<BarangayBoundaries | null>(null);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const [layerState, setLayerState] = useState<Record<GisLayerKey, boolean>>(defaultLayerState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [animalType, setAnimalType] = useState('All');
  const [category, setCategory] = useState('All');
  const [retryRequest, setRetryRequest] = useState(0);
  const mapLoading = !map;

  const selectHandlerRef = useRef(setSelectedBarangay);
  const knownBarangaysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    knownBarangaysRef.current = new Set(barangayData.map((item) => item.barangay_name));
  }, [barangayData]);

  // Add layers and interactions exactly once per map instance.
  useEffect(() => {
    if (!map) return;
    addGisLayers(map);
    return registerGisInteractions(map, () => ({
      onBarangaySelect: (name) => {
        if (knownBarangaysRef.current.has(name)) selectHandlerRef.current(name);
      },
    }));
  }, [map]);

  // Barangay boundary polygons (static, filter-independent).
  useEffect(() => {
    let cancelled = false;
    loadDigosBoundaries()
      .then((collection) => {
        if (!cancelled) setBoundaries(collection);
      })
      .catch(() => {
        if (!cancelled) setBoundaryError('Barangay boundaries could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered API data (single source of truth: the backend applies all filters).
  useEffect(() => {
    let cancelled = false;

    const loadHeatmapData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await gisAPI.getHeatmap({
          date_from: dateFrom,
          date_to: dateTo,
          animal_type: animalType,
          who_category: category
        });

        if (cancelled) return;

        const nextData = validBarangayData(response.data);
        setBarangayData(nextData);
        setHeatPoints(validHeatPoints(response.heat_points));
        setIncidentPoints(validIncidentPoints(response.incident_points));
        setSelectedBarangay((current) => {
          if (current && nextData.some((item) => item.barangay_name === current)) {
            return current;
          }

          return nextData[0]?.barangay_name ?? null;
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error && loadError.message
            ? loadError.message
            : 'Unable to load live GIS incident data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadHeatmapData();

    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, animalType, category, retryRequest]);

  // Push data into the map sources (no re-initialisation).
  useEffect(() => {
    if (!map) return;
    updateGisData(map, boundaries, barangayData, heatPoints, incidentPoints);
  }, [map, boundaries, barangayData, heatPoints, incidentPoints]);

  // Layer toggles.
  useEffect(() => {
    if (!map) return;
    setGisLayerVisibility(map, layerState);
  }, [map, layerState]);

  const getRiskVariant = (riskLevel: string) => {
    switch (riskLevel) {
      case 'HIGH RISK': return 'danger';
      case 'MODERATE RISK': return 'warning';
      case 'LOW RISK': return 'success';
      default: return 'neutral';
    }
  };

  const animalOptions = [
    { value: 'All', label: 'All Animals' },
    { value: 'Dog', label: 'Dog' },
    { value: 'Cat', label: 'Cat' },
    { value: 'Other', label: 'Other' }
  ];

  const categoryOptions = [
    { value: 'All', label: 'All Categories' },
    { value: 'I', label: 'Category I' },
    { value: 'II', label: 'Category II' },
    { value: 'III', label: 'Category III' }
  ];

  const selectedData = barangayData.find((item) => item.barangay_name === selectedBarangay) ?? null;
  const emptyMessage = 'No incident data found for the selected filters.';
  const bannerMessage = basemapError || boundaryError;

  return (
    <div className="min-h-screen flex-1 bg-[#f3f7f5]">
      <Header title="GIS Heatmap & Analysis" breadcrumbs={['GIS Map', 'Barangay Analysis']} />

      <div className="grid grid-cols-1 gap-5 px-5 py-5 lg:px-7 lg:py-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col overflow-hidden xl:sticky xl:top-24 xl:self-start rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
          <div className="shrink-0 border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-extrabold text-slate-950">Barangay Incident Heatmap</h2>
            <p className="mt-0.5 text-sm font-medium text-slate-500">Click a barangay or marker to inspect incident density, risk, and PEP compliance.</p>
          </div>
          <div className="relative h-[520px] md:h-[620px] xl:h-[min(720px,calc(100vh-185px))] xl:min-h-[650px]">
            {/* Inline positioning: maplibre-gl.css (unlayered) sets .maplibregl-map { position: relative },
                which would otherwise beat Tailwind's layered absolute/inset utilities. */}
            <div ref={mapContainerRef} className="h-full w-full" style={{ position: 'absolute', inset: 0 }} />

            {(mapLoading || loading) && (
              <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-white/80">
                <p className="text-sm text-slate-500">Loading live GIS data...</p>
              </div>
            )}

            {bannerMessage && !error && (
              <div className="pointer-events-none absolute left-1/2 top-4 z-[5] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-amber-200 bg-white px-4 py-2 text-center shadow-sm">
                <p className="text-xs font-semibold text-amber-800">{bannerMessage}</p>
              </div>
            )}

            {!loading && !mapLoading && !error && barangayData.length === 0 && (
              <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm text-slate-500">{emptyMessage}</p>
                </div>
              </div>
            )}

            {error && (
              <div className={barangayData.length > 0
                ? 'absolute left-1/2 top-4 z-[5] w-[calc(100%-2rem)] max-w-md -translate-x-1/2'
                : 'absolute inset-0 z-[5] flex items-center justify-center bg-white/80'}>
                <div className="rounded-2xl border border-rose-100 bg-white px-4 py-3 text-center shadow-sm">
                  <p className="text-sm font-medium text-destructive">{error}</p>
                  <button
                    type="button"
                    onClick={() => setRetryRequest((request) => request + 1)}
                    className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-3xl border border-emerald-900/5 bg-white p-5 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            {selectedData ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-extrabold text-slate-950">{selectedData.barangay_name}</h2>
                    <p className="mt-0.5 text-sm font-medium text-slate-500">Barangay Analysis</p>
                  </div>
                  <Badge variant={getRiskVariant(selectedData.risk_level)}>{selectedData.risk_level}</Badge>
                </div>

                <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold leading-none text-slate-950">{selectedData.total_incident_count}</span>
                    <span className="text-sm font-medium text-slate-500">incidents</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Total bite cases reported</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Top Animal</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{selectedData.top_animal_type}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Risk Level</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{selectedData.risk_level}</p>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-500">PEP Compliance Rate</p>
                    <span className="text-sm font-bold text-slate-950">{selectedData.pep_compliance_rate}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-primary"
                      style={{ width: selectedData.pep_compliance_rate + '%' }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center">
                <h2 className="text-base font-extrabold text-slate-950">Barangay Analysis</h2>
                <p className="mx-auto mt-2 max-w-56 text-sm text-slate-500">Select a barangay on the map to view analysis.</p>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-emerald-900/5 bg-white p-5 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <h3 className="text-base font-extrabold text-slate-950">Filters</h3>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Input
                  label="Date From"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
                <Input
                  label="Date To"
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </div>
              <Select
                label="Animal Type"
                options={animalOptions}
                value={animalType}
                onChange={(event) => setAnimalType(event.target.value)}
              />
              <Select
                label="WHO Category"
                options={categoryOptions}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-900/5 bg-white p-5 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <h3 className="text-base font-extrabold text-slate-950">Map Layers</h3>
            <div className="mt-3 space-y-2">
              {GIS_LAYER_DEFS.map((def) => (
                <label key={def.key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={layerState[def.key]}
                    onChange={(event) => setLayerState((current) => ({ ...current, [def.key]: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-teal-700"
                  />
                  <span>
                    <span className="block text-sm font-bold text-slate-700">{def.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{def.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-900/5 bg-white p-5 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <h3 className="text-base font-extrabold text-slate-950">Legend</h3>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Choropleth (incidents per barangay)</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {CHOROPLETH_CLASSES.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="h-4 w-4 shrink-0 rounded" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm font-medium text-slate-500">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Barangay marker risk</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
              {(Object.keys(RISK_COLORS) as Array<keyof typeof RISK_COLORS>).map((risk) => (
                <div key={risk} className="flex items-center gap-2">
                  <div className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: RISK_COLORS[risk] }}></div>
                  <span className="text-sm font-medium text-slate-500">{risk}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
