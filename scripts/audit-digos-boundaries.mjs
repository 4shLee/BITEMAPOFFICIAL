import fs from 'node:fs';

const sourcePath = process.argv[2];

if (!sourcePath) {
  throw new Error('Usage: node scripts/audit-digos-boundaries.mjs <barangays.geojson>');
}

const oldFallbacks = {
  Aplaya: [125.3425, 6.76],
  Balabag: [125.3575, 6.74],
  Binaton: [125.37, 6.83],
  Cogon: [125.3875, 6.765],
  Colorado: [125.315, 6.756],
  Dawis: [125.3725, 6.76],
  Dulangan: [125.36, 6.81],
  Goma: [125.32, 6.74],
  Igpit: [125.348, 6.724],
  Kapatagan: [125.33, 6.805],
  Kiagot: [125.391, 6.783],
  Lungag: [125.3, 6.67],
  Mahayahay: [125.3425, 6.74],
  Matti: [125.334, 6.756],
  Ruparan: [125.35, 6.78],
  'San Agustin': [125.35, 6.765],
  'San Jose': [125.3575, 6.76],
  'San Miguel': [125.358, 6.733],
  'San Roque': [125.325, 6.755],
  Sinawilan: [125.41, 6.775],
  Soong: [125.32, 6.7],
  Tiguman: [125.3725, 6.74],
  'Tres De Mayo': [125.366, 6.761],
  'Zone 1': [125.3525, 6.75],
  'Zone 2': [125.3675, 6.75],
  'Zone 3': [125.38, 6.748],
};

function polygonAreaAndCentroid(ring) {
  let areaTwice = 0;
  let longitudeTotal = 0;
  let latitudeTotal = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [longitudeA, latitudeA] = ring[index];
    const [longitudeB, latitudeB] = ring[index + 1];
    const cross = longitudeA * latitudeB - longitudeB * latitudeA;
    areaTwice += cross;
    longitudeTotal += (longitudeA + longitudeB) * cross;
    latitudeTotal += (latitudeA + latitudeB) * cross;
  }

  const signedArea = areaTwice / 2;
  return {
    area: Math.abs(signedArea),
    point: [
      longitudeTotal / (6 * signedArea),
      latitudeTotal / (6 * signedArea),
    ],
  };
}

function pointInRing([longitude, latitude], ring) {
  let inside = false;

  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const [currentLongitude, currentLatitude] = ring[current];
    const [previousLongitude, previousLatitude] = ring[previous];
    const crosses = (currentLatitude > latitude) !== (previousLatitude > latitude)
      && longitude < ((previousLongitude - currentLongitude) * (latitude - currentLatitude))
        / (previousLatitude - currentLatitude) + currentLongitude;

    if (crosses) inside = !inside;
  }

  return inside;
}

function pointInPolygon(point, rings) {
  return pointInRing(point, rings[0])
    && !rings.slice(1).some((hole) => pointInRing(point, hole));
}

function distanceToSegmentSquared(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;

  if (dx !== 0 || dy !== 0) {
    const ratio = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (ratio > 1) {
      x = end[0];
      y = end[1];
    } else if (ratio > 0) {
      x += dx * ratio;
      y += dy * ratio;
    }
  }

  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function signedDistanceToPolygon(point, rings) {
  let minimumDistanceSquared = Infinity;

  for (const ring of rings) {
    for (let index = 0; index < ring.length - 1; index += 1) {
      minimumDistanceSquared = Math.min(
        minimumDistanceSquared,
        distanceToSegmentSquared(point, ring[index], ring[index + 1]),
      );
    }
  }

  const distance = Math.sqrt(minimumDistanceSquared);
  return pointInPolygon(point, rings) ? distance : -distance;
}

function representativePoint(rings) {
  const centroid = polygonAreaAndCentroid(rings[0]).point;
  if (pointInPolygon(centroid, rings)) return centroid;

  const longitudes = rings[0].map(([longitude]) => longitude);
  const latitudes = rings[0].map(([, latitude]) => latitude);
  const bounds = {
    west: Math.min(...longitudes),
    east: Math.max(...longitudes),
    south: Math.min(...latitudes),
    north: Math.max(...latitudes),
  };

  let best = rings[0][0];
  let bestDistance = signedDistanceToPolygon(best, rings);
  let searchBounds = bounds;

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const longitudeStep = (searchBounds.east - searchBounds.west) / 20;
    const latitudeStep = (searchBounds.north - searchBounds.south) / 20;

    for (let longitudeIndex = 0; longitudeIndex <= 20; longitudeIndex += 1) {
      for (let latitudeIndex = 0; latitudeIndex <= 20; latitudeIndex += 1) {
        const candidate = [
          searchBounds.west + longitudeIndex * longitudeStep,
          searchBounds.south + latitudeIndex * latitudeStep,
        ];
        const distance = signedDistanceToPolygon(candidate, rings);
        if (distance > bestDistance) {
          best = candidate;
          bestDistance = distance;
        }
      }
    }

    searchBounds = {
      west: best[0] - longitudeStep,
      east: best[0] + longitudeStep,
      south: best[1] - latitudeStep,
      north: best[1] + latitudeStep,
    };
  }

  return best;
}

function largestPolygon(geometry) {
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates;

  return polygons
    .map((rings) => ({
      rings,
      area: polygonAreaAndCentroid(rings[0]).area,
    }))
    .sort((left, right) => right.area - left.area)[0].rings;
}

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const features = source.features
  .filter((feature) => feature.properties?.ADM3_PCODE === 'PH1102403')
  .sort((left, right) => left.properties.psgc_code.localeCompare(right.properties.psgc_code));

const results = features.map((feature) => {
  const name = feature.properties.psgc_name;
  const rings = largestPolygon(feature.geometry);
  const point = representativePoint(rings);
  const oldPoint = oldFallbacks[name];

  return {
    psgc_code: feature.properties.psgc_code,
    name,
    longitude: Number(point[0].toFixed(8)),
    latitude: Number(point[1].toFixed(8)),
    old_longitude: oldPoint?.[0] ?? null,
    old_latitude: oldPoint?.[1] ?? null,
    old_inside_boundary: oldPoint ? pointInPolygon(oldPoint, rings) : false,
    new_inside_boundary: pointInPolygon(point, rings),
    boundary_valid_on: feature.properties.validOn,
    boundary_match: feature.properties.psgc_status,
    boundary_match_confidence: feature.properties.match_confidence,
  };
});

console.log(JSON.stringify(results, null, 2));
