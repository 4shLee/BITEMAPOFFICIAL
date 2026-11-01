import maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, Point, Polygon, MultiPolygon } from 'geojson';
import { featureCollection, pointFeature, type BarangayBoundaries } from '../../../lib/maplibre/geo';

export type RiskLevel = 'LOW RISK' | 'MODERATE RISK' | 'HIGH RISK';

export interface BarangayData {
  incident_id: number | null;
  incident_ids: number[];
  barangay_name: string;
  latitude: number;
  longitude: number;
  total_incident_count: number;
  total_incidents: number;
  top_animal_type: string;
  pep_compliance_rate: number;
  risk_level: RiskLevel;
}

export interface HeatPoint {
  barangay_name: string;
  latitude: number;
  longitude: number;
  intensity: number;
  total_incident_count: number;
}

export interface IncidentPoint {
  incident_id: number;
  barangay_name: string;
  latitude: number;
  longitude: number;
}

export type GisLayerKey = 'choropleth' | 'boundaries' | 'heatmap' | 'barangayMarkers' | 'clusters' | 'incidents';

export const GIS_LAYER_DEFS: Array<{ key: GisLayerKey; label: string; description: string; layerIds: string[]; defaultOn: boolean }> = [
  { key: 'choropleth', label: 'Barangay choropleth', description: 'Polygons colored by incident count', layerIds: ['gis-choropleth'], defaultOn: true },
  { key: 'boundaries', label: 'Barangay boundaries', description: 'Barangay outlines and names', layerIds: ['gis-boundaries', 'gis-boundary-labels'], defaultOn: true },
  { key: 'heatmap', label: 'Incident heatmap', description: 'Density of reported incidents', layerIds: ['gis-heatmap'], defaultOn: true },
  { key: 'barangayMarkers', label: 'Barangay markers', description: 'Risk-colored barangay summary markers', layerIds: ['gis-barangay-markers'], defaultOn: true },
  { key: 'clusters', label: 'Incident clusters', description: 'Staff-only; grouped exact incident pins', layerIds: ['gis-clusters', 'gis-cluster-count'], defaultOn: false },
  { key: 'incidents', label: 'Incident markers', description: 'Staff-only; individual exact incident pins', layerIds: ['gis-incident-points'], defaultOn: false },
];

export const RISK_COLORS: Record<RiskLevel, string> = {
  'LOW RISK': '#16A34A',
  'MODERATE RISK': '#F2C94C',
  'HIGH RISK': '#DC2626',
};

/** Choropleth classes mirror the existing risk thresholds (0-10 / 11-20 / 21+). */
export const CHOROPLETH_CLASSES = [
  { label: '0 incidents', color: '#E2E8F0' },
  { label: '1-10 incidents', color: '#86EFAC' },
  { label: '11-20 incidents', color: '#F2C94C' },
  { label: '21+ incidents', color: '#DC2626' },
];

const SOURCES = {
  barangays: 'gis-barangays',
  markers: 'gis-barangay-markers-src',
  heat: 'gis-heat',
  incidents: 'gis-incidents',
} as const;

export const INTERACTIVE_LAYERS = ['gis-incident-points', 'gis-clusters', 'gis-barangay-markers', 'gis-choropleth'];

type BarangayProps = { name: string; count: number; risk: RiskLevel | 'NONE'; top_animal: string; pep: number };

const empty = () => ({ type: 'FeatureCollection', features: [] }) as FeatureCollection;

/** Adds all sources and layers once. Safe to call again (no-op when already present). */
export function addGisLayers(map: maplibregl.Map) {
  if (map.getSource(SOURCES.barangays)) return;

  map.addSource(SOURCES.barangays, { type: 'geojson', data: empty() });
  map.addSource(SOURCES.markers, { type: 'geojson', data: empty() });
  map.addSource(SOURCES.heat, { type: 'geojson', data: empty() });
  map.addSource(SOURCES.incidents, { type: 'geojson', data: empty(), cluster: true, clusterRadius: 50, clusterMaxZoom: 15 });

  map.addLayer({
    id: 'gis-choropleth',
    type: 'fill',
    source: SOURCES.barangays,
    paint: {
      'fill-color': ['step', ['get', 'count'], CHOROPLETH_CLASSES[0].color, 1, CHOROPLETH_CLASSES[1].color, 11, CHOROPLETH_CLASSES[2].color, 21, CHOROPLETH_CLASSES[3].color],
      'fill-opacity': 0.5,
    },
  });

  map.addLayer({
    id: 'gis-heatmap',
    type: 'heatmap',
    source: SOURCES.heat,
    paint: {
      'heatmap-weight': ['get', 'intensity'],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 15, 1.6],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 28, 13, 48, 16, 80],
      'heatmap-opacity': 0.75,
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(167,243,208,0)',
        0.2, '#A7F3D0',
        0.45, '#22C55E',
        0.65, '#F2C94C',
        0.82, '#F97316',
        1, '#DC2626',
      ],
    },
  });

  map.addLayer({
    id: 'gis-boundaries',
    type: 'line',
    source: SOURCES.barangays,
    paint: { 'line-color': '#0F766E', 'line-width': 1.5, 'line-opacity': 0.9 },
  });

  map.addLayer({
    id: 'gis-boundary-labels',
    type: 'symbol',
    source: SOURCES.barangays,
    minzoom: 11.5,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 11,
      'text-font': ['Open Sans Semibold'],
    },
    paint: { 'text-color': '#0F172A', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 },
  });

  map.addLayer({
    id: 'gis-barangay-markers',
    type: 'circle',
    source: SOURCES.markers,
    paint: {
      'circle-radius': ['get', 'radius'],
      'circle-color': ['match', ['get', 'risk'], 'HIGH RISK', RISK_COLORS['HIGH RISK'], 'MODERATE RISK', RISK_COLORS['MODERATE RISK'], RISK_COLORS['LOW RISK']],
      'circle-opacity': 0.85,
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 2,
    },
  });

  map.addLayer({
    id: 'gis-clusters',
    type: 'circle',
    source: SOURCES.incidents,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'], '#38BDF8', 10, '#0284C7', 30, '#075985'],
      'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 30, 28],
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 2,
    },
  });

  map.addLayer({
    id: 'gis-cluster-count',
    type: 'symbol',
    source: SOURCES.incidents,
    filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-font': ['Open Sans Semibold'], 'text-allow-overlap': true },
    paint: { 'text-color': '#FFFFFF' },
  });

  map.addLayer({
    id: 'gis-incident-points',
    type: 'circle',
    source: SOURCES.incidents,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': 5,
      'circle-color': '#38BDF8',
      'circle-stroke-color': '#0F172A',
      'circle-stroke-width': 1,
      'circle-opacity': 0.95,
    },
  });
}

const riskOf = (count: number): RiskLevel | 'NONE' => (count <= 0 ? 'NONE' : count > 20 ? 'HIGH RISK' : count > 10 ? 'MODERATE RISK' : 'LOW RISK');

function setSourceData(map: maplibregl.Map, id: string, data: FeatureCollection) {
  (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(data);
}

/** Pushes the (already filtered) API data into the sources. Filtering happens server-side only. */
export function updateGisData(
  map: maplibregl.Map,
  boundaries: BarangayBoundaries | null,
  barangayData: BarangayData[],
  heatPoints: HeatPoint[],
  incidentPoints: IncidentPoint[],
) {
  const byName = new Map(barangayData.map((item) => [item.barangay_name, item]));

  const polygons = boundaries
    ? ({
        type: 'FeatureCollection',
        features: boundaries.features.map((feature) => {
          const item = byName.get(feature.properties.name);
          const count = item?.total_incident_count ?? 0;
          return {
            type: 'Feature',
            geometry: feature.geometry as Polygon | MultiPolygon,
            properties: {
              name: feature.properties.name,
              count,
              risk: item?.risk_level ?? riskOf(count),
              top_animal: item?.top_animal_type ?? 'N/A',
              pep: item?.pep_compliance_rate ?? 0,
            } satisfies BarangayProps,
          } as Feature<Polygon | MultiPolygon, BarangayProps>;
        }),
      } as FeatureCollection)
    : empty();
  setSourceData(map, SOURCES.barangays, polygons);

  setSourceData(map, SOURCES.markers, featureCollection(barangayData.map((item) =>
    pointFeature(item.latitude, item.longitude, {
      name: item.barangay_name,
      count: item.total_incident_count,
      risk: item.risk_level,
      top_animal: item.top_animal_type,
      pep: item.pep_compliance_rate,
      radius: Math.min(30, Math.max(8, 8 + Math.sqrt(item.total_incident_count) * 3)),
    }),
  )));

  setSourceData(map, SOURCES.heat, featureCollection(heatPoints.map((point) =>
    pointFeature(point.latitude, point.longitude, { intensity: point.intensity, name: point.barangay_name }),
  )));

  setSourceData(map, SOURCES.incidents, featureCollection(incidentPoints.map((point) =>
    pointFeature(point.latitude, point.longitude, { incident_id: point.incident_id, barangay_name: point.barangay_name }),
  )));
}

export function setGisLayerVisibility(map: maplibregl.Map, visible: Record<GisLayerKey, boolean>) {
  GIS_LAYER_DEFS.forEach((def) => {
    def.layerIds.forEach((layerId) => {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visible[def.key] ? 'visible' : 'none');
    });
  });
}

const popupContent = (rows: Array<[string, string | number] | string>) => {
  const root = document.createElement('div');
  root.style.minWidth = '180px';
  rows.forEach((row, index) => {
    if (index > 0) root.appendChild(document.createElement('br'));
    if (typeof row === 'string') {
      const strong = document.createElement('strong');
      strong.textContent = row;
      root.appendChild(strong);
    } else {
      root.appendChild(document.createTextNode(`${row[0]}: ${row[1]}`));
    }
  });
  return root;
};

export type MapClickHandlers = {
  onBarangaySelect: (name: string) => void;
};

/**
 * Registers one click + one mousemove handler on the map. A single click is resolved against the
 * topmost interactive layer so overlapping layers never open duplicate popups.
 * Returns a disposer; the map's own removal also drops all listeners.
 */
export function registerGisInteractions(map: maplibregl.Map, handlers: () => MapClickHandlers) {
  let popup: maplibregl.Popup | null = null;
  const show = (lngLat: maplibregl.LngLatLike, content: HTMLElement) => {
    popup?.remove();
    popup = new maplibregl.Popup({ maxWidth: '280px' }).setLngLat(lngLat).setDOMContent(content).addTo(map);
  };

  const topFeature = (point: maplibregl.PointLike) => {
    const layers = INTERACTIVE_LAYERS.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
    return layers.length ? map.queryRenderedFeatures(point, { layers })[0] : undefined;
  };

  const onClick = (event: maplibregl.MapMouseEvent) => {
    const feature = topFeature(event.point);
    if (!feature) return;
    const props = (feature.properties ?? {}) as Record<string, string | number>;

    if (feature.layer.id === 'gis-clusters') {
      const source = map.getSource(SOURCES.incidents) as maplibregl.GeoJSONSource;
      const clusterId = Number(props.cluster_id);
      const center = (feature.geometry as Point).coordinates as [number, number];
      source.getClusterExpansionZoom(clusterId).then((zoom) => {
        map.easeTo({ center, zoom: Math.min(zoom, map.getMaxZoom()) });
      }).catch(() => undefined);
      return;
    }

    if (feature.layer.id === 'gis-incident-points') {
      show((feature.geometry as Point).coordinates as [number, number], popupContent([
        `Incident #${props.incident_id}`,
        ['Barangay', String(props.barangay_name)],
      ]));
      return;
    }

    // Barangay marker or choropleth polygon
    const name = String(props.name);
    handlers().onBarangaySelect(name);
    show(event.lngLat, popupContent([
      name,
      ['Total Incidents', Number(props.count)],
      ['Risk Level', props.risk === 'NONE' ? 'No recorded incidents' : String(props.risk)],
      ['Top Animal Type', String(props.top_animal)],
      ['PEP Compliance Rate', `${Number(props.pep)}%`],
    ]));
  };

  const onMove = (event: maplibregl.MapMouseEvent) => {
    map.getCanvas().style.cursor = topFeature(event.point) ? 'pointer' : '';
  };

  map.on('click', onClick);
  map.on('mousemove', onMove);

  return () => {
    map.off('click', onClick);
    map.off('mousemove', onMove);
    popup?.remove();
  };
}
