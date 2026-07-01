import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Select } from '../UI/Select';
import { inventoryAPI } from '../../../lib/services/api';

interface InventoryFormModalProps {
  item?: any;
  onClose: (shouldReload?: boolean) => void;
}

export function InventoryFormModal({ item, onClose }: InventoryFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    item_name: item?.item_name || '',
    item_type: item?.item_type || 'Vaccine',
    current_stock: item?.current_stock || '',
    reorder_level: item?.reorder_level || '',
    unit: item?.unit || 'vials',
    description: item?.description || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (item) {
        await inventoryAPI.update(item.id, formData);
        toast.success('Inventory item updated successfully');
      } else {
        await inventoryAPI.create(formData);
        toast.success('Inventory item added successfully');
      }
      onClose(true);
    } catch (error) {
      toast.error(item ? 'Failed to update item' : 'Failed to create item');
    } finally {
      setLoading(false);
    }
  };

  const itemTypeOptions = [
    { value: 'Vaccine', label: 'Vaccine' },
    { value: 'Medication', label: 'Medication' },
    { value: 'Medical Supply', label: 'Medical Supply' },
    { value: 'Equipment', label: 'Equipment' }
  ];

  const unitOptions = [
    { value: 'vials', label: 'Vials' },
    { value: 'sets', label: 'Sets' },
    { value: 'pieces', label: 'Pieces' },
    { value: 'boxes', label: 'Boxes' },
    { value: 'bottles', label: 'Bottles' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {item ? 'Edit Inventory Item' : 'Add Inventory Item'}
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
              label="Item Name"
              placeholder="Enter item name"
              value={formData.item_name}
              onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Item Type"
                options={itemTypeOptions}
                value={formData.item_type}
                onChange={(e) => setFormData({ ...formData, item_type: e.target.value })}
              />

              <Select
                label="Unit"
                options={unitOptions}
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Current Stock"
                type="number"
                placeholder="Enter current stock"
                value={formData.current_stock}
                onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
                required
              />

              <Input
                label="Reorder Level"
                type="number"
                placeholder="Enter reorder level"
                value={formData.reorder_level}
                onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm min-h-[80px]"
                placeholder="Item description or notes..."
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
              {loading ? 'Saving...' : item ? 'Update Item' : 'Add Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
