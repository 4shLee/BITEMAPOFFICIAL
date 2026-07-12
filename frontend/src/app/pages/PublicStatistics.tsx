import { Link } from 'react-router';
import { AlertCircle, ArrowLeft, Calendar, RefreshCw, TrendingUp, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { useState, useEffect } from 'react';
import { publicAPI } from '../../lib/services/api';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';

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

const chartColors = ['#1D9E75', '#185FA5', '#BA7517', '#DC2626', '#6B7280'];

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setStatsError('');
    try {
      const [statsResult, barangayResult] = await Promise.all([
        publicAPI.getStatistics(),
        publicAPI.getBarangayStats()
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
  };

  const barangayData = Object.entries(barangayStats)
    .map(([name, total]) => ({
      name,
      cases: Number(total ?? 0)
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

  const peakMonth = monthlyData.reduce((highest, item) => item.cases > highest.cases ? item : highest, monthlyData[0]);
  const topAgeGroup = ageGroupData.reduce((highest, item) => item.cases > highest.cases ? item : highest, ageGroupData[0]);
  const hasIncidentData = stats.totalCases > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <Link to="/public" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              <ArrowLeft className="h-4 w-4" /> Back to Public Portal
            </Link>
          </div>
        </header>
        <main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-6 py-12">
          <div className="w-full rounded-2xl border border-rose-200 bg-white p-7 text-center shadow-sm">
            <AlertCircle className="mx-auto h-8 w-8 text-rose-600" />
            <h1 className="mt-3 text-xl font-semibold text-foreground">Unable to load public statistics</h1>
            <p className="mt-2 text-sm text-muted-foreground">{statsError}</p>
            <button type="button" onClick={loadData} className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/public"
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Statistics & Trends</h1>
              <p className="text-xs text-muted-foreground">Animal Bite Incident Data - Digos City {stats.year}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-2">Total Cases ({stats.year})</p>
                <p className="text-3xl font-semibold text-foreground mb-1">{stats.totalCases.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Live database records</p>
              </div>
              <div className="w-12 h-12 bg-primary-bg rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-2">Completed PEP Doses</p>
                <p className="text-3xl font-semibold text-foreground mb-1">{stats.completedDoses.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{stats.vaccinationRate.toFixed(1)}% completion rate</p>
              </div>
              <div className="w-12 h-12 bg-success-bg rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-success" />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-2">Average Cases/Month</p>
                <p className="text-3xl font-semibold text-foreground mb-1">{stats.averageCasesPerMonth.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Based on current year data</p>
              </div>
              <div className="w-12 h-12 bg-accent-bg rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-base font-semibold text-foreground mb-6">Monthly Incident Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0DED5" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#888780" />
                <YAxis tick={{ fontSize: 12 }} stroke="#888780" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #E0DED5',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Line type="monotone" dataKey="cases" stroke="#1D9E75" strokeWidth={2} dot={{ fill: '#1D9E75', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-base font-semibold text-foreground mb-6">Animal Type Distribution</h2>
            {animalTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={animalTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => String(name) + ': ' + String(value)}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {animalTypeData.map((entry, index) => (
                      <Cell key={'cell-' + index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                No incident data available yet.
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-base font-semibold text-foreground mb-6">Top 5 Barangays by Incidents</h2>
            {barangayData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barangayData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0DED5" />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#888780" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke="#888780" width={90} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #E0DED5',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="cases" fill="#1D9E75" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                No barangay incident data available yet.
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-base font-semibold text-foreground mb-6">Cases by Age Group</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ageGroupData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0DED5" />
                <XAxis dataKey="group" tick={{ fontSize: 12 }} stroke="#888780" />
                <YAxis tick={{ fontSize: 12 }} stroke="#888780" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #E0DED5',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="cases" fill="#185FA5" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-8 bg-card border border-border rounded-lg p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Key Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Peak Month</p>
                <p className="text-sm text-muted-foreground">
                  {hasIncidentData ? peakMonth.month + ' currently has the highest recorded incidents with ' + peakMonth.cases + ' case(s).' : 'No incident data has been recorded for this year yet.'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Dominant Animal Type</p>
                <p className="text-sm text-muted-foreground">
                  {stats.topAnimalType !== 'N/A' ? stats.topAnimalType + ' is the most reported animal type in current records.' : 'No animal type distribution is available yet.'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Most Affected Age Group</p>
                <p className="text-sm text-muted-foreground">
                  {hasIncidentData ? topAgeGroup.group + ' has the highest count with ' + topAgeGroup.cases + ' case(s).' : 'No age group trend is available yet.'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">High-Risk Areas</p>
                <p className="text-sm text-muted-foreground">
                  {stats.highRiskBarangays > 0 ? stats.highRiskBarangays + ' barangay(s) reached the high-risk threshold this year.' : 'No barangay has reached the high-risk threshold this year.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
