import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const incidentReport = await readFile(new URL('../src/app/pages/IncidentReport.tsx', import.meta.url), 'utf8');
const mainLayout = await readFile(new URL('../src/app/components/Layout/MainLayout.tsx', import.meta.url), 'utf8');
const patientForm = await readFile(new URL('../src/app/pages/PatientRecordForm.tsx', import.meta.url), 'utf8');
const apiService = await readFile(new URL('../src/lib/services/api.ts', import.meta.url), 'utf8');
const theme = await readFile(new URL('../src/styles/theme.css', import.meta.url), 'utf8');

test('existing patient validation excludes new-patient-only fields', () => {
  assert.match(incidentReport, /!isEditMode && formData\.patientType === 'new'/);
  assert.match(incidentReport, /isEditMode \|\| formData\.patientType === 'existing' \? incidentPayload/);
  assert.match(incidentReport, /if \(contactError\) nextErrors\.contact = contactError/);
  assert.doesNotMatch(incidentReport, /nextErrors\.contact = contactNumberError/);
});

test('Laravel field errors are retained and mapped to visible controls', () => {
  assert.match(apiService, /data\.errors \|\| \{\}/);
  assert.match(incidentReport, /mapBackendErrors\(error\.errors\)/);
  assert.match(incidentReport, /pep_start_date: 'pepStartDate'/);
});

test('PEP preview is based on PEP Start Date rather than Date of Incident', () => {
  assert.match(incidentReport, /addDaysToDateKey\(formData\.pepStartDate, day\)/);
  assert.doesNotMatch(incidentReport, /addDaysToDateKey\(formData\.incidentDate, day\)/);
  assert.match(incidentReport, /Schedule based on PEP Start Date/);
});

test('the authenticated layout has one primary page scroll owner', () => {
  assert.match(mainLayout, /data-primary-scroll-container/);
  assert.equal((mainLayout.match(/overflow-y-auto/g) || []).length, 1);
  assert.match(mainLayout, /max-md:hidden/);
  assert.match(mainLayout, /md:ml-64/);
  assert.doesNotMatch(incidentReport, /max-md:overflow-y-auto/);
  assert.doesNotMatch(patientForm, /max-md:overflow-y-auto/);
  assert.match(mainLayout, /document\.documentElement\.classList\.add\('bitemap-app-shell'\)/);
  assert.match(theme, /html\.bitemap-app-shell,[\s\S]*overflow: hidden/);
});

test('route navigation resets the actual content scroll container', () => {
  assert.match(mainLayout, /contentRef\.current\?\.scrollTo\(\{ top: 0, left: 0 \}\)/);
  assert.match(mainLayout, /\[location\.pathname, location\.search\]/);
  assert.doesNotMatch(mainLayout, /window\.scrollTo/);
});

test('validation scrolling is submit-driven and targets only the first invalid field', () => {
  assert.match(incidentReport, /querySelector<HTMLElement>\('\[aria-invalid="true"\]'\)/);
  assert.doesNotMatch(incidentReport, /querySelectorAll<HTMLElement>\('\[aria-invalid="true"\]'\)/);
  assert.equal((incidentReport.match(/focusFirstInvalidField\(\);/g) || []).length, 2);
});
