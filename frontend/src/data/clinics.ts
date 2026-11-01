export interface PublicClinic {
  public_id: string;
  name: string;
  clinic_type: string | null;
  address: string | null;
  barangay: string | null;
  phone: string | null;
  public_email: string | null;
  operating_hours: string | null;
  services: string[];
  latitude: number | null;
  longitude: number | null;
  public_notes: string | null;
  verified: boolean;
  is_partner?: boolean;
  source?: string;
  last_verified_at: string | null;
  last_updated_at: string | null;
  open_now?: boolean | null;
  distanceKm?: number;
}

/**
 * Curated, verified directory of Animal Bite Centers and hospitals providing
 * rabies post-exposure prophylaxis (PEP) in Digos City, Davao del Sur.
 *
 * NOTE: BITEMAP's management system remains exclusive to the partner private ABC.
 * External clinics listed here are public directory references only.
 */
export const VERIFIED_PUBLIC_CLINICS: PublicClinic[] = [
  {
    public_id: 'abtc-digos-cho',
    name: 'Digos City Animal Bite Treatment Center',
    clinic_type: 'Public / LGU Animal Bite Treatment Center',
    address: 'Lim Street, Barangay Zone 3, Digos City, Davao del Sur',
    barangay: 'Zone 3',
    phone: '(082) 553-2470',
    public_email: null,
    operating_hours: 'Monday–Friday, 8:00 AM–5:00 PM',
    services: [
      'Animal bite assessment',
      'Anti-rabies vaccination',
      'PEP schedule follow-up',
      'Wound care',
      'PhilHealth Animal Bite Package',
    ],
    latitude: 6.7490,
    longitude: 125.3565,
    public_notes: 'City Health Office public ABTC. PhilHealth-accredited rabies post-exposure prophylaxis provider.',
    verified: true,
    is_partner: false,
    source: 'Public Health Directory',
    last_verified_at: '2026-01-15',
    last_updated_at: '2026-01-15',
    open_now: null,
  },
  {
    public_id: 'abtc-ddsph',
    name: 'Davao del Sur Provincial Hospital - ABTC',
    clinic_type: 'Public Provincial Hospital ABTC',
    address: 'OPD Building, Lapu-Lapu Street, Barangay Zone 2, Digos City, Davao del Sur',
    barangay: 'Zone 2',
    phone: '(082) 553-2550',
    public_email: null,
    operating_hours: 'Monday–Friday, 8:00 AM–5:00 PM (Emergency 24/7)',
    services: [
      'Animal bite assessment',
      'Anti-rabies vaccination',
      'Rabies Immunoglobulin (eRIG/hRIG)',
      'Wound care',
      'Tetanus immunization',
    ],
    latitude: 6.7535,
    longitude: 125.3530,
    public_notes: 'Provincial government tertiary hospital providing anti-rabies vaccination and emergency post-exposure care.',
    verified: true,
    is_partner: false,
    source: 'Public Health Directory',
    last_verified_at: '2026-01-15',
    last_updated_at: '2026-01-15',
    open_now: null,
  },
  {
    public_id: 'abc-jgmd-digos',
    name: 'JGMD Digos City Animal Bite Center and Medical Clinic',
    clinic_type: 'Private Animal Bite Center',
    address: 'Vinzon Street, Barangay Zone 3, Digos City, Davao del Sur',
    barangay: 'Zone 3',
    phone: '0915-350-3565',
    public_email: null,
    operating_hours: 'Monday–Saturday, 8:00 AM–5:00 PM',
    services: [
      'Animal bite assessment',
      'Anti-rabies vaccination',
      'Rabies Immunoglobulin (eRIG/hRIG)',
      'Wound care',
      'PEP schedule follow-up',
    ],
    latitude: 6.7485,
    longitude: 125.3582,
    public_notes: 'Private animal bite clinic offering consultation, active vaccination, and rabies immunoglobulin.',
    verified: true,
    is_partner: false,
    source: 'Public Health Directory',
    last_verified_at: '2026-01-15',
    last_updated_at: '2026-01-15',
    open_now: null,
  },
  {
    public_id: 'abc-darc-digos',
    name: 'Digos Animal Bite Care Center (DARC)',
    clinic_type: 'Private Animal Bite Center',
    address: 'Lapu-Lapu Extension, Purok Cabbage, Barangay San Jose, Digos City, Davao del Sur',
    barangay: 'San Jose',
    phone: '0977-299-4167',
    public_email: null,
    operating_hours: 'Monday–Saturday, 8:00 AM–5:00 PM',
    services: [
      'Animal bite assessment',
      'Anti-rabies vaccination',
      'PEP schedule follow-up',
      'Wound care',
    ],
    latitude: 6.7472,
    longitude: 125.3540,
    public_notes: 'Private outpatient animal bite care center.',
    verified: true,
    is_partner: false,
    source: 'Public Health Directory',
    last_verified_at: '2026-01-15',
    last_updated_at: '2026-01-15',
    open_now: null,
  },
  {
    public_id: 'hospital-mcdc-digos',
    name: 'Medical Center of Digos Cooperative (MCDC Hospital)',
    clinic_type: 'Private Cooperative Tertiary Hospital',
    address: 'National Highway, Barangay Tres de Mayo, Digos City, Davao del Sur',
    barangay: 'Tres De Mayo',
    phone: '(082) 553-3333',
    public_email: null,
    operating_hours: 'Open 24 Hours (Emergency & OPD)',
    services: [
      'Animal bite assessment',
      'Anti-rabies vaccination',
      'Rabies Immunoglobulin (hRIG)',
      'Wound care',
      'Emergency bite trauma management',
    ],
    latitude: 6.7680,
    longitude: 125.3395,
    public_notes: 'Tertiary cooperative hospital with 24/7 emergency department for animal exposure and rabies treatment.',
    verified: true,
    is_partner: false,
    source: 'Public Health Directory',
    last_verified_at: '2026-01-15',
    last_updated_at: '2026-01-15',
    open_now: null,
  },
  {
    public_id: 'hospital-digos-doctors',
    name: 'Digos Doctors Hospital',
    clinic_type: 'Private Tertiary Hospital',
    address: 'McArthur Highway, Barangay Kiagot, Digos City, Davao del Sur',
    barangay: 'Kiagot',
    phone: '(082) 553-2771',
    public_email: null,
    operating_hours: 'Open 24 Hours (Emergency Room)',
    services: [
      'Animal bite assessment',
      'Anti-rabies vaccination',
      'Rabies Immunoglobulin (eRIG/hRIG)',
      'Wound care',
      'Specialist consultation',
    ],
    latitude: 6.7812,
    longitude: 125.3578,
    public_notes: 'Private general hospital equipped for 24-hour bite management and PEP protocols.',
    verified: true,
    is_partner: false,
    source: 'Public Health Directory',
    last_verified_at: '2026-01-15',
    last_updated_at: '2026-01-15',
    open_now: null,
  },
];

/**
 * Calculates straight-line distance in kilometers using the Haversine formula.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's mean radius in km
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

export function formatDistance(distanceKm?: number): string {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return '';
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

/**
 * Builds a direct Google Maps directions URL.
 */
export function getGoogleMapsDirectionsUrl(
  destLat: number,
  destLng: number,
  originLat?: number | null,
  originLng?: number | null,
): string {
  const base = 'https://www.google.com/maps/dir/?api=1';
  const destination = encodeURIComponent(`${destLat},${destLng}`);
  if (originLat != null && originLng != null) {
    const origin = encodeURIComponent(`${originLat},${originLng}`);
    return `${base}&origin=${origin}&destination=${destination}`;
  }
  return `${base}&destination=${destination}`;
}
