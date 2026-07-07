import { useState, useEffect } from 'react';
import { Package, AlertTriangle, Plus, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';
import { inventoryAPI } from '../../lib/services/api';
import { canPerformAction, getStoredUser } from '../../lib/auth/roleAccess';
import { InventoryFormModal } from '../components/Inventory/InventoryFormModal';
import { StockAdjustmentModal } from '../components/Inventory/StockAdjustmentModal';

export function Inventory() {
  const currentUser = getStoredUser();
  const canCreateInventory = canPerformAction(currentUser?.role, 'inventory.create');
  const canUpdateInventory = canPerformAction(currentUser?.role, 'inventory.update');
  const canAdjustStock = canPerformAction(currentUser?.role, 'inventory.adjust_stock');
  const showInventoryActions = canUpdateInventory || canAdjustStock;
  const inventoryColumnCount = showInventoryActions ? 9 : 8;
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [adjustingItem, setAdjustingItem] = useState<any>(null);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const response = await inventoryAPI.getAll();
      if (response.success) {
        setInventory(response.data);
      }
    } catch (error) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setShowFormModal(true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    setShowFormModal(true);
  };

  const handleAdjustStock = (item: any) => {
    setAdjustingItem(item);
    setShowAdjustModal(true);
  };

  const handleFormModalClose = (shouldReload?: boolean) => {
    setShowFormModal(false);
    setEditingItem(null);
    if (shouldReload) {
      loadInventory();
    }
  };

  const handleAdjustModalClose = (shouldReload?: boolean) => {
    setShowAdjustModal(false);
    setAdjustingItem(null);
    if (shouldReload) {
      loadInventory();
    }
  };

  const getStockStatus = (stock: number, reorderLevel: number) => {
    if (stock === 0) return 'Critical';
    if (stock < reorderLevel) return 'Low';
    return 'OK';
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'OK': return 'success';
      case 'Low': return 'warning';
      case 'Critical': return 'danger';
      default: return 'neutral';
    }
  };

  const getStockPercentage = (stock: number, reorderLevel: number) => {
    return Math.min(100, (stock / (reorderLevel * 2)) * 100);
  };

  const totalItems = inventory.length;
  const lowStockItems = inventory.filter(item => {
    const status = getStockStatus(item.current_stock, item.reorder_level);
    return status === 'Low';
  }).length;
  const criticalItems = inventory.filter(item => {
    const status = getStockStatus(item.current_stock, item.reorder_level);
    return status === 'Critical';
  }).length;

  return (
    <div className="min-h-screen flex-1 bg-background">
      <Header title="Vaccine & Supply Inventory" breadcrumbs={['Inventory', 'Stock Management']} />

      <div className="space-y-5 px-5 py-5 lg:px-7 lg:py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            icon={Package}
            title="Total Items"
            value={totalItems.toString()}
            iconBgColor="bg-accent-bg"
            iconColor="text-accent"
          />
          <StatCard
            icon={AlertTriangle}
            title="Low Stock Items"
            value={lowStockItems.toString()}
            iconBgColor="bg-warning-bg"
            iconColor="text-warning"
          />
          <StatCard
            icon={AlertTriangle}
            title="Critical Items"
            value={criticalItems.toString()}
            iconBgColor="bg-destructive-bg"
            iconColor="text-destructive"
          />
        </div>

        <div className="mb-6 overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm shadow-slate-900/5">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-extrabold text-foreground">Current Stock</h2>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">Monitor vaccine and clinic supply levels.</p>
            </div>
            {canCreateInventory && (
              <Button variant="primary" size="sm" onClick={handleCreate}>
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/60 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 text-left">Vaccine/Supply Name</th>
                  <th className="px-5 py-3 text-left">Type</th>
                  <th className="px-5 py-3 text-left">Current Stock</th>
                  <th className="px-5 py-3 text-left">Unit</th>
                  <th className="px-5 py-3 text-left">Reorder Level</th>
                  <th className="px-5 py-3 text-left">Stock Level</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Last Updated</th>
                  {showInventoryActions && <th className="px-5 py-3 text-left">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={inventoryColumnCount} className="px-6 py-10 text-center text-sm text-muted-foreground">
                      Loading inventory...
                    </td>
                  </tr>
                ) : inventory.length === 0 ? (
                  <tr>
                    <td colSpan={inventoryColumnCount} className="px-6 py-10 text-center text-sm text-muted-foreground">
                      No inventory items found
                    </td>
                  </tr>
                ) : (
                  inventory.map((item) => {
                    const status = getStockStatus(item.current_stock, item.reorder_level);
                    return (
                      <tr key={item.id} className="transition-colors hover:bg-muted/45">
                        <td className="px-5 py-4 text-sm font-semibold text-foreground">{item.item_name}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{item.item_type}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-foreground">{item.current_stock}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{item.unit}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{item.reorder_level}</td>
                        <td className="px-5 py-4">
                          <div className="w-32">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  status === 'OK' ? 'bg-success' :
                                  status === 'Low' ? 'bg-warning' : 'bg-destructive'
                                }`}
                                style={{ width: `${getStockPercentage(item.current_stock, item.reorder_level)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={getStatusVariant(status)}>
                            {status}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">
                          {item.last_updated ? new Date(item.last_updated).toLocaleString() : '-'}
                        </td>
                        {showInventoryActions && (
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              {canAdjustStock && (
                                <button
                                  onClick={() => handleAdjustStock(item)}
                                  className="inline-flex h-8 items-center justify-center rounded-full bg-primary px-3 text-xs font-semibold leading-none text-white shadow-sm transition-colors hover:bg-primary-dark"
                                  title="Adjust Stock"
                                >
                                  Adjust
                                </button>
                              )}
                              {canUpdateInventory && (
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-primary-bg text-primary shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-bg/80"
                                  title="Edit"
                                  aria-label="Edit inventory item"
                                >
                                  <Edit className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showFormModal && (canCreateInventory || canUpdateInventory) && (
        <InventoryFormModal
          item={editingItem}
          onClose={handleFormModalClose}
        />
      )}

      {showAdjustModal && canAdjustStock && adjustingItem && (
        <StockAdjustmentModal
          item={adjustingItem}
          onClose={handleAdjustModalClose}
        />
      )}
    </div>
  );
}
