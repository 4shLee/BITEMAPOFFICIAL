import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Select } from '../UI/Select';
import { patientsAPI, barangaysAPI } from '../../../lib/services/api';

interface PatientFormModalProps {
  patient?: any;
  onClose: (shouldReload?: boolean) => void;
}

export function PatientFormModal({ patient, onClose }: PatientFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [barangays, setBarangays] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    full_name: patient?.full_name || '',
    age: patient?.age || '',
    sex: patient?.sex || 'Male',
    contact_number: patient?.contact_number || '',
    address: patient?.address || '',
    barangay_id: patient?.barangay_id || '',
    email: patient?.email || ''
  });

  useEffect(() => {
    loadBarangays();
  }, []);

  const loadBarangays = async () => {
    try {
      const response = await barangaysAPI.getAll();
      if (response.success) {
        setBarangays(response.data);
      }
    } catch (error) {
      toast.error('Failed to load barangays');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (patient) {
        await patientsAPI.update(patient.id, formData);
        toast.success('Patient updated successfully');
      } else {
        await patientsAPI.create(formData);
        toast.success('Patient created successfully');
      }
      onClose(true);
    } catch (error) {
      toast.error(patient ? 'Failed to update patient' : 'Failed to create patient');
    } finally {
      setLoading(false);
    }
  };

  const sexOptions = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' }
  ];

  const barangayOptions = barangays.map(b => ({
    value: b.id,
    label: b.name
  }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {patient ? 'Edit Patient' : 'New Patient'}
          </h2>
          <button
            onClick={() => onClose(false)}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            <Input
              label="Full Name"
              placeholder="Enter patient's full name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <Input
              label="Contact Number"
              type="tel"
              placeholder="Enter contact number"
              value={formData.contact_number}
              onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
              required
            />

            <Input
              label="Email (Optional)"
              type="email"
              placeholder="Enter email address"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />

            <Input
              label="Address"
              placeholder="Enter complete address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />

            <Select
              label="Barangay"
              options={barangayOptions}
              value={formData.barangay_id}
              onChange={(e) => setFormData({ ...formData, barangay_id: e.target.value })}
              required
            />
          </div>

          <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Saving...' : patient ? 'Update Patient' : 'Create Patient'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
