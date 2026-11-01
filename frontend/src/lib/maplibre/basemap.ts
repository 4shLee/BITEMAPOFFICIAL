import type { StyleSpecification } from 'maplibre-gl';
import { DIGOS_BOUNDS } from '../../data/digos-geography';

/**
 * Basemap configuration.
 *
 * MapLibre GL JS does not ship any tiles or styles. BITEMAP previously used the
 * public OpenStreetMap raster tiles; the same source is kept here so no new
 * provider, API key, or cost is introduced. This is a raster style rendered by
 * MapLibre. A vector tile provider (e.g. self-hosted OpenMapTiles/Protomaps or a
 * keyed commercial provider) requires approval and is NOT configured.
 *
 * Provider terms: https://operations.osmfoundation.org/policies/tiles/
 * (attribution required, no bulk downloading, suitable for light production use).
 * To switch providers, only this file needs to change.
 */
export const BASEMAP_SOURCE_ID = 'osm-raster';

export const BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    [BASEMAP_SOURCE_ID]: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    },
  },
  // Self-hosted glyphs (public/fonts) so symbol layers (cluster counts, labels) need no third-party font server.
  glyphs: '/fonts/{fontstack}/{range}.pbf',
  layers: [{ id: 'osm-raster-layer', type: 'raster', source: BASEMAP_SOURCE_ID }],
};

/** MapLibre bounds are [[west, south], [east, north]] in [lng, lat] order. */
export const DIGOS_MAX_BOUNDS: [[number, number], [number, number]] = [
  [DIGOS_BOUNDS[0][1], DIGOS_BOUNDS[0][0]],
  [DIGOS_BOUNDS[1][1], DIGOS_BOUNDS[1][0]],
];
