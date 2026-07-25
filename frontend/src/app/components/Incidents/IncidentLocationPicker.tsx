import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Coordinates = {
  lat: number;
  lng: number;
};

type IncidentLocationPickerProps = {
  barangayName?: string;
  barangayCoordinates?: Coordinates | null;
  latitude?: string;
  longitude?: string;
  pendingLatitude?: string;
  pendingLongitude?: string;
  exactPin: boolean;
  onPinSelect: (latitude: string, longitude: string) => void;
};

const DIGOS_CENTER: [number, number] = [6.7497, 125.3572];
const DIGOS_BOUNDS: [[number, number], [number, number]] = [[6.63, 125.25], [6.88, 125.48]];

export function IncidentLocationPicker({
  barangayName,
  barangayCoordinates,
  latitude,
  longitude,
  pendingLatitude,
  pendingLongitude,
  exactPin,
  onPinSelect,
}: IncidentLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const primaryMarkerRef = useRef<L.CircleMarker | null>(null);
  const pendingMarkerRef = useRef<L.CircleMarker | null>(null);
  const onPinSelectRef = useRef(onPinSelect);

  useEffect(() => {
    onPinSelectRef.current = onPinSelect;
  }, [onPinSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DIGOS_CENTER,
      zoom: 13,
      minZoom: 12,
      maxZoom: 18,
      maxBounds: L.latLngBounds(DIGOS_BOUNDS),
      maxBoundsViscosity: 1,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      onPinSelectRef.current(event.latlng.lat.toFixed(8), event.latlng.lng.toFixed(8));
    });

    mapRef.current = map;
    window.setTimeout(() => map.invalidateSize(), 0);

    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => map.invalidateSize());
    if (observer && containerRef.current) observer.observe(containerRef.current);

    return () => {
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      primaryMarkerRef.current = null;
      pendingMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const selectedLat = Number(latitude);
    const selectedLng = Number(longitude);
    const pendingLat = Number(pendingLatitude);
    const pendingLng = Number(pendingLongitude);
    const hasConfirmedCoordinates = exactPin && Number.isFinite(selectedLat) && Number.isFinite(selectedLng) && Boolean(latitude) && Boolean(longitude);
    const hasPendingCoordinates = Number.isFinite(pendingLat) && Number.isFinite(pendingLng) && Boolean(pendingLatitude) && Boolean(pendingLongitude);
    const confirmedCoordinates = hasConfirmedCoordinates ? { lat: selectedLat, lng: selectedLng } : null;
    const reviewCoordinates = hasPendingCoordinates ? { lat: pendingLat, lng: pendingLng } : null;
    const primaryCoordinates = confirmedCoordinates || barangayCoordinates;
    const center = reviewCoordinates || confirmedCoordinates || barangayCoordinates;

    primaryMarkerRef.current?.remove();
    pendingMarkerRef.current?.remove();
    primaryMarkerRef.current = null;
    pendingMarkerRef.current = null;

    if (primaryCoordinates) {
      primaryMarkerRef.current = L.circleMarker([primaryCoordinates.lat, primaryCoordinates.lng], {
        radius: confirmedCoordinates ? 8 : 7,
        color: confirmedCoordinates ? '#047857' : '#0369a1',
        fillColor: confirmedCoordinates ? '#10b981' : '#38bdf8',
        fillOpacity: 0.95,
        weight: 3,
      })
        .addTo(map)
        .bindTooltip(confirmedCoordinates ? 'Confirmed exact incident pin' : (barangayName ? barangayName + ' approximate center' : 'Approximate barangay center'));
    }

    if (reviewCoordinates) {
      pendingMarkerRef.current = L.circleMarker([reviewCoordinates.lat, reviewCoordinates.lng], {
        radius: 9,
        color: '#b45309',
        fillColor: '#f59e0b',
        fillOpacity: 0.95,
        weight: 3,
        dashArray: '4 3',
      })
        .addTo(map)
        .bindTooltip('Pin selected for review', { permanent: false });
    }

    if (center) {
      map.setView([center.lat, center.lng], reviewCoordinates || confirmedCoordinates ? 17 : 15, { animate: false });
    } else {
      map.setView(DIGOS_CENTER, 13, { animate: false });
    }
  }, [barangayCoordinates, barangayName, exactPin, latitude, longitude, pendingLatitude, pendingLongitude]);

  return (
    <div className="relative isolate z-0 overflow-hidden rounded-xl border border-emerald-100 bg-slate-100 shadow-inner">
      <div
        ref={containerRef}
        className="relative z-0 h-52 w-full"
        role="application"
        aria-label="Incident location map. Click the map to set an exact incident pin."
      />
    </div>
  );
}
