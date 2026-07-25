import { useState, useEffect, useRef } from 'react';
import { X, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Select } from '../UI/Select';
import { incidentsAPI, patientsAPI, barangaysAPI } from '../../../lib/services/api';

const DIGOS_BARANGAY_COORDINATES: Record<string, { location_lat: number; location_lng: number }> = {
  Aplaya: { location_lat: 6.7600, location_lng: 125.3425 },
  Balabag: { location_lat: 6.7400, location_lng: 125.3575 },
  Binaton: { location_lat: 6.8300, location_lng: 125.3700 },
  Cogon: { location_lat: 6.7650, location_lng: 125.3875 },
  Colorado: { location_lat: 6.7560, location_lng: 125.3150 },
  Dawis: { location_lat: 6.7600, location_lng: 125.3725 },
  Dulangan: { location_lat: 6.8100, location_lng: 125.3600 },
  Goma: { location_lat: 6.7400, location_lng: 125.3200 },
  Igpit: { location_lat: 6.7240, location_lng: 125.3480 },
  Kapatagan: { location_lat: 6.8050, location_lng: 125.3300 },
  Kiagot: { location_lat: 6.7830, location_lng: 125.3910 },
  Lungag: { location_lat: 6.6700, location_lng: 125.3000 },
  Mahayahay: { location_lat: 6.7400, location_lng: 125.3425 },
  Matti: { location_lat: 6.7560, location_lng: 125.3340 },
  Ruparan: { location_lat: 6.7800, location_lng: 125.3500 },
  'San Agustin': { location_lat: 6.7650, location_lng: 125.3500 },
  'San Jose': { location_lat: 6.7600, location_lng: 125.3575 },
  'San Miguel': { location_lat: 6.7330, location_lng: 125.3580 },
  'San Roque': { location_lat: 6.7550, location_lng: 125.3250 },
  Sinawilan: { location_lat: 6.7750, location_lng: 125.4100 },
  Soong: { location_lat: 6.7000, location_lng: 125.3200 },
  Tiguman: { location_lat: 6.7400, location_lng: 125.3725 },
  'Tres De Mayo': { location_lat: 6.7610, location_lng: 125.3660 },
  'Zone 1': { location_lat: 6.7500, location_lng: 125.3525 },
  'Zone 2': { location_lat: 6.7500, location_lng: 125.3675 },
  'Zone 3': { location_lat: 6.7480, location_lng: 125.3800 },
};

interface IncidentFormModalProps {
  incident?: any;
  onClose: (shouldReload?: boolean) => void;
}

export function IncidentFormModal({ incident, onClose }: IncidentFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [barangays, setBarangays] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    patient_name: incident?.patient?.full_name || '',
    age: incident?.patient?.age ?? '',
    sex: incident?.patient?.sex || 'Male',
    contact_number: incident?.contact_number || incident?.patient?.contact_number || '',
    incident_date: incident?.incident_date || new Date().toISOString().split('T')[0],
    animal_type: incident?.animal_type || 'Dog',
    bite_location: incident?.bite_location || '',
    who_category: incident?.who_category || 'Category II',
    status: incident?.status || 'Active',
    barangay_id: incident?.barangay_id || '',
    provoked: incident?.provoked || false,
    notes: incident?.notes || '',
  });

  useEffect(() => {
    loadData();
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClickOutside = (e: MouseEvent) => {
    if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
      setShowSuggestions(false);
    }
  };

  const loadData = async () => {
    try {
      const [patientsRes, barangaysRes] = await Promise.all([
        patientsAPI.getAll({ per_page: 50 }),
        barangaysAPI.getAll(),
      ]);
      if (patientsRes.success) setPatients(patientsRes.data);
      if (barangaysRes.success) setBarangays(barangaysRes.data);
    } catch {
      toast.error('Failed to load form data');
    }
  };

  const handlePatientNameChange = (value: string) => {
    setFormData(prev => ({ ...prev, patient_name: value }));
    if (value.trim().length >= 2) {
      const matches = patients.filter(p =>
        p.full_name.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(matches.slice(0, 5));
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (patient: any) => {
    setFormData(prev => ({
      ...prev,
      patient_name: patient.full_name,
      age: patient.age ?? prev.age,
      sex: patient.sex || prev.sex,
      contact_number: prev.contact_number || patient.contact_number || '',
    }));
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patient_name.trim()) {
      toast.error('Patient name is required');
      return;
    }
    if (String(formData.age).trim() === '') {
      toast.error('Patient age is required');
      return;
    }
    if (!formData.sex) {
      toast.error('Patient sex is required');
      return;
    }
    setLoading(true);
    try {
      const selectedCoordinates = getSelectedBarangayCoordinates();
      const payload = selectedCoordinates
        ? { ...formData, ...selectedCoordinates }
        : formData;

      if (incident) {
        await incidentsAPI.update(incident.id, payload);
        toast.success('Incident updated successfully');
      } else {
        await incidentsAPI.create(payload);
        toast.success('Incident created successfully');
      }
      onClose(true);
    } catch {
      toast.error(incident ? 'Failed to update incident' : 'Failed to create incident');
    } finally {
      setLoading(false);
    }
  };

  const sexOptions = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
  ];

  const animalOptions = [
    { value: 'Dog', label: 'Dog' },
    { value: 'Cat', label: 'Cat' },
    { value: 'Rat', label: 'Rat' },
    { value: 'Other', label: 'Other' },
  ];

  const categoryOptions = [
    { value: 'Category I',   label: 'Category I — Touching/licks on intact skin' },
    { value: 'Category II',  label: 'Category II — Minor scratches, no bleeding' },
    { value: 'Category III', label: 'Category III — Bites, broken skin' },
  ];

  const statusOptions = [
    { value: 'Active',    label: 'Active' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Pending',   label: 'Pending' },
  ];

  const barangayOptions = barangays.map(b => ({ value: b.id, label: b.name }));

  const getSelectedBarangayCoordinates = () => {
    const selectedBarangay = barangays.find(b => String(b.id) === String(formData.barangay_id));

    if (!selectedBarangay) return null;

    if (selectedBarangay.latitude && selectedBarangay.longitude) {
      return {
        location_lat: Number(selectedBarangay.latitude),
        location_lng: Number(selectedBarangay.longitude),
      };
    }

    return DIGOS_BARANGAY_COORDINATES[selectedBarangay.name] || null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {incident ? 'Edit Incident' : 'New Incident Report'}
          </h2>
          <button onClick={() => onClose(false)} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">

            {/* ── Patient Information ─────────────────────────────────── */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Patient Information
              </h3>
              <div className="space-y-4">

                {/* Patient name — free-text with autocomplete */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Patient Name <span className="text-destructive">*</span>
                  </label>
                  <div className="relative" ref={suggestionsRef}>
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Type patient's full name"
                      value={formData.patient_name}
                      onChange={e => handlePatientNameChange(e.target.value)}
                      onFocus={() => formData.patient_name.length >= 2 && setShowSuggestions(suggestions.length > 0)}
                      required
                      autoComplete="off"
                      className="w-full pl-9 pr-4 py-2.5 bg-input-background border border-input rounded-lg text-sm
                        text-foreground placeholder:text-muted-foreground/50
                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                    {/* Autocomplete dropdown */}
                    {showSuggestions && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 overflow-hidden">
                        {suggestions.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => selectSuggestion(p)}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                          >
                            <span className="font-medium text-foreground">{p.full_name}</span>
                            <span className="text-xs text-muted-foreground">{p.contact_number || 'No contact'}</span>
                          </button>
                        ))}
                        <div className="px-4 py-2 border-t border-border bg-muted/30">
                          <p className="text-[11px] text-muted-foreground">Select to auto-fill or keep typing a new name</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Age"
                    type="number"
                    min="0"
                    max="130"
                    placeholder="Enter age"
                    value={formData.age}
                    onChange={e => setFormData({ ...formData, age: e.target.value })}
                    required
                  />
                  <Select
                    label="Sex"
                    options={sexOptions}
                    value={formData.sex}
                    onChange={e => setFormData({ ...formData, sex: e.target.value })}
                    required
                  />
                </div>

                {/* Contact number */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Contact Number <span className="text-xs text-muted-foreground font-normal">(for PEP SMS reminders)</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="tel"
                      placeholder="e.g. 09171234567"
                      value={formData.contact_number}
                      onChange={e => setFormData({ ...formData, contact_number: e.target.value })}
                      className="w-full pl-9 pr-4 py-2.5 bg-input-background border border-input rounded-lg text-sm
                        text-foreground placeholder:text-muted-foreground/50
                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Incident Details ────────────────────────────────────── */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Incident Details
              </h3>
              <div className="space-y-4">
                <Input
                  label="Incident Date"
                  type="date"
                  value={formData.incident_date}
                  onChange={e => setFormData({ ...formData, incident_date: e.target.value })}
                  required
                />

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Animal Type"
                    options={animalOptions}
                    value={formData.animal_type}
                    onChange={e => setFormData({ ...formData, animal_type: e.target.value })}
                  />
                  <Input
                    label="Bite Location"
                    placeholder="e.g. Left arm, Right leg"
                    value={formData.bite_location}
                    onChange={e => setFormData({ ...formData, bite_location: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="WHO Category"
                    options={categoryOptions}
                    value={formData.who_category}
                    onChange={e => setFormData({ ...formData, who_category: e.target.value })}
                  />
                  <Select
                    label="Status"
                    options={statusOptions}
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                  />
                </div>

                <Select
                  label="Barangay"
                  options={barangayOptions}
                  value={formData.barangay_id}
                  onChange={e => setFormData({ ...formData, barangay_id: e.target.value })}
                  required
                />

                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="provoked"
                    checked={formData.provoked}
                    onChange={e => setFormData({ ...formData, provoked: e.target.checked })}
                    className="w-4 h-4 rounded border-input accent-primary"
                  />
                  <label htmlFor="provoked" className="text-sm text-foreground cursor-pointer">
                    Provoked attack
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Notes (Optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-input-background border border-input rounded-lg text-sm
                      focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors
                      min-h-[90px] resize-none"
                    placeholder="Additional notes about the incident..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-muted/20">
            <Button type="button" variant="outline" onClick={() => onClose(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Saving…' : incident ? 'Update Incident' : 'Create Incident'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
