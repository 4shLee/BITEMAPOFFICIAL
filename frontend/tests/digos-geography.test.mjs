import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const frontendSource = fs.readFileSync(new URL('../src/data/digos-geography.ts', import.meta.url), 'utf8');
const backendSource = fs.readFileSync(
  new URL('../../backend/app/Support/DigosBarangayCoordinates.php', import.meta.url),
  'utf8',
);
const edgeSource = fs.readFileSync(
  new URL('../supabase/functions/server/index.tsx', import.meta.url),
  'utf8',
);

const frontendPoints = new Map(
  [...frontendSource.matchAll(/^\s*(?:'([^']+)'|([A-Za-z]+)):\s*\{\s*psgcCode:\s*'(\d+)',\s*lat:\s*([\d.]+),\s*lng:\s*([\d.]+)\s*\}/gm)]
    .map((match) => [match[1] || match[2], {
      psgcCode: match[3],
      lat: Number(match[4]),
      lng: Number(match[5]),
    }]),
);

const backendPoints = new Map(
  [...backendSource.matchAll(/^\s*'([^']+)'\s*=>\s*\['psgc_code'\s*=>\s*'(\d+)',\s*'lat'\s*=>\s*([\d.]+),\s*'lng'\s*=>\s*([\d.]+)\],?$/gm)]
    .map((match) => [match[1], {
      psgcCode: match[2],
      lat: Number(match[3]),
      lng: Number(match[4]),
    }]),
);

const edgePoints = new Map(
  [...edgeSource.matchAll(/^\s*(?:\"([^\"]+)\"|([A-Za-z]+)):\s*\{\s*latitude:\s*([\d.]+),\s*longitude:\s*([\d.]+)\s*\},?$/gm)]
    .map((match) => [match[1] || match[2], {
      lat: Number(match[3]),
      lng: Number(match[4]),
    }]),
);

test('all 26 supported Digos barangays have unique points within approved bounds', () => {
  assert.equal(frontendPoints.size, 26);
  assert.equal(new Set([...frontendPoints.values()].map((point) => point.psgcCode)).size, 26);
  assert.equal(
    new Set([...frontendPoints.values()].map((point) => `${point.lat.toFixed(8)},${point.lng.toFixed(8)}`)).size,
    26,
  );

  for (const point of frontendPoints.values()) {
    assert.ok(point.lat >= 6.7215 && point.lat <= 6.9872);
    assert.ok(point.lng >= 125.2525 && point.lng <= 125.3932);
  }
});

test('backend, browser fallback, and edge GIS coordinate mirrors remain synchronized', () => {
  assert.deepEqual(frontendPoints, backendPoints);
  assert.equal(edgePoints.size, 26);

  for (const [name, point] of frontendPoints) {
    assert.deepEqual(edgePoints.get(name), { lat: point.lat, lng: point.lng });
  }
});

test('known barangays resolve to their validated representative points', () => {
  const expected = {
    Cogon: [6.75742356, 125.37724579],
    Aplaya: [6.74164834, 125.37245251],
    Dawis: [6.73009357, 125.36827608],
    Sinawilan: [6.77581148, 125.37787301],
    'Zone 1': [6.75787339, 125.35641175],
    'Zone 2': [6.75207111, 125.35295619],
    'Zone 3': [6.74419295, 125.35539780],
  };

  for (const [name, [lat, lng]] of Object.entries(expected)) {
    assert.deepEqual(frontendPoints.get(name), {
      psgcCode: backendPoints.get(name).psgcCode,
      lat,
      lng,
    });
  }
});
