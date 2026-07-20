import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pepSchedule = await readFile(new URL('../src/app/pages/PEPSchedule.tsx', import.meta.url), 'utf8');

test('patient schedule selection uses an accessible searchable combobox', () => {
  assert.match(pepSchedule, /function PatientIncidentCombobox/);
  assert.match(pepSchedule, /role="combobox"/);
  assert.match(pepSchedule, /aria-controls="pep-patient-incident-listbox"/);
  assert.match(pepSchedule, /Search patient name, contact number, or incident ID/);
  assert.match(pepSchedule, /No matching patient incidents found\./);
  assert.match(pepSchedule, /<CommandList id="pep-patient-incident-listbox"/);
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
  assert.match(pepSchedule, /useEffect\(\(\) => \{\s*loadSchedule\(\);\s*\}, \[\]\)/);
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
  assert.match(pepSchedule, /if \(!nextOpen\) setSearchText\(''\)/);
});
