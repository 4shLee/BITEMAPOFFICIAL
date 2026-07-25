import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  HeartPulse,
  Info,
  LocateFixed,
  LockKeyhole,
  Map,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { publicAPI } from '../../lib/services/api';
import { AnimatedGISBackground } from '../components/Brand/AnimatedGISBackground';
import { BITEMAP_FONT_FAMILY, BITEMAP_LOGO_SRC } from '../components/Brand/brand';

type PublicPortalStats = {
  year: number;
  totalCases: number;
  vaccinationRate: number;
};

const defaultStats: PublicPortalStats = {
  year: new Date().getFullYear(),
  totalCases: 0,
  vaccinationRate: 0,
};

const featureCards = [
  {
    title: 'Incident Heatmap',
    description: 'View barangay-level incident intensity and generalized public trends without exposing individual locations.',
    button: 'Explore Map',
    to: '/public/heatmap',
    icon: Map,
    preview: 'map',
  },
  {
    title: 'Statistics and Trends',
    description: 'Review aggregated case patterns, vaccination completion, and reporting-period summaries.',
    button: 'View Statistics',
    to: '/public/statistics',
    icon: BarChart3,
    preview: 'chart',
  },
  {
    title: 'Vaccination Clinics',
    description: 'Find nearby Animal Bite Centers and check the location, hours, and contact information provided.',
    button: 'Find Clinics',
    to: '/public/clinics',
    icon: Building2,
    preview: 'clinic',
  },
] as const;

const biteSteps = [
  'Wash the wound immediately with soap and running water for around 15 minutes.',
  'Apply an appropriate antiseptic when available.',
  'Seek medical assessment as soon as possible.',
  'Tell the healthcare provider about the animal and how the exposure happened.',
  'Follow the treatment schedule prescribed by the healthcare professional.',
];

const faqs = [
  {
    question: 'What should I do after an animal bite?',
    answer: 'Wash the wound with soap and running water for around 15 minutes, apply an appropriate antiseptic when available, and seek medical assessment as soon as possible.',
  },
  {
    question: 'Where can I receive anti-rabies treatment?',
    answer: 'Open the Vaccination Clinics directory to review available Animal Bite Centers, their general locations, operating hours, and contact details.',
  },
  {
    question: 'Is patient information shown publicly?',
    answer: 'No. The public portal displays aggregated statistics only. Names, contact details, exact home addresses, exact incident coordinates, and identifiable patient records are not shown.',
  },
  {
    question: 'What does the heatmap represent?',
    answer: 'The heatmap represents relative animal-bite incident intensity summarized at barangay level. It does not identify individual patients or exact incident locations.',
  },
];

function FeaturePreview({ type }: { type: 'map' | 'chart' | 'clinic' }) {
  if (type === 'chart') {
    return (
      <div className="flex h-28 items-end gap-2 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-100/80 p-4" aria-hidden="true">
        {[38, 58, 46, 78, 64, 88, 72].map((height, index) => (
          <span key={index} className="flex-1 rounded-t-md bg-gradient-to-t from-teal-700 to-emerald-400" style={{ height: `${height}%`, opacity: 0.72 + index * 0.03 }} />
        ))}
      </div>
    );
  }

  if (type === 'clinic') {
    return (
      <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100" aria-hidden="true">
        <span className="absolute left-5 top-5 h-10 w-10 rounded-full border border-teal-200 bg-white/80" />
        <span className="absolute bottom-4 right-6 h-7 w-16 rounded-full bg-white/60" />
        <div className="rounded-2xl bg-white p-3 text-teal-700 shadow-lg shadow-teal-900/10"><HeartPulse className="h-8 w-8" /></div>
      </div>
    );
  }

  return (
    <div className="relative h-28 overflow-hidden rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-100" aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full opacity-45" viewBox="0 0 300 112">
        <path d="M-10 88 C52 22 88 96 154 38 S245 70 320 4" fill="none" stroke="#0f766e" strokeWidth="2" />
        <path d="M-20 34 C40 74 108 4 174 66 S246 36 320 92" fill="none" stroke="#34d399" strokeWidth="1.5" />
        {[44, 104, 162, 224, 270].map((cx, index) => <circle key={cx} cx={cx} cy={[55, 72, 42, 64, 34][index]} r="5" fill="#0f766e" />)}
      </svg>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-teal-950/5">
      <div className="mb-5 h-10 w-10 rounded-xl bg-slate-200" />
      <div className="mb-2 h-7 w-24 rounded bg-slate-200" />
      <div className="h-4 w-44 max-w-full rounded bg-slate-100" />
    </div>
  );
}

export function PublicPortal() {
  const [stats, setStats] = useState<PublicPortalStats>(defaultStats);
  const [barangaysWithIncidents, setBarangaysWithIncidents] = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [headerScrolled, setHeaderScrolled] = useState(false);

  const loadStats = useCallback(async () => {
    setIsLoadingStats(true);
    setStatsError('');

    try {
      const [statsResult, barangayResult] = await Promise.all([
        publicAPI.getStatistics(),
        publicAPI.getBarangayStats(),
      ]);

      if (!statsResult.success || !barangayResult.success) {
        throw new Error('Public statistics request failed');
      }

      const barangayTotals = Object.values(barangayResult.data ?? {}) as unknown[];
      setStats({
        year: Number(statsResult.year ?? defaultStats.year),
        totalCases: Number(statsResult.totalCases ?? 0),
        vaccinationRate: Number(statsResult.vaccinationRate ?? 0),
      });
      setBarangaysWithIncidents(barangayTotals.filter((total) => Number(total ?? 0) > 0).length);
    } catch {
      setStatsError('Public statistics are temporarily unavailable. Please try again later.');
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadStats(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadStats]);

  useEffect(() => {
    const updateHeader = () => setHeaderScrolled(window.scrollY > 8);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
    return () => window.removeEventListener('scroll', updateHeader);
  }, []);

  const reportingPeriod = useMemo(() => {
    const now = new Date();
    const endMonth = new Intl.DateTimeFormat('en', { month: 'long' }).format(now);
    return `January–${endMonth} ${stats.year}`;
  }, [stats.year]);

  const hasData = stats.totalCases > 0 || barangaysWithIncidents > 0 || stats.vaccinationRate > 0;

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900" style={{ fontFamily: BITEMAP_FONT_FAMILY }}>
      <header className={`sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md transition-shadow ${headerScrolled ? 'shadow-md shadow-teal-950/8' : ''}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
          <Link to="/public" className="flex min-w-0 items-center gap-3" aria-label="BITEMAP Public Portal home">
            <img src={BITEMAP_LOGO_SRC} alt="BITEMAP logo" className="h-11 w-11 shrink-0 object-contain sm:h-12 sm:w-12" />
            <div className="min-w-0">
              <p className="truncate text-[17px] font-extrabold leading-tight text-teal-800 sm:text-xl">BITEMAP Public Portal</p>
              <p className="hidden truncate text-xs font-medium text-slate-500 md:block">Animal Bite Incident Tracking and Vaccination Monitoring</p>
            </div>
          </Link>
          <Link to="/login" className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-teal-700/40 bg-white px-3.5 text-xs font-extrabold text-teal-800 shadow-sm transition-colors hover:border-teal-700 hover:bg-teal-50 sm:px-5 sm:text-sm">
            <LockKeyhole className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Authorized Staff Login</span>
            <span className="sm:hidden">Staff Login</span>
          </Link>
        </div>
      </header>

      <main>
        <section className="relative isolate min-h-[540px] overflow-hidden">
          <AnimatedGISBackground tintClassName="bg-gradient-to-b from-teal-950/28 via-teal-900/38 to-teal-950/50" />
          <div className="relative z-10 mx-auto flex min-h-[540px] max-w-7xl items-center justify-center px-4 pb-24 pt-16 text-center sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-4xl text-white [text-shadow:0_2px_16px_rgba(4,47,46,0.3)]">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-100/35 bg-teal-950/20 px-3 py-1.5 text-xs font-bold text-emerald-50 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" /> Public health insights for Digos City
              </div>
              <h1 className="mx-auto max-w-[860px] text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[58px]">Track Animal Bite Trends. Find Help Faster.</h1>
              <p className="mx-auto mt-5 max-w-3xl text-base font-medium leading-relaxed text-teal-50/95 sm:text-lg">Explore aggregated animal bite statistics, barangay-level trends, vaccination information, and nearby Animal Bite Centers.</p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Link to="/public/heatmap" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-extrabold text-teal-800 shadow-lg transition-colors hover:bg-emerald-50">
                  <Map className="h-5 w-5" /> Explore Incident Map
                </Link>
                <Link to="/public/clinics" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/55 bg-teal-950/25 px-6 text-sm font-extrabold text-white transition-colors hover:bg-white/15">
                  <MapPin className="h-5 w-5" /> Find a Clinic
                </Link>
              </div>
              <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold leading-relaxed text-teal-50/90 sm:text-sm">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>Public information portal &mdash; no personal patient information is displayed.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-20 mx-auto -mt-14 max-w-7xl px-4 sm:px-6 lg:px-8" aria-labelledby="public-summary-heading">
          <div className="mb-4 flex flex-col gap-1 px-1 text-white sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-100">Public summary</p>
              <h2 id="public-summary-heading" className="text-lg font-extrabold">Current reporting period</h2>
            </div>
            <p className="flex items-center gap-2 text-sm font-bold text-teal-50"><CalendarDays className="h-4 w-4" /> {reportingPeriod}</p>
          </div>

          {isLoadingStats ? (
            <div className="grid gap-4 md:grid-cols-3" aria-label="Loading public statistics">
              <StatSkeleton /><StatSkeleton /><StatSkeleton />
            </div>
          ) : statsError ? (
            <div className="rounded-3xl border border-rose-200 bg-white p-6 shadow-xl shadow-teal-950/8">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" /><div><p className="font-extrabold text-slate-900">Unable to load the public summary</p><p className="mt-1 text-sm text-slate-600">{statsError}</p></div></div>
                <button type="button" onClick={loadStats} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-teal-700 px-5 text-sm font-extrabold text-white hover:bg-teal-800"><RefreshCw className="h-4 w-4" /> Retry</button>
              </div>
            </div>
          ) : !hasData ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-teal-950/8">
              <Activity className="mx-auto h-8 w-8 text-teal-600" /><p className="mt-3 font-extrabold text-slate-900">No data available</p><p className="mt-1 text-sm text-slate-500">No aggregated public statistics are available for {reportingPeriod}.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: 'Total Bite Incidents', value: stats.totalCases.toLocaleString(), icon: Activity, note: 'Aggregated reports' },
                { label: 'Barangays with Recorded Incidents', value: barangaysWithIncidents.toLocaleString(), icon: LocateFixed, note: 'Barangay-level totals only' },
                { label: 'PEP Completion Rate', value: `${stats.vaccinationRate.toFixed(1)}%`, icon: CheckCircle2, note: 'Completed treatment schedules' },
              ].map(({ label, value, icon: Icon, note }) => (
                <article key={label} className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xl shadow-teal-950/8">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Icon className="h-5 w-5" /></div>
                  <p className="text-3xl font-extrabold text-teal-900">{value}</p><h3 className="mt-1 text-sm font-extrabold text-slate-800">{label}</h3><p className="mt-1 text-xs font-medium text-slate-500">{note}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="explore-heading">
          <div className="mb-9 max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">Public resources</p><h2 id="explore-heading" className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Explore Public Information</h2><p className="mt-3 text-base leading-relaxed text-slate-600">Access privacy-safe maps, summarized trends, and treatment-center information.</p></div>
          <div className="grid gap-6 lg:grid-cols-3">
            {featureCards.map(({ title, description, button, to, icon: Icon, preview }) => (
              <article key={title} className="flex flex-col rounded-[28px] border border-slate-200 bg-white p-5 shadow-lg shadow-teal-950/5">
                <FeaturePreview type={preview} />
                <div className="flex flex-1 flex-col px-1 pb-1 pt-5"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Icon className="h-5 w-5" /></div><h3 className="text-xl font-extrabold text-slate-900">{title}</h3><p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{description}</p><Link to={to} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-teal-700 px-5 text-sm font-extrabold text-white transition-colors hover:bg-teal-800">{button}<ArrowRight className="h-4 w-4" /></Link></div>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-emerald-950 py-16 text-white" aria-labelledby="bite-guidance-heading">
          <div className="mx-auto grid max-w-7xl gap-9 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200"><HeartPulse className="h-6 w-6" /></div><h2 id="bite-guidance-heading" className="mt-5 text-3xl font-extrabold leading-tight sm:text-4xl">What to Do After an Animal Bite or Scratch</h2><p className="mt-4 leading-relaxed text-emerald-100/80">Act promptly and get an assessment from a qualified healthcare professional.</p></div>
            <div className="rounded-[28px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm sm:p-7">
              <ol className="space-y-4">{biteSteps.map((step, index) => <li key={step} className="flex gap-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-300 text-xs font-extrabold text-emerald-950">{index + 1}</span><p className="pt-0.5 text-sm font-medium leading-relaxed text-emerald-50 sm:text-base">{step}</p></li>)}</ol>
              <p className="mt-6 border-t border-white/10 pt-5 text-xs font-semibold leading-relaxed text-emerald-100/75">This information is for general guidance and does not replace professional medical assessment.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div aria-labelledby="helps-heading"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">Built for public awareness</p><h2 id="helps-heading" className="mt-2 text-3xl font-extrabold text-slate-900">How BITEMAP Helps</h2><div className="mt-7 grid gap-4 sm:grid-cols-2">{[
            ['Public awareness', Users, 'Clear guidance and summarized community information.'],
            ['Incident visualization', Map, 'Aggregated barangay patterns without exact patient locations.'],
            ['Vaccination information', HeartPulse, 'PEP completion context and treatment guidance.'],
            ['Clinic discovery', Navigation, 'A direct path to available treatment-center details.'],
          ].map(([title, Icon, text]) => <article key={String(title)} className="rounded-2xl border border-slate-200 bg-white p-5"><Icon className="h-5 w-5 text-teal-700" /><h3 className="mt-3 font-extrabold text-slate-900">{String(title)}</h3><p className="mt-1 text-sm leading-relaxed text-slate-600">{String(text)}</p></article>)}</div></div>

          <div aria-labelledby="faq-heading"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">Quick answers</p><h2 id="faq-heading" className="mt-2 text-3xl font-extrabold text-slate-900">Frequently Asked Questions</h2><div className="mt-7 space-y-3">{faqs.map(({ question, answer }) => <details key={question} className="group rounded-2xl border border-slate-200 bg-white p-5 open:border-teal-200 open:shadow-md open:shadow-teal-950/5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-extrabold text-slate-900"><span>{question}</span><ChevronDown className="h-5 w-5 shrink-0 text-teal-700 transition-transform group-open:rotate-180" /></summary><p className="mt-3 pr-6 text-sm leading-relaxed text-slate-600">{answer}</p></details>)}</div></div>
        </section>

        <section className="border-y border-teal-100 bg-teal-50/70 py-14" aria-labelledby="clinic-preview-heading">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex flex-col gap-6 rounded-[28px] border border-teal-200/70 bg-white p-6 shadow-lg shadow-teal-950/5 lg:flex-row lg:items-center lg:justify-between lg:p-8"><div className="flex max-w-3xl items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-700 text-white"><Building2 className="h-6 w-6" /></div><div><h2 id="clinic-preview-heading" className="text-2xl font-extrabold text-slate-900">Clinic Contact and Directory</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">Review available clinic names, general locations, operating hours, and contact information in the public directory. Details are shown only when supplied for public use.</p><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-teal-800"><span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> General location</span><span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4" /> Operating hours</span><span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> Public contact details</span></div></div></div><Link to="/public/clinics" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-teal-700 px-6 text-sm font-extrabold text-white hover:bg-teal-800">Open Clinic Directory<ArrowRight className="h-4 w-4" /></Link></div></div>
        </section>
      </main>

      <footer className="bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div className="md:col-span-2 lg:col-span-1"><div className="flex items-center gap-3"><div className="rounded-xl bg-white p-1"><img src={BITEMAP_LOGO_SRC} alt="BITEMAP logo" className="h-10 w-10 object-contain" /></div><p className="font-extrabold text-white">BITEMAP Public Portal</p></div><p className="mt-4 text-sm leading-relaxed text-slate-400">Privacy-conscious public information for animal bite trends, vaccination awareness, and clinic discovery.</p></div>
          <div><h2 className="text-sm font-extrabold text-white">Public Portal</h2><nav className="mt-4 flex flex-col gap-3 text-sm"><Link to="/public/heatmap" className="hover:text-emerald-300">Incident Heatmap</Link><Link to="/public/statistics" className="hover:text-emerald-300">Statistics and Trends</Link><Link to="/public/clinics" className="hover:text-emerald-300">Vaccination Clinics</Link><Link to="/login" className="hover:text-emerald-300">Authorized Staff Login</Link></nav></div>
          <div><h2 className="text-sm font-extrabold text-white">Privacy Notice</h2><p className="mt-4 text-sm leading-relaxed text-slate-400">Public views use barangay-level totals, generalized markers, clusters, or heatmap intensity. Identifiable patient records and exact incident coordinates are not displayed.</p></div>
          <div><h2 className="text-sm font-extrabold text-white">Medical Disclaimer</h2><p className="mt-4 text-sm leading-relaxed text-slate-400">Portal information is for general awareness and does not replace diagnosis, treatment, or professional medical assessment.</p></div>
        </div>
        <div className="border-t border-white/10"><div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8"><p>© 2026 BITEMAP. Public information portal.</p><p>Capstone project developed at Cor Jesu College.</p></div></div>
      </footer>
    </div>
  );
}
