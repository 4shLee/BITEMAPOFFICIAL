import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Map, BarChart3, MapPin, AlertCircle, Phone } from 'lucide-react';
import { StatCard } from '../components/UI/StatCard';
import { publicAPI } from '../../lib/services/api';

type PublicPortalStats = {
  year: number;
  totalCases: number;
  highRiskBarangays: number;
  vaccinationRate: number;
};

const defaultStats: PublicPortalStats = {
  year: new Date().getFullYear(),
  totalCases: 0,
  highRiskBarangays: 0,
  vaccinationRate: 0,
};

export function PublicPortal() {
  const [stats, setStats] = useState<PublicPortalStats>(defaultStats);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      try {
        const result = await publicAPI.getStatistics();

        if (!isMounted) return;

        if (result.success) {
          setStats({
            year: Number(result.year ?? defaultStats.year),
            totalCases: Number(result.totalCases ?? 0),
            highRiskBarangays: Number(result.highRiskBarangays ?? 0),
            vaccinationRate: Number(result.vaccinationRate ?? 0),
          });
          setStatsError('');
        }
      } catch (error) {
        console.error('Error loading public portal statistics:', error);
        if (isMounted) {
          setStatsError('Live public statistics are temporarily unavailable.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingStats(false);
        }
      }
    };

    loadStats();

    return () => {
      isMounted = false;
    };
  }, []);

  const totalCases = isLoadingStats ? '...' : stats.totalCases.toLocaleString();
  const highRiskBarangays = isLoadingStats ? '...' : stats.highRiskBarangays.toLocaleString();
  const vaccinationRate = isLoadingStats ? '...' : stats.vaccinationRate.toFixed(1) + '%';

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">BITEMAP Public Portal</h1>
                <p className="text-xs text-muted-foreground">Animal Bite Tracking - Digos City</p>
              </div>
            </div>
            <Link
              to="/login"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
            >
              Health Worker Login
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold text-foreground mb-3">
            Animal Bite Incident Tracking & Awareness
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stay informed about animal bite incidents in Digos City. View real-time statistics,
            incident heatmaps, and find vaccination clinic information.
          </p>
        </div>

        {statsError && (
          <div className="max-w-2xl mx-auto mb-6 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
            {statsError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <StatCard
            icon={AlertCircle}
            title={`Total Bite Cases (${stats.year})`}
            value={totalCases}
            iconBgColor="bg-primary-bg"
            iconColor="text-primary"
          />
          <StatCard
            icon={MapPin}
            title="High-Risk Barangays"
            value={highRiskBarangays}
            iconBgColor="bg-destructive-bg"
            iconColor="text-destructive"
          />
          <StatCard
            icon={BarChart3}
            title="Vaccination Rate"
            value={vaccinationRate}
            iconBgColor="bg-success-bg"
            iconColor="text-success"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          <Link
            to="/public/heatmap"
            className="bg-card border border-border rounded-xl p-8 hover:shadow-lg transition-shadow group"
          >
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-primary-bg rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                <Map className="w-8 h-8 text-primary group-hover:text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">View Incident Heatmap</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Interactive map showing animal bite incidents across Digos City barangays.
                  See which areas have higher incident rates.
                </p>
                <span className="text-sm text-primary font-medium group-hover:underline">
                  Explore Map -&gt;
                </span>
              </div>
            </div>
          </Link>

          <Link
            to="/public/statistics"
            className="bg-card border border-border rounded-xl p-8 hover:shadow-lg transition-shadow group"
          >
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-accent-bg rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-accent group-hover:text-white transition-colors">
                <BarChart3 className="w-8 h-8 text-accent group-hover:text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Statistics & Trends</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  View detailed statistics on animal bite incidents, vaccination rates,
                  and trends over time in your barangay.
                </p>
                <span className="text-sm text-accent font-medium group-hover:underline">
                  View Statistics -&gt;
                </span>
              </div>
            </div>
          </Link>

          <Link
            to="/public/clinics"
            className="bg-card border border-border rounded-xl p-8 hover:shadow-lg transition-shadow group"
          >
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-success-bg rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-success group-hover:text-white transition-colors">
                <MapPin className="w-8 h-8 text-success group-hover:text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Vaccination Clinics</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Find anti-rabies vaccination centers near you. View clinic locations,
                  operating hours, and contact information.
                </p>
                <span className="text-sm text-success font-medium group-hover:underline">
                  Find Clinics -&gt;
                </span>
              </div>
            </div>
          </Link>

          <div className="bg-warning-bg border border-warning/20 rounded-xl p-8">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-8 h-8 text-warning flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-warning mb-2">What to Do if Bitten</h3>
                <ul className="text-sm text-warning space-y-1">
                  <li>1. Wash the wound thoroughly with soap and water</li>
                  <li>2. Apply antiseptic or alcohol</li>
                  <li>3. Seek medical attention immediately</li>
                  <li>4. Get anti-rabies vaccination within 24 hours</li>
                  <li>5. Report the incident to your Barangay Health Worker</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-8">
          <div className="flex items-start gap-4 mb-6">
            <Phone className="w-6 h-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Emergency Contacts</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Digos City Health Office</p>
              <p className="text-sm text-muted-foreground">+63 82 553 1234</p>
              <p className="text-sm text-muted-foreground">health@digos.gov.ph</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Animal Bite Treatment Center</p>
              <p className="text-sm text-muted-foreground">+63 82 553 5678</p>
              <p className="text-sm text-muted-foreground">Mon-Sat: 8:00 AM - 5:00 PM</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Emergency Hotline</p>
              <p className="text-sm text-muted-foreground">911 or +63 82 553 9999</p>
              <p className="text-sm text-muted-foreground">24/7 Emergency Response</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">Copyright 2026 Digos City Health Office - Cor Jesu College</p>
            <p>Department of Health - Philippines | Republic Act 9482: Anti-Rabies Act of 2007</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
