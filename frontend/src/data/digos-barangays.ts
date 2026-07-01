type BarangayPolygon = {
  name: string;
  coordinates: [number, number][];
};

const closePolygon = (coordinates: [number, number][]) => {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];

  if (first[0] === last[0] && first[1] === last[1]) {
    return coordinates;
  }

  return [...coordinates, first];
};

const barangayPolygons: BarangayPolygon[] = [
  {
    name: 'Kapatagan',
    coordinates: [[125.250, 6.800], [125.335, 6.800], [125.350, 6.880], [125.260, 6.880]],
  },
  {
    name: 'Dulangan',
    coordinates: [[125.335, 6.805], [125.390, 6.805], [125.400, 6.880], [125.350, 6.880]],
  },
  {
    name: 'Binaton',
    coordinates: [[125.390, 6.805], [125.430, 6.800], [125.445, 6.880], [125.400, 6.880]],
  },
  {
    name: 'Kiagot',
    coordinates: [[125.390, 6.760], [125.440, 6.760], [125.430, 6.805], [125.390, 6.805]],
  },
  {
    name: 'Sinawilan',
    coordinates: [[125.440, 6.760], [125.480, 6.755], [125.480, 6.840], [125.430, 6.805]],
  },
  {
    name: 'San Roque',
    coordinates: [[125.250, 6.740], [125.310, 6.740], [125.320, 6.800], [125.250, 6.800]],
  },
  {
    name: 'Colorado',
    coordinates: [[125.310, 6.740], [125.345, 6.742], [125.335, 6.800], [125.320, 6.800]],
  },
  {
    name: 'Ruparan',
    coordinates: [[125.345, 6.760], [125.390, 6.760], [125.390, 6.805], [125.335, 6.805]],
  },
  {
    name: 'San Agustin',
    coordinates: [[125.335, 6.735], [125.370, 6.735], [125.390, 6.760], [125.345, 6.760]],
  },
  {
    name: 'Matti',
    coordinates: [[125.300, 6.700], [125.345, 6.700], [125.345, 6.742], [125.310, 6.740]],
  },
  {
    name: 'Goma',
    coordinates: [[125.250, 6.670], [125.300, 6.670], [125.300, 6.740], [125.250, 6.740]],
  },
  {
    name: 'Soong',
    coordinates: [[125.250, 6.630], [125.315, 6.630], [125.300, 6.670], [125.250, 6.670]],
  },
  {
    name: 'Lungag',
    coordinates: [[125.315, 6.630], [125.365, 6.630], [125.355, 6.680], [125.300, 6.670]],
  },
  {
    name: 'Igpit',
    coordinates: [[125.315, 6.680], [125.355, 6.680], [125.345, 6.720], [125.300, 6.700]],
  },
  {
    name: 'Mahayahay',
    coordinates: [[125.345, 6.700], [125.370, 6.700], [125.370, 6.735], [125.335, 6.735]],
  },
  {
    name: 'Balabag',
    coordinates: [[125.370, 6.700], [125.395, 6.700], [125.390, 6.735], [125.370, 6.735]],
  },
  {
    name: 'San Jose',
    coordinates: [[125.390, 6.700], [125.420, 6.700], [125.415, 6.735], [125.390, 6.735]],
  },
  {
    name: 'San Miguel',
    coordinates: [[125.345, 6.675], [125.385, 6.675], [125.370, 6.700], [125.315, 6.680]],
  },
  {
    name: 'Tiguman',
    coordinates: [[125.370, 6.735], [125.390, 6.735], [125.390, 6.760], [125.370, 6.760]],
  },
  {
    name: 'Tres De Mayo',
    coordinates: [[125.390, 6.735], [125.420, 6.735], [125.440, 6.760], [125.390, 6.760]],
  },
  {
    name: 'Zone 1',
    coordinates: [[125.420, 6.735], [125.445, 6.735], [125.445, 6.755], [125.440, 6.760]],
  },
  {
    name: 'Zone 2',
    coordinates: [[125.395, 6.710], [125.420, 6.710], [125.420, 6.735], [125.390, 6.735]],
  },
  {
    name: 'Zone 3',
    coordinates: [[125.420, 6.710], [125.445, 6.710], [125.445, 6.735], [125.420, 6.735]],
  },
  {
    name: 'Cogon',
    coordinates: [[125.445, 6.710], [125.480, 6.705], [125.480, 6.755], [125.445, 6.755]],
  },
  {
    name: 'Aplaya',
    coordinates: [[125.420, 6.670], [125.480, 6.665], [125.480, 6.705], [125.445, 6.710], [125.420, 6.700]],
  },
  {
    name: 'Dawis',
    coordinates: [[125.365, 6.630], [125.430, 6.630], [125.420, 6.670], [125.385, 6.675], [125.355, 6.680]],
  },
];

export const digosBarangaysGeoJSON = {
  type: 'FeatureCollection',
  features: barangayPolygons.map((barangay) => ({
    type: 'Feature',
    properties: {
      name: barangay.name,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [closePolygon(barangay.coordinates)],
    },
  })),
} as const;
