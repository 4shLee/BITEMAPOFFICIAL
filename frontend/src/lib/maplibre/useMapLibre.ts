import { useEffect, useRef, useState, type RefObject } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAP_SOURCE_ID, BASEMAP_STYLE } from './basemap';

type InitOptions = Omit<maplibregl.MapOptions, 'container' | 'style'>;

/**
 * Creates exactly one MapLibre map per container, exposes it once its style has loaded,
 * keeps it sized with the container, and removes it (with all listeners/sources) on unmount.
 * Init options are read once; changing them later does not re-create the map.
 */
export function useMapLibre(containerRef: RefObject<HTMLDivElement | null>, options: InitOptions) {
  const optionsRef = useRef(options);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [basemapError, setBasemapError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isCancelled = false;

    const instance = new maplibregl.Map({
      ...optionsRef.current,
      container,
      style: BASEMAP_STYLE,
      attributionControl: { compact: true },
    });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    instance.on('error', (event) => {
      const sourceId = (event as { sourceId?: string }).sourceId;
      if (sourceId === BASEMAP_SOURCE_ID) {
        setBasemapError('Basemap tiles could not be loaded. Map data layers remain available.');
      }
    });
    instance.on('sourcedata', (event) => {
      if (event.sourceId === BASEMAP_SOURCE_ID && event.isSourceLoaded) setBasemapError(null);
    });

    const onMapReady = () => {
      if (!isCancelled) {
        setMap(instance);
        try {
          instance.resize();
        } catch {
          // ignore transient resize error during early mount
        }
      }
    };

    if (instance.isStyleLoaded()) {
      onMapReady();
    } else {
      instance.once('load', onMapReady);
      instance.once('style.load', onMapReady);
    }

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      try {
        instance.resize();
      } catch {
        // ignore resize error
      }
    });
    observer?.observe(container);

    // Initial resize pass after next frame to ensure parent layout has settled
    const rafId = requestAnimationFrame(() => {
      try {
        instance.resize();
      } catch {
        // ignore
      }
    });

    return () => {
      isCancelled = true;
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      setMap(null);
      instance.remove();
    };
  }, [containerRef]);

  return { map, basemapError };
}
