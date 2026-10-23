export type InventoryCatalogProduct = {
  key: string;
  product_name: string;
  brand: string;
  item_name: string;
  label: string;
  item_type: 'Vaccine' | 'Immunoglobulin' | 'Medicine' | 'Supply';
  purpose: string;
  is_pep_vaccine: boolean;
  aliases?: string[];
};

export const INVENTORY_PRODUCT_CATALOG: InventoryCatalogProduct[] = [
  {
    key: 'anti_rabies_vaccine',
    product_name: 'Anti-Rabies Vaccine',
    brand: 'Abhayrab',
    item_name: 'Anti-Rabies Vaccine — Abhayrab',
    label: 'Anti-Rabies Vaccine — Abhayrab',
    item_type: 'Vaccine',
    purpose: 'PEP for all bite categories.',
    is_pep_vaccine: true,
    aliases: [
      'anti-rabies vaccine — abhayrab',
      'anti-rabies vaccine - abhayrab',
      'anti-rabies vaccine (abhayrab)',
      'anti-rabies vaccine',
      'anti rabies vaccine',
    ],
  },
  {
    key: 'tetanus_toxoid',
    product_name: 'Tetanus Toxoid',
    brand: 'Abhaytox / Bett',
    item_name: 'Tetanus Toxoid — Abhaytox / Bett',
    label: 'Tetanus Toxoid — Abhaytox / Bett',
    item_type: 'Vaccine',
    purpose: 'Active tetanus immunization.',
    is_pep_vaccine: false,
    aliases: [
      'tetanus toxoid — abhaytox / bett',
      'tetanus toxoid - abhaytox / bett',
      'tetanus toxoid (abhaytox / bett)',
      'tetanus toxoid',
    ],
  },
  {
    key: 'equine_rig',
    product_name: 'Equine RIG (eRIG)',
    brand: 'Equirab',
    item_name: 'Equine RIG (eRIG) — Equirab',
    label: 'Equine RIG (eRIG) — Equirab',
    item_type: 'Immunoglobulin',
    purpose: 'Passive immunization; Category III according to the interview record.',
    is_pep_vaccine: false,
    aliases: [
      'equine rig (erig) — equirab',
      'equine rig (erig) - equirab',
      'equine rig (erig)',
      'equine rig',
    ],
  },
  {
    key: 'human_rig',
    product_name: 'Human RIG (hRIG)',
    brand: 'Berirab',
    item_name: 'Human RIG (hRIG) — Berirab',
    label: 'Human RIG (hRIG) — Berirab',
    item_type: 'Immunoglobulin',
    purpose: 'Passive immunization; Category III according to the interview record.',
    is_pep_vaccine: false,
    aliases: [
      'human rig (hrig) — berirab',
      'human rig (hrig) - berirab',
      'human rig (hrig)',
      'human rig',
    ],
  },
];

export function normalizeInventoryProductName(value?: string | null): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function findCatalogProduct(
  itemName?: string | null,
  brand?: string | null,
  catalog: InventoryCatalogProduct[] = INVENTORY_PRODUCT_CATALOG
): InventoryCatalogProduct | null {
  const normalizedName = normalizeInventoryProductName(itemName);
  if (!normalizedName) return null;

  for (const product of catalog) {
    const defaultMatch = INVENTORY_PRODUCT_CATALOG.find((item) => item.key === product.key);
    const aliases = (product.aliases || defaultMatch?.aliases || []).map(normalizeInventoryProductName);
    if (
      normalizedName === normalizeInventoryProductName(product.item_name)
      || normalizedName === normalizeInventoryProductName(product.product_name)
      || normalizedName === normalizeInventoryProductName(product.key)
      || aliases.includes(normalizedName)
    ) {
      return product;
    }
  }

  const normalizedBrand = normalizeInventoryProductName(brand);
  if (normalizedBrand) {
    for (const product of catalog) {
      if (normalizedBrand === normalizeInventoryProductName(product.brand)) {
        return product;
      }
    }
  }

  return null;
}

export function findDuplicateInventoryProduct<T extends { id: number | string; item_name?: string | null; brand?: string | null }>(
  itemName?: string | null,
  existingItems: T[] = [],
  ignoreId?: number | string | null,
  catalog: InventoryCatalogProduct[] = INVENTORY_PRODUCT_CATALOG
): T | null {
  const normalizedTarget = normalizeInventoryProductName(itemName);
  if (!normalizedTarget) return null;

  const targetCatalog = findCatalogProduct(itemName, null, catalog);

  for (const existing of existingItems) {
    if (ignoreId != null && String(existing.id) === String(ignoreId)) continue;
    const normalizedExisting = normalizeInventoryProductName(existing.item_name);
    if (!normalizedExisting) continue;

    if (normalizedExisting === normalizedTarget) {
      return existing;
    }

    if (targetCatalog) {
      const existingCatalog = findCatalogProduct(existing.item_name, existing.brand, catalog);
      if (existingCatalog && existingCatalog.key === targetCatalog.key) {
        return existing;
      }
    }
  }

  return null;
}
