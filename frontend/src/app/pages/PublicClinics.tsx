import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import maplibregl from 'maplibre-gl';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Compass,
  ExternalLink,
  HeartPulse,
  Info,
  LocateFixed,
  LogIn,
  Mail,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { publicAPI } from '../../lib/services/api';
import { getDefaultPathForRole, getStoredUser, hasAuthSession } from '../../lib/auth/roleAccess';
import { AnimatedGISBackground } from '../components/Brand/AnimatedGISBackground';
import { BITEMAP_FONT_FAMILY, BITEMAP_LOGO_SRC } from '../components/Brand/brand';
import { escapeHtml, toLngLat } from '../../lib/maplibre/geo';
import { useMapLibre } from '../../lib/maplibre/useMapLibre';
import {
  calculateDistanceKm,
  formatDistance,
  getGoogleMapsDirectionsUrl,
  VERIFIED_PUBLIC_CLINICS,
  type PublicClinic,
} from '../../data/clinics';

const DIGOS_CENTER_COORDS: [number, number] = [6.7497, 125.3572];
const initialFilters = { search: '', barangay: 'All', openNow: false, service: 'All', immunoglobulin: 'All' };
const knownServices = ['Animal bite assessment', 'Anti-rabies vaccination', 'PEP schedule follow-up', 'Wound care', 'Rabies Immunoglobulin (eRIG/hRIG)'];

const phoneIsValid = (phone: string | null) => Boolean(phone && /^[+\d][\d\s()-]{6,}$/.test(phone));
const formatDate = (value: string | null) => {
  if (!value) return 'Verified reference';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Verified reference' : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm font-bold text-slate-700 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </span>
    </label>
  );
}

function Skeletons() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((id) => (
        <div key={id} className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5">
          <div className="h-5 w-1/2 rounded bg-slate-200" />
          <div className="mt-4 h-3 w-4/5 rounded bg-slate-100" />
          <div className="mt-2 h-3 w-3/5 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function PublicClinics() {
  const user = useMemo(() => (hasAuthSession() ? getStoredUser() : null), []);
  const authDestination = user ? getDefaultPathForRole(user.role) : '/login';
  const authLabel = user ? 'Dashboard' : 'Log In';
  const mapNode = useRef<HTMLDivElement | null>(null);
  const { map, basemapError } = useMapLibre(mapNode, {
    center: [DIGOS_CENTER_COORDS[1], DIGOS_CENTER_COORDS[0]],
    zoom: 13,
    minZoom: 10,
    maxZoom: 18,
  });

  const [clinics, setClinics] = useState<PublicClinic[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<PublicClinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Geolocation state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationState, setLocationState] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'>('idle');
  const [locationFeedback, setLocationFeedback] = useState<string | null>(null);

  // References to active map markers and popups
  const markersMapRef = useRef<Map<string, { marker: maplibregl.Marker; popup: maplibregl.Popup }>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  const loadClinics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await publicAPI.getClinics();
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        setClinics(result.data as PublicClinic[]);
      } else {
        // Fallback to verified local directory of Digos City Animal Bite Centers
        setClinics(VERIFIED_PUBLIC_CLINICS);
      }
    } catch {
      // Graceful fallback to verified curated directory
      setClinics(VERIFIED_PUBLIC_CLINICS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClinics();
  }, [loadClinics]);

  // Request browser geolocation
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationState('unsupported');
      setLocationFeedback('Browser geolocation is not supported on this device.');
      return;
    }

    setLocationState('requesting');
    setLocationFeedback('Detecting your location…');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setLocationState('granted');
        setLocationFeedback('Location detected. Clinics sorted by nearest distance.');

        if (map) {
          map.flyTo({ center: [coords.lng, coords.lat], zoom: 14, essential: true });
        }
      },
      (err) => {
        setLocationState('denied');
        if (err.code === err.PERMISSION_DENIED) {
          setLocationFeedback('Location permission was denied. You can still browse clinics on the map.');
        } else {
          setLocationFeedback('Unable to determine your location. Please check device location settings.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [map]);

  // Add MapLibre Geolocate Control
  useEffect(() => {
    if (!map) return;

    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: true,
    });

    map.addControl(geolocate, 'top-right');

    const onGeolocate = (e: GeolocationPosition) => {
      setUserLocation({
        lat: e.coords.latitude,
        lng: e.coords.longitude,
      });
      setLocationState('granted');
      setLocationFeedback('Location detected from map. Clinics sorted by nearest distance.');
    };

    geolocate.on('geolocate', onGeolocate);

    return () => {
      try {
        geolocate.off('geolocate', onGeolocate);
        map.removeControl(geolocate);
      } catch {
        // Safe cleanup
      }
    };
  }, [map]);

  // Render user location pin on the map
  useEffect(() => {
    if (!map) return;

    if (userLocation) {
      if (!userMarkerRef.current) {
        const pinEl = document.createElement('div');
        pinEl.className = 'bitemap-user-pin';
        pinEl.style.width = '24px';
        pinEl.style.height = '24px';
        pinEl.style.position = 'relative';
        pinEl.style.cursor = 'pointer';
        pinEl.innerHTML = `
          <div style="position: absolute; inset: -6px; border-radius: 9999px; background: rgba(14, 165, 233, 0.35); animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
          <div style="position: relative; width: 24px; height: 24px; border-radius: 9999px; background: #0284c7; border: 3px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
            <div style="width: 8px; height: 8px; border-radius: 9999px; background: #ffffff;"></div>
          </div>
        `;

        const userPopup = new maplibregl.Popup({ offset: 16, closeButton: false })
          .setLngLat([userLocation.lng, userLocation.lat])
          .setHTML(
            `<div style="font-family: inherit; font-size: 12px; font-weight: 700; color: #0369a1; padding: 2px 4px;">📍 Your Current Location</div>`,
          );

        const marker = new maplibregl.Marker({ element: pinEl })
          .setLngLat([userLocation.lng, userLocation.lat])
          .setPopup(userPopup)
          .addTo(map);

        userMarkerRef.current = marker;
      } else {
        userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
        userMarkerRef.current.getPopup()?.setLngLat([userLocation.lng, userLocation.lat]);
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  }, [map, userLocation]);

  // Filter list of clinics
  const barangays = useMemo(
    () => Array.from(new Set(clinics.map((clinic) => clinic.barangay).filter(Boolean) as string[])).sort(),
    [clinics],
  );

  const filtered = useMemo(() => {
    return clinics.filter((clinic) => {
      const search = filters.search.trim().toLowerCase();
      const text = [clinic.name, clinic.address, clinic.barangay, ...clinic.services].filter(Boolean).join(' ').toLowerCase();
      const serviceMatch =
        filters.service === 'All' || clinic.services.some((item) => item.toLowerCase() === filters.service.toLowerCase());
      const rigMatch =
        filters.immunoglobulin === 'All' || clinic.services.some((item) => item.toLowerCase().includes(filters.immunoglobulin.toLowerCase()));
      const barangayMatch = filters.barangay === 'All' || clinic.barangay === filters.barangay;
      const openMatch = !filters.openNow || clinic.open_now === true;

      return (!search || text.includes(search)) && barangayMatch && openMatch && serviceMatch && rigMatch;
    });
  }, [clinics, filters]);

  // Calculate distances and sort
  const sortedClinics = useMemo(() => {
    const withDistance = filtered.map((clinic) => {
      if (userLocation && clinic.latitude != null && clinic.longitude != null) {
        const distanceKm = calculateDistanceKm(userLocation.lat, userLocation.lng, clinic.latitude, clinic.longitude);
        return { ...clinic, distanceKm };
      }
      return { ...clinic, distanceKm: undefined };
    });

    if (userLocation) {
      return withDistance.sort((a, b) => {
        const distA = a.distanceKm ?? Infinity;
        const distB = b.distanceKm ?? Infinity;
        return distA - distB;
      });
    }

    // Default sorting: Partner clinic first, then verified, then alphabetical
    return withDistance.sort((a, b) => {
      if (a.is_partner && !b.is_partner) return -1;
      if (!a.is_partner && b.is_partner) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filtered, userLocation]);

  // Sync MapLibre clinic markers and popups
  useEffect(() => {
    if (!map) return;

    // Clear existing clinic markers and popups
    markersMapRef.current.forEach(({ marker, popup }) => {
      popup.remove();
      marker.remove();
    });
    markersMapRef.current.clear();

    const bounds = new maplibregl.LngLatBounds();
    let hasValidMarker = false;

    sortedClinics.forEach((clinic) => {
      const coords = toLngLat(clinic.latitude, clinic.longitude);
      if (!coords) return;

      bounds.extend(coords);
      hasValidMarker = true;

      const isSelected = clinic.public_id === selectedId;
      const isPartner = Boolean(clinic.is_partner);

      // Custom Pin DOM element
      const pinEl = document.createElement('div');
      pinEl.className = 'bitemap-clinic-pin';
      pinEl.style.width = isSelected ? '34px' : '30px';
      pinEl.style.height = isSelected ? '34px' : '30px';
      pinEl.style.borderRadius = '9999px';
      pinEl.style.backgroundColor = isPartner ? '#047857' : '#0F766E';
      pinEl.style.border = isSelected ? '3px solid #F59E0B' : '2px solid #FFFFFF';
      pinEl.style.boxShadow = isSelected ? '0 0 0 3px rgba(245, 158, 11, 0.4), 0 4px 10px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.25)';
      pinEl.style.display = 'flex';
      pinEl.style.alignItems = 'center';
      pinEl.style.justifyContent = 'center';
      pinEl.style.color = '#FFFFFF';
      pinEl.style.cursor = 'pointer';
      pinEl.style.transition = 'all 0.15s ease';

      // SVG Icon inside pin
      pinEl.innerHTML = isPartner
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
        : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;

      // Popup with clinic name, address, contact information, and directions
      const directionsUrl = getGoogleMapsDirectionsUrl(
        clinic.latitude!,
        clinic.longitude!,
        userLocation?.lat,
        userLocation?.lng,
      );

      const popupHtml = `
        <div style="font-family: inherit; font-size: 12px; color: #1e293b; padding: 2px 0; max-width: 250px;">
          <div style="display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 7px; border-radius: 9999px; margin-bottom: 5px; ${
            isPartner ? 'background: #ecfdf5; color: #047857;' : 'background: #f1f5f9; color: #475569;'
          }">
            ${isPartner ? '★ BITEMAP Partner Clinic' : 'Directory Reference'}
          </div>
          <h3 style="margin: 0 0 5px 0; font-size: 13.5px; font-weight: 800; color: #0f172a; line-height: 1.25;">
            ${escapeHtml(clinic.name)}
          </h3>
          <p style="margin: 0 0 4px 0; font-size: 11.5px; color: #475569; display: flex; align-items: flex-start; gap: 4px;">
            <span style="color: #0f766e; flex-shrink: 0;">📍</span>
            <span>${escapeHtml(clinic.address || clinic.barangay || 'Address not supplied')}</span>
          </p>
          ${
            clinic.phone
              ? `<p style="margin: 0 0 4px 0; font-size: 11.5px; color: #475569; display: flex; align-items: center; gap: 4px;">
                   <span style="color: #0f766e; flex-shrink: 0;">📞</span>
                   <span>${escapeHtml(clinic.phone)}</span>
                 </p>`
              : ''
          }
          ${
            clinic.operating_hours
              ? `<p style="margin: 0 0 4px 0; font-size: 11px; color: #64748b; display: flex; align-items: center; gap: 4px;">
                   <span style="color: #0f766e; flex-shrink: 0;">🕒</span>
                   <span>${escapeHtml(clinic.operating_hours)}</span>
                 </p>`
              : ''
          }
          ${
            clinic.distanceKm != null
              ? `<p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; color: #0f766e; display: flex; align-items: center; gap: 4px;">
                   <span>🧭</span>
                   <span>${escapeHtml(formatDistance(clinic.distanceKm))}</span>
                 </p>`
              : ''
          }
          <div style="border-top: 1px solid #f1f5f9; padding-top: 6px; margin-top: 6px; display: flex; justify-content: space-between; align-items: center;">
            <a href="${directionsUrl}" target="_blank" rel="noreferrer" style="font-size: 11px; font-weight: 800; color: #0f766e; text-decoration: underline;">
              Get Directions ↗
            </a>
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 20, closeButton: true, maxWidth: '280px' })
        .setLngLat(coords)
        .setHTML(popupHtml);

      const marker = new maplibregl.Marker({ element: pinEl })
        .setLngLat(coords)
        .setPopup(popup)
        .addTo(map);

      pinEl.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedId(clinic.public_id);
        markersMapRef.current.forEach(({ popup: otherPopup }, id) => {
          if (id !== clinic.public_id && otherPopup.isOpen()) {
            otherPopup.remove();
          }
        });
        if (!popup.isOpen()) {
          popup.setLngLat(coords).addTo(map);
        }
      });

      markersMapRef.current.set(clinic.public_id, { marker, popup });
    });

    // Auto fit bounds safely when clinics or user location change
    if (hasValidMarker && !bounds.isEmpty()) {
      if (userLocation) {
        bounds.extend([userLocation.lng, userLocation.lat]);
      }
      try {
        const container = map.getContainer();
        if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
          map.fitBounds(bounds, { padding: 48, maxZoom: 15, animate: false });
        }
      } catch {
        // Safe fallback
      }
    }
  }, [map, sortedClinics, userLocation]);

  // Update pin visual selection highlight without re-creating markers or re-fitting bounds
  useEffect(() => {
    markersMapRef.current.forEach(({ marker }, id) => {
      const el = marker.getElement();
      if (!el) return;
      const isSelected = id === selectedId;
      el.style.width = isSelected ? '34px' : '30px';
      el.style.height = isSelected ? '34px' : '30px';
      el.style.border = isSelected ? '3px solid #F59E0B' : '2px solid #FFFFFF';
      el.style.boxShadow = isSelected
        ? '0 0 0 3px rgba(245, 158, 11, 0.4), 0 4px 10px rgba(0,0,0,0.3)'
        : '0 2px 8px rgba(0,0,0,0.25)';
    });
  }, [selectedId]);

  const focusClinic = useCallback(
    (clinic: PublicClinic) => {
      setSelectedId(clinic.public_id);
      const coordinates = toLngLat(clinic.latitude, clinic.longitude);
      if (coordinates && map) {
        map.flyTo({ center: coordinates, zoom: 16, essential: true });
        const entry = markersMapRef.current.get(clinic.public_id);
        if (entry) {
          markersMapRef.current.forEach(({ popup: otherPopup }, id) => {
            if (id !== clinic.public_id && otherPopup.isOpen()) {
              otherPopup.remove();
            }
          });
          entry.popup.setLngLat(coordinates).addTo(map);
        }
        // Smooth scroll map into view if on mobile screen
        if (window.innerWidth < 1024 && mapNode.current) {
          mapNode.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    },
    [map],
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900" style={{ fontFamily: BITEMAP_FONT_FAMILY }}>
      <header className="sticky top-0 z-[1000] border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <Link to="/public" className="flex min-w-0 items-center gap-3">
            <img src={BITEMAP_LOGO_SRC} alt="BITEMAP logo" className="h-11 w-11 object-contain sm:h-12 sm:w-12" />
            <div className="min-w-0">
              <p className="truncate text-[17px] font-extrabold text-teal-800 sm:text-xl">BITEMAP Public Portal</p>
              <p className="hidden text-xs text-slate-500 md:block">Animal Bite Incident Tracking and Vaccination Monitoring</p>
            </div>
          </Link>
          <div className="flex gap-2">
            <Link
              to="/public"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 px-3.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Public Portal</span>
            </Link>
            <Link
              to={authDestination}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-teal-700/30 bg-white px-3.5 text-xs font-extrabold text-teal-800 shadow-xs hover:border-teal-700 hover:bg-teal-50 transition-colors"
              title={user ? 'Go to Staff Dashboard' : 'Staff Log In'}
            >
              <LogIn className="h-4 w-4 text-teal-700" />
              <span>{authLabel}</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative isolate overflow-hidden">
          <AnimatedGISBackground tintClassName="bg-gradient-to-r from-teal-950/75 via-teal-900/60 to-teal-800/40" />
          <div className="relative z-10 mx-auto max-w-7xl px-4 py-10 text-white sm:px-6 sm:py-12 lg:px-8">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-teal-950/30 px-3 py-1.5 text-xs font-bold backdrop-blur-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Digos City Animal Bite Center Directory</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Find Nearby Animal Bite Centers</h1>
              <p className="mt-3 text-sm text-teal-50/95 sm:text-base">
                Locate nearby animal bite centers and find information to help you access treatment.
              </p>
              <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-white/15 bg-white/10 p-3.5 text-xs leading-relaxed text-teal-50/90 backdrop-blur-sm sm:flex-row sm:items-center">
                <Info className="h-4 w-4 shrink-0 text-emerald-300" />
                <p>
                  <strong className="text-white">Directory Notice:</strong> BITEMAP's management system remains exclusive to our partner private ABC. Other Animal Bite Centers listed on this public map are directory references to help patients access timely care.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          {/* Medical Guidance Alert */}
          <div className="mb-6 flex gap-3 rounded-2xl border border-teal-200 bg-teal-50/90 px-4 py-3.5 text-sm leading-relaxed text-teal-900 shadow-sm">
            <HeartPulse className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
            <div>
              <p className="font-bold">Immediate First Aid Advice</p>
              <p className="mt-0.5 text-xs leading-normal text-teal-800 sm:text-sm">
                After an animal bite or scratch, wash the wound immediately with running water and soap for 10–15 minutes, then seek medical assessment without delay. Contact the clinic first to confirm current vaccine availability, operating hours, and requirements.
              </p>
            </div>
          </div>

          {/* Search, Geolocation & Filters Bar */}
          <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3.5 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto_auto] lg:items-end">
              <label>
                <span className="mb-1.5 block text-xs font-extrabold uppercase text-slate-500">Search clinics</span>
                <span className="relative block">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Name, barangay, address, or service"
                    className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
                  />
                </span>
              </label>

              <FilterSelect label="Barangay" value={filters.barangay} onChange={(value) => setFilters({ ...filters, barangay: value })}>
                <option value="All">All barangays</option>
                {barangays.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect label="Treatment service" value={filters.service} onChange={(value) => setFilters({ ...filters, service: value })}>
                <option value="All">All services</option>
                {knownServices.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Immunoglobulin"
                value={filters.immunoglobulin}
                onChange={(value) => setFilters({ ...filters, immunoglobulin: value })}
              >
                <option value="All">Any availability</option>
                <option value="eRIG">eRIG available</option>
                <option value="hRIG">hRIG available</option>
              </FilterSelect>

              <button
                type="button"
                onClick={requestLocation}
                disabled={locationState === 'requesting'}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-3.5 text-xs font-extrabold transition shadow-sm ${
                  userLocation
                    ? 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                title="Detect your location to calculate distance and sort clinics"
              >
                <LocateFixed className={`h-4 w-4 ${locationState === 'requesting' ? 'animate-spin text-teal-600' : userLocation ? 'text-sky-600' : 'text-slate-500'}`} />
                <span>{userLocation ? 'Location Active' : locationState === 'requesting' ? 'Detecting…' : 'Near Me'}</span>
              </button>

              <button
                type="button"
                onClick={() => setFilters(initialFilters)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100"
              >
                <RotateCcw className="h-4 w-4 text-slate-500" />
                <span>Reset</span>
              </button>
            </div>

            {locationFeedback && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="flex items-center gap-1.5 font-medium">
                  <Compass className="h-3.5 w-3.5 text-teal-700" />
                  {locationFeedback}
                </span>
                {userLocation && (
                  <button
                    onClick={() => {
                      setUserLocation(null);
                      setLocationState('idle');
                      setLocationFeedback(null);
                    }}
                    className="font-bold text-slate-500 hover:text-slate-800 underline"
                  >
                    Clear location
                  </button>
                )}
              </div>
            )}
          </section>

          {error ? (
            <section className="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
              <Info className="mx-auto h-8 w-8 text-rose-600" />
              <h2 className="mt-3 text-xl font-extrabold text-slate-900">Unable to load clinic information</h2>
              <p className="mt-2 text-sm text-slate-600">{error}</p>
              <button
                onClick={loadClinics}
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-teal-700 px-5 text-sm font-extrabold text-white hover:bg-teal-800"
              >
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
            </section>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              {/* Interactive Map Column */}
              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg lg:sticky lg:top-20">
                <div className="border-b border-slate-100 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900">Interactive Map</h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Explore nearby animal bite treatment facilities and get directions.
                      </p>
                    </div>
                    {userLocation && (
                      <span className="hidden items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-800 sm:inline-flex">
                        <LocateFixed className="h-3 w-3 text-sky-600" /> Nearest first
                      </span>
                    )}
                  </div>
                </div>

                <div className="relative h-[440px] sm:h-[540px] lg:h-[650px] overflow-hidden bg-slate-100">
                  {/* Inline positioning ensures position: absolute and width/height 100% prevail
                      over unlayered .maplibregl-map { position: relative } in Tailwind v4 */}
                  <div
                    ref={mapNode}
                    className="h-full w-full"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                    aria-label="Interactive Animal Bite Centers Map"
                  />

                  {basemapError && (
                    <div className="pointer-events-none absolute left-1/2 top-3 z-[5] max-w-xs -translate-x-1/2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-center text-xs font-semibold text-amber-800 shadow">
                      {basemapError}
                    </div>
                  )}

                  {/* Map Pin Legend Overlay */}
                  <div className="pointer-events-none absolute bottom-4 left-4 z-[5] flex flex-wrap gap-2 rounded-xl border border-slate-200/90 bg-white/95 p-2 text-[11px] font-bold text-slate-700 shadow-md backdrop-blur-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-emerald-700" /> Partner ABC
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-teal-700" /> Directory Center
                    </span>
                    {userLocation && (
                      <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full bg-sky-600" /> Your Location
                      </span>
                    )}
                  </div>
                </div>
              </section>

              {/* Nearby Animal Bite Centers Column */}
              <section>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">Nearby Animal Bite Centers</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {loading
                        ? 'Loading verified directory…'
                        : `${sortedClinics.length} ${sortedClinics.length === 1 ? 'center available' : 'centers available'}${userLocation ? ' · Sorted by nearest distance' : ''}`}
                    </p>
                  </div>
                </div>

                {loading ? (
                  <Skeletons />
                ) : sortedClinics.length === 0 ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <Building2 className="mx-auto h-9 w-9 text-teal-600" />
                    <h3 className="mt-3 text-base font-extrabold text-slate-900">No nearby Animal Bite Centers found.</h3>
                    <p className="mt-2 text-sm text-slate-500">Try searching another location or exploring the map.</p>
                    <button
                      type="button"
                      onClick={() => setFilters(initialFilters)}
                      className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reset filters
                    </button>
                  </div>
                ) : (
                  <div className="max-h-[650px] space-y-4 overflow-y-auto pr-1">
                    {sortedClinics.map((clinic) => (
                      <ClinicCard
                        key={clinic.public_id}
                        clinic={clinic}
                        userLocation={userLocation}
                        selected={selectedId === clinic.public_id}
                        onFocus={focusClinic}
                        onDetails={setDetails}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Before Visiting Guidance Card */}
          <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-slate-900">Before Visiting an Animal Bite Center</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: 'Bring a valid ID', desc: 'Required for official PhilHealth or patient identification records.' },
                { title: 'Prepare bite details', desc: 'Note animal type, date/time, whether pet or stray, and vaccination history.' },
                { title: 'Vaccination booklet', desc: 'Bring previous anti-rabies and tetanus immunization records if available.' },
                { title: 'Contact clinic first', desc: 'Confirm doctor availability, rabies immunoglobulin stock, and operating hours.' },
              ].map((item) => (
                <div key={item.title} className="flex gap-3 rounded-2xl bg-slate-50/80 p-3.5">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Clinic Details Modal */}
      {details && <ClinicModal clinic={details} userLocation={userLocation} close={() => setDetails(null)} />}
    </div>
  );
}

function ClinicCard({
  clinic,
  userLocation,
  selected,
  onFocus,
  onDetails,
}: {
  clinic: PublicClinic;
  userLocation: { lat: number; lng: number } | null;
  selected: boolean;
  onFocus: (clinic: PublicClinic) => void;
  onDetails: (clinic: PublicClinic) => void;
}) {
  const hasCoordinates = clinic.latitude != null && clinic.longitude != null;
  const isPartner = Boolean(clinic.is_partner);
  const directionsUrl = hasCoordinates
    ? getGoogleMapsDirectionsUrl(clinic.latitude!, clinic.longitude!, userLocation?.lat, userLocation?.lng)
    : null;

  return (
    <article
      onClick={() => onFocus(clinic)}
      className={`cursor-pointer rounded-3xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
        selected ? 'border-teal-600 ring-2 ring-teal-600/15' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-900 sm:text-lg">{clinic.name}</h3>
          </div>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">{clinic.clinic_type || 'Animal Bite Center'}</p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {isPartner ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-800 border border-emerald-200">
              <Star className="h-3 w-3 fill-emerald-600 text-emerald-600" /> BITEMAP Partner
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
              Directory Reference
            </span>
          )}

          {clinic.distanceKm != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-extrabold text-teal-800 border border-teal-200">
              <Navigation className="h-3 w-3 text-teal-700" />
              {formatDistance(clinic.distanceKm)}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-600">
        {(clinic.address || clinic.barangay) && (
          <p className="flex items-start gap-2 text-xs sm:text-sm">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
            <span>{[clinic.address, clinic.barangay].filter(Boolean).join(' · ')}</span>
          </p>
        )}

        {clinic.operating_hours && (
          <p className="flex items-center gap-2 text-xs sm:text-sm">
            <Clock3 className="h-4 w-4 shrink-0 text-teal-600" />
            <span>{clinic.operating_hours}</span>
          </p>
        )}

        {phoneIsValid(clinic.phone) && (
          <p className="flex items-center gap-2 text-xs sm:text-sm">
            <Phone className="h-4 w-4 shrink-0 text-teal-600" />
            <a
              href={`tel:${clinic.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-teal-700 hover:underline"
            >
              {clinic.phone}
            </a>
          </p>
        )}
      </div>

      {clinic.services.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {clinic.services.slice(0, 3).map((service) => (
            <span key={service} className="rounded-full bg-teal-50/80 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
              {service}
            </span>
          ))}
          {clinic.services.length > 3 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
              +{clinic.services.length - 3} more
            </span>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          disabled={!hasCoordinates}
          onClick={(e) => {
            e.stopPropagation();
            onFocus(clinic);
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <Navigation className="h-3.5 w-3.5 text-teal-600" />
          <span>View on Map</span>
        </button>

        {directionsUrl && (
          <a
            onClick={(e) => e.stopPropagation()}
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50/70 px-3.5 text-xs font-extrabold text-teal-800 hover:bg-teal-100"
          >
            <ExternalLink className="h-3.5 w-3.5 text-teal-700" />
            <span>Get Directions</span>
          </a>
        )}

        {phoneIsValid(clinic.phone) && (
          <a
            onClick={(e) => e.stopPropagation()}
            href={`tel:${clinic.phone}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            <Phone className="h-3.5 w-3.5 text-slate-500" />
            <span>Call</span>
          </a>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDetails(clinic);
          }}
          className="ml-auto inline-flex h-9 items-center rounded-full bg-teal-700 px-3.5 text-xs font-extrabold text-white hover:bg-teal-800"
        >
          <span>Details</span>
        </button>
      </div>
    </article>
  );
}

function ClinicModal({
  clinic,
  userLocation,
  close,
}: {
  clinic: PublicClinic;
  userLocation: { lat: number; lng: number } | null;
  close: () => void;
}) {
  const directionsUrl =
    clinic.latitude != null && clinic.longitude != null
      ? getGoogleMapsDirectionsUrl(clinic.latitude, clinic.longitude, userLocation?.lat, userLocation?.lng)
      : null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-5" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                  clinic.is_partner ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {clinic.is_partner ? '★ BITEMAP Partner Clinic' : 'Public Directory Reference'}
              </span>
              {clinic.distanceKm != null && (
                <span className="text-xs font-extrabold text-teal-700">· {formatDistance(clinic.distanceKm)}</span>
              )}
            </div>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-900">{clinic.name}</h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">{clinic.clinic_type || 'Animal Bite Center'}</p>
          </div>
          <button
            onClick={close}
            aria-label="Close modal"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Detail
            icon={MapPin}
            label="General location"
            value={[clinic.address, clinic.barangay].filter(Boolean).join(' · ') || 'Not supplied'}
          />
          <Detail icon={Clock3} label="Operating schedule" value={clinic.operating_hours || 'Hours unavailable'} />
          <Detail icon={Phone} label="Public contact" value={clinic.phone || 'Not supplied'} />
          <Detail icon={Mail} label="Public email" value={clinic.public_email || 'Not supplied'} />
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <h3 className="text-sm font-extrabold text-slate-900">Reported Services & Vaccines</h3>
          {clinic.services.length ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {clinic.services.map((service) => (
                <div key={service} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{service}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Service availability not explicitly reported.</p>
          )}
        </div>

        {clinic.public_notes && (
          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
            <p className="font-bold text-slate-700">Notes & Information:</p>
            <p className="mt-1">{clinic.public_notes}</p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            Source: {clinic.source || 'Public directory reference'} · Verified: {formatDate(clinic.last_verified_at)}
          </p>

          <div className="flex gap-2">
            {directionsUrl && (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-teal-700 px-5 text-xs font-extrabold text-white hover:bg-teal-800"
              >
                <ExternalLink className="h-4 w-4" /> Get Google Maps Directions
              </a>
            )}
            <button
              onClick={close}
              className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 px-4 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <Icon className="h-5 w-5 text-teal-700" />
      <p className="mt-2.5 text-xs font-extrabold uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}
