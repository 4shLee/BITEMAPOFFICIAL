export type DigosBarangayPoint = {
  psgcCode: string;
  lat: number;
  lng: number;
};

export const DIGOS_GEOGRAPHY_SOURCE =
  'NAMRIA administrative barangay boundaries (valid 2023-11-06), matched to PSA PSGC codes';

export const DIGOS_BOUNDS: [[number, number], [number, number]] = [
  [6.7215, 125.2525],
  [6.9872, 125.3932],
];

export const DIGOS_CENTER: [number, number] = [6.85435, 125.32285];

export const DIGOS_BARANGAY_POINTS: Record<string, DigosBarangayPoint> = {
  Aplaya: { psgcCode: '1102403001', lat: 6.74164834, lng: 125.37245251 },
  Balabag: { psgcCode: '1102403002', lat: 6.85685429, lng: 125.26978155 },
  'San Jose': { psgcCode: '1102403003', lat: 6.73125205, lng: 125.35463070 },
  Binaton: { psgcCode: '1102403004', lat: 6.84838618, lng: 125.33803610 },
  Cogon: { psgcCode: '1102403005', lat: 6.75742356, lng: 125.37724579 },
  Colorado: { psgcCode: '1102403006', lat: 6.75506963, lng: 125.29556990 },
  Dawis: { psgcCode: '1102403007', lat: 6.73009357, lng: 125.36827608 },
  Dulangan: { psgcCode: '1102403008', lat: 6.83769091, lng: 125.31446776 },
  Goma: { psgcCode: '1102403009', lat: 6.85286242, lng: 125.29052371 },
  Igpit: { psgcCode: '1102403010', lat: 6.73338652, lng: 125.31541972 },
  Kiagot: { psgcCode: '1102403011', lat: 6.78090818, lng: 125.35800284 },
  Lungag: { psgcCode: '1102403012', lat: 6.79466699, lng: 125.27767847 },
  Mahayahay: { psgcCode: '1102403013', lat: 6.79668215, lng: 125.29340182 },
  Matti: { psgcCode: '1102403014', lat: 6.76590191, lng: 125.30570925 },
  Kapatagan: { psgcCode: '1102403019', lat: 6.92605084, lng: 125.31445063 },
  Ruparan: { psgcCode: '1102403020', lat: 6.79071808, lng: 125.32848162 },
  'San Agustin': { psgcCode: '1102403021', lat: 6.77762873, lng: 125.31501883 },
  'San Miguel': { psgcCode: '1102403022', lat: 6.73901160, lng: 125.34085046 },
  'San Roque': { psgcCode: '1102403023', lat: 6.77930377, lng: 125.28642543 },
  Sinawilan: { psgcCode: '1102403024', lat: 6.77581148, lng: 125.37787301 },
  Soong: { psgcCode: '1102403025', lat: 6.81067777, lng: 125.35310403 },
  Tiguman: { psgcCode: '1102403026', lat: 6.75099690, lng: 125.32413033 },
  'Tres De Mayo': { psgcCode: '1102403027', lat: 6.76795080, lng: 125.33903558 },
  'Zone 1': { psgcCode: '1102403028', lat: 6.75787339, lng: 125.35641175 },
  'Zone 2': { psgcCode: '1102403029', lat: 6.75207111, lng: 125.35295619 },
  'Zone 3': { psgcCode: '1102403030', lat: 6.74419295, lng: 125.35539780 },
};

export function getDigosBarangayPoint(name?: string | null) {
  return name ? DIGOS_BARANGAY_POINTS[name] ?? null : null;
}
