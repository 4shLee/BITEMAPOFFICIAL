import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { DIGOS_CENTER } from '../../../data/digos-geography';
import { DIGOS_MAX_BOUNDS } from '../../../lib/maplibre/basemap';
import { featureCollection, pointFeature, toLngLat } from '../../../lib/maplibre/geo';
import { useMapLibre } from '../../../lib/maplibre/useMapLibre';

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

const SOURCE_ID = 'picker-pins';

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
  const onPinSelectRef = useRef(onPinSelect);
  const { map } = useMapLibre(containerRef, {
    center: [DIGOS_CENTER[1], DIGOS_CENTER[0]],
    zoom: 13,
    minZoom: 10,
    maxZoom: 18,
    maxBounds: DIGOS_MAX_BOUNDS,
  });

  useEffect(() => {
    onPinSelectRef.current = onPinSelect;
  }, [onPinSelect]);

  // Sources, layers and listeners are created once per map instance.
  useEffect(() => {
    if (!map) return;

    map.addSource(SOURCE_ID, { type: 'geojson', data: featureCollection([]) });
    map.addLayer({
      id: 'picker-pins',
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius': ['match', ['get', 'kind'], 'pending', 9, 'confirmed', 8, 7],
        'circle-color': ['match', ['get', 'kind'], 'pending', '#f59e0b', 'confirmed', '#10b981', '#38bdf8'],
        'circle-stroke-color': ['match', ['get', 'kind'], 'pending', '#b45309', 'confirmed', '#047857', '#0369a1'],
        'circle-stroke-width': 3,
        'circle-opacity': 0.95,
      },
    });

    const tooltip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
    const onClick = (event: maplibregl.MapMouseEvent) => {
      onPinSelectRef.current(event.lngLat.lat.toFixed(8), event.lngLat.lng.toFixed(8));
    };
    const onEnter = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      tooltip.setLngLat((feature.geometry as GeoJSON.Point).coordinates as [number, number]).setText(String(feature.properties?.label ?? '')).addTo(map);
    };
    const onLeave = () => tooltip.remove();

    map.on('click', onClick);
    map.on('mouseenter', 'picker-pins', onEnter);
    map.on('mouseleave', 'picker-pins', onLeave);

    return () => {
      tooltip.remove();
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;

    const hasConfirmedCoordinates = exactPin && Boolean(latitude) && Boolean(longitude);
    const hasPendingCoordinates = Boolean(pendingLatitude) && Boolean(pendingLongitude);
    const confirmed = hasConfirmedCoordinates ? toLngLat(latitude, longitude) : null;
    const pending = hasPendingCoordinates ? toLngLat(pendingLatitude, pendingLongitude) : null;
    const approximate = barangayCoordinates ? toLngLat(barangayCoordinates.lat, barangayCoordinates.lng) : null;
    const primary = confirmed || approximate;
    const center = pending || confirmed || approximate;

    const features = [
      primary && pointFeature(primary[1], primary[0], {
        kind: confirmed ? 'confirmed' : 'approximate',
        label: confirmed
          ? 'Confirmed exact incident pin'
          : (barangayName ? barangayName + ' approximate center' : 'Approximate barangay center'),
      }),
      pending && pointFeature(pending[1], pending[0], { kind: 'pending', label: 'Pin selected for review' }),
    ];
    (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined)?.setData(featureCollection(features));

    if (center) {
      map.jumpTo({ center, zoom: pending || confirmed ? 17 : 15 });
    } else {
      map.jumpTo({ center: [DIGOS_CENTER[1], DIGOS_CENTER[0]], zoom: 11 });
    }
  }, [map, barangayCoordinates, barangayName, exactPin, latitude, longitude, pendingLatitude, pendingLongitude]);

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
