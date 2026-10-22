import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const patientRecordForm = await readFile(new URL('../src/app/pages/PatientRecordForm.tsx', import.meta.url), 'utf8');
const patientsPage = await readFile(new URL('../src/app/pages/Patients.tsx', import.meta.url), 'utf8');
const patientHelpers = await readFile(new URL('../src/lib/patient.ts', import.meta.url), 'utf8');

test('valid contact number does not create an undefined contactNumber error key in PatientRecordForm', () => {
  assert.match(patientRecordForm, /const contactError = contactNumberError\(formData\.contactNumber, formData\.smsConsent\)/);
  assert.match(patientRecordForm, /if \(contactError\) nextErrors\.contactNumber = contactError/);
  assert.doesNotMatch(patientRecordForm, /nextErrors\.contactNumber\s*=\s*contactNumberError/);
});

test('PatientRecordForm maps Laravel field validation errors and focuses the first invalid control', () => {
  assert.match(patientRecordForm, /import \{ ApiError, getErrorMessage, patientsAPI \}/);
  assert.match(patientRecordForm, /if \(error instanceof ApiError && Object\.keys\(error\.errors\)\.length > 0\)/);
  assert.match(patientRecordForm, /const backendErrors = mapBackendErrors\(error\.errors\)/);
  assert.match(patientRecordForm, /contact_number: 'contactNumber'/);
  assert.match(patientRecordForm, /residence_barangay: 'residenceBarangay'/);
  assert.match(patientRecordForm, /focusFirstInvalidField\(\)/);
});

test('PatientRecordForm guards against duplicate submissions while a request is in progress', () => {
  assert.match(patientRecordForm, /const isSubmittingRef = useRef\(false\)/);
  assert.match(patientRecordForm, /if \(saving \|\| isSubmittingRef\.current\) return/);
  assert.match(patientRecordForm, /isSubmittingRef\.current = true/);
  assert.match(patientRecordForm, /isSubmittingRef\.current = false/);
  assert.match(patientRecordForm, /disabled=\{saving\}/);
});

test('PatientRecordForm only shows success toast and navigates after API creation or update resolves', () => {
  const submitBlock = patientRecordForm.slice(
    patientRecordForm.indexOf('const handleSubmit = async'),
    patientRecordForm.indexOf('if (!canSavePatient && !isEditMode)')
  );

  const createCallIndex = submitBlock.indexOf('patientsAPI.create(payload)');
  const successToastIndex = submitBlock.indexOf("toast.success(isEditMode ? 'Patient record updated successfully.' : 'Patient record created successfully.')");
  const navigateIndex = submitBlock.indexOf("navigate('/patients/' + patientId)");

  assert.ok(createCallIndex > -1);
  assert.ok(successToastIndex > createCallIndex);
  assert.ok(navigateIndex > successToastIndex);
});

test('Patient Registry list loads fresh records on mount and displays structured residence barangay', () => {
  assert.match(patientsPage, /patientsAPI\.getAll\(/);
  assert.match(patientsPage, /patient\.residence_barangay \|\| patient\.barangay\?\.name \|\| 'Not recorded'/);
  assert.match(patientHelpers, /export function contactNumberError/);
});
