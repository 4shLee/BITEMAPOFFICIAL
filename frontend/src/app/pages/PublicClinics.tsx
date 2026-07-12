import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Building2, CheckCircle2, ChevronDown, Clock3, ExternalLink, HeartPulse, Info, LockKeyhole, Mail, MapPin, Navigation, Phone, RefreshCw, RotateCcw, Search, ShieldCheck, X } from 'lucide-react';
import { publicAPI } from '../../lib/services/api';
import { AnimatedGISBackground } from '../components/Brand/AnimatedGISBackground';
import { BITEMAP_FONT_FAMILY, BITEMAP_LOGO_SRC } from '../components/Brand/brand';

type Clinic = {
  public_id: string; name: string; clinic_type: string | null; address: string | null;
  barangay: string | null; phone: string | null; public_email: string | null;
  operating_hours: string | null; services: string[]; latitude: number | null;
  longitude: number | null; public_notes: string | null; verified: boolean;
  last_verified_at: string | null; last_updated_at: string | null; open_now?: boolean | null;
};

const center: [number, number] = [6.7497, 125.3572];
const initialFilters = { search: '', barangay: 'All', openNow: false, service: 'All', immunoglobulin: 'All' };
const knownServices = ['Animal bite assessment', 'Anti-rabies vaccination', 'Wound care', 'PEP schedule follow-up'];
const phoneIsValid = (phone: string | null) => Boolean(phone && /^[+\d][\d\s()-]{6,}$/.test(phone));
const formatDate = (value: string | null) => {
  if (!value) return 'Not supplied';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not supplied' : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label><span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{label}</span><span className="relative block"><select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm font-bold text-slate-700 outline-none focus:border-teal-600">{children}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /></span></label>;
}

function Skeletons() {
  return <div className="space-y-4">{[1, 2, 3].map((id) => <div key={id} className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5"><div className="h-5 w-1/2 rounded bg-slate-200" /><div className="mt-4 h-3 w-4/5 rounded bg-slate-100" /><div className="mt-2 h-3 w-3/5 rounded bg-slate-100" /></div>)}</div>;
}

export function PublicClinics() {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markerRefs = useRef<Map<string, L.CircleMarker>>(new Map());
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await publicAPI.getClinics();
      if (!result.success) throw new Error('Clinic request failed');
      setClinics(Array.isArray(result.data) ? result.data : []);
    } catch {
      setClinics([]);
      setError('Unable to load clinic information. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const map = L.map(mapNode.current, { center, zoom: 12, minZoom: 10, maxZoom: 18 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map); mapRef.current = map;
    const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(mapNode.current);
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  const barangays = useMemo(() => Array.from(new Set(clinics.map((clinic) => clinic.barangay).filter(Boolean) as string[])).sort(), [clinics]);
  const filtered = useMemo(() => clinics.filter((clinic) => {
    const search = filters.search.trim().toLowerCase();
    const text = [clinic.name, clinic.address, clinic.barangay, ...clinic.services].filter(Boolean).join(' ').toLowerCase();
    const service = filters.service === 'All' || clinic.services.some((item) => item.toLowerCase() === filters.service.toLowerCase());
    const rig = filters.immunoglobulin === 'All' || clinic.services.some((item) => item.toLowerCase().includes(filters.immunoglobulin.toLowerCase()));
    return (!search || text.includes(search)) && (filters.barangay === 'All' || clinic.barangay === filters.barangay) && (!filters.openNow || clinic.open_now === true) && service && rig;
  }), [clinics, filters]);

  useEffect(() => {
    const map = mapRef.current; const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers(); markerRefs.current.clear();
    const points: L.LatLngExpression[] = [];
    filtered.forEach((clinic) => {
      if (clinic.latitude == null || clinic.longitude == null) return;
      const point: [number, number] = [Number(clinic.latitude), Number(clinic.longitude)];
      const marker = L.circleMarker(point, { radius: clinic.public_id === selectedId ? 12 : 9, color: clinic.public_id === selectedId ? '#064E3B' : '#fff', weight: clinic.public_id === selectedId ? 4 : 2, fillColor: clinic.verified ? '#0F766E' : '#64748B', fillOpacity: .9 })
        .bindTooltip(clinic.name.replace(/[<>&"']/g, '')).on('click', () => setSelectedId(clinic.public_id)).addTo(layer);
      markerRefs.current.set(clinic.public_id, marker); points.push(point);
    });
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
    else if (points.length === 1) map.setView(points[0], 15); else map.setView(center, 12);
  }, [filtered, selectedId]);

  const focus = (clinic: Clinic) => {
    setSelectedId(clinic.public_id);
    if (clinic.latitude != null && clinic.longitude != null) {
      mapRef.current?.setView([Number(clinic.latitude), Number(clinic.longitude)], 16, { animate: true });
      markerRefs.current.get(clinic.public_id)?.openTooltip();
    }
  };
  const hasCoordinates = filtered.some((clinic) => clinic.latitude != null && clinic.longitude != null);

  return <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900" style={{ fontFamily: BITEMAP_FONT_FAMILY }}>
    <header className="sticky top-0 z-[1000] border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-md"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8"><Link to="/public" className="flex min-w-0 items-center gap-3"><img src={BITEMAP_LOGO_SRC} alt="BITEMAP logo" className="h-11 w-11 object-contain sm:h-12 sm:w-12" /><div className="min-w-0"><p className="truncate text-[17px] font-extrabold text-teal-800 sm:text-xl">BITEMAP Public Portal</p><p className="hidden text-xs text-slate-500 md:block">Animal Bite Incident Tracking and Vaccination Monitoring</p></div></Link><div className="flex gap-2"><Link to="/public" className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 px-3 text-xs font-extrabold"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Public Portal</span></Link><Link to="/login" className="inline-flex h-10 items-center gap-2 rounded-full border border-teal-700/40 px-3 text-xs font-extrabold text-teal-800"><LockKeyhole className="h-4 w-4" /><span className="hidden md:inline">Authorized Staff Login</span><span className="md:hidden">Staff</span></Link></div></div></header>
    <main>
      <section className="relative isolate overflow-hidden"><AnimatedGISBackground tintClassName="bg-gradient-to-r from-teal-950/72 via-teal-900/52 to-teal-800/32" /><div className="relative z-10 mx-auto max-w-7xl px-4 py-10 text-white sm:px-6 sm:py-12 lg:px-8"><div className="max-w-3xl"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-teal-950/20 px-3 py-1.5 text-xs font-bold"><ShieldCheck className="h-3.5 w-3.5" /> Clinic-supplied public information</div><h1 className="text-3xl font-extrabold sm:text-4xl">Find an Animal Bite Center</h1><p className="mt-3 text-sm text-teal-50/90 sm:text-base">View available clinic locations, contact details, operating hours, and reported treatment services.</p><p className="mt-3 flex items-center gap-2 text-xs text-teal-50/80"><Info className="h-4 w-4" /> Clinic information is shown only when supplied and verified by the clinic.</p></div></div></section>
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="mb-6 flex gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3.5 text-sm leading-relaxed text-teal-900"><HeartPulse className="mt-0.5 h-5 w-5 shrink-0" /><p>After an animal bite or scratch, wash the wound immediately and seek medical assessment as soon as possible. Contact the clinic before travelling to confirm operating hours, treatment availability, and requirements.</p></div>
        <section className="mb-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto_auto] lg:items-end"><label><span className="mb-1.5 block text-[11px] font-extrabold uppercase text-slate-500">Search clinics</span><span className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Name, barangay, address, or service" className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none" /></span></label><FilterSelect label="Barangay" value={filters.barangay} onChange={(value) => setFilters({ ...filters, barangay: value })}><option value="All">All locations</option>{barangays.map((item) => <option key={item}>{item}</option>)}</FilterSelect><FilterSelect label="Treatment service" value={filters.service} onChange={(value) => setFilters({ ...filters, service: value })}><option value="All">All reported services</option>{knownServices.map((item) => <option key={item}>{item}</option>)}</FilterSelect><FilterSelect label="Immunoglobulin" value={filters.immunoglobulin} onChange={(value) => setFilters({ ...filters, immunoglobulin: value })}><option value="All">Any availability</option><option value="eRIG">eRIG reported</option><option value="hRIG">hRIG reported</option></FilterSelect><label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold"><input type="checkbox" checked={filters.openNow} onChange={(e) => setFilters({ ...filters, openNow: e.target.checked })} className="accent-teal-700" /> Open now</label><button onClick={() => setFilters(initialFilters)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-extrabold"><RotateCcw className="h-4 w-4" /> Reset</button></div><p className="mt-3 text-xs text-slate-500">Filters match only information explicitly supplied for public display.</p></section>
        {error ? <section className="rounded-3xl border border-rose-200 bg-white p-8 text-center"><Info className="mx-auto h-8 w-8 text-rose-600" /><h2 className="mt-3 text-xl font-extrabold">Unable to load clinic information</h2><p className="mt-2 text-sm text-slate-600">{error}</p><button onClick={load} className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-teal-700 px-5 text-sm font-extrabold text-white"><RefreshCw className="h-4 w-4" /> Retry</button></section> :
        <div className="grid gap-5 lg:grid-cols-2"><section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-extrabold">Verified Clinic Locations</h2><p className="mt-1 text-xs text-slate-500">Only clinic-supplied public coordinates appear on this map.</p></div><div className="relative h-[430px] sm:h-[540px] lg:h-[650px]"><div ref={mapNode} className="absolute inset-0" aria-label="Public clinic location map" />{!loading && !hasCoordinates && <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/75 p-5"><div className="max-w-xs rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-lg"><MapPin className="mx-auto h-7 w-7 text-teal-600" /><p className="mt-3 font-extrabold">No verified map locations available</p><p className="mt-1 text-sm text-slate-500">Listings may still appear without public coordinates.</p></div></div>}</div></section>
        <section><div className="mb-3"><h2 className="text-lg font-extrabold">Clinic Results</h2><p className="mt-1 text-xs text-slate-500">{loading ? 'Loading verified information…' : String(filtered.length) + ' public listings'}</p></div>{loading ? <Skeletons /> : clinics.length === 0 ? <Empty title="No clinic information available" text="No clinic has enabled a verified public listing yet." /> : filtered.length === 0 ? <Empty title="No clinics match these filters" text="Try a broader location or service selection." /> : <div className="max-h-[650px] space-y-4 overflow-y-auto pr-1">{filtered.map((clinic) => <ClinicCard key={clinic.public_id} clinic={clinic} selected={selectedId === clinic.public_id} focus={focus} details={setDetails} />)}</div>}</section></div>}
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-extrabold">Before Visiting</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{['Bring a valid ID when available', 'Prepare details about the bite or scratch', 'Bring previous vaccination records when applicable', 'Contact the clinic first to confirm requirements'].map((item) => <div key={item} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" /><p className="text-sm text-slate-600">{item}</p></div>)}</div></section>
      </div>
    </main>
    {details && <ClinicModal clinic={details} close={() => setDetails(null)} />}
  </div>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center"><Building2 className="mx-auto h-8 w-8 text-teal-600" /><h3 className="mt-3 font-extrabold">{title}</h3><p className="mt-2 text-sm text-slate-500">{text}</p></div>;
}

function ClinicCard({ clinic, selected, focus, details }: { clinic: Clinic; selected: boolean; focus: (clinic: Clinic) => void; details: (clinic: Clinic) => void }) {
  const hasLocation = clinic.latitude != null && clinic.longitude != null;
  return <article onClick={() => focus(clinic)} className={'cursor-pointer rounded-3xl border bg-white p-5 shadow-sm ' + (selected ? 'border-teal-500 ring-2 ring-teal-500/10' : 'border-slate-200')}><div className="flex justify-between gap-3"><div><h3 className="font-extrabold">{clinic.name}</h3><p className="mt-1 text-xs text-slate-500">{clinic.clinic_type || 'Clinic type not supplied'}</p></div><span className={'h-fit rounded-full px-2.5 py-1 text-[11px] font-extrabold ' + (clinic.verified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')}>{clinic.verified ? 'Verified' : 'Not verified'}</span></div><div className="mt-4 space-y-2 text-sm text-slate-600">{(clinic.address || clinic.barangay) && <p className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-teal-600" />{[clinic.address, clinic.barangay].filter(Boolean).join(' · ')}</p>}<p className="flex gap-2"><Clock3 className="h-4 w-4 shrink-0 text-teal-600" />{clinic.operating_hours || 'Operating hours unavailable'}</p></div><div className="mt-4 flex flex-wrap gap-2">{clinic.services.length ? clinic.services.map((service) => <span key={service} className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-800">{service}</span>) : <span className="text-xs text-slate-400">Treatment availability not confirmed</span>}</div><p className="mt-4 text-[11px] text-slate-400">Last verified: {formatDate(clinic.last_verified_at)}</p><div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4"><button disabled={!hasLocation} onClick={(e) => { e.stopPropagation(); focus(clinic); }} className="inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-extrabold disabled:opacity-40"><Navigation className="h-3.5 w-3.5" /> View on Map</button>{hasLocation && <a onClick={(e) => e.stopPropagation()} href={'https://www.openstreetmap.org/directions?to=' + clinic.latitude + ',' + clinic.longitude} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-extrabold"><ExternalLink className="h-3.5 w-3.5" /> Directions</a>}{phoneIsValid(clinic.phone) && <a onClick={(e) => e.stopPropagation()} href={'tel:' + clinic.phone} className="inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-extrabold"><Phone className="h-3.5 w-3.5" /> Call Clinic</a>}<button onClick={(e) => { e.stopPropagation(); details(clinic); }} className="h-9 rounded-full bg-teal-700 px-3 text-xs font-extrabold text-white">View Details</button></div></article>;
}

function ClinicModal({ clinic, close }: { clinic: Clinic; close: () => void }) {
  return <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-5" role="dialog" aria-modal="true"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-white p-6 sm:rounded-[28px]"><div className="flex justify-between gap-4"><div><p className="text-xs font-extrabold uppercase text-teal-700">Public clinic details</p><h2 className="mt-1 text-2xl font-extrabold">{clinic.name}</h2></div><button onClick={close} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100"><X className="h-5 w-5" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Detail icon={MapPin} label="General location" value={[clinic.address, clinic.barangay].filter(Boolean).join(' · ') || 'Not supplied'} /><Detail icon={Clock3} label="Operating schedule" value={clinic.operating_hours || 'Hours unavailable'} /><Detail icon={Phone} label="Public contact" value={clinic.phone || 'Not supplied'} /><Detail icon={Mail} label="Public email" value={clinic.public_email || 'Not supplied'} /></div><div className="mt-6 border-t pt-5"><h3 className="font-extrabold">Reported services</h3>{clinic.services.length ? clinic.services.map((service) => <div key={service} className="mt-2 flex justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm"><b>{service}</b><span className="text-xs font-extrabold text-emerald-700">Available</span></div>) : <p className="mt-2 text-sm text-slate-500">Availability not confirmed.</p>}<p className="mt-3 text-xs text-slate-400">Unlisted services are availability not confirmed, not “not offered.”</p></div>{clinic.public_notes && <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm">{clinic.public_notes}</div>}<p className="mt-6 border-t pt-4 text-xs text-slate-500">Last verified: {formatDate(clinic.last_verified_at)} · Last updated: {formatDate(clinic.last_updated_at)}</p></div></div>;
}

function Detail({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><Icon className="h-5 w-5 text-teal-700" /><p className="mt-3 text-[11px] font-extrabold uppercase text-slate-400">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>;
}
