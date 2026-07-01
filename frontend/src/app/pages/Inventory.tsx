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
    <div className="flex-1">
      <Header title="Vaccine & Supply Inventory" breadcrumbs={['Inventory', 'Stock Management']} />

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
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

        <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-base font-medium text-foreground">Current Stock</h2>
            {canCreateInventory && (
              <Button variant="primary" size="sm" onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted text-xs font-medium text-muted-foreground">
                  <th className="text-left px-6 py-3">Vaccine/Supply Name</th>
                  <th className="text-left px-6 py-3">Type</th>
                  <th className="text-left px-6 py-3">Current Stock</th>
                  <th className="text-left px-6 py-3">Unit</th>
                  <th className="text-left px-6 py-3">Reorder Level</th>
                  <th className="text-left px-6 py-3">Stock Level</th>
                  <th className="text-left px-6 py-3">Status</th>
                  <th className="text-left px-6 py-3">Last Updated</th>
                  {showInventoryActions && <th className="text-left px-6 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={inventoryColumnCount} className="px-6 py-8 text-center text-sm text-muted-foreground">
                      Loading inventory...
                    </td>
                  </tr>
                ) : inventory.length === 0 ? (
                  <tr>
                    <td colSpan={inventoryColumnCount} className="px-6 py-8 text-center text-sm text-muted-foreground">
                      No inventory items found
                    </td>
                  </tr>
                ) : (
                  inventory.map((item) => {
                    const status = getStockStatus(item.current_stock, item.reorder_level);
                    return (
                      <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-foreground">{item.item_name}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{item.item_type}</td>
                        <td className="px-6 py-4 text-sm text-foreground">{item.current_stock}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{item.unit}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{item.reorder_level}</td>
                        <td className="px-6 py-4">
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
                        <td className="px-6 py-4">
                          <Badge variant={getStatusVariant(status)}>
                            {status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground">
                          {item.last_updated ? new Date(item.last_updated).toLocaleString() : '-'}
                        </td>
                        {showInventoryActions && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {canAdjustStock && (
                                <button
                                  onClick={() => handleAdjustStock(item)}
                                  className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90 transition-colors"
                                  title="Adjust Stock"
                                >
                                  Adjust
                                </button>
                              )}
                              {canUpdateInventory && (
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/15"
                                  title="Edit"
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
