import { useCallback, useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  AlertTriangle,
  CalendarClock,
  Edit,
  Layers,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { StatCard } from '../components/ui/StatCard';
import { getErrorMessage, inventoryAPI } from '../../lib/services/api';
import { canPerformAction, getStoredUser, normalizeRoleKey } from '../../lib/auth/roleAccess';
import { InventoryFormModal } from '../components/Inventory/InventoryFormModal';
import { StockAdjustmentModal } from '../components/Inventory/StockAdjustmentModal';
import { InventoryBatchModal } from '../components/Inventory/InventoryBatchModal';
import {
  findCatalogProduct,
  INVENTORY_PRODUCT_CATALOG,
  type InventoryCatalogProduct,
} from '../../lib/inventoryCatalog';

const INVENTORY_ITEMS_PER_PAGE = 10;

type InventoryBatchSummary = {
  id: number | string;
  batch_number?: string | null;
  quantity_remaining?: number | string | null;
  quantity_received?: number | string | null;
  expiry_date?: string | null;
  received_date?: string | null;
  supplier?: string | null;
  status?: string | null;
};

type InventoryItem = {
  id: number | string;
  item_name?: string | null;
  brand?: string | null;
  purpose?: string | null;
  description?: string | null;
  item_type?: string | null;
  current_stock?: number | string | null;
  reorder_level?: number | string | null;
  critical_level?: number | string | null;
  nearest_expiry_date?: string | null;
  expiry_date?: string | null;
  unit?: string | null;
  batch_number?: string | null;
  supplier?: string | null;
  last_updated?: string | null;
  batches?: InventoryBatchSummary[];
};

type InventoryNavigationState = {
  openAddBatchForId?: number | string;
  openCreateVaccine?: boolean;
} | null;

export function Inventory() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const canCreateInventory = canPerformAction(currentUser?.role, 'inventory.create');
  const canUpdateInventory = canPerformAction(currentUser?.role, 'inventory.update');
  const canDeleteInventory = canPerformAction(currentUser?.role, 'inventory.delete');
  const canAdjustStock = canPerformAction(currentUser?.role, 'inventory.adjust_stock');
  const canRecordUsage = canPerformAction(currentUser?.role, 'inventory.record_usage');
  const isNurseInventoryView = normalizeRoleKey(currentUser?.role) === 'nurse_vaccinator';
  const inventoryColumnCount = 10;
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [productCatalog, setProductCatalog] = useState<InventoryCatalogProduct[]>(INVENTORY_PRODUCT_CATALOG);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchModalMode, setBatchModalMode] = useState<'add' | 'view'>('add');
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [selectedBatchItem, setSelectedBatchItem] = useState<InventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [deletingProductLoading, setDeletingProductLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const handledNavigationRef = useRef(false);

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      const response = await inventoryAPI.getAll();
      if (response.success) {
        setInventory(response.data);
        if (Array.isArray(response.meta?.catalog) && response.meta.catalog.length > 0) {
          setProductCatalog(response.meta.catalog as InventoryCatalogProduct[]);
        }
      }
    } catch {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadInventory(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadInventory]);

  useEffect(() => {
    if (!openMenuId) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-inventory-more-menu]')) return;
      setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openMenuId]);

  useEffect(() => {
    if (loading || handledNavigationRef.current) return;
    const navState = location.state as InventoryNavigationState;
    if (!navState) return;

    handledNavigationRef.current = true;
    if (navState.openAddBatchForId != null && canAdjustStock) {
      const target = inventory.find((item) => String(item.id) === String(navState.openAddBatchForId)) || null;
      setSelectedBatchItem(target);
      setBatchModalMode('add');
      setShowBatchModal(true);
      navigate(location.pathname, { replace: true, state: null });
    } else if (navState.openCreateVaccine && canCreateInventory) {
      setEditingItem(null);
      setShowFormModal(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [canAdjustStock, canCreateInventory, inventory, loading, location.pathname, location.state, navigate]);

  const handleEdit = (item: InventoryItem) => {
    setOpenMenuId(null);
    setEditingItem(item);
    setShowFormModal(true);
  };

  const handleCreate = () => {
    setOpenMenuId(null);
    setEditingItem(null);
    setShowFormModal(true);
  };

  const handleAdjustStock = (item: InventoryItem) => {
    setOpenMenuId(null);
    setAdjustingItem(item);
    setShowAdjustModal(true);
  };

  const handleAddBatch = (item?: InventoryItem) => {
    setOpenMenuId(null);
    setSelectedBatchItem(item || null);
    setBatchModalMode('add');
    setShowBatchModal(true);
  };

  const handleViewBatches = (item: InventoryItem) => {
    setOpenMenuId(null);
    setSelectedBatchItem(item);
    setBatchModalMode('view');
    setShowBatchModal(true);
  };

  const handleRequestDeleteProduct = (item: InventoryItem) => {
    setOpenMenuId(null);
    setDeletingItem(item);
  };

  const handleConfirmDeleteProduct = async () => {
    if (!deletingItem) return;
    try {
      setDeletingProductLoading(true);
      const response = await inventoryAPI.delete(String(deletingItem.id));
      toast.success(response.message || `Deleted ${deletingItem.item_name}.`);
      setDeletingItem(null);
      void loadInventory();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to delete inventory product.'));
    } finally {
      setDeletingProductLoading(false);
    }
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

  const getDaysUntilExpiry = (expiryDate?: string | null) => {
    if (!expiryDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getBatchDiagnostics = (item: InventoryItem) => {
    const batches = item.batches || [];
    const totalBatches = batches.length;
    const unexpiredBatches = batches.filter((batch) => {
      if (batch.status === 'Expired') return false;
      const days = getDaysUntilExpiry(batch.expiry_date);
      return days === null || days >= 0;
    });
    const usableBatches = unexpiredBatches.filter((batch) => Number(batch.quantity_remaining || 0) > 0);

    return {
      totalBatches,
      unexpiredBatches,
      usableBatches,
      activeLotNumber: usableBatches[0]?.batch_number || item.batch_number || null,
    };
  };

  const getStockStatus = (item: InventoryItem) => {
    const stock = Number(item.current_stock || 0);
    const reorderLevel = Number(item.reorder_level || 0);
    const daysUntilExpiry = getDaysUntilExpiry(item.nearest_expiry_date || item.expiry_date);
    const { totalBatches, unexpiredBatches, usableBatches } = getBatchDiagnostics(item);

    if (item.item_type === 'Vaccine' && totalBatches === 0) return 'No Lot/Batch';
    if (totalBatches > 0 && unexpiredBatches.length === 0) return 'Expired';
    if (daysUntilExpiry !== null && daysUntilExpiry < 0) return 'Expired';
    if (stock === 0 || (item.item_type === 'Vaccine' && totalBatches > 0 && usableBatches.length === 0)) return 'Critical';
    if (daysUntilExpiry !== null && daysUntilExpiry <= 60) return 'Expiring Soon';
    if (stock <= reorderLevel) return 'Low Stock';
    return 'OK';
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'OK': return 'success';
      case 'No Lot/Batch': return 'warning';
      case 'Low Stock': return 'warning';
      case 'Critical': return 'danger';
      case 'Expiring Soon': return 'warning';
      case 'Expired': return 'danger';
      default: return 'neutral';
    }
  };

  const getStockPercentage = (stock: number, reorderLevel: number) => {
    if (reorderLevel <= 0) return stock > 0 ? 100 : 0;
    return Math.min(100, (stock / (reorderLevel * 2)) * 100);
  };

  const totalItems = inventory.length;
  const lowStockItems = inventory.filter(item => {
    const status = getStockStatus(item);
    return status === 'Low Stock' || status === 'Expiring Soon' || status === 'No Lot/Batch';
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
            title="Low / Expiring / Unbatched"
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
              <p className="mt-0.5 text-sm font-medium text-muted-foreground">
                <span className="font-semibold text-foreground">Product</span> = catalog item. <span className="font-semibold text-foreground">Lot / Batch</span> = dated vials with lot number, expiry date, and quantity (required for PEP Record Dose).
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
                {itemTypes.map((type) => <option key={type} value={type || ''}>{type}</option>)}
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
                <option value="No Lot/Batch">No Lot/Batch</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Critical">Critical</option>
                <option value="Expiring Soon">Expiring Soon</option>
                <option value="Expired">Expired</option>
              </select>
              {canCreateInventory && (
                <Button variant="primary" size="md" onClick={handleCreate}>
                  <Plus className="h-4 w-4" />
                  Add Product
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/60 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 text-left whitespace-nowrap">Vaccine/Supply Name</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Type</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Current Stock</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Unit</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Reorder Level</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Lot / Batch & Stock Details</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Nearest Expiry</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Last Updated</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Actions</th>
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
                    const { totalBatches, unexpiredBatches, usableBatches, activeLotNumber } = getBatchDiagnostics(item);
                    const matchedCatalog = findCatalogProduct(item.item_name, item.brand, productCatalog);
                    const displayBrand = item.brand || null;
                    const hasMoreMenu = canAdjustStock || canRecordUsage || canUpdateInventory || canDeleteInventory;
                    const isMenuOpen = openMenuId === String(item.id);
                    return (
                      <tr key={item.id} className="transition-colors hover:bg-muted/45">
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-semibold text-foreground">{item.item_name}</p>
                          {displayBrand && (
                            <p className="mt-0.5 text-sm font-medium text-muted-foreground">Brand: {displayBrand}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-muted-foreground">{item.item_type}</td>
                        <td className="px-4 py-3.5 text-sm font-semibold text-foreground whitespace-nowrap">{item.current_stock} {item.unit}</td>
                        <td className="px-4 py-3.5 text-sm text-muted-foreground">{item.unit}</td>
                        <td className="px-4 py-3.5 text-sm text-muted-foreground">{item.reorder_level}</td>
                        <td className="px-4 py-3.5">
                          <div className="w-52 space-y-1.5">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  status === 'OK' ? 'bg-success' :
                                  status === 'Low Stock' || status === 'Expiring Soon' || status === 'No Lot/Batch' ? 'bg-warning' : 'bg-destructive'
                                }`}
                                style={{ width: `${getStockPercentage(Number(item.current_stock || 0), Number(item.reorder_level || 0))}%` }}
                              ></div>
                            </div>
                            <p className="text-xs font-medium text-muted-foreground">
                              Reorder: {item.reorder_level}{item.critical_level ? ' | Critical: ' + item.critical_level : ''}
                            </p>
                            {totalBatches === 0 ? (
                              <p className="text-xs font-semibold text-amber-700">
                                No lot/batch recorded — click View Lots to enter lot no. &amp; expiry.
                              </p>
                            ) : usableBatches.length > 0 ? (
                              <p className="text-xs font-semibold text-emerald-700">
                                Lot {activeLotNumber} ({usableBatches.length} usable lot{usableBatches.length === 1 ? '' : 's'})
                              </p>
                            ) : unexpiredBatches.length === 0 ? (
                              <p className="text-xs font-semibold text-destructive">
                                All recorded lots expired — add a new batch.
                              </p>
                            ) : (
                              <p className="text-xs font-semibold text-amber-700">
                                Recorded lot(s) depleted (0 remaining) — restock a batch.
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                          {nearestExpiry ? (
                            <div className="flex items-center gap-2">
                              <CalendarClock className="h-4 w-4 text-muted-foreground" />
                              <span>{new Date(nearestExpiry).toLocaleDateString()}</span>
                              {daysUntilExpiry !== null && daysUntilExpiry <= 60 && (
                                <span className="text-xs font-semibold text-warning">{daysUntilExpiry < 0 ? 'Expired' : daysUntilExpiry + 'd'}</span>
                              )}
                            </div>
                          ) : totalBatches === 0 ? (
                            <span className="text-xs font-medium text-amber-700">No batch expiry</span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={getStatusVariant(status)}>
                            {status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                          {item.last_updated ? new Date(item.last_updated).toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-nowrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleViewBatches(item)}
                              className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border border-accent/20 bg-accent-bg px-3 text-sm font-semibold text-accent shadow-sm transition-colors hover:border-accent/40 hover:bg-accent-bg/80"
                              title="View Lots / Batches"
                              aria-label="View inventory batches"
                            >
                              <Layers className="h-3.5 w-3.5" />
                              <span>View Lots</span>
                            </button>
                            {hasMoreMenu && (
                              <div className="relative" data-inventory-more-menu>
                                <button
                                  type="button"
                                  onClick={() => setOpenMenuId(isMenuOpen ? null : String(item.id))}
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted"
                                  title="More product & stock actions"
                                  aria-label={`More actions for ${item.item_name}`}
                                  aria-expanded={isMenuOpen}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                                {isMenuOpen && (
                                  <div
                                    className="absolute right-0 z-30 mt-1.5 w-48 overflow-hidden rounded-2xl border border-border bg-card py-1 shadow-xl"
                                    role="menu"
                                  >
                                    {canAdjustStock && (
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => handleAddBatch(item)}
                                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                                      >
                                        <Plus className="h-3.5 w-3.5 text-primary" />
                                        <span>Add Batch / Restock</span>
                                      </button>
                                    )}
                                    {(canAdjustStock || canRecordUsage) && (
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => handleAdjustStock(item)}
                                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                                      >
                                        <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                                        <span>{isNurseInventoryView ? 'Record Usage' : 'Adjust Stock'}</span>
                                      </button>
                                    )}
                                    {canUpdateInventory && (
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => handleEdit(item)}
                                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                                      >
                                        <Edit className="h-3.5 w-3.5 text-primary" />
                                        <span>Edit Product</span>
                                      </button>
                                    )}
                                    {canDeleteInventory && (
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => handleRequestDeleteProduct(item)}
                                        className="flex w-full items-center gap-2.5 border-t border-border/60 px-3.5 py-2 text-left text-sm font-semibold text-destructive transition-colors hover:bg-destructive-bg/50"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                        <span>Delete Product</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
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
                  <span className="rounded-full border border-border bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
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
          item={editingItem || undefined}
          existingItems={inventory}
          catalog={productCatalog}
          onSwitchToAddBatch={(existingItem) => {
            setShowFormModal(false);
            setEditingItem(null);
            handleAddBatch(existingItem as InventoryItem);
          }}
          onClose={handleFormModalClose}
        />
      )}

      {showBatchModal && (
        <InventoryBatchModal
          mode={batchModalMode}
          item={
            selectedBatchItem
              ? inventory.find((inv) => String(inv.id) === String(selectedBatchItem.id)) || selectedBatchItem
              : undefined
          }
          inventoryItems={inventory}
          canAddBatch={canAdjustStock}
          canDeleteBatch={canDeleteInventory}
          onSwitchToAdd={() => setBatchModalMode('add')}
          onBatchMutated={() => void loadInventory()}
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

      {deletingItem && canDeleteInventory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-product-modal-title"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="flex items-start gap-3 border-b border-border px-6 py-4">
              <div className="rounded-2xl bg-destructive-bg p-2.5 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="delete-product-modal-title" className="text-base font-extrabold text-foreground">
                  Delete Inventory Product Permanently?
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Permanent deletion cannot be undone.
                </p>
              </div>
            </div>

            <div className="space-y-3 px-6 py-4 text-sm">
              <div className="grid grid-cols-1 gap-2 rounded-2xl border border-border bg-muted/40 p-3.5 sm:grid-cols-2">
                <div>
                  <span className="font-semibold text-muted-foreground">Product Name:</span>
                  <p className="mt-0.5 text-sm font-bold text-foreground">{deletingItem.item_name}</p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Current Stock:</span>
                  <p className="mt-0.5 text-sm font-bold text-foreground">
                    {deletingItem.current_stock ?? 0} {deletingItem.unit} ({(deletingItem.batches?.length || 0)} lot{(deletingItem.batches?.length || 0) === 1 ? '' : 's'})
                  </p>
                </div>
              </div>

              {(deletingItem.batches?.length || 0) > 0 ? (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-amber-950">
                  <p className="font-bold">
                    This product still has {deletingItem.batches?.length} recorded lot/batch(es).
                  </p>
                  <p className="mt-1 text-amber-900">
                    Products with recorded lots, stock transactions, or PEP vaccination dose references cannot be deleted directly. Open <span className="font-semibold">View Lots</span> to delete unused test lots first, or use <span className="font-semibold">Adjust Stock</span> if a lot has clinical history.
                  </p>
                  <div className="mt-2.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const target = deletingItem;
                        setDeletingItem(null);
                        handleViewBatches(target);
                      }}
                    >
                      Open View Lots
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  This will permanently remove <span className="font-semibold text-foreground">{deletingItem.item_name}</span> from Inventory. If the product has historical stock transactions or PEP dose references, deletion will be blocked to protect clinical and audit integrity.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingItem(null)}
                disabled={deletingProductLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmDeleteProduct}
                disabled={deletingProductLoading}
              >
                {deletingProductLoading ? 'Deleting...' : 'Delete Product Permanently'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
