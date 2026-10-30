import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { getErrorMessage, inventoryAPI } from '../../../lib/services/api';

const REMOVE_STOCK_TYPES = ['Used', 'Dispensed', 'Damaged', 'Expired'];
const REQUIRES_REASON = ['Damaged', 'Expired', 'Adjustment'];

interface StockAdjustmentModalProps {
  item: {
    id: number | string;
    item_name?: string | null;
    current_stock?: number | string | null;
    unit?: string | null;
    batches?: Array<{
      id: number | string;
      batch_number?: string | null;
      quantity_remaining?: number | string | null;
      expiry_date?: string | null;
    }>;
  };
  onClose: (shouldReload?: boolean) => void;
  mode?: 'adjust' | 'usage';
}

export function StockAdjustmentModal({ item, onClose, mode = 'adjust' }: StockAdjustmentModalProps) {
  const isUsageMode = mode === 'usage';
  const hasBatches = (item.batches?.length || 0) > 0;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    transaction_type: 'Used',
    inventory_batch_id: item.batches?.length === 1 ? String(item.batches[0].id) : '',
    quantity: '',
    transaction_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const isRemovingStock = REMOVE_STOCK_TYPES.includes(formData.transaction_type);
  const isAdjustment = formData.transaction_type === 'Adjustment';
  const currentStock = Number(item.current_stock) || 0;
  const parsedQuantity = formData.quantity.trim() === '' ? NaN : parseInt(formData.quantity, 10);
  const quantity = Number.isNaN(parsedQuantity) ? 0 : parsedQuantity;
  const selectedBatch = (item.batches || []).find((batch) => String(batch.id) === formData.inventory_batch_id);
  const selectedBatchRemaining = Number(selectedBatch?.quantity_remaining || 0);
  const wouldGoNegative = (isRemovingStock && quantity > currentStock) || (isAdjustment && quantity < 0);
  const wouldExceedBatch = Boolean(isRemovingStock && selectedBatch && quantity > selectedBatchRemaining);

  const getNewStockPreview = () => {
    if (isRemovingStock) {
      return Math.max(0, currentStock - Math.max(0, quantity));
    }
    if (isAdjustment) {
      if (hasBatches && selectedBatch) {
        const delta = Math.max(0, quantity) - selectedBatchRemaining;
        return Math.max(0, currentStock + delta);
      }
      return Math.max(0, quantity);
    }
    return currentStock;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (Number.isNaN(parsedQuantity) || (isAdjustment ? parsedQuantity < 0 : parsedQuantity <= 0)) {
      toast.error(isAdjustment ? 'Enter a valid stock count (0 or greater).' : 'Please enter a valid quantity greater than 0.');
      return;
    }

    if (REQUIRES_REASON.includes(formData.transaction_type) && !formData.notes.trim()) {
      toast.error('Please enter a reason for this stock adjustment.');
      return;
    }

    if (hasBatches && !formData.inventory_batch_id) {
      toast.error('Please select the affected batch/lot.');
      return;
    }

    if (wouldExceedBatch) {
      toast.error('Selected batch does not have enough remaining stock.');
      return;
    }

    const newStock = getNewStockPreview();
    if (newStock < 0 || wouldGoNegative) {
      toast.error('Stock cannot become negative.');
      return;
    }

    setLoading(true);
    try {
      await inventoryAPI.update(String(item.id), {
        current_stock: newStock,
        transaction_type: formData.transaction_type,
        inventory_batch_id: formData.inventory_batch_id || undefined,
        transaction_date: formData.transaction_date,
        notes: formData.notes.trim(),
      });

      toast.success(isUsageMode ? 'Stock usage recorded successfully' : 'Stock adjusted successfully');
      onClose(true);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, isUsageMode ? 'Failed to record stock usage' : 'Failed to adjust stock'));
    } finally {
      setLoading(false);
    }
  };

  const transactionTypeOptions = isUsageMode
    ? [
        { value: 'Used', label: 'Used (Subtract from Stock)' },
        { value: 'Dispensed', label: 'Dispensed (Subtract from Stock)' },
      ]
    : [
        { value: 'Used', label: 'Used (Subtract from Stock)' },
        { value: 'Dispensed', label: 'Dispensed (Subtract from Stock)' },
        { value: 'Damaged', label: 'Damaged / Wastage (Subtract from Stock)' },
        { value: 'Expired', label: 'Expired Write-off (Subtract from Stock)' },
        { value: 'Adjustment', label: hasBatches ? 'Inventory Count Correction (Set Exact Lot Remaining)' : 'Inventory Count Correction (Set Exact Stock)' },
      ];

  const today = new Date().toISOString().split('T')[0];
  const batchOptions = [
    { value: '', label: 'Select affected batch/lot' },
    ...(item.batches || [])
      .filter((batch) => {
        if (isAdjustment) return true;
        const hasStock = Number(batch.quantity_remaining || 0) > 0;
        const isNotExpired = !batch.expiry_date || batch.expiry_date >= today;
        return hasStock && (!isUsageMode || isNotExpired);
      })
      .map((batch) => ({
        value: String(batch.id),
        label: `${batch.batch_number} — ${batch.quantity_remaining} ${item.unit} remaining (exp ${batch.expiry_date || 'N/A'})`,
      })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">{isUsageMode ? 'Record Stock Usage' : 'Adjust Stock'}</h2>
            <p className="text-sm font-medium text-muted-foreground">
              {isUsageMode
                ? `Record usage or dispensing for ${item.item_name}.`
                : `Record stock deductions, wastage, or count corrections for ${item.item_name}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="rounded-full p-1.5 transition-colors hover:bg-muted"
            aria-label="Close stock adjustment modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-3 px-5 py-4">
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted p-3">
              <div className="rounded-xl bg-white/70 px-3 py-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Current Product Stock</p>
                <p className="text-2xl font-semibold text-foreground">
                  {item.current_stock} <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>
                </p>
              </div>
              <div className="rounded-xl bg-white/70 px-3 py-2 text-right">
                <p className="mb-1 text-xs font-medium text-muted-foreground">New Product Stock</p>
                <p className={'text-2xl font-semibold ' + (wouldGoNegative || wouldExceedBatch ? 'text-destructive' : 'text-primary')}>
                  {getNewStockPreview()} <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>
                </p>
              </div>
            </div>

            {!isUsageMode && (
              <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                To receive new stock deliveries with a lot number and expiry date, use <span className="font-semibold text-foreground">Add Batch / Restock</span> instead.
              </div>
            )}

            <Select
              label="Adjustment / Usage Type"
              options={transactionTypeOptions}
              value={formData.transaction_type}
              onChange={(e) => setFormData({
                ...formData,
                transaction_type: e.target.value,
                inventory_batch_id: item.batches?.length === 1 ? String(item.batches[0].id) : formData.inventory_batch_id,
              })}
            />

            {hasBatches && (
              <div>
                <Select
                  label="Batch / Lot Affected *"
                  options={batchOptions}
                  value={formData.inventory_batch_id}
                  onChange={(e) => setFormData({ ...formData, inventory_batch_id: e.target.value })}
                />
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {isAdjustment
                    ? 'Select the lot whose physical count is being corrected. Product stock will automatically sync with the sum of all lots.'
                    : 'Select the lot where stock was used, dispensed, damaged, or expired.'}
                </p>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Input
                  label={isAdjustment ? (hasBatches ? 'Corrected Lot Remaining *' : 'Exact Stock Count *') : 'Quantity to Deduct *'}
                  type="number"
                  placeholder={isAdjustment ? 'Enter exact remaining count' : 'Enter quantity'}
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                  min={isAdjustment ? '0' : '1'}
                  error={
                    wouldGoNegative
                      ? 'Quantity cannot result in negative stock.'
                      : wouldExceedBatch
                        ? `Quantity exceeds selected batch remaining stock (${selectedBatchRemaining} ${item.unit}).`
                        : undefined
                  }
                />
                {!wouldGoNegative && !wouldExceedBatch && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isRemovingStock && 'This will subtract from the selected lot and product stock.'}
                    {isAdjustment && (hasBatches
                      ? 'Sets the exact remaining count for the selected lot.'
                      : 'Replaces the current product stock count.')}
                  </p>
                )}
              </div>

              <Input
                label="Transaction Date *"
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                max={today}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">
                Notes / Reason {REQUIRES_REASON.includes(formData.transaction_type) ? '*' : '(Optional)'}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="h-20 w-full resize-none rounded-xl border border-input bg-input-background px-3 py-2 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={
                  isUsageMode
                    ? 'Optional usage notes, patient reference, or remarks...'
                    : 'Reason for stock adjustment, wastage, or count correction...'
                }
                required={REQUIRES_REASON.includes(formData.transaction_type)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading || wouldGoNegative || wouldExceedBatch}>
              {loading ? (isUsageMode ? 'Recording...' : 'Saving...') : (isUsageMode ? 'Record Usage' : 'Save Stock Adjustment')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
