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
    <div className="flex-1">
      <Header title="GIS Heatmap & Analysis" breadcrumbs={['GIS Map', 'Barangay Analysis']} />

      <div className="p-8 flex gap-6">
        <div className="w-80 space-y-4 flex-shrink-0">
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-foreground mb-4">Filters</h3>
            <div className="space-y-3">
              <div>
                <Input
                  label="Date From"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </div>
              <div>
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

          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-foreground mb-3">Legend</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[#16A34A]"></div>
                <span className="text-xs text-muted-foreground">0-10 incidents</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[#F2C94C]"></div>
                <span className="text-xs text-muted-foreground">11-20 incidents</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[#DC2626]"></div>
                <span className="text-xs text-muted-foreground">21+ incidents</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-card border border-border rounded-lg overflow-hidden">
          <div className="h-[600px] relative">
            <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

            {(mapLoading || loading) && (
              <div className="absolute inset-0 bg-card/80 flex items-center justify-center z-[400]">
                <p className="text-sm text-muted-foreground">Loading live GIS data...</p>
              </div>
            )}

            {!loading && !mapLoading && !error && barangayData.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center z-[400] pointer-events-none">
                <div className="bg-card border border-border rounded-lg px-4 py-3 shadow-sm">
                  <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 bg-card/80 flex items-center justify-center z-[400]">
                <div className="bg-card border border-border rounded-lg px-4 py-3 shadow-sm">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-80 bg-card border border-border rounded-lg p-6 flex-shrink-0 space-y-6">
          {selectedData ? (
            <>
              <div>
                <h2 className="text-lg font-medium text-foreground mb-1">{selectedData.barangay_name}</h2>
                <p className="text-sm text-muted-foreground">Barangay Analysis</p>
              </div>

              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-semibold text-foreground">{selectedData.total_incident_count}</span>
                  <span className="text-sm text-muted-foreground">incidents</span>
                </div>
                <p className="text-xs text-muted-foreground">Total bite cases reported</p>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Risk Level</p>
                  <Badge variant={getRiskVariant(selectedData.risk_level)}>{selectedData.risk_level}</Badge>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Top Animal Type</p>
                  <Badge variant="info">{selectedData.top_animal_type}</Badge>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">PEP Compliance Rate</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: selectedData.pep_compliance_rate + '%' }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-foreground">{selectedData.pep_compliance_rate}%</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div>
              <h2 className="text-lg font-medium text-foreground mb-1">Barangay Analysis</h2>
              <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
