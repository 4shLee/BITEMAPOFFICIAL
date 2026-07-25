import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Select } from '../UI/Select';
import { inventoryAPI } from '../../../lib/services/api';

interface InventoryFormModalProps {
  item?: {
    id: number | string;
    item_name?: string | null;
    item_type?: string | null;
    current_stock?: number | string | null;
    reorder_level?: number | string | null;
    unit?: string | null;
    description?: string | null;
  };
  onClose: (shouldReload?: boolean) => void;
}

export function InventoryFormModal({ item, onClose }: InventoryFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    item_name: item?.item_name || '',
    item_type: item?.item_type || 'Vaccine',
    current_stock: item?.current_stock || '',
    reorder_level: item?.reorder_level || '',
    unit: item?.unit || 'Vials',
    description: item?.description || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (item) {
        await inventoryAPI.update(String(item.id), formData);
        toast.success('Inventory item updated successfully');
      } else {
        await inventoryAPI.create(formData);
        toast.success('Inventory item added successfully');
      }
      onClose(true);
    } catch {
      toast.error(item ? 'Failed to update item' : 'Failed to create item');
    } finally {
      setLoading(false);
    }
  };

  const itemTypeOptions = [
    { value: 'Vaccine', label: 'Vaccine' },
    { value: 'Immunoglobulin', label: 'Immunoglobulin' },
    { value: 'Medicine', label: 'Medicine' },
    { value: 'Supply', label: 'Supply' },
    { value: 'Other', label: 'Other' }
  ];

  const unitOptions = [
    { value: 'Vials', label: 'Vials' },
    { value: 'Doses', label: 'Doses' },
    { value: 'Ampoules', label: 'Ampoules' },
    { value: 'Pieces', label: 'Pieces' },
    { value: 'Boxes', label: 'Boxes' },
    { value: 'Kits', label: 'Kits' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">
              {item ? 'Edit Inventory Item' : 'Add Inventory Item'}
            </h2>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              {item ? 'Update the master item details and reorder level.' : 'Create the master inventory item. Use Add Batch/Restock for lot-level stock.'}
            </p>
          </div>
          <button
            onClick={() => onClose(false)}
            className="rounded-full p-1.5 transition-colors hover:bg-muted"
            aria-label="Close inventory item modal"
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
              helperText="Example: Anti-rabies Vaccine, Rabies Immunoglobulin, Sterile Syringe"
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
                label={item ? 'Current Stock' : 'Initial Stock'}
                type="number"
                placeholder={item ? 'Enter current stock' : 'Enter initial stock, or 0 if no stock yet'}
                value={formData.current_stock}
                onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
                helperText={!item ? 'Use 0 if stock will be added later through Add Batch/Restock.' : undefined}
                required
                min="0"
              />

              <Input
                label="Reorder Level"
                type="number"
                placeholder="Enter reorder level"
                value={formData.reorder_level}
                onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                helperText="Alert when stock is at or below this level."
                required
                min="0"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[80px] w-full rounded-xl border border-input bg-input-background px-3 py-2 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
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
