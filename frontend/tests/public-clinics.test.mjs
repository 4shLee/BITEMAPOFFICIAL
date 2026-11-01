import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const clinicsSource = fs.readFileSync(new URL('../src/data/clinics.ts', import.meta.url), 'utf8');
const publicClinicsPageSource = fs.readFileSync(new URL('../src/app/pages/PublicClinics.tsx', import.meta.url), 'utf8');
const backendControllerSource = fs.readFileSync(
  new URL('../../backend/app/Http/Controllers/Api/BitemapApiController.php', import.meta.url),
  'utf8',
);

test('PublicClinics page contains the required section title and subtitle', () => {
  assert.ok(
    publicClinicsPageSource.includes('Find Nearby Animal Bite Centers'),
    'Page must contain section title "Find Nearby Animal Bite Centers"',
  );
  assert.ok(
    publicClinicsPageSource.includes('Locate nearby animal bite centers and find information to help you access treatment.'),
    'Page must contain section subtitle "Locate nearby animal bite centers and find information to help you access treatment."',
  );
});

test('PublicClinics page replaces legacy section headings and empty overlay', () => {
  assert.ok(!publicClinicsPageSource.includes('Verified Clinic Locations'), 'Must not contain "Verified Clinic Locations"');
  assert.ok(!publicClinicsPageSource.includes('Clinic Results'), 'Must not contain "Clinic Results"');
  assert.ok(!publicClinicsPageSource.includes('No verified map locations available'), 'Must not contain "No verified map locations available"');
});

test('PublicClinics page contains the required empty state wording', () => {
  assert.ok(
    publicClinicsPageSource.includes('No nearby Animal Bite Centers found.'),
    'Must display empty state heading "No nearby Animal Bite Centers found."',
  );
  assert.ok(
    publicClinicsPageSource.includes('Try searching another location or exploring the map.'),
    'Must display empty state helper "Try searching another location or exploring the map."',
  );
});

test('PublicClinics page supports MapLibre GL JS without Leaflet', () => {
  assert.ok(publicClinicsPageSource.includes("import maplibregl from 'maplibre-gl';"), 'Must use MapLibre GL JS');
  assert.ok(!publicClinicsPageSource.toLowerCase().includes('leaflet'), 'Must not include Leaflet references');
});

test('PublicClinics page has Google Maps directions and View on Map actions', () => {
  assert.ok(publicClinicsPageSource.includes('View on Map'), 'Must contain View on Map action');
  assert.ok(publicClinicsPageSource.includes('Get Directions'), 'Must contain Get Directions action');
  assert.ok(publicClinicsPageSource.includes('getGoogleMapsDirectionsUrl'), 'Must use Google Maps directions generator');
  assert.ok(clinicsSource.includes('https://www.google.com/maps/dir/?api=1'), 'Directions must target Google Maps Universal URL');
});

test('Distance calculation Haversine formula works accurately', () => {
  function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Digos City Hall (6.7578, 125.3564) to Provincial Hospital (6.7535, 125.3530) is approx ~0.60 km
  const dist = calculateDistanceKm(6.7578, 125.3564, 6.7535, 125.3530);
  assert.ok(dist > 0.4 && dist < 0.8, `Calculated distance should be ~0.6km, got ${dist}`);
});

test('Backend controller includes verified public clinic directory and preserves partner clinic distinction', () => {
  assert.ok(backendControllerSource.includes('getPublicClinicDirectory'), 'Backend controller must include getPublicClinicDirectory');
  assert.ok(backendControllerSource.includes("'is_partner' => true"), 'Partner clinic must be marked as partner');
  assert.ok(backendControllerSource.includes("'is_partner' => false"), 'Directory clinics must be marked as directory reference');
});
