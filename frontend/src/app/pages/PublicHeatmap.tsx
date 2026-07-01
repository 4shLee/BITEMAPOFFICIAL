import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, MapPin, AlertCircle } from 'lucide-react';
import { Badge } from '../components/UI/Badge';

export function PublicHeatmap() {
  const [selectedBarangay, setSelectedBarangay] = useState<string | null>('Aplaya');

  const barangayData = [
    { name: 'Aplaya', incidents: 23, color: '#D85A30', riskLevel: 'High', population: 12500 },
    { name: 'San Jose', incidents: 18, color: '#BA7517', riskLevel: 'Medium', population: 10200 },
    { name: 'Dawis', incidents: 12, color: '#BA7517', riskLevel: 'Medium', population: 8900 },
    { name: 'Zone 1', incidents: 8, color: '#5DCAA5', riskLevel: 'Low', population: 5600 },
    { name: 'Zone 2', incidents: 5, color: '#5DCAA5', riskLevel: 'Low', population: 4800 },
    { name: 'Mahayahay', incidents: 15, color: '#BA7517', riskLevel: 'Medium', population: 9300 },
    { name: 'Balabag', incidents: 7, color: '#5DCAA5', riskLevel: 'Low', population: 6200 },
    { name: 'Tiguman', incidents: 10, color: '#5DCAA5', riskLevel: 'Low', population: 7100 },
  ];

  const selectedData = barangayData.find(b => b.name === selectedBarangay);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/public"
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Incident Heatmap</h1>
                <p className="text-xs text-muted-foreground">Digos City Animal Bite Incidents - 2026</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-warning-bg border border-warning/20 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-warning mb-1">Public Information Notice</p>
              <p className="text-sm text-warning">
                This map shows aggregate incident data for public awareness. Individual patient information is protected and not displayed.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-base font-medium text-foreground">Barangay Incident Density Map</h2>
                <p className="text-sm text-muted-foreground mt-1">Click on a barangay to view detailed statistics</p>
              </div>

              <div className="h-[600px] bg-muted flex items-center justify-center relative p-8">
                <MapPin className="w-16 h-16 text-muted-foreground absolute" />
                <p className="text-sm text-muted-foreground absolute top-4 left-4">Interactive Digos City Map</p>

                <div className="absolute inset-8 grid grid-cols-4 gap-2">
                  {barangayData.map((barangay) => (
                    <button
                      key={barangay.name}
                      onClick={() => setSelectedBarangay(barangay.name)}
                      className={`rounded-lg transition-all flex flex-col items-center justify-center text-white font-medium text-sm hover:opacity-90 p-4 ${
                        selectedBarangay === barangay.name ? 'ring-4 ring-primary ring-offset-2' : ''
                      }`}
                      style={{ backgroundColor: barangay.color }}
                    >
                      <span className="mb-1">{barangay.name}</span>
                      <span className="text-xs opacity-90">{barangay.incidents} cases</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-border">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#5DCAA5]"></div>
                    <span className="text-xs text-muted-foreground">Low Risk (0-10 cases)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#BA7517]"></div>
                    <span className="text-xs text-muted-foreground">Medium Risk (11-20 cases)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#D85A30]"></div>
                    <span className="text-xs text-muted-foreground">High Risk (21+ cases)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {selectedData && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-lg font-semibold text-foreground mb-1">{selectedData.name}</h2>
                <p className="text-sm text-muted-foreground mb-4">Barangay Statistics</p>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-3xl font-semibold text-foreground">{selectedData.incidents}</span>
                      <span className="text-sm text-muted-foreground">cases</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Total incidents in 2026</p>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Risk Level</p>
                    <Badge variant={
                      selectedData.riskLevel === 'High' ? 'danger' :
                      selectedData.riskLevel === 'Medium' ? 'warning' : 'success'
                    }>
                      {selectedData.riskLevel} Risk
                    </Badge>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Population</p>
                    <p className="text-sm font-medium text-foreground">{selectedData.population.toLocaleString()} residents</p>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Incident Rate</p>
                    <p className="text-sm font-medium text-foreground">
                      {((selectedData.incidents / selectedData.population) * 1000).toFixed(2)} per 1,000 residents
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-primary-bg border border-primary/20 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-primary mb-3">Prevention Tips</h3>
                <ul className="text-sm text-primary space-y-2">
                  <li>• Avoid approaching stray animals</li>
                  <li>• Keep pets vaccinated</li>
                  <li>• Report aggressive animals to authorities</li>
                  <li>• Teach children animal safety</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-xs text-muted-foreground mb-2">Total Cases (City-wide)</p>
            <p className="text-2xl font-semibold text-foreground">98</p>
            <p className="text-xs text-muted-foreground mt-1">Year to date</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-xs text-muted-foreground mb-2">Most Common Animal</p>
            <p className="text-2xl font-semibold text-foreground">Dog</p>
            <p className="text-xs text-muted-foreground mt-1">85% of cases</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-xs text-muted-foreground mb-2">Peak Month</p>
            <p className="text-2xl font-semibold text-foreground">April</p>
            <p className="text-xs text-muted-foreground mt-1">28 incidents</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-xs text-muted-foreground mb-2">Vaccination Coverage</p>
            <p className="text-2xl font-semibold text-success">76.5%</p>
            <p className="text-xs text-muted-foreground mt-1">Completed PEP</p>
          </div>
        </div>
      </main>
    </div>
  );
}
