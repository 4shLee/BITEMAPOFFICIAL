import { useState } from 'react';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Button } from '../components/UI/Button';
import { MapPin } from 'lucide-react';

export function IncidentReport() {
  const [formData, setFormData] = useState({
    patientName: '',
    age: '',
    sex: 'Male',
    address: '',
    contact: '',
    incidentDate: '',
    incidentTime: '',
    animalType: 'Dog',
    biteSite: '',
    whoCategory: 'I',
    barangay: 'Aplaya'
  });

  const sexOptions = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' }
  ];

  const animalOptions = [
    { value: 'Dog', label: 'Dog' },
    { value: 'Cat', label: 'Cat' },
    { value: 'Other', label: 'Other' }
  ];

  const barangayOptions = [
    { value: 'Aplaya', label: 'Aplaya' },
    { value: 'San Jose', label: 'San Jose' },
    { value: 'Dawis', label: 'Dawis' },
    { value: 'Zone 1', label: 'Zone 1' },
    { value: 'Zone 2', label: 'Zone 2' },
    { value: 'Mahayahay', label: 'Mahayahay' },
    { value: 'Balabag', label: 'Balabag' },
    { value: 'Tiguman', label: 'Tiguman' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting incident report:', formData);
  };

  return (
    <div className="flex-1">
      <Header title="New Incident Report" breadcrumbs={['Incidents', 'New Report']} />

      <div className="p-8">
        <form onSubmit={handleSubmit} className="max-w-4xl">
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <h2 className="text-base font-medium text-foreground mb-4">Section 1: Patient Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Full Name"
                  placeholder="Enter patient's full name"
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  required
                />
              </div>
              <Input
                label="Age"
                type="number"
                placeholder="Enter age"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                required
              />
              <Select
                label="Sex"
                options={sexOptions}
                value={formData.sex}
                onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
              />
              <div className="md:col-span-2">
                <Input
                  label="Address"
                  placeholder="Enter complete address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>
              <Input
                label="Contact Number"
                type="tel"
                placeholder="Enter contact number"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <h2 className="text-base font-medium text-foreground mb-4">Section 2: Bite Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Date of Incident"
                type="date"
                value={formData.incidentDate}
                onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
                required
              />
              <Input
                label="Time of Incident"
                type="time"
                value={formData.incidentTime}
                onChange={(e) => setFormData({ ...formData, incidentTime: e.target.value })}
                required
              />
              <Select
                label="Animal Type"
                options={animalOptions}
                value={formData.animalType}
                onChange={(e) => setFormData({ ...formData, animalType: e.target.value })}
              />
              <Input
                label="Bite Site"
                placeholder="e.g., Left arm, Right leg"
                value={formData.biteSite}
                onChange={(e) => setFormData({ ...formData, biteSite: e.target.value })}
                required
              />
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-foreground mb-2">
                  WHO Wound Category
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { value: 'I', label: 'Category I', desc: 'Touching/feeding animals, licks on intact skin' },
                    { value: 'II', label: 'Category II', desc: 'Nibbling, minor scratches, abrasions without bleeding' },
                    { value: 'III', label: 'Category III', desc: 'Single/multiple bites, licks on broken skin, contamination' }
                  ].map((cat) => (
                    <label
                      key={cat.value}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        formData.whoCategory === cat.value
                          ? 'border-primary bg-primary-bg'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="whoCategory"
                        value={cat.value}
                        checked={formData.whoCategory === cat.value}
                        onChange={(e) => setFormData({ ...formData, whoCategory: e.target.value })}
                        className="sr-only"
                      />
                      <div className="font-medium text-sm text-foreground mb-1">{cat.label}</div>
                      <div className="text-xs text-muted-foreground">{cat.desc}</div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <h2 className="text-base font-medium text-foreground mb-4">Section 3: Incident Location</h2>
            <Select
              label="Barangay"
              options={barangayOptions}
              value={formData.barangay}
              onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
            />
            <div className="mt-4 bg-muted rounded-lg h-64 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Click map to pin incident location</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" size="lg">
              Save Incident Report
            </Button>
            <Button type="button" variant="outline" size="lg">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
