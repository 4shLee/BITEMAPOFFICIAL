import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';
import { DIGOS_BARANGAY_POINTS } from '../../data/digos-geography';

export const validCoordinate = (value: unknown, minimum: number, maximum: number): number | null => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;

  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum ? coordinate : null;
};

export const validLatitude = (value: unknown) => validCoordinate(value, -90, 90);
export const validLongitude = (value: unknown) => validCoordinate(value, -180, 180);

/** Returns a GeoJSON [longitude, latitude] pair, or null if either value is invalid. Never swaps values. */
export const toLngLat = (latitude: unknown, longitude: unknown): [number, number] | null => {
  const lat = validLatitude(latitude);
  const lng = validLongitude(longitude);
  return lat === null || lng === null ? null : [lng, lat];
};

export const pointFeature = <P extends Record<string, unknown>>(
  latitude: unknown,
  longitude: unknown,
  properties: P,
): Feature<Point, P> | null => {
  const coordinates = toLngLat(latitude, longitude);
  return coordinates ? { type: 'Feature', properties, geometry: { type: 'Point', coordinates } } : null;
};

export const featureCollection = <G extends Geometry, P extends Record<string, unknown>>(
  features: Array<Feature<G, P> | null>,
): FeatureCollection<G, P> => ({
  type: 'FeatureCollection',
  features: features.filter((feature): feature is Feature<G, P> => feature !== null),
});

export const escapeHtml = (value: string | number) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export type BarangayBoundaryProperties = { psgc_code: string; name: string };
export type BarangayBoundaries = FeatureCollection<Geometry, BarangayBoundaryProperties>;

const BOUNDARY_URL = '/data/digos-barangays.geojson';
let boundaryPromise: Promise<BarangayBoundaries> | null = null;

const barangayNameByPsgc = new Map(
  Object.entries(DIGOS_BARANGAY_POINTS).map(([name, point]) => [point.psgcCode, name]),
);

/**
 * Loads the 26 Digos City barangay polygons (NAMRIA boundaries, matched by PSA PSGC code).
 * Names are normalised to the BITEMAP barangay names used by the API via the PSGC code,
 * so the choropleth join is by canonical name, not by free-text boundary labels.
 */
export function loadDigosBoundaries(): Promise<BarangayBoundaries> {
  if (!boundaryPromise) {
    boundaryPromise = fetch(BOUNDARY_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Boundary request failed (${response.status})`);
        return response.json() as Promise<BarangayBoundaries>;
      })
      .then((collection) => ({
        type: 'FeatureCollection' as const,
        features: collection.features.flatMap((feature) => {
          const name = barangayNameByPsgc.get(feature.properties.psgc_code);
          return name ? [{ ...feature, properties: { ...feature.properties, name } }] : [];
        }),
      }))
      .catch((error) => {
        boundaryPromise = null; // allow retry
        throw error;
      });
  }
  return boundaryPromise;
}
