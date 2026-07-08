import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Select } from '../UI/Select';
import { inventoryAPI } from '../../../lib/services/api';

const ADD_STOCK_TYPES = ['Restock', 'Received'];
const REMOVE_STOCK_TYPES = ['Used', 'Dispensed', 'Damaged', 'Expired'];
const REQUIRES_REASON = ['Damaged', 'Expired', 'Adjustment'];

interface StockAdjustmentModalProps {
  item: any;
  onClose: (shouldReload?: boolean) => void;
  mode?: 'adjust' | 'usage';
}

export function StockAdjustmentModal({ item, onClose, mode = 'adjust' }: StockAdjustmentModalProps) {
  const isUsageMode = mode === 'usage';
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    transaction_type: isUsageMode ? 'Used' : 'Restock',
    inventory_batch_id: '',
    quantity: '',
    transaction_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const quantity = parseInt(formData.quantity, 10);
      if (isNaN(quantity) || quantity <= 0) {
        toast.error('Please enter a valid quantity');
        setLoading(false);
        return;
      }
      if (REQUIRES_REASON.includes(formData.transaction_type) && !formData.notes.trim()) {
        toast.error('Please enter a reason for this stock adjustment');
        setLoading(false);
        return;
      }
      if (isRemovingStock && item.batches?.length > 0 && !formData.inventory_batch_id) {
        toast.error('Please select the affected batch/lot');
        setLoading(false);
        return;
      }
      if (wouldExceedBatch) {
        toast.error('Selected batch does not have enough remaining stock');
        setLoading(false);
        return;
      }

      const currentStock = Number(item.current_stock) || 0;
      let newStock = currentStock;

      if (ADD_STOCK_TYPES.includes(formData.transaction_type)) {
        newStock = currentStock + quantity;
      } else if (REMOVE_STOCK_TYPES.includes(formData.transaction_type)) {
        newStock = currentStock - quantity;
        if (newStock < 0) {
          toast.error('Insufficient stock');
          setLoading(false);
          return;
        }
      } else if (formData.transaction_type === 'Adjustment') {
        // For adjustments, use the quantity as the new absolute value
        newStock = quantity;
      }

      await inventoryAPI.update(item.id, {
        current_stock: newStock,
        transaction_type: formData.transaction_type,
        inventory_batch_id: formData.inventory_batch_id || undefined,
        transaction_date: formData.transaction_date,
        notes: formData.notes
      });

      toast.success(isUsageMode ? 'Stock usage recorded successfully' : 'Stock adjusted successfully');
      onClose(true);
    } catch (error) {
      toast.error(isUsageMode ? 'Failed to record stock usage' : 'Failed to adjust stock');
    } finally {
      setLoading(false);
    }
  };

  const transactionTypeOptions = isUsageMode ? [
    { value: 'Used', label: 'Used (Subtract from Current Stock)' },
    { value: 'Dispensed', label: 'Dispensed (Subtract from Current Stock)' },
  ] : [
    { value: 'Restock', label: 'Restock (Add to Current Stock)' },
    { value: 'Received', label: 'Received (Add to Current Stock)' },
    { value: 'Used', label: 'Used (Subtract from Current Stock)' },
    { value: 'Dispensed', label: 'Dispensed (Subtract from Current Stock)' },
    { value: 'Damaged', label: 'Damaged (Subtract from Current Stock)' },
    { value: 'Expired', label: 'Expired (Subtract from Current Stock)' },
    { value: 'Adjustment', label: 'Set Exact Stock (Does Not Add)' }
  ];
  const today = new Date().toISOString().split('T')[0];
  const batchOptions = [
    { value: '', label: 'Select affected batch/lot' },
    ...(item.batches || [])
      .filter((batch: any) => {
        const hasStock = Number(batch.quantity_remaining || 0) > 0;
        const isNotExpired = !batch.expiry_date || batch.expiry_date >= today;
        return hasStock && (!isUsageMode || isNotExpired);
      })
      .map((batch: any) => ({
        value: String(batch.id),
        label: `${batch.batch_number} - ${batch.quantity_remaining} ${item.unit} remaining - exp ${batch.expiry_date || 'N/A'}`,
      })),
  ];

  const isAddingStock = ADD_STOCK_TYPES.includes(formData.transaction_type);
  const isRemovingStock = REMOVE_STOCK_TYPES.includes(formData.transaction_type);
  const isAdjustment = formData.transaction_type === 'Adjustment';
  const currentStock = Number(item.current_stock) || 0;
  const quantity = parseInt(formData.quantity, 10) || 0;
  const wouldGoNegative = isRemovingStock && quantity > currentStock;
  const selectedBatch = (item.batches || []).find((batch: any) => String(batch.id) === formData.inventory_batch_id);
  const wouldExceedBatch = Boolean(isRemovingStock && selectedBatch && quantity > Number(selectedBatch.quantity_remaining || 0));

  const getNewStockPreview = () => {
    if (isAddingStock) {
      return currentStock + quantity;
    } else if (isRemovingStock) {
      return Math.max(0, currentStock - quantity);
    } else if (isAdjustment) {
      return quantity;
    }
    return currentStock;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">{isUsageMode ? 'Record Stock Usage' : 'Adjust Stock'}</h2>
            <p className="text-sm text-muted-foreground">
              {isUsageMode ? 'Record vaccine or supply usage for this item.' : item.item_name}
            </p>
          </div>
          <button
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
                <p className="mb-1 text-xs font-medium text-muted-foreground">Current Stock</p>
                <p className="text-2xl font-semibold text-foreground">
                  {item.current_stock} <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>
                </p>
              </div>
              <div className="rounded-xl bg-white/70 px-3 py-2 text-right">
                <p className="mb-1 text-xs font-medium text-muted-foreground">New Stock</p>
                <p className={'text-2xl font-semibold ' + (wouldGoNegative ? 'text-destructive' : 'text-primary')}>
                  {getNewStockPreview()} <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>
                </p>
              </div>
            </div>

            {isAddingStock && (
              <div className="rounded-2xl border border-warning/20 bg-warning-bg px-3 py-2 text-xs font-medium text-warning">
                For new vaccine or supply lots, use Add Batch/Restock when possible so expiry and lot details are tracked.
              </div>
            )}
            {isUsageMode && (
              <div className="rounded-2xl border border-primary/15 bg-primary-bg px-3 py-2 text-xs font-medium text-primary">
                Recording usage will subtract from current stock.
              </div>
            )}

            <Select
              label="Transaction Type"
              options={transactionTypeOptions}
              value={formData.transaction_type}
              onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value, inventory_batch_id: '' })}
            />

            {isRemovingStock && item.batches?.length > 0 && (
              <div>
                <Select
                  label="Batch/Lot Affected"
                  options={batchOptions}
                  value={formData.inventory_batch_id}
                  onChange={(e) => setFormData({ ...formData, inventory_batch_id: e.target.value })}
                />
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  Select the batch where the stock was used, dispensed, damaged, or expired.
                </p>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Input
                  label={isAdjustment ? "Exact Stock Amount" : "Quantity"}
                  type="number"
                  placeholder={isAdjustment ? "Enter exact stock amount" : "Enter quantity"}
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                  min="1"
                  error={wouldGoNegative ? 'Quantity exceeds available stock.' : wouldExceedBatch ? 'Quantity exceeds selected batch stock.' : undefined}
                />
                {!wouldGoNegative && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isAddingStock && 'This will add to current stock.'}
                    {isRemovingStock && 'This will subtract from current stock.'}
                    {isAdjustment && 'This will replace the current stock total.'}
                  </p>
                )}
              </div>

              <Input
                label="Transaction Date"
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Notes / Reason {REQUIRES_REASON.includes(formData.transaction_type) ? '*' : '(Optional)'}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="h-24 w-full resize-none rounded-xl border border-input bg-input-background px-3 py-2 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={isUsageMode ? 'Optional usage notes, patient reference, or remarks...' : 'Reason for stock adjustment, batch number, etc...'}
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
              {loading ? (isUsageMode ? 'Recording...' : 'Adjusting...') : (isUsageMode ? 'Record Usage' : 'Adjust Stock')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
