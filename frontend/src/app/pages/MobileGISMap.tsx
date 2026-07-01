import { useState } from 'react';
import { ChevronDown, Filter, MapPin, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { Badge } from '../components/UI/Badge';
import { BottomSheet } from '../components/UI/BottomSheet';

interface BarangayData {
  name: string;
  incidents: number;
  color: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  population: number;
  topAnimal: string;
  casesLastMonth: number;
  trend: 'up' | 'down';
}

export function MobileGISMap() {
  const [selectedBarangay, setSelectedBarangay] = useState<BarangayData | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState('2026-ytd');
  const [animalType, setAnimalType] = useState('all');

  const barangayData: BarangayData[] = [
    { name: 'Aplaya', incidents: 23, color: '#D85A30', riskLevel: 'High', population: 12500, topAnimal: 'Dog', casesLastMonth: 5, trend: 'up' },
    { name: 'San Jose', incidents: 18, color: '#BA7517', riskLevel: 'Medium', population: 10200, topAnimal: 'Dog', casesLastMonth: 3, trend: 'down' },
    { name: 'Dawis', incidents: 12, color: '#BA7517', riskLevel: 'Medium', population: 8900, topAnimal: 'Cat', casesLastMonth: 2, trend: 'down' },
    { name: 'Zone 1', incidents: 8, color: '#5DCAA5', riskLevel: 'Low', population: 5600, topAnimal: 'Dog', casesLastMonth: 1, trend: 'down' },
    { name: 'Zone 2', incidents: 5, color: '#5DCAA5', riskLevel: 'Low', population: 4800, topAnimal: 'Dog', casesLastMonth: 1, trend: 'down' },
    { name: 'Mahayahay', incidents: 15, color: '#BA7517', riskLevel: 'Medium', population: 9300, topAnimal: 'Dog', casesLastMonth: 4, trend: 'up' },
    { name: 'Balabag', incidents: 7, color: '#5DCAA5', riskLevel: 'Low', population: 6200, topAnimal: 'Cat', casesLastMonth: 1, trend: 'down' },
    { name: 'Tiguman', incidents: 10, color: '#5DCAA5', riskLevel: 'Low', population: 7100, topAnimal: 'Dog', casesLastMonth: 2, trend: 'down' },
  ];

  const handleBarangayClick = (barangay: BarangayData) => {
    setSelectedBarangay(barangay);
  };

  const getRiskVariant = (level: string) => {
    switch (level) {
      case 'High': return 'danger';
      case 'Medium': return 'warning';
      case 'Low': return 'success';
      default: return 'neutral';
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Fixed Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Incident Heatmap</h1>
            <p className="text-xs text-muted-foreground">Digos City, 2026</p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <Filter className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Filter Bar */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-border space-y-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Period</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm"
              >
                <option value="2026-ytd">Year to Date 2026</option>
                <option value="2026-q1">Q1 2026</option>
                <option value="last-30">Last 30 Days</option>
                <option value="last-90">Last 90 Days</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Animal Type</label>
              <select
                value={animalType}
                onChange={(e) => setAnimalType(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm"
              >
                <option value="all">All Animals</option>
                <option value="dog">Dog</option>
                <option value="cat">Cat</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        )}
      </header>

      {/* Map Container */}
      <div className="flex-1 relative overflow-hidden">
        {/* Map Grid */}
        <div className="absolute inset-0 p-2 grid grid-cols-2 gap-1.5">
          {barangayData.map((barangay) => (
            <button
              key={barangay.name}
              onClick={() => handleBarangayClick(barangay)}
              className="rounded-lg shadow-sm flex flex-col items-center justify-center p-3 transition-all active:scale-95 relative overflow-hidden"
              style={{ backgroundColor: barangay.color }}
            >
              <span className="text-white font-semibold text-sm mb-1 drop-shadow-md">
                {barangay.name}
              </span>
              <span className="text-white text-xs opacity-90 drop-shadow">
                {barangay.incidents} cases
              </span>
              {barangay.trend === 'up' && (
                <div className="absolute top-1 right-1">
                  <TrendingUp className="w-3 h-3 text-white opacity-75" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Legend Card - Floating */}
        <div className="absolute top-3 left-3 bg-card border border-border rounded-xl shadow-lg p-3 max-w-[140px]">
          <p className="text-xs font-medium text-foreground mb-2">Risk Level</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#5DCAA5]"></div>
              <span className="text-xs text-muted-foreground">Low (0-10)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#BA7517]"></div>
              <span className="text-xs text-muted-foreground">Med (11-20)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#D85A30]"></div>
              <span className="text-xs text-muted-foreground">High (21+)</span>
            </div>
          </div>
        </div>

        {/* Stats Summary - Floating Bottom */}
        <div className="absolute bottom-3 left-3 right-3 bg-card border border-border rounded-xl shadow-lg p-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-foreground">98</p>
              <p className="text-xs text-muted-foreground">Total Cases</p>
            </div>
            <div>
              <p className="text-lg font-bold text-warning">3</p>
              <p className="text-xs text-muted-foreground">High Risk</p>
            </div>
            <div>
              <p className="text-lg font-bold text-success">76%</p>
              <p className="text-xs text-muted-foreground">Vaccinated</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sheet for Barangay Details */}
      <BottomSheet
        isOpen={selectedBarangay !== null}
        onClose={() => setSelectedBarangay(null)}
        title={selectedBarangay?.name}
      >
        {selectedBarangay && (
          <div className="space-y-4 pb-6">
            {/* Risk Badge */}
            <div className="flex items-center gap-3">
              <Badge variant={getRiskVariant(selectedBarangay.riskLevel)} size="md">
                {selectedBarangay.riskLevel} Risk
              </Badge>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{selectedBarangay.population.toLocaleString()} residents</span>
              </div>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <p className="text-xs text-muted-foreground">Total Cases</p>
                </div>
                <p className="text-2xl font-bold text-foreground">{selectedBarangay.incidents}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {((selectedBarangay.incidents / selectedBarangay.population) * 1000).toFixed(1)} per 1K
                </p>
              </div>

              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  <p className="text-xs text-muted-foreground">Last Month</p>
                </div>
                <p className="text-2xl font-bold text-foreground">{selectedBarangay.casesLastMonth}</p>
                <p className={`text-xs mt-1 ${selectedBarangay.trend === 'up' ? 'text-destructive' : 'text-success'}`}>
                  {selectedBarangay.trend === 'up' ? '↑ Increasing' : '↓ Decreasing'}
                </p>
              </div>
            </div>

            {/* Animal Breakdown */}
            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground mb-3">Most Common Animal</p>
              <div className="bg-accent-bg rounded-lg p-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{selectedBarangay.topAnimal}</p>
                  <p className="text-xs text-muted-foreground">85% of incidents</p>
                </div>
              </div>
            </div>

            {/* Demographics */}
            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground mb-3">Age Distribution</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">0-17 years</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: '35%' }}></div>
                    </div>
                    <span className="text-sm font-medium text-foreground w-8 text-right">35%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">18-59 years</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: '52%' }}></div>
                    </div>
                    <span className="text-sm font-medium text-foreground w-8 text-right">52%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">60+ years</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: '13%' }}></div>
                    </div>
                    <span className="text-sm font-medium text-foreground w-8 text-right">13%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Prevention Tips */}
            <div className="border-t border-border pt-4">
              <div className="bg-warning-bg border border-warning/20 rounded-lg p-4">
                <p className="text-sm font-medium text-warning mb-2">Prevention Tips for {selectedBarangay.name}</p>
                <ul className="text-xs text-warning space-y-1">
                  <li>• Report stray {selectedBarangay.topAnimal.toLowerCase()}s to barangay officials</li>
                  <li>• Keep pets vaccinated and leashed</li>
                  <li>• Teach children not to approach unfamiliar animals</li>
                  <li>• Seek immediate medical attention if bitten</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
