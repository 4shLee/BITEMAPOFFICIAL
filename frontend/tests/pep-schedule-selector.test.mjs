import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pepSchedule = await readFile(new URL('../src/app/pages/PEPSchedule.tsx', import.meta.url), 'utf8');
const comboboxSource = pepSchedule.slice(
  pepSchedule.indexOf('function PatientIncidentCombobox'),
  pepSchedule.indexOf('export function PEPSchedule')
);

test('patient schedule selection uses an accessible searchable combobox', () => {
  assert.match(pepSchedule, /function PatientIncidentCombobox/);
  assert.match(pepSchedule, /role="combobox"/);
  assert.match(pepSchedule, /aria-controls="pep-patient-incident-listbox"/);
  assert.match(pepSchedule, /Search patient name, contact number, or incident ID/);
  assert.match(pepSchedule, /No matching patient incidents found\./);
  assert.match(pepSchedule, /<CommandList\s+[\s\S]*?id="pep-patient-incident-listbox"/);
  assert.doesNotMatch(pepSchedule, /<label className="block text-sm font-bold text-foreground">Patient Schedule<\/label>[\s\S]{0,300}<select/);
});

test('client-side search covers names, compact text, contacts, and incident IDs', () => {
  assert.match(pepSchedule, /function matchesScheduleSearch/);
  assert.match(pepSchedule, /group\.patient/);
  assert.match(pepSchedule, /group\.contact_number/);
  assert.match(pepSchedule, /'Incident #' \+ group\.incidentId/);
  assert.match(pepSchedule, /compactScheduleSearch\(searchableText\)\.includes\(compactScheduleSearch\(normalizedQuery\)\)/);
  assert.match(pepSchedule, /filter\(\(group\) => matchesScheduleSearch\(group, searchText\)\)/);
  assert.match(pepSchedule, /scheduleSearchRank\(left, searchText\) - scheduleSearchRank\(right, searchText\)/);
});

test('selection updates the incident deep link without search-time API requests', () => {
  assert.match(pepSchedule, /params\.set\('incident_id', incidentId\)/);
  assert.match(pepSchedule, /navigate\(location\.pathname \+ '\?' \+ params\.toString\(\), \{ replace: true \}\)/);
  assert.match(pepSchedule, /window\.setTimeout\(\(\) => void loadSchedule\(\), 0\)/);
  assert.match(pepSchedule, /\}, \[loadSchedule\]\)/);
  assert.match(pepSchedule, /\[groups, loadError, loading, requestedIncidentId\]/);
});

test('loading, API failure, empty data, and no-result states remain distinct', () => {
  assert.match(pepSchedule, /Loading patient schedules…/);
  assert.match(pepSchedule, /Unable to load patient schedules\./);
  assert.match(pepSchedule, />Retry<\/Button>/);
  assert.match(pepSchedule, /No PEP schedules available\./);
  assert.match(pepSchedule, /No matching patient incidents found\./);
});

test('Escape explicitly closes and clears the patient incident search', () => {
  assert.match(pepSchedule, /if \(event\.key === 'Escape'\)/);
  assert.match(pepSchedule, /event\.stopPropagation\(\)/);
  assert.match(pepSchedule, /handleOpenChange\(false\)/);
  assert.match(pepSchedule, /if \(!nextOpen\) \{[\s\S]*?setSearchText\(''\)/);
});

test('combobox interaction styling uses scoped green and neutral states without blue', () => {
  assert.doesNotMatch(comboboxSource, /blue/i);
  assert.match(comboboxSource, /hover:bg-slate-50/);
  assert.match(comboboxSource, /data-\[selected=true\]:bg-emerald-50!/);
  assert.match(comboboxSource, /data-\[current=true\]:border-l-emerald-600/);
  assert.match(comboboxSource, /focus-visible:ring-emerald-600/);
  assert.match(comboboxSource, /<Check /);
});

test('combobox panel and rows remain compact and responsive', () => {
  assert.match(comboboxSource, /w-\[var\(--radix-popover-trigger-width\)\]/);
  assert.match(comboboxSource, /max-w-\[calc\(100vw-1\.5rem\)\]/);
  assert.match(comboboxSource, /max-h-64/);
  assert.match(comboboxSource, /scrollbar-width:thin/);
  assert.match(comboboxSource, /min-h-\[68px\]/);
  assert.match(comboboxSource, /title=\{group\.patient\}/);
});

test('closed selector and compact states use the polished combobox surface', () => {
  assert.match(comboboxSource, /<ChevronDown/);
  assert.match(comboboxSource, /open \? 'rotate-180'/);
  assert.doesNotMatch(comboboxSource, /ChevronsUpDown/);
  assert.match(comboboxSource, /loading \? \(/);
  assert.match(comboboxSource, /loadError \? \(/);
  assert.match(comboboxSource, /groups\.length === 0 \? \(/);
  assert.match(comboboxSource, /onClick=\{onRetry\}>Retry<\/Button>/);
  assert.doesNotMatch(comboboxSource, /heading="Patient incidents"/);
});

test('initial schedule rendering does not wait for inventory', () => {
  const loadScheduleSource = pepSchedule.slice(
    pepSchedule.indexOf('const loadSchedule = useCallback'),
    pepSchedule.indexOf('const invalidateDoseInventoryOptions')
  );

  assert.match(loadScheduleSource, /pepScheduleAPI\.getAll\(controller\.signal\)/);
  assert.doesNotMatch(loadScheduleSource, /Promise\.all/);
  assert.doesNotMatch(loadScheduleSource, /inventoryAPI\.getAll/);
  assert.match(loadScheduleSource, /setLoading\(false\)/);
});

test('dose inventory options are lazy, cancelable, and invalidated after mutations', () => {
  assert.match(pepSchedule, /pepScheduleAPI\.getDoseInventoryOptions\(controller\.signal\)/);
  assert.match(pepSchedule, /const controller = new AbortController\(\)/);
  assert.match(pepSchedule, /void loadDoseInventoryOptions\(\)/);
  assert.match(pepSchedule, /inventoryRequestRef\.current\?\.abort\(\)/);
  assert.match(pepSchedule, /invalidateDoseInventoryOptions\(\);[\s\S]*?await loadSchedule\(\)/);
});
