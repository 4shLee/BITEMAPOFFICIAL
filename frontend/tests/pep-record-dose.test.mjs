import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pep = await readFile(new URL('../src/app/pages/PEPSchedule.tsx', import.meta.url), 'utf8').then((s) => s.replace(/\r\n/g, '\n'));
const inventoryPage = await readFile(new URL('../src/app/pages/Inventory.tsx', import.meta.url), 'utf8').then((s) => s.replace(/\r\n/g, '\n'));
const inventoryFormModal = await readFile(new URL('../src/app/components/Inventory/InventoryFormModal.tsx', import.meta.url), 'utf8').then((s) => s.replace(/\r\n/g, '\n'));
const inventoryBatchModal = await readFile(new URL('../src/app/components/Inventory/InventoryBatchModal.tsx', import.meta.url), 'utf8').then((s) => s.replace(/\r\n/g, '\n'));
const inventoryCatalog = await readFile(new URL('../src/lib/inventoryCatalog.ts', import.meta.url), 'utf8').then((s) => s.replace(/\r\n/g, '\n'));
const modal = pep.slice(pep.indexOf('{recordDose && ('), pep.indexOf('{rescheduleDose && ('));

test('Record Dose submits the selected product and batch identifiers and auto-selects a single eligible batch', () => {
  assert.match(pep, /inventory_id: Number\(recordForm\.inventoryItemId\)/);
  assert.match(pep, /inventory_batch_id: Number\(recordForm\.inventoryBatchId\)/);
  assert.match(modal, /<option key=\{item\.id\} value=\{item\.id\}>/);
  assert.match(modal, /<option key=\{batch\.id\} value=\{batch\.id\}>/);
  assert.match(modal, /inventoryBatchId: nextBatches\.length === 1 \? String\(nextBatches\[0\]\.id\) : ''/);
});

test('products without a usable batch get an explanatory state and a direct action to open Inventory', () => {
  assert.match(pep, /response\.meta\?\.unavailable/);
  assert.match(modal, /No vaccine with an unexpired lot\/batch is available\./);
  assert.match(modal, /Add a batch in Inventory → Add Batch \/ Restock\./);
  assert.match(modal, /Add Batch in Inventory/);
  assert.match(modal, /Unavailable in product list:/);
  assert.match(pep, /no_batch: 'no lot\/batch recorded'/);
});

test('Inventory page highlights unbatched vaccines and supports Add Batch navigation from Record Dose', () => {
  assert.match(inventoryPage, /'No Lot\/Batch'/);
  assert.match(inventoryPage, /No lot\/batch recorded — click Add Batch \/ Restock to enter lot no\. &amp; expiry\./);
  assert.match(inventoryPage, /openAddBatchForId/);
  assert.match(inventoryFormModal, /Initial Lot \/ Batch Details/);
  assert.match(inventoryFormModal, /batch_number: formData\.batch_number\.trim\(\)/);
  assert.match(inventoryBatchModal, /Unbatched stock detected:/);
  assert.match(inventoryBatchModal, /Add Batch \/ Restock Now/);
});

test('inventory API failures are shown with a retry action', () => {
  assert.match(pep, /setInventoryOptionsError\(getErrorMessage\(error, 'Unable to load vaccine inventory options\.'\)\)/);
  assert.match(modal, /inventoryOptionsError &&/);
  assert.match(modal, /void loadDoseInventoryOptions\(\)/);
});

test('Record Dose blocks duplicate submissions and refreshes options after a failed save', () => {
  assert.match(pep, /doseSubmittingRef\.current\) return/);
  assert.match(pep, /doseSubmittingRef\.current = false/);
  assert.match(pep, /toast\.error\(getErrorMessage\(error, 'Failed to record dose\.'\)\);\n\s+invalidateDoseInventoryOptions\(\);/);
  assert.match(modal, /disabled=\{savingDose \|\| inventoryOptionsLoading\}/);
});

test('required-field messages appear only after a submit attempt and fields keep required labels', () => {
  assert.match(modal, /doseSubmitAttempted && !recordForm\.administrationRoute/);
  assert.match(modal, /Administration Route \*/);
  assert.match(modal, /Vaccine Product \*/);
  assert.match(modal, /Vaccine Lot \/ Batch \*/);
  assert.match(modal, /Date Administered \*/);
});

test('Record Dose form is compact: two-column grid, no long explanatory paragraphs', () => {
  assert.match(modal, /grid grid-cols-1 gap-x-3 gap-y-2\.5 p-4 sm:grid-cols-2/);
  assert.match(modal, /max-w-2xl/);
  assert.doesNotMatch(modal, /Encode administered vaccine details for this dose\./);
  assert.doesNotMatch(modal, /intradermal and intramuscular vial-consumption rules are still under validation/);
  assert.match(modal, /deducts 1 unit from available stock/);
});

test('Add Inventory Product uses the four approved clinic products with brand, purpose, and duplicate protection', () => {
  assert.match(inventoryCatalog, /Anti-Rabies Vaccine — Abhayrab/);
  assert.match(inventoryCatalog, /Tetanus Toxoid — Abhaytox \/ Bett/);
  assert.match(inventoryCatalog, /Equine RIG \(eRIG\) — Equirab/);
  assert.match(inventoryCatalog, /Human RIG \(hRIG\) — Berirab/);
  assert.match(inventoryFormModal, /Select clinic vaccine or immunoglobulin product/);
  assert.match(inventoryFormModal, /handleProductSelect\(e\.target\.value\)/);
  assert.match(inventoryFormModal, /duplicateExistingItem/);
  assert.match(inventoryFormModal, /Open Add Batch \/ Restock/);
});

test('Inventory table simplifies row actions and supports confirmed product and batch deletion', async () => {
  const stockAdjustmentModal = await readFile(new URL('../src/app/components/Inventory/StockAdjustmentModal.tsx', import.meta.url), 'utf8').then((s) => s.replace(/\r\n/g, '\n'));
  assert.match(inventoryPage, /View Lots \(\{totalBatches\}\)/);
  assert.match(inventoryPage, /Add Batch \/ Restock/);
  assert.match(inventoryPage, /\+ Add Product/);
  assert.match(inventoryPage, /data-inventory-more-menu/);
  assert.match(inventoryPage, /Delete Product/);
  assert.match(inventoryPage, /Delete Inventory Product Permanently\?/);
  assert.match(inventoryBatchModal, /Delete Lot \/ Batch Permanently\?/);
  assert.match(inventoryBatchModal, /Delete Lot Permanently/);
  assert.match(inventoryFormModal, /Current Stock \(Read-Only\)/);
  assert.doesNotMatch(stockAdjustmentModal, /value: 'Restock'/);
  assert.doesNotMatch(stockAdjustmentModal, /value: 'Received'/);
});
