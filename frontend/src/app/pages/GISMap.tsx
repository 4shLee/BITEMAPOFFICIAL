import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Badge } from '../components/UI/Badge';
import { publicAPI } from '../../lib/services/api';

declare global {
  interface Window {
    L?: any;
  }
}

interface BarangayData {
  incident_id: number | null;
  incident_ids: number[];
  barangay_name: string;
  latitude: number;
  longitude: number;
  total_incident_count: number;
  total_incidents: number;
  top_animal_type: string;
  pep_compliance_rate: number;
  risk_level: 'LOW RISK' | 'MODERATE RISK' | 'HIGH RISK';
}

interface HeatPoint {
  barangay_name: string;
  latitude: number;
  longitude: number;
  intensity: number;
  total_incident_count: number;
}

const DIGOS_CENTER: [number, number] = [6.7497, 125.3572];
const DIGOS_BOUNDS: [[number, number], [number, number]] = [[6.63, 125.25], [6.88, 125.48]];

const RISK_COLORS = {
  'LOW RISK': '#16A34A',
  'MODERATE RISK': '#F2C94C',
  'HIGH RISK': '#DC2626'
};

const escapeHtml = (value: string | number) => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export function GISMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerLayerRef = useRef<any>(null);
  const heatLayerRef = useRef<any>(null);

  const [selectedBarangay, setSelectedBarangay] = useState<string | null>(null);
  const [barangayData, setBarangayData] = useState<BarangayData[]>([]);
  const [heatPoints, setHeatPoints] = useState<HeatPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [animalType, setAnimalType] = useState('All');
  const [category, setCategory] = useState('All');

  useEffect(() => {
    let cancelled = false;

    const loadLeafletHeat = async () => {
      try {
        window.L = L;
        await import('leaflet.heat');

        if (!cancelled) {
          setMapLoading(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          setMapLoading(false);
          setError('Unable to load the GIS heatmap plugin.');
        }
      }
    };

    loadLeafletHeat();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapLoading || !mapContainerRef.current || mapInstanceRef.current) return;

    const maxBounds = L.latLngBounds(DIGOS_BOUNDS);
    const map = L.map(mapContainerRef.current, {
      center: DIGOS_CENTER,
      zoom: 13,
      minZoom: 12,
      maxZoom: 18,
      maxBounds,
      maxBoundsViscosity: 1.0
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    window.setTimeout(() => map.invalidateSize(), 0);
  }, [mapLoading]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const container = mapContainerRef.current;

    if (!map || !container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, [mapLoading]);

  useEffect(() => {
    const loadHeatmapData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await publicAPI.getHeatmap({
          date_from: dateFrom,
          date_to: dateTo,
          animal_type: animalType,
          who_category: category
        });

        const nextData = (response.data || []) as BarangayData[];
        setBarangayData(nextData);
        setHeatPoints((response.heat_points || []) as HeatPoint[]);
        setSelectedBarangay((current) => {
          if (current && nextData.some((item) => item.barangay_name === current)) {
            return current;
          }

          return nextData[0]?.barangay_name ?? null;
        });
      } catch (loadError) {
        setBarangayData([]);
        setHeatPoints([]);
        setSelectedBarangay(null);
        setError('Unable to load live GIS incident data.');
      } finally {
        setLoading(false);
      }
    };

    loadHeatmapData();
  }, [dateFrom, dateTo, animalType, category]);

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map || !markerLayerRef.current) return;

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    markerLayerRef.current.clearLayers();

    if (heatPoints.length > 0 && typeof (L as any).heatLayer === 'function') {
      const points = heatPoints.map((point) => [point.latitude, point.longitude, point.intensity]);
      heatLayerRef.current = (L as any).heatLayer(points, {
        radius: 38,
        blur: 26,
        maxZoom: 17,
        minOpacity: 0.35,
        gradient: {
          0.2: '#A7F3D0',
          0.45: '#22C55E',
          0.65: '#F2C94C',
          0.82: '#F97316',
          1.0: '#DC2626'
        }
      }).addTo(map);
    }

    barangayData.forEach((item) => {
      const color = RISK_COLORS[item.risk_level] || '#16A34A';
      const radius = Math.min(30, Math.max(8, 8 + Math.sqrt(item.total_incident_count) * 3));
      const popup =
        '<div style="min-width:180px">' +
        '<strong>' + escapeHtml(item.barangay_name) + '</strong><br />' +
        'Total Incidents: ' + escapeHtml(item.total_incident_count) + '<br />' +
        'Risk Level: ' + escapeHtml(item.risk_level) + '<br />' +
        'Top Animal Type: ' + escapeHtml(item.top_animal_type) + '<br />' +
        'PEP Compliance Rate: ' + escapeHtml(item.pep_compliance_rate) + '%' +
        '</div>';

      const marker = L.circleMarker([item.latitude, item.longitude], {
        radius,
        color: '#FFFFFF',
        weight: 2,
        fillColor: color,
        fillOpacity: 0.85
      })
        .bindPopup(popup)
        .on('click', () => setSelectedBarangay(item.barangay_name));

      markerLayerRef.current.addLayer(marker);
    });

    window.setTimeout(() => map.invalidateSize(), 0);
  }, [barangayData, heatPoints, mapLoading]);

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
  const emptyMessage = 'No incident data available yet.';

  return (
    <div className="min-h-screen flex-1 bg-[#f3f7f5]">
      <Header title="GIS Heatmap & Analysis" breadcrumbs={['GIS Map', 'Barangay Analysis']} />

      <div className="grid grid-cols-1 gap-5 px-5 py-5 lg:px-7 lg:py-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-extrabold text-slate-950">Barangay Incident Heatmap</h2>
            <p className="mt-0.5 text-xs font-medium text-slate-500">Click a barangay marker to inspect incident density, risk, and PEP compliance.</p>
          </div>
          <div className="relative h-[520px] md:h-[620px] xl:h-[min(720px,calc(100vh-185px))] xl:min-h-[650px]">
            <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

            {(mapLoading || loading) && (
              <div className="absolute inset-0 z-[400] flex items-center justify-center bg-white/80">
                <p className="text-sm text-slate-500">Loading live GIS data...</p>
              </div>
            )}

            {!loading && !mapLoading && !error && barangayData.length === 0 && (
              <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center">
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm text-slate-500">{emptyMessage}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 z-[400] flex items-center justify-center bg-white/80">
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm text-destructive">{error}</p>
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
                    <p className="mt-0.5 text-xs font-medium text-slate-500">Barangay Analysis</p>
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
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Top Animal</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{selectedData.top_animal_type}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Risk Level</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{selectedData.risk_level}</p>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500">PEP Compliance Rate</p>
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
            <h3 className="text-sm font-extrabold text-slate-950">Filters</h3>
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
            <h3 className="text-sm font-extrabold text-slate-950">Legend</h3>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 shrink-0 rounded bg-[#16A34A]"></div>
                <span className="text-xs font-medium text-slate-500">0-10 incidents</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 shrink-0 rounded bg-[#F2C94C]"></div>
                <span className="text-xs font-medium text-slate-500">11-20 incidents</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 shrink-0 rounded bg-[#DC2626]"></div>
                <span className="text-xs font-medium text-slate-500">21+ incidents</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
