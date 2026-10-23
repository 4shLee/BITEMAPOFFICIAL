import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { getErrorMessage, inventoryAPI } from '../../../lib/services/api';
import {
  findCatalogProduct,
  findDuplicateInventoryProduct,
  INVENTORY_PRODUCT_CATALOG,
  type InventoryCatalogProduct,
} from '../../../lib/inventoryCatalog';

type ExistingInventorySummary = {
  id: number | string;
  item_name?: string | null;
  brand?: string | null;
  item_type?: string | null;
  current_stock?: number | string | null;
  reorder_level?: number | string | null;
  unit?: string | null;
  description?: string | null;
};

interface InventoryFormModalProps {
  item?: ExistingInventorySummary;
  existingItems?: ExistingInventorySummary[];
  catalog?: InventoryCatalogProduct[];
  onSwitchToAddBatch?: (existingItem: ExistingInventorySummary) => void;
  onClose: (shouldReload?: boolean) => void;
}

export function InventoryFormModal({
  item,
  existingItems = [],
  catalog = INVENTORY_PRODUCT_CATALOG,
  onSwitchToAddBatch,
  onClose,
}: InventoryFormModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const initialCatalogProduct = findCatalogProduct(item?.item_name, item?.brand, catalog);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    item_name: item?.item_name || '',
    brand: item?.brand || initialCatalogProduct?.brand || '',
    item_type: item?.item_type || initialCatalogProduct?.item_type || 'Vaccine',
    current_stock: item ? String(item.current_stock ?? 0) : '0',
    reorder_level: item?.reorder_level != null ? String(item.reorder_level) : '',
    unit: item?.unit || 'Vials',
    description: item?.description || '',
    batch_number: '',
    expiry_date: '',
    received_date: today,
    supplier: '',
  });

  const selectedCatalogProduct = findCatalogProduct(formData.item_name, formData.brand, catalog);
  const duplicateExistingItem = findDuplicateInventoryProduct(
    formData.item_name,
    existingItems,
    item?.id,
    catalog
  );
  const initialStockQty = Number(formData.current_stock || 0);
  const requiresInitialBatch = !item && initialStockQty > 0;

  const handleProductSelect = (nextItemName: string) => {
    const matched = findCatalogProduct(nextItemName, null, catalog);
    setFormData((current) => ({
      ...current,
      item_name: nextItemName,
      brand: matched?.brand || '',
      item_type: matched?.item_type || current.item_type,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.item_name.trim()) {
      toast.error('Please select a product from the dropdown.');
      return;
    }

    if (duplicateExistingItem) {
      toast.error('This product is already registered in Inventory. Use Add Batch / Restock to add a new lot and stock quantity.');
      return;
    }

    if (requiresInitialBatch) {
      if (!formData.batch_number.trim()) {
        toast.error('Enter the Batch / Lot Number for the initial stock, or set Initial Stock to 0 and add a batch later.');
        return;
      }
      if (!formData.expiry_date) {
        toast.error('Enter the Expiry Date for the initial lot/batch.');
        return;
      }
    }

    setLoading(true);

    try {
      if (item) {
        await inventoryAPI.update(String(item.id), {
          item_name: formData.item_name,
          brand: formData.brand || undefined,
          item_type: formData.item_type,
          current_stock: Number(formData.current_stock || 0),
          reorder_level: Number(formData.reorder_level || 0),
          unit: formData.unit,
          description: formData.description,
        });
        toast.success('Inventory item updated successfully');
      } else {
        await inventoryAPI.create({
          item_name: formData.item_name,
          brand: formData.brand || undefined,
          item_type: formData.item_type,
          current_stock: initialStockQty,
          reorder_level: Number(formData.reorder_level || 0),
          unit: formData.unit,
          description: formData.description,
          ...(requiresInitialBatch ? {
            batch_number: formData.batch_number.trim(),
            expiry_date: formData.expiry_date,
            received_date: formData.received_date || today,
            supplier: formData.supplier.trim() || undefined,
            notes: formData.description.trim() || undefined,
          } : {}),
        });
        toast.success(
          requiresInitialBatch
            ? 'Product and initial lot/batch added successfully.'
            : 'Product added. Click "Add Batch / Restock" to record a lot number, expiry date, and quantity.'
        );
      }
      onClose(true);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, item ? 'Failed to update item' : 'Failed to create item'));
    } finally {
      setLoading(false);
    }
  };

  const productOptions = [
    { value: '', label: 'Select clinic vaccine or immunoglobulin product' },
    ...catalog.map((product) => {
      const existing = findDuplicateInventoryProduct(product.item_name, existingItems, item?.id, catalog);
      return {
        value: product.item_name,
        label: existing
          ? `${product.item_name} (Already registered — use Add Batch / Restock)`
          : product.item_name,
      };
    }),
    ...(item?.item_name && !catalog.some((product) => product.item_name === item.item_name)
      ? [{ value: item.item_name, label: item.item_name }]
      : []),
  ];

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
              {item ? 'Edit Inventory Product' : 'Add Inventory Product'}
            </h2>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              {item
                ? 'Update the master product details and reorder level.'
                : 'Step 1: Select the clinic product. Step 2: Record a Lot/Batch (lot number, expiry date, and quantity) for dose administration.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="rounded-full p-1.5 transition-colors hover:bg-muted"
            aria-label="Close inventory item modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            <Select
              label="Product / Item Name"
              options={productOptions}
              value={formData.item_name}
              onChange={(e) => handleProductSelect(e.target.value)}
              required
            />

            {selectedCatalogProduct && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-950">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-semibold">Product:</span> {selectedCatalogProduct.product_name}
                  </span>
                  <span>
                    <span className="font-semibold">Brand:</span> {selectedCatalogProduct.brand}
                  </span>
                </div>
                <p className="mt-1 text-emerald-900">
                  <span className="font-semibold">Purpose:</span> {selectedCatalogProduct.purpose}
                </p>
              </div>
            )}

            {duplicateExistingItem && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950" role="alert">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">This product is already registered in Inventory ({duplicateExistingItem.item_name}).</p>
                  <p className="mt-0.5 text-amber-900">
                    Do not register duplicate products. Use <span className="font-semibold">Add Batch / Restock</span> to record a new lot number, expiry date, and quantity.
                  </p>
                </div>
                {onSwitchToAddBatch && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onSwitchToAddBatch(duplicateExistingItem)}
                  >
                    Open Add Batch / Restock
                  </Button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="Brand"
                placeholder="Auto-filled from product"
                value={formData.brand}
                readOnly
              />

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
                label={item ? 'Current Stock' : 'Initial Stock Quantity'}
                type="number"
                placeholder={item ? 'Enter current stock' : '0 (or enter opening quantity)'}
                value={formData.current_stock}
                onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
                helperText={!item ? 'Keep 0 to add lots later via Add Batch / Restock, or enter > 0 to record the first lot below.' : undefined}
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

            {!item && (
              requiresInitialBatch ? (
                <div className="space-y-3 rounded-2xl border border-primary/25 bg-primary-bg/40 p-4">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wide text-primary">
                      Initial Lot / Batch Details (Required for initial stock)
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Links the {initialStockQty} {formData.unit.toLowerCase()} opening stock to a specific lot number and expiry date so it can be selected in PEP Record Dose.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Input
                      label="Batch / Lot Number *"
                      placeholder="ARV-2026-001"
                      value={formData.batch_number}
                      onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                      required
                    />
                    <Input
                      label="Expiry Date *"
                      type="date"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                      required
                    />
                    <Input
                      label="Date Received *"
                      type="date"
                      max={today}
                      value={formData.received_date}
                      onChange={(e) => setFormData({ ...formData, received_date: e.target.value })}
                      required
                    />
                  </div>
                  <Input
                    label="Supplier / Source (Optional)"
                    placeholder="Optional supplier or delivery source"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                  <span className="font-semibold">No initial lot/batch yet:</span> saving with 0 stock registers the product only. Before recording a PEP vaccine dose, click <span className="font-semibold">Add Batch / Restock</span> on this product to enter its lot number, expiry date, and quantity.
                </div>
              )
            )}

            <div>
              <label className="block text-xs font-medium text-foreground mb-2">
                Description / Notes (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[72px] w-full rounded-xl border border-input bg-input-background px-3 py-2 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Item description or receiving notes..."
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
            <Button
              type="submit"
              variant="primary"
              disabled={loading || Boolean(duplicateExistingItem)}
            >
              {loading ? 'Saving...' : (item ? 'Update Product' : (requiresInitialBatch ? 'Add Product & Batch' : 'Add Product'))}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
