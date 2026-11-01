import maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { escapeHtml, featureCollection, pointFeature, type BarangayBoundaries } from '../../../lib/maplibre/geo';

export type PublicRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SUPPRESSED' | 'NO DATA';

export type PublicAggregate = {
  barangay_name: string;
  latitude: number;
  longitude: number;
  risk_level: PublicRiskLevel;
  count_label: string;
};

export const PUBLIC_RISK_STYLES: Record<PublicRiskLevel, { color: string; label: string }> = {
  LOW: { color: '#6FCFA9', label: 'Low' },
  MODERATE: { color: '#E7B85C', label: 'Moderate' },
  HIGH: { color: '#D97868', label: 'High' },
  SUPPRESSED: { color: '#94A3B8', label: 'Suppressed' },
  'NO DATA': { color: '#CBD5E1', label: 'No data' },
};

const POLY_SRC = 'public-barangays';
const POINT_SRC = 'public-barangay-points';

const riskMatch = (): maplibregl.ExpressionSpecification => [
  'match', ['get', 'risk'],
  'LOW', PUBLIC_RISK_STYLES.LOW.color,
  'MODERATE', PUBLIC_RISK_STYLES.MODERATE.color,
  'HIGH', PUBLIC_RISK_STYLES.HIGH.color,
  'SUPPRESSED', PUBLIC_RISK_STYLES.SUPPRESSED.color,
  PUBLIC_RISK_STYLES['NO DATA'].color,
];

const empty = () => ({ type: 'FeatureCollection', features: [] }) as FeatureCollection;

/**
 * Public portal: aggregated, barangay-level only. Polygons are colored by the API's classification;
 * a small center marker per barangay mirrors the previous aggregate circles. No exact incident
 * locations are ever added to this map.
 */
export function addPublicLayers(map: maplibregl.Map) {
  if (map.getSource(POLY_SRC)) return;
  map.addSource(POLY_SRC, { type: 'geojson', data: empty() });
  map.addSource(POINT_SRC, { type: 'geojson', data: empty() });

  map.addLayer({
    id: 'public-fill',
    type: 'fill',
    source: POLY_SRC,
    paint: { 'fill-color': riskMatch(), 'fill-opacity': ['case', ['==', ['get', 'risk'], 'NO DATA'], 0.35, 0.62] },
  });
  map.addLayer({
    id: 'public-outline',
    type: 'line',
    source: POLY_SRC,
    paint: {
      'line-color': ['case', ['get', 'selected'], '#0F766E', '#FFFFFF'],
      'line-width': ['case', ['get', 'selected'], 4, 1.5],
    },
  });
  map.addLayer({
    id: 'public-points',
    type: 'circle',
    source: POINT_SRC,
    paint: {
      'circle-radius': ['case', ['get', 'selected'], 9, 7],
      'circle-color': riskMatch(),
      'circle-stroke-color': ['case', ['get', 'selected'], '#0F766E', '#FFFFFF'],
      'circle-stroke-width': 2,
      'circle-opacity': 0.9,
    },
  });
}

export function updatePublicData(
  map: maplibregl.Map,
  boundaries: BarangayBoundaries | null,
  data: PublicAggregate[],
  selected: string | null,
) {
  const byName = new Map(data.map((item) => [item.barangay_name, item]));

  const polygons: FeatureCollection = {
    type: 'FeatureCollection',
    features: (boundaries?.features ?? []).map((feature) => {
      const item = byName.get(feature.properties.name);
      return {
        type: 'Feature',
        geometry: feature.geometry as Geometry,
        properties: {
          name: feature.properties.name,
          risk: item?.risk_level ?? 'NO DATA',
          label: item?.count_label ?? 'No data',
          selected: feature.properties.name === selected,
        },
      } as Feature;
    }),
  };
  (map.getSource(POLY_SRC) as maplibregl.GeoJSONSource | undefined)?.setData(polygons);

  (map.getSource(POINT_SRC) as maplibregl.GeoJSONSource | undefined)?.setData(featureCollection(data.map((item) =>
    pointFeature(item.latitude, item.longitude, {
      name: item.barangay_name,
      risk: item.risk_level,
      label: item.count_label,
      selected: item.barangay_name === selected,
    }),
  )));
}

/** Hover tooltip + click selection, registered once. Returns a disposer. */
export function registerPublicInteractions(map: maplibregl.Map, onSelect: () => (name: string) => void) {
  const tooltip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
  const layers = ['public-points', 'public-fill'];

  const top = (point: maplibregl.PointLike) => map.queryRenderedFeatures(point, { layers })[0];

  const onMove = (event: maplibregl.MapMouseEvent) => {
    const feature = top(event.point);
    map.getCanvas().style.cursor = feature ? 'pointer' : '';
    if (!feature) {
      tooltip.remove();
      return;
    }
    const props = feature.properties as Record<string, string>;
    const style = PUBLIC_RISK_STYLES[props.risk as PublicRiskLevel] ?? PUBLIC_RISK_STYLES['NO DATA'];
    tooltip
      .setLngLat(event.lngLat)
      .setHTML(`<strong>${escapeHtml(props.name)}</strong><br>${escapeHtml(props.label)}<br>${escapeHtml(style.label)}`)
      .addTo(map);
  };
  const onClick = (event: maplibregl.MapMouseEvent) => {
    const feature = top(event.point);
    if (feature) onSelect()(String((feature.properties as Record<string, string>).name));
  };
  const onLeave = () => tooltip.remove();

  map.on('mousemove', onMove);
  map.on('click', onClick);
  map.on('mouseout', onLeave);

  return () => {
    map.off('mousemove', onMove);
    map.off('click', onClick);
    map.off('mouseout', onLeave);
    tooltip.remove();
  };
}
