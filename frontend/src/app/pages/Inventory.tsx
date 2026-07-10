import { useState, useEffect } from 'react';
import { AlertTriangle, CalendarClock, Edit, Layers, Package, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';
import { inventoryAPI } from '../../lib/services/api';
import { canPerformAction, getStoredUser, normalizeRoleKey } from '../../lib/auth/roleAccess';
import { InventoryFormModal } from '../components/Inventory/InventoryFormModal';
import { StockAdjustmentModal } from '../components/Inventory/StockAdjustmentModal';
import { InventoryBatchModal } from '../components/Inventory/InventoryBatchModal';

const INVENTORY_ITEMS_PER_PAGE = 10;

export function Inventory() {
  const currentUser = getStoredUser();
  const canCreateInventory = canPerformAction(currentUser?.role, 'inventory.create');
  const canUpdateInventory = canPerformAction(currentUser?.role, 'inventory.update');
  const canAdjustStock = canPerformAction(currentUser?.role, 'inventory.adjust_stock');
  const canRecordUsage = canPerformAction(currentUser?.role, 'inventory.record_usage');
  const isNurseInventoryView = normalizeRoleKey(currentUser?.role) === 'nurse_vaccinator';
  const inventoryColumnCount = 10;
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchModalMode, setBatchModalMode] = useState<'add' | 'view'>('add');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [adjustingItem, setAdjustingItem] = useState<any>(null);
  const [selectedBatchItem, setSelectedBatchItem] = useState<any>(null);

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

  const handleAddBatch = (item?: any) => {
    setSelectedBatchItem(item || null);
    setBatchModalMode('add');
    setShowBatchModal(true);
  };

  const handleViewBatches = (item: any) => {
    setSelectedBatchItem(item);
    setBatchModalMode('view');
    setShowBatchModal(true);
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

  const handleBatchModalClose = (shouldReload?: boolean) => {
    setShowBatchModal(false);
    setSelectedBatchItem(null);
    if (shouldReload) {
      loadInventory();
    }
  };

  const getDaysUntilExpiry = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getStockStatus = (item: any) => {
    const stock = Number(item.current_stock || 0);
    const reorderLevel = Number(item.reorder_level || 0);
    const daysUntilExpiry = getDaysUntilExpiry(item.nearest_expiry_date || item.expiry_date);

    if (daysUntilExpiry !== null && daysUntilExpiry < 0) return 'Expired';
    if (stock === 0) return 'Critical';
    if (daysUntilExpiry !== null && daysUntilExpiry <= 60) return 'Expiring Soon';
    if (stock === 0) return 'Critical';
    if (stock <= reorderLevel) return 'Low Stock';
    return 'OK';
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'OK': return 'success';
      case 'Low Stock': return 'warning';
      case 'Critical': return 'danger';
      case 'Expiring Soon': return 'warning';
      case 'Expired': return 'danger';
      default: return 'neutral';
    }
  };

  const getStockPercentage = (stock: number, reorderLevel: number) => {
    return Math.min(100, (stock / (reorderLevel * 2)) * 100);
  };

  const totalItems = inventory.length;
  const lowStockItems = inventory.filter(item => {
    const status = getStockStatus(item);
    return status === 'Low Stock' || status === 'Expiring Soon';
  }).length;
  const criticalItems = inventory.filter(item => {
    const status = getStockStatus(item);
    return status === 'Critical' || status === 'Expired';
  }).length;
  const itemTypes = Array.from(new Set(inventory.map((item) => item.item_type).filter(Boolean)));
  const filteredInventory = inventory.filter((item) => {
    const status = getStockStatus(item);
    const search = searchTerm.toLowerCase();

    return (
      (!search || item.item_name?.toLowerCase().includes(search) || item.item_type?.toLowerCase().includes(search)) &&
      (statusFilter === 'All' || status === statusFilter) &&
      (typeFilter === 'All' || item.item_type === typeFilter)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredInventory.length / INVENTORY_ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * INVENTORY_ITEMS_PER_PAGE;
  const pageEndIndex = Math.min(pageStartIndex + INVENTORY_ITEMS_PER_PAGE, filteredInventory.length);
  const paginatedInventory = filteredInventory.slice(pageStartIndex, pageEndIndex);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
            title="Low / Expiring Items"
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
          <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-extrabold text-foreground">Current Stock</h2>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">Monitor vaccine and clinic supply levels.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search inventory"
                  className="h-10 w-full rounded-full border border-input bg-input-background pl-9 pr-3 text-sm shadow-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-56"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 rounded-full border border-input bg-input-background px-3 text-sm shadow-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="All">All Types</option>
                {itemTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 rounded-full border border-input bg-input-background px-3 text-sm shadow-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="All">All Status</option>
                <option value="OK">OK</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Critical">Critical</option>
                <option value="Expiring Soon">Expiring Soon</option>
                <option value="Expired">Expired</option>
              </select>
              {canCreateInventory && (
                <Button variant="primary" size="sm" onClick={handleCreate}>
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              )}
            </div>
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
                  <th className="px-5 py-3 text-left">Stock Details</th>
                  <th className="px-5 py-3 text-left">Nearest Expiry</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Last Updated</th>
                  <th className="px-5 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={inventoryColumnCount} className="px-6 py-10 text-center text-sm text-muted-foreground">
                      Loading inventory...
                    </td>
                  </tr>
                ) : filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={inventoryColumnCount} className="px-6 py-10 text-center text-sm text-muted-foreground">
                      No inventory items found.
                    </td>
                  </tr>
                ) : (
                  paginatedInventory.map((item) => {
                    const status = getStockStatus(item);
                    const nearestExpiry = item.nearest_expiry_date || item.expiry_date;
                    const daysUntilExpiry = getDaysUntilExpiry(nearestExpiry);
                    return (
                      <tr key={item.id} className="transition-colors hover:bg-muted/45">
                        <td className="px-5 py-4 text-sm font-semibold text-foreground">{item.item_name}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{item.item_type}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-foreground">{item.current_stock} {item.unit}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{item.unit}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{item.reorder_level}</td>
                        <td className="px-5 py-4">
                          <div className="w-40 space-y-1.5">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  status === 'OK' ? 'bg-success' :
                                  status === 'Low' ? 'bg-warning' : 'bg-destructive'
                                }`}
                                style={{ width: `${getStockPercentage(item.current_stock, item.reorder_level)}%` }}
                              ></div>
                            </div>
                            <p className="text-[11px] font-medium text-muted-foreground">
                              Reorder: {item.reorder_level}{item.critical_level ? ' | Critical: ' + item.critical_level : ''}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">
                          {nearestExpiry ? (
                            <div className="flex items-center gap-2">
                              <CalendarClock className="h-4 w-4 text-muted-foreground" />
                              <span>{new Date(nearestExpiry).toLocaleDateString()}</span>
                              {daysUntilExpiry !== null && daysUntilExpiry <= 60 && (
                                <span className="text-xs font-semibold text-warning">{daysUntilExpiry < 0 ? 'Expired' : daysUntilExpiry + 'd'}</span>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={getStatusVariant(status)}>
                            {status}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">
                          {item.last_updated ? new Date(item.last_updated).toLocaleString() : '-'}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-nowrap items-center gap-2">
                            <button
                              onClick={() => handleViewBatches(item)}
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent-bg text-accent shadow-sm transition-colors hover:border-accent/40 hover:bg-accent-bg/80"
                              title="View Batches"
                              aria-label="View inventory batches"
                            >
                              <Layers className="h-4 w-4" />
                            </button>
                            {canAdjustStock && (
                              <button
                                onClick={() => handleAddBatch(item)}
                                className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary-bg px-3 text-xs font-semibold leading-none text-primary shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-bg/80"
                                title="Add Batch / Restock"
                                aria-label="Add batch or restock this inventory item"
                              >
                                Restock
                              </button>
                            )}
                            {(canAdjustStock || canRecordUsage) && (
                              <button
                                onClick={() => handleAdjustStock(item)}
                                className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-primary px-3 text-xs font-semibold leading-none text-white shadow-sm transition-colors hover:bg-primary-dark"
                                title={isNurseInventoryView ? 'Record Usage' : 'Adjust Stock'}
                                aria-label={isNurseInventoryView ? 'Record stock usage' : 'Adjust stock'}
                              >
                                {isNurseInventoryView ? 'Record Usage' : 'Adjust'}
                              </button>
                            )}
                            {canUpdateInventory && (
                              <button
                                onClick={() => handleEdit(item)}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary-bg text-primary shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-bg/80"
                                title="Edit Item Details"
                                aria-label="Edit item details"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading inventory...</p>
            ) : filteredInventory.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Showing {pageStartIndex + 1}-{pageEndIndex} of {filteredInventory.length} item{filteredInventory.length !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={safeCurrentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                    Page {safeCurrentPage} of {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={safeCurrentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {showFormModal && (canCreateInventory || canUpdateInventory) && (
        <InventoryFormModal
          item={editingItem}
          onClose={handleFormModalClose}
        />
      )}

      {showBatchModal && (
        <InventoryBatchModal
          mode={batchModalMode}
          item={selectedBatchItem}
          inventoryItems={inventory}
          onClose={handleBatchModalClose}
        />
      )}

      {showAdjustModal && (canAdjustStock || canRecordUsage) && adjustingItem && (
        <StockAdjustmentModal
          item={adjustingItem}
          mode={canRecordUsage && !canAdjustStock ? 'usage' : 'adjust'}
          onClose={handleAdjustModalClose}
        />
      )}
    </div>
  );
}
