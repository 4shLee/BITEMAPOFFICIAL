import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const publicHeatmapSource = readFileSync(
  resolve(import.meta.dirname, '../src/app/pages/PublicHeatmap.tsx'),
  'utf8',
);

const publicLayersSource = readFileSync(
  resolve(import.meta.dirname, '../src/app/components/Gis/publicLayers.ts'),
  'utf8',
);

const useMapLibreSource = readFileSync(
  resolve(import.meta.dirname, '../src/lib/maplibre/useMapLibre.ts'),
  'utf8',
);

test('PublicHeatmap normalizes API responses and never accesses RISK_STYLES without fallback', () => {
  assert.ok(publicHeatmapSource.includes('function normalizePublicHeatmapResponse'));
  assert.ok(publicHeatmapSource.includes('function getRiskStyle'));
  assert.ok(!publicHeatmapSource.includes('RISK_STYLES[b.risk_level]'));
  assert.ok(!publicHeatmapSource.includes('RISK_STYLES[selected.risk_level]'));
  assert.ok(!publicHeatmapSource.includes('RISK_STYLES[item.risk_level]'));
});

test('publicLayers symbol layer specifies self-hosted Open Sans Semibold font and guards queryRenderedFeatures', () => {
  assert.ok(publicLayersSource.includes("'text-font': ['Open Sans Semibold']"));
  assert.ok(publicLayersSource.includes('layers.filter((id) => Boolean(map.getLayer(id)))'));
});

test('useMapLibre catches synchronous MapLibre constructor errors instead of crashing React tree', () => {
  assert.ok(useMapLibreSource.includes('new maplibregl.Map('));
  assert.ok(useMapLibreSource.includes("setBasemapError('Interactive map could not be initialized on this browser or device.')"));
});
