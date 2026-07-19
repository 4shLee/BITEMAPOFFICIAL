export type PatientLike = {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  suffix?: string | null;
  full_name?: string | null;
  address?: string | null;
  address_line?: string | null;
  residence_barangay?: string | null;
  city_municipality?: string | null;
  province?: string | null;
};

export const PATIENT_SUFFIX_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'Jr.', label: 'Jr.' },
  { value: 'Sr.', label: 'Sr.' },
  { value: 'II', label: 'II' },
  { value: 'III', label: 'III' },
  { value: 'IV', label: 'IV' },
  { value: 'V', label: 'V' },
];

export function normalizePatientText(value?: string | null) {
  return (value || '').trim().replace(/\s+/g, ' ');
}

export function composePatientFullName(patient: PatientLike) {
  const structured = [
    patient.first_name,
    patient.middle_name,
    patient.last_name,
    patient.suffix,
  ].map(normalizePatientText).filter(Boolean).join(' ');

  return structured || normalizePatientText(patient.full_name);
}

export function getPatientDisplayName(patient: PatientLike) {
  const firstName = normalizePatientText(patient.first_name);
  const middleName = normalizePatientText(patient.middle_name);
  const lastName = normalizePatientText(patient.last_name);
  const suffix = normalizePatientText(patient.suffix);

  if (!firstName || !lastName) return normalizePatientText(patient.full_name);

  const firstMiddleWord = middleName.split(' ').find(Boolean);
  const middleInitial = firstMiddleWord ? `${Array.from(firstMiddleWord)[0]}.` : '';
  return [firstName, middleInitial, lastName, suffix].filter(Boolean).join(' ');
}

export function splitLegacyPatientName(fullName?: string | null) {
  const parts = normalizePatientText(fullName).split(' ').filter(Boolean);
  const suffixValues = new Set(['Jr.', 'Sr.', 'II', 'III', 'IV', 'V']);
  const suffix = suffixValues.has(parts.at(-1) || '') ? parts.pop() || '' : '';

  if (parts.length < 2) {
    return { firstName: parts[0] || '', middleName: '', lastName: '', suffix };
  }

  return {
    firstName: parts[0],
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
    lastName: parts.at(-1) || '',
    suffix,
  };
}

export function getPatientNameFields(patient?: PatientLike | null) {
  if (!patient) return { firstName: '', middleName: '', lastName: '', suffix: '' };
  if (patient.first_name || patient.middle_name || patient.last_name || patient.suffix) {
    return {
      firstName: normalizePatientText(patient.first_name),
      middleName: normalizePatientText(patient.middle_name),
      lastName: normalizePatientText(patient.last_name),
      suffix: normalizePatientText(patient.suffix),
    };
  }

  return splitLegacyPatientName(patient.full_name);
}

export function composePatientAddress(patient: PatientLike) {
  const structured = [
    patient.address_line,
    patient.residence_barangay,
    patient.city_municipality,
    patient.province,
  ].map(normalizePatientText).filter(Boolean).join(', ');

  return structured || normalizePatientText(patient.address);
}

export function isValidPatientName(value: string, minimumLength: number) {
  const normalized = normalizePatientText(value);
  return normalized.length >= minimumLength
    && normalized.length <= 50
    && /^(?=.*\p{L})[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(normalized);
}

export function contactNumberError(value: string, smsPermission: boolean) {
  const contact = value.trim();
  if (!contact) return smsPermission ? 'A valid contact number is required to enable SMS reminders.' : undefined;
  if (!/^\d{11}$/.test(contact)) return 'Contact number must contain exactly 11 digits.';
  if (!contact.startsWith('09')) return 'Contact number must start with 09.';
  return undefined;
}
