import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pep = await readFile(new URL('../src/app/pages/PEPSchedule.tsx', import.meta.url), 'utf8').then((s) => s.replace(/\r\n/g, '\n'));
const modal = pep.slice(pep.indexOf('{recordDose && ('), pep.indexOf('{rescheduleDose && ('));

test('Record Dose submits the selected product and batch identifiers', () => {
  assert.match(pep, /inventory_id: Number\(recordForm\.inventoryItemId\)/);
  assert.match(pep, /inventory_batch_id: Number\(recordForm\.inventoryBatchId\)/);
  assert.match(modal, /<option key=\{item\.id\} value=\{item\.id\}>/);
  assert.match(modal, /<option key=\{batch\.id\} value=\{batch\.id\}>/);
});

test('products with stock but no usable batch get an explanatory empty state, not a silent empty list', () => {
  assert.match(pep, /response\.meta\?\.unavailable/);
  assert.match(modal, /No vaccine with an unexpired lot\/batch is available\./);
  assert.match(modal, /Add a batch in Inventory/);
  assert.match(pep, /no_batch: 'no lot\/batch recorded'/);
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
  assert.match(modal, /stock is not deducted automatically/);
});
