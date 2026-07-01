import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Select } from '../UI/Select';
import { animalsAPI, barangaysAPI } from '../../../lib/services/api';

interface AnimalFormModalProps {
  animal?: any;
  onClose: (shouldReload?: boolean) => void;
}

export function AnimalFormModal({ animal, onClose }: AnimalFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [barangays, setBarangays] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    animal_type: animal?.animal_type || 'Dog',
    breed: animal?.breed || '',
    owner_name: animal?.owner_name || '',
    owner_contact: animal?.owner_contact || '',
    barangay_id: animal?.barangay_id || '',
    vaccination_status: animal?.vaccination_status || 'Not Vaccinated',
    vaccination_date: animal?.vaccination_date || '',
    next_vaccination_date: animal?.next_vaccination_date || '',
    notes: animal?.notes || ''
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
      if (animal) {
        await animalsAPI.update(animal.id, formData);
        toast.success('Animal updated successfully');
      } else {
        await animalsAPI.create(formData);
        toast.success('Animal registered successfully');
      }
      onClose(true);
    } catch (error) {
      toast.error(animal ? 'Failed to update animal' : 'Failed to register animal');
    } finally {
      setLoading(false);
    }
  };

  const animalTypeOptions = [
    { value: 'Dog', label: 'Dog' },
    { value: 'Cat', label: 'Cat' },
    { value: 'Other', label: 'Other' }
  ];

  const vaccinationStatusOptions = [
    { value: 'Vaccinated', label: 'Vaccinated' },
    { value: 'Not Vaccinated', label: 'Not Vaccinated' },
    { value: 'Overdue', label: 'Overdue' }
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
            {animal ? 'Edit Animal' : 'Register Animal'}
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
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Animal Type"
                options={animalTypeOptions}
                value={formData.animal_type}
                onChange={(e) => setFormData({ ...formData, animal_type: e.target.value })}
              />

              <Input
                label="Breed"
                placeholder="Enter breed"
                value={formData.breed}
                onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
              />
            </div>

            <Input
              label="Owner Name"
              placeholder="Enter owner's full name"
              value={formData.owner_name}
              onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
              required
            />

            <Input
              label="Owner Contact Number"
              type="tel"
              placeholder="Enter contact number"
              value={formData.owner_contact}
              onChange={(e) => setFormData({ ...formData, owner_contact: e.target.value })}
              required
            />

            <Select
              label="Barangay"
              options={barangayOptions}
              value={formData.barangay_id}
              onChange={(e) => setFormData({ ...formData, barangay_id: e.target.value })}
              required
            />

            <Select
              label="Vaccination Status"
              options={vaccinationStatusOptions}
              value={formData.vaccination_status}
              onChange={(e) => setFormData({ ...formData, vaccination_status: e.target.value })}
            />

            {formData.vaccination_status === 'Vaccinated' && (
              <>
                <Input
                  label="Last Vaccination Date"
                  type="date"
                  value={formData.vaccination_date}
                  onChange={(e) => setFormData({ ...formData, vaccination_date: e.target.value })}
                />

                <Input
                  label="Next Vaccination Due Date"
                  type="date"
                  value={formData.next_vaccination_date}
                  onChange={(e) => setFormData({ ...formData, next_vaccination_date: e.target.value })}
                />
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-foreground mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm min-h-[80px]"
                placeholder="Additional notes..."
              />
            </div>
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
              {loading ? 'Saving...' : animal ? 'Update Animal' : 'Register Animal'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
