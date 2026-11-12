import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Calendar,
  CalendarDays,
  CheckCircle2,
  HeartPulse,
  LogIn,
  Map,
  MapPin,
  PawPrint,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { publicAPI } from '../../lib/services/api';
import { getDefaultPathForRole, getStoredUser, hasAuthSession } from '../../lib/auth/roleAccess';
import { AnimatedGISBackground } from '../components/Brand/AnimatedGISBackground';
import { BITEMAP_FONT_FAMILY, BITEMAP_LOGO_SRC } from '../components/Brand/brand';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

type MonthlyCase = {
  month: string;
  cases: number;
};

type DistributionItem = {
  name?: string;
  group?: string;
  value?: number;
  cases?: number;
};

type PublicStats = {
  year: number;
  totalCases: number;
  activeCases: number;
  completedVaccinations: number;
  completedDoses: number;
  pendingDoses: number;
  vaccinationRate: number;
  highRiskBarangays: number;
  averageCasesPerMonth: number;
  topBarangay: string;
  topAnimalType: string;
  monthlyCases: MonthlyCase[];
  animalTypeDistribution: DistributionItem[];
  ageGroupDistribution: DistributionItem[];
};

const chartColors = ['#0D9488', '#0284C7', '#D97706', '#E11D48', '#64748B'];

const defaultStats: PublicStats = {
  year: new Date().getFullYear(),
  totalCases: 0,
  activeCases: 0,
  completedVaccinations: 0,
  completedDoses: 0,
  pendingDoses: 0,
  vaccinationRate: 0,
  highRiskBarangays: 0,
  averageCasesPerMonth: 0,
  topBarangay: 'N/A',
  topAnimalType: 'N/A',
  monthlyCases: [],
  animalTypeDistribution: [],
  ageGroupDistribution: [
    { group: '0-17', cases: 0 },
    { group: '18-35', cases: 0 },
    { group: '36-50', cases: 0 },
    { group: '51+', cases: 0 },
  ],
};

export function PublicStatistics() {
  const [stats, setStats] = useState<PublicStats>(defaultStats);
  const [barangayStats, setBarangayStats] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  const user = useMemo(() => (hasAuthSession() ? getStoredUser() : null), []);
  const authDestination = user ? getDefaultPathForRole(user.role) : '/login';
  const authLabel = user ? 'Dashboard' : 'Log In';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setStatsError('');
    try {
      const [statsResult, barangayResult] = await Promise.all([
        publicAPI.getStatistics(),
        publicAPI.getBarangayStats(),
      ]);

      if (!statsResult.success || !barangayResult.success) {
        throw new Error('Public statistics request failed.');
      }

      if (statsResult.success) {
        setStats({
          year: Number(statsResult.year ?? defaultStats.year),
          totalCases: Number(statsResult.totalCases ?? 0),
          activeCases: Number(statsResult.activeCases ?? 0),
          completedVaccinations: Number(statsResult.completedVaccinations ?? 0),
          completedDoses: Number(statsResult.completedDoses ?? 0),
          pendingDoses: Number(statsResult.pendingDoses ?? 0),
          vaccinationRate: Number(statsResult.vaccinationRate ?? 0),
          highRiskBarangays: Number(statsResult.highRiskBarangays ?? 0),
          averageCasesPerMonth: Number(statsResult.averageCasesPerMonth ?? 0),
          topBarangay: statsResult.topBarangay ?? 'N/A',
          topAnimalType: statsResult.topAnimalType ?? 'N/A',
          monthlyCases: statsResult.monthlyCases ?? [],
          animalTypeDistribution: statsResult.animalTypeDistribution ?? [],
          ageGroupDistribution: statsResult.ageGroupDistribution ?? defaultStats.ageGroupDistribution,
        });
      }

      if (barangayResult.success) {
        setBarangayStats(barangayResult.data ?? {});
      }
    } catch {
      setStats(defaultStats);
      setBarangayStats({});
      setStatsError('Public statistics are temporarily unavailable. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadData]);

  const barangayData = Object.entries(barangayStats)
    .map(([name, total]) => ({
      name,
      cases: Number(total ?? 0),
    }))
    .sort((a, b) => b.cases - a.cases)
    .slice(0, 5);

  const monthlyData = stats.monthlyCases.length > 0 ? stats.monthlyCases : [{ month: 'No data', cases: 0 }];

  const animalTypeData = stats.animalTypeDistribution.map((item, index) => ({
    name: item.name ?? 'Unknown',
    value: Number(item.value ?? 0),
    color: chartColors[index % chartColors.length],
  }));

  const ageGroupData = stats.ageGroupDistribution.map((item) => ({
    group: item.group ?? 'Unknown',
    cases: Number(item.cases ?? 0),
  }));

  const peakMonth = monthlyData.reduce((highest, item) => (item.cases > highest.cases ? item : highest), monthlyData[0]);
  const topAgeGroup = ageGroupData.reduce((highest, item) => (item.cases > highest.cases ? item : highest), ageGroupData[0]);
  const hasIncidentData = stats.totalCases > 0;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50" style={{ fontFamily: BITEMAP_FONT_FAMILY }}>
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-sm font-semibold text-slate-600">Loading public statistics & trends...</p>
        </div>
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900" style={{ fontFamily: BITEMAP_FONT_FAMILY }}>
        <header className="sticky top-0 z-[1000] border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
            <Link to="/public" className="flex min-w-0 items-center gap-3">
              <img src={BITEMAP_LOGO_SRC} alt="BITEMAP logo" className="h-11 w-11 object-contain sm:h-12 sm:w-12" />
              <div className="min-w-0">
                <p className="truncate text-[17px] font-extrabold text-teal-800 sm:text-xl">BITEMAP Public Portal</p>
                <p className="hidden text-xs text-slate-500 md:block">Animal Bite Incident Tracking and Vaccination Monitoring</p>
              </div>
            </Link>
            <Link
              to="/public"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 px-3.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Portal</span>
            </Link>
          </div>
        </header>
        <main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-6 py-12">
          <div className="w-full rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-lg shadow-rose-950/5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-xl font-extrabold text-slate-900">Unable to load public statistics</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{statsError}</p>
            <button
              type="button"
              onClick={loadData}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-teal-700 px-6 text-sm font-extrabold text-white shadow-sm hover:bg-teal-800 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900" style={{ fontFamily: BITEMAP_FONT_FAMILY }}>
      <header className="sticky top-0 z-[1000] border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <Link to="/public" className="flex min-w-0 items-center gap-3" aria-label="BITEMAP Public Portal home">
            <img src={BITEMAP_LOGO_SRC} alt="BITEMAP logo" className="h-11 w-11 shrink-0 object-contain sm:h-12 sm:w-12" />
            <div className="min-w-0">
              <p className="truncate text-[17px] font-extrabold leading-tight text-teal-800 sm:text-xl">BITEMAP Public Portal</p>
              <p className="hidden truncate text-xs font-medium text-slate-500 md:block">Animal Bite Incident Tracking and Vaccination Monitoring</p>
            </div>
          </Link>
          <nav className="flex items-center gap-1.5 sm:gap-3" aria-label="Public portal navigation">
            <Link
              to="/public/heatmap"
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-900 transition-colors"
            >
              <Map className="h-4 w-4 text-teal-700" />
              <span className="hidden sm:inline">Incident Map</span>
            </Link>
            <Link
              to="/public/statistics"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-teal-100/70 px-3 text-xs font-extrabold text-teal-900 transition-colors"
              aria-current="page"
            >
              <BarChart3 className="h-4 w-4 text-teal-800" />
              <span className="hidden sm:inline">Statistics</span>
            </Link>
            <Link
              to="/public/clinics"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-teal-700 px-3.5 text-xs font-extrabold text-white shadow-sm hover:bg-teal-800 transition-colors sm:h-10 sm:px-4"
            >
              <MapPin className="h-4 w-4" />
              <span>Find a Clinic</span>
            </Link>
            <Link
              to={authDestination}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-teal-700/30 bg-white px-3 text-xs font-extrabold text-teal-800 shadow-xs hover:border-teal-700 hover:bg-teal-50 transition-colors sm:h-10 sm:px-4"
              title={user ? 'Go to Staff Dashboard' : 'Staff Log In'}
            >
              <LogIn className="h-4 w-4 text-teal-700" />
              <span>{authLabel}</span>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden">
          <AnimatedGISBackground tintClassName="bg-gradient-to-r from-teal-950/72 via-teal-900/52 to-teal-800/32" />
          <div className="relative z-10 mx-auto max-w-7xl px-4 py-10 text-white sm:px-6 sm:py-12 lg:px-8">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-teal-950/20 px-3 py-1.5 text-xs font-bold text-teal-50">
                <ShieldCheck className="h-3.5 w-3.5" /> Public view — privacy-safe statistics
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Statistics & Trends</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-teal-50/90 sm:text-base">
                Aggregated animal bite incident statistics, monthly epidemiological trends, and vaccination completion insights for Digos City in {stats.year}.
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-teal-950/5 transition-all hover:border-teal-200 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Total Cases ({stats.year})</p>
                  <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{stats.totalCases.toLocaleString()}</p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-teal-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Live database records</span>
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                  <Calendar className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-teal-950/5 transition-all hover:border-teal-200 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Completed PEP Doses</p>
                  <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{stats.completedDoses.toLocaleString()}</p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <HeartPulse className="h-3.5 w-3.5" />
                    <span>{stats.vaccinationRate.toFixed(1)}% completion rate</span>
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-teal-950/5 transition-all hover:border-teal-200 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Average Cases / Month</p>
                  <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{stats.averageCasesPerMonth.toFixed(1)}</p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-sky-700">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>Based on current year data</span>
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-teal-950/5">
              <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Monthly Incident Trend</h2>
                  <p className="text-xs font-medium text-slate-500">Recorded cases per month across {stats.year}</p>
                </div>
                <div className="rounded-xl bg-teal-50 p-2 text-teal-700">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} stroke="#CBD5E1" />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} stroke="#CBD5E1" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #E2E8F0',
                      borderRadius: '16px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cases"
                    name="Incidents"
                    stroke="#0D9488"
                    strokeWidth={2.5}
                    dot={{ fill: '#0D9488', r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                    activeDot={{ r: 6, fill: '#0F766E' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-teal-950/5">
              <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Animal Type Distribution</h2>
                  <p className="text-xs font-medium text-slate-500">Breakdown of reported animal types</p>
                </div>
                <div className="rounded-xl bg-teal-50 p-2 text-teal-700">
                  <PawPrint className="h-5 w-5" />
                </div>
              </div>
              {animalTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={animalTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={95}
                      innerRadius={45}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {animalTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #E2E8F0',
                        borderRadius: '16px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-sm font-medium text-slate-400">
                  No incident data available yet.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-teal-950/5">
              <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Top 5 Barangays by Incidents</h2>
                  <p className="text-xs font-medium text-slate-500">Barangays with the highest case counts</p>
                </div>
                <div className="rounded-xl bg-teal-50 p-2 text-teal-700">
                  <MapPin className="h-5 w-5" />
                </div>
              </div>
              {barangayData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barangayData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#64748B' }} stroke="#CBD5E1" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} stroke="#CBD5E1" width={100} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #E2E8F0',
                        borderRadius: '16px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    />
                    <Bar dataKey="cases" name="Incidents" fill="#0D9488" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-sm font-medium text-slate-400">
                  No barangay incident data available yet.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-teal-950/5">
              <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Cases by Age Group</h2>
                  <p className="text-xs font-medium text-slate-500">Victim age demographic distribution</p>
                </div>
                <div className="rounded-xl bg-teal-50 p-2 text-teal-700">
                  <Users className="h-5 w-5" />
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ageGroupData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="group" tick={{ fontSize: 12, fill: '#64748B', fontWeight: 600 }} stroke="#CBD5E1" />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} stroke="#CBD5E1" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #E2E8F0',
                      borderRadius: '16px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  />
                  <Bar dataKey="cases" name="Cases" fill="#0284C7" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-teal-100 bg-gradient-to-br from-white via-teal-50/30 to-emerald-50/20 p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-700" />
              <h2 className="text-base font-extrabold text-slate-900 sm:text-lg">Key Epidemiological Insights</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <div className="flex items-center gap-2 text-teal-800">
                  <CalendarDays className="h-4 w-4" />
                  <span className="text-xs font-extrabold uppercase tracking-wider">Peak Month</span>
                </div>
                <p className="mt-2 text-base font-extrabold text-slate-900">{hasIncidentData ? peakMonth.month : 'N/A'}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {hasIncidentData
                    ? `Highest recorded incidents with ${peakMonth.cases} case(s).`
                    : 'No incident data has been recorded for this year yet.'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <div className="flex items-center gap-2 text-teal-800">
                  <PawPrint className="h-4 w-4" />
                  <span className="text-xs font-extrabold uppercase tracking-wider">Dominant Animal</span>
                </div>
                <p className="mt-2 text-base font-extrabold text-slate-900">
                  {stats.topAnimalType !== 'N/A' ? stats.topAnimalType : 'None'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {stats.topAnimalType !== 'N/A'
                    ? `${stats.topAnimalType} is the most reported animal type in current records.`
                    : 'No animal type distribution is available yet.'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <div className="flex items-center gap-2 text-teal-800">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-extrabold uppercase tracking-wider">Most Affected Age</span>
                </div>
                <p className="mt-2 text-base font-extrabold text-slate-900">{hasIncidentData ? topAgeGroup.group : 'N/A'}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {hasIncidentData
                    ? `${topAgeGroup.group} has the highest count with ${topAgeGroup.cases} case(s).`
                    : 'No age group trend is available yet.'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <div className="flex items-center gap-2 text-teal-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs font-extrabold uppercase tracking-wider">High-Risk Areas</span>
                </div>
                <p className="mt-2 text-base font-extrabold text-slate-900">
                  {stats.highRiskBarangays > 0 ? `${stats.highRiskBarangays} Barangay(s)` : '0 Barangays'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {stats.highRiskBarangays > 0
                    ? `${stats.highRiskBarangays} barangay(s) reached the high-risk threshold this year.`
                    : 'No barangay has reached the high-risk threshold this year.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div className="md:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white p-1">
                <img src={BITEMAP_LOGO_SRC} alt="BITEMAP logo" className="h-10 w-10 object-contain" />
              </div>
              <p className="font-extrabold text-white">BITEMAP Public Portal</p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Privacy-conscious public information for animal bite trends, vaccination awareness, and clinic discovery.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white">Public Portal</h2>
            <nav className="mt-4 flex flex-col gap-3 text-sm">
              <Link to="/public/heatmap" className="hover:text-emerald-300">
                Incident Heatmap
              </Link>
              <Link to="/public/statistics" className="font-bold text-emerald-400">
                Statistics and Trends
              </Link>
              <Link to="/public/clinics" className="hover:text-emerald-300">
                Vaccination Clinics
              </Link>
            </nav>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white">Privacy Notice</h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Public views use barangay-level totals, generalized markers, clusters, or heatmap intensity. Identifiable patient records and exact incident coordinates are not displayed.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white">Medical Disclaimer</h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Portal information is for general awareness and does not replace diagnosis, treatment, or professional medical assessment.
            </p>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <p>© 2026 BITEMAP. Public information portal.</p>
            <p>Capstone project developed at Cor Jesu College.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
