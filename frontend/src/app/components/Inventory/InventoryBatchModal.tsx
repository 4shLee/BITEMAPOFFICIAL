import { useEffect, useState } from 'react';
import { AlertTriangle, Plus, Trash2, X } from 'lucide-react';
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
  notes?: string | null;
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
  canDeleteBatch?: boolean;
  onSwitchToAdd?: () => void;
  onBatchMutated?: () => void;
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
  canDeleteBatch = false,
  onSwitchToAdd,
  onBatchMutated,
  onClose,
}: InventoryBatchModalProps) {
  const [loading, setLoading] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState(false);
  const [confirmingDeleteBatch, setConfirmingDeleteBatch] = useState<InventoryBatch | null>(null);
  const [selectedItemId, setSelectedItemId] = useState(item?.id ? String(item.id) : String(inventoryItems[0]?.id || ''));
  const selectedItem = item || inventoryItems.find((inventoryItem) => String(inventoryItem.id) === selectedItemId);
  const [localBatches, setLocalBatches] = useState<InventoryBatch[]>(selectedItem?.batches || []);

  useEffect(() => {
    setLocalBatches(selectedItem?.batches || []);
  }, [selectedItem]);

  const hasUnbatchedStock = Boolean(
    selectedItem
    && localBatches.length === 0
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

  const handleConfirmDeleteBatch = async () => {
    if (!selectedItem || !confirmingDeleteBatch) return;

    try {
      setDeletingBatch(true);
      const response = await inventoryAPI.deleteBatch(String(selectedItem.id), String(confirmingDeleteBatch.id));
      toast.success(response.message || `Lot/batch ${confirmingDeleteBatch.batch_number} deleted.`);
      const nextBatches = Array.isArray(response.data?.batches)
        ? (response.data.batches as InventoryBatch[])
        : localBatches.filter((batch) => String(batch.id) !== String(confirmingDeleteBatch.id));
      setLocalBatches(nextBatches);
      setConfirmingDeleteBatch(null);
      if (onBatchMutated) {
        onBatchMutated();
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to delete lot/batch.'));
    } finally {
      setDeletingBatch(false);
    }
  };

  const itemOptions = inventoryItems.map((inventoryItem) => ({
    value: String(inventoryItem.id),
    label: inventoryItem.item_name || 'Unnamed item',
  }));
  const batches = localBatches;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">
              {mode === 'add' ? 'Add Batch / Restock' : 'Inventory Lots / Batches'}
            </h2>
            <p className="mt-0.5 text-sm font-medium text-muted-foreground">
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
                <label className="mb-1.5 block text-sm font-semibold text-foreground">Notes</label>
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
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {confirmingDeleteBatch && (
              <div
                className="rounded-2xl border border-destructive/30 bg-destructive-bg/50 p-4 text-xs text-foreground"
                role="alertdialog"
                aria-labelledby="delete-batch-dialog-title"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <h3 id="delete-batch-dialog-title" className="text-sm font-extrabold text-destructive">
                      Delete Lot / Batch Permanently?
                    </h3>
                    <div className="grid grid-cols-1 gap-1 rounded-xl border border-border bg-card px-3 py-2 sm:grid-cols-3">
                      <div>
                        <span className="font-semibold text-muted-foreground">Product:</span>{' '}
                        <span className="font-bold text-foreground">{selectedItem?.item_name}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-muted-foreground">Batch / Lot:</span>{' '}
                        <span className="font-bold text-foreground">{confirmingDeleteBatch.batch_number}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-muted-foreground">Remaining Quantity:</span>{' '}
                        <span className="font-bold text-foreground">
                          {confirmingDeleteBatch.quantity_remaining} {selectedItem?.unit}
                        </span>
                      </div>
                    </div>
                    <p className="text-muted-foreground">
                      Permanent deletion cannot be undone and will subtract this lot&apos;s remaining quantity from the product stock total. Lots referenced by PEP vaccination doses or stock transactions cannot be deleted—use <span className="font-semibold text-foreground">Adjust Stock</span> to zero out remaining quantity when history must be preserved.
                    </p>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmingDeleteBatch(null)}
                        disabled={deletingBatch}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={handleConfirmDeleteBatch}
                        disabled={deletingBatch}
                      >
                        {deletingBatch ? 'Deleting...' : 'Delete Lot Permanently'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                      {canDeleteBatch && <th className="px-4 py-3 text-right">Actions</th>}
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
                        {canDeleteBatch && (
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteBatch(batch)}
                              className="inline-flex h-8 items-center gap-1 rounded-full border border-destructive/25 bg-destructive-bg px-2.5 text-sm font-semibold text-destructive transition-colors hover:border-destructive/50 hover:bg-destructive-bg/80"
                              title={`Delete lot ${batch.batch_number}`}
                              aria-label={`Delete batch ${batch.batch_number}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete Lot</span>
                            </button>
                          </td>
                        )}
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
