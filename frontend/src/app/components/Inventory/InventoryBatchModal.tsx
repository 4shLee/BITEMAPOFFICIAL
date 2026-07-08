import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Select } from '../UI/Select';
import { Badge } from '../UI/Badge';
import { inventoryAPI } from '../../../lib/services/api';

type InventoryBatchModalProps = {
  mode: 'add' | 'view';
  item?: any;
  inventoryItems?: any[];
  onClose: (shouldReload?: boolean) => void;
};

function statusVariant(status: string) {
  switch (status) {
    case 'Active': return 'success' as const;
    case 'Expiring Soon': return 'warning' as const;
    case 'Expired': return 'danger' as const;
    case 'Depleted': return 'neutral' as const;
    default: return 'neutral' as const;
  }
}

export function InventoryBatchModal({ mode, item, inventoryItems = [], onClose }: InventoryBatchModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(item?.id ? String(item.id) : String(inventoryItems[0]?.id || ''));
  const selectedItem = item || inventoryItems.find((inventoryItem) => String(inventoryItem.id) === selectedItemId);
  const [formData, setFormData] = useState({
    batch_number: '',
    quantity_received: '',
    expiry_date: '',
    received_date: new Date().toISOString().split('T')[0],
    supplier: '',
    notes: '',
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedItem) return;

    const quantity = Number(formData.quantity_received);
    if (!quantity || quantity <= 0) {
      toast.error('Quantity received must be greater than zero.');
      return;
    }

    if (new Date(formData.received_date) > new Date()) {
      toast.error('Date received cannot be in the future.');
      return;
    }

    try {
      setLoading(true);
      await inventoryAPI.addBatch(String(selectedItem.id), {
        ...formData,
        quantity_received: quantity,
      });
      toast.success('Inventory batch added successfully.');
      onClose(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add inventory batch.');
    } finally {
      setLoading(false);
    }
  };

  const itemOptions = inventoryItems.map((inventoryItem) => ({
    value: String(inventoryItem.id),
    label: inventoryItem.item_name,
  }));
  const batches = selectedItem?.batches || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">{mode === 'add' ? 'Add Batch / Restock' : 'Inventory Batches'}</h2>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              {mode === 'add' ? 'Record stock received for a specific lot or batch.' : selectedItem?.item_name}
            </p>
          </div>
          <button type="button" onClick={() => onClose(false)} className="rounded-full p-1.5 transition-colors hover:bg-muted" aria-label="Close batch modal">
            <X className="h-5 w-5" />
          </button>
        </div>

        {mode === 'add' ? (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="space-y-4 p-6">
              {!item && (
                <Select
                  label="Inventory Item"
                  options={itemOptions}
                  value={selectedItemId}
                  onChange={(event) => setSelectedItemId(event.target.value)}
                  required
                />
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Batch / Lot Number" value={formData.batch_number} onChange={(event) => setFormData({ ...formData, batch_number: event.target.value })} placeholder="ARV-2026-001" required />
                <Input label="Quantity Received" type="number" min="1" value={formData.quantity_received} onChange={(event) => setFormData({ ...formData, quantity_received: event.target.value })} required />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Input label="Unit" value={selectedItem?.unit || ''} readOnly />
                <Input label="Expiry Date" type="date" value={formData.expiry_date} onChange={(event) => setFormData({ ...formData, expiry_date: event.target.value })} required />
                <Input label="Date Received" type="date" max={new Date().toISOString().split('T')[0]} value={formData.received_date} onChange={(event) => setFormData({ ...formData, received_date: event.target.value })} required />
              </div>

              <Input label="Supplier / Source" value={formData.supplier} onChange={(event) => setFormData({ ...formData, supplier: event.target.value })} placeholder="Optional supplier or source" />

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                  className="min-h-[80px] w-full rounded-xl border border-input bg-input-background px-3 py-2 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Optional receiving notes"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <Button type="button" variant="outline" onClick={() => onClose(false)} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Add Batch'}</Button>
            </div>
          </form>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            {batches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
                No batches recorded for this item yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/60 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 text-left">Batch/Lot</th>
                      <th className="px-4 py-3 text-left">Remaining</th>
                      <th className="px-4 py-3 text-left">Received</th>
                      <th className="px-4 py-3 text-left">Expiry</th>
                      <th className="px-4 py-3 text-left">Received Date</th>
                      <th className="px-4 py-3 text-left">Supplier</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {batches.map((batch: any) => (
                      <tr key={batch.id} className="text-sm">
                        <td className="px-4 py-3 font-semibold text-foreground">{batch.batch_number}</td>
                        <td className="px-4 py-3 text-muted-foreground">{batch.quantity_remaining} {selectedItem?.unit}</td>
                        <td className="px-4 py-3 text-muted-foreground">{batch.quantity_received} {selectedItem?.unit}</td>
                        <td className="px-4 py-3 text-muted-foreground">{batch.expiry_date || '-'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{batch.received_date || '-'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{batch.supplier || '-'}</td>
                        <td className="px-4 py-3"><Badge variant={statusVariant(batch.status)}>{batch.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
