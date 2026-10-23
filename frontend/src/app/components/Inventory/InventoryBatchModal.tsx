import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { getErrorMessage, inventoryAPI } from '../../../lib/services/api';

type InventoryBatch = {
  id: number | string;
  batch_number?: string | null;
  quantity_remaining?: number | string | null;
  quantity_received?: number | string | null;
  expiry_date?: string | null;
  received_date?: string | null;
  supplier?: string | null;
  status?: string | null;
};

type BatchInventoryItem = {
  id: number | string;
  item_name?: string | null;
  item_type?: string | null;
  current_stock?: number | string | null;
  unit?: string | null;
  batches?: InventoryBatch[];
};

type InventoryBatchModalProps = {
  mode: 'add' | 'view';
  item?: BatchInventoryItem;
  inventoryItems?: BatchInventoryItem[];
  canAddBatch?: boolean;
  onSwitchToAdd?: () => void;
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

export function InventoryBatchModal({
  mode,
  item,
  inventoryItems = [],
  canAddBatch = false,
  onSwitchToAdd,
  onClose,
}: InventoryBatchModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(item?.id ? String(item.id) : String(inventoryItems[0]?.id || ''));
  const selectedItem = item || inventoryItems.find((inventoryItem) => String(inventoryItem.id) === selectedItemId);
  const hasUnbatchedStock = Boolean(
    selectedItem
    && (selectedItem.batches?.length || 0) === 0
    && Number(selectedItem.current_stock || 0) > 0
  );

  const [formData, setFormData] = useState({
    batch_number: '',
    quantity_received: hasUnbatchedStock ? String(selectedItem?.current_stock || '') : '',
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
      toast.success('Lot/batch added successfully. Unexpired vaccine lots can now be selected in PEP Record Dose.');
      onClose(true);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to add inventory batch.'));
    } finally {
      setLoading(false);
    }
  };

  const itemOptions = inventoryItems.map((inventoryItem) => ({
    value: String(inventoryItem.id),
    label: inventoryItem.item_name || 'Unnamed item',
  }));
  const batches = selectedItem?.batches || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">
              {mode === 'add' ? 'Add Batch / Restock' : 'Inventory Lots / Batches'}
            </h2>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              {mode === 'add'
                ? 'Record lot number, expiry date, and quantity received for a vaccine or supply product.'
                : selectedItem?.item_name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'view' && canAddBatch && onSwitchToAdd && (
              <Button type="button" size="sm" onClick={onSwitchToAdd}>
                <Plus className="h-4 w-4" />
                Add Batch / Restock
              </Button>
            )}
            <button
              type="button"
              onClick={() => onClose(false)}
              className="rounded-full p-1.5 transition-colors hover:bg-muted"
              aria-label="Close batch modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {mode === 'add' ? (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="space-y-4 p-6">
              {item ? (
                <Input
                  label="Vaccine / Supply Product"
                  value={selectedItem?.item_name || ''}
                  readOnly
                />
              ) : (
                <Select
                  label="Vaccine / Supply Product"
                  options={itemOptions}
                  value={selectedItemId}
                  onChange={(event) => setSelectedItemId(event.target.value)}
                  required
                />
              )}

              {hasUnbatchedStock && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                  <span className="font-semibold">Unbatched stock detected:</span> {selectedItem?.item_name} currently has {selectedItem?.current_stock} {selectedItem?.unit} without a recorded lot/batch. Saving this first lot will assign your stock to this lot number and expiry date so it can be selected in PEP Record Dose.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Batch / Lot Number *"
                  value={formData.batch_number}
                  onChange={(event) => setFormData({ ...formData, batch_number: event.target.value })}
                  placeholder="ARV-2026-001"
                  helperText="Lot number printed on the vaccine vial or box."
                  required
                />
                <Input
                  label="Quantity Received *"
                  type="number"
                  min="1"
                  value={formData.quantity_received}
                  onChange={(event) => setFormData({ ...formData, quantity_received: event.target.value })}
                  helperText="Number of vials/units in this lot."
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Input label="Unit" value={selectedItem?.unit || ''} readOnly />
                <Input
                  label="Expiry Date *"
                  type="date"
                  value={formData.expiry_date}
                  onChange={(event) => setFormData({ ...formData, expiry_date: event.target.value })}
                  helperText="Unexpired lots are selectable in Record Dose."
                  required
                />
                <Input
                  label="Date Received *"
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  value={formData.received_date}
                  onChange={(event) => setFormData({ ...formData, received_date: event.target.value })}
                  required
                />
              </div>

              <Input
                label="Supplier / Source"
                value={formData.supplier}
                onChange={(event) => setFormData({ ...formData, supplier: event.target.value })}
                placeholder="Optional supplier or source"
              />

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                  className="min-h-[72px] w-full rounded-xl border border-input bg-input-background px-3 py-2 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Optional receiving notes"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <Button type="button" variant="outline" onClick={() => onClose(false)} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Lot / Batch'}</Button>
            </div>
          </form>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            {batches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-8 text-center">
                <p className="text-sm font-bold text-amber-950">No lot/batch recorded for this product yet.</p>
                <p className="mt-1 text-xs text-amber-900">
                  A vaccine product cannot be selected in PEP Schedule → Record Dose until an unexpired lot/batch with available stock is recorded.
                </p>
                {canAddBatch && onSwitchToAdd && (
                  <Button type="button" size="sm" className="mt-4" onClick={onSwitchToAdd}>
                    <Plus className="h-4 w-4" />
                    Add Batch / Restock Now
                  </Button>
                )}
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
                    {batches.map((batch) => (
                      <tr key={batch.id} className="text-sm">
                        <td className="px-4 py-3 font-semibold text-foreground">{batch.batch_number}</td>
                        <td className="px-4 py-3 text-muted-foreground">{batch.quantity_remaining} {selectedItem?.unit}</td>
                        <td className="px-4 py-3 text-muted-foreground">{batch.quantity_received} {selectedItem?.unit}</td>
                        <td className="px-4 py-3 text-muted-foreground">{batch.expiry_date || '-'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{batch.received_date || '-'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{batch.supplier || '-'}</td>
                        <td className="px-4 py-3"><Badge variant={statusVariant(batch.status || '')}>{batch.status || 'Unknown'}</Badge></td>
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
