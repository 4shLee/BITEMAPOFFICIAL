import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertCircle, CalendarDays, CheckCircle2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Layout/Header';
import { IncidentLocationPicker } from '../components/Incidents/IncidentLocationPicker';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Button } from '../components/UI/Button';
import { barangaysAPI, incidentsAPI, patientsAPI } from '../../lib/services/api';
import { getStoredUser, normalizeRoleKey } from '../../lib/auth/roleAccess';
import {
  PATIENT_SUFFIX_OPTIONS,
  composePatientAddress,
  composePatientFullName,
  contactNumberError,
  getPatientDisplayName,
  getPatientNameFields,
  isValidPatientName,
  normalizePatientText,
} from '../../lib/patient';

type PatientOption = {
  id: number | string;
  full_name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
  age?: number | string;
  sex?: string;
  address?: string;
  address_line?: string;
  residence_barangay?: string;
  city_municipality?: string;
  province?: string;
  contact_number?: string;
  barangay_id?: number | string;
  sms_consent?: boolean | number | null;
};

type BarangayOption = {
  id: number | string;
  name: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

type FormErrors = Partial<Record<keyof IncidentFormData | 'patientSelection', string>>;

type IncidentFormData = {
  patientType: 'existing' | 'new';
  patientId: string;
  patientSearch: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  age: string;
  sex: string;
  addressLine: string;
  residenceBarangay: string;
  cityMunicipality: string;
  province: string;
  legacyAddress: string;
  contact: string;
  smsConsent: boolean;
  incidentDate: string;
  incidentTime: string;
  firstConsultDate: string;
  animalType: string;
  exposureType: string;
  animalStatus: string;
  animalCondition: string;
  woundWashed: string;
  biteSite: string;
  whoCategory: string;
  status: string;
  locationScope: '' | 'within_digos' | 'outside_digos';
  barangayId: string;
  locationLat: string;
  locationLng: string;
  locationMode: 'none' | 'barangay' | 'exact';
  incidentCityMunicipality: string;
  incidentProvince: string;
  incidentSpecificLocation: string;
};

const DIGOS_BARANGAY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  Aplaya: { lat: 6.7600, lng: 125.3425 },
  Balabag: { lat: 6.7400, lng: 125.3575 },
  Binaton: { lat: 6.8300, lng: 125.3700 },
  Cogon: { lat: 6.7650, lng: 125.3875 },
  Colorado: { lat: 6.7560, lng: 125.3150 },
  Dawis: { lat: 6.7600, lng: 125.3725 },
  Dulangan: { lat: 6.8100, lng: 125.3600 },
  Goma: { lat: 6.7400, lng: 125.3200 },
  Igpit: { lat: 6.7240, lng: 125.3480 },
  Kapatagan: { lat: 6.8050, lng: 125.3300 },
  Kiagot: { lat: 6.7830, lng: 125.3910 },
  Lungag: { lat: 6.6700, lng: 125.3000 },
  Mahayahay: { lat: 6.7400, lng: 125.3425 },
  Matti: { lat: 6.7560, lng: 125.3340 },
  Ruparan: { lat: 6.7800, lng: 125.3500 },
  'San Agustin': { lat: 6.7650, lng: 125.3500 },
  'San Jose': { lat: 6.7600, lng: 125.3575 },
  'San Miguel': { lat: 6.7330, lng: 125.3580 },
  'San Roque': { lat: 6.7550, lng: 125.3250 },
  Sinawilan: { lat: 6.7750, lng: 125.4100 },
  Soong: { lat: 6.7000, lng: 125.3200 },
  Tiguman: { lat: 6.7400, lng: 125.3725 },
  'Tres De Mayo': { lat: 6.7610, lng: 125.3660 },
  'Zone 1': { lat: 6.7500, lng: 125.3525 },
  'Zone 2': { lat: 6.7500, lng: 125.3675 },
  'Zone 3': { lat: 6.7480, lng: 125.3800 },
};

const initialFormData: IncidentFormData = {
  patientType: 'new',
  patientId: '',
  patientSearch: '',
  firstName: '',
  middleName: '',
  lastName: '',
  suffix: '',
  age: '',
  sex: '',
  addressLine: '',
  residenceBarangay: '',
  cityMunicipality: 'Digos City',
  province: 'Davao del Sur',
  legacyAddress: '',
  contact: '',
  smsConsent: false,
  incidentDate: '',
  incidentTime: '',
  firstConsultDate: '',
  animalType: '',
  exposureType: 'Bite',
  animalStatus: 'Unknown',
  animalCondition: 'Under observation',
  woundWashed: '',
  biteSite: '',
  whoCategory: '',
  status: 'Active',
  locationScope: '',
  barangayId: '',
  locationLat: '',
  locationLng: '',
  locationMode: 'none',
  incidentCityMunicipality: '',
  incidentProvince: '',
  incidentSpecificLocation: '',
};

const fallbackBarangays: BarangayOption[] = [
  { id: '1', name: 'Aplaya' },
  { id: '2', name: 'San Jose' },
  { id: '3', name: 'Dawis' },
  { id: '4', name: 'Zone 1' },
  { id: '5', name: 'Zone 2' },
  { id: '6', name: 'Mahayahay' },
  { id: '7', name: 'Balabag' },
  { id: '8', name: 'Tiguman' },
];

const categoryGuidance: Record<string, string> = {
  I: 'No PEP required if reliable history. Provide health advice.',
  II: 'PEP vaccination recommended.',
  III: 'PEP vaccination and RIG evaluation recommended.',
};

const categoryCards = [
  {
    value: 'I',
    label: 'Category I',
    risk: 'Low risk',
    desc: 'Touching/feeding animals, licks on intact skin',
    idleClass: 'border-emerald-100 bg-emerald-50/45 hover:border-emerald-300',
    activeClass: 'border-emerald-500 bg-emerald-50 shadow-sm ring-2 ring-emerald-100',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    value: 'II',
    label: 'Category II',
    risk: 'Moderate risk',
    desc: 'Nibbling, minor scratches, abrasions without bleeding',
    idleClass: 'border-amber-100 bg-amber-50/45 hover:border-amber-300',
    activeClass: 'border-amber-500 bg-amber-50 shadow-sm ring-2 ring-amber-100',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  {
    value: 'III',
    label: 'Category III',
    risk: 'High risk',
    desc: 'Single/multiple bites, licks on broken skin, contamination',
    idleClass: 'border-rose-100 bg-rose-50/45 hover:border-rose-300',
    activeClass: 'border-rose-500 bg-rose-50 shadow-sm ring-2 ring-rose-100',
    badgeClass: 'bg-rose-100 text-rose-700',
  },
];

const todayKey = () => new Date().toISOString().split('T')[0];
const pepDoseDayOffsets = [0, 3, 7, 14, 28];

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return '';

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function composePatientName(formData: IncidentFormData) {
  return composePatientFullName({
    first_name: formData.firstName,
    middle_name: formData.middleName,
    last_name: formData.lastName,
    suffix: formData.suffix,
  });
}

function splitPatientName(patient: PatientOption | undefined) {
  return getPatientNameFields(patient);
}

function buildNotes(formData: IncidentFormData) {
  return [
    'Exposure Type: ' + formData.exposureType,
    'Animal Status: ' + formData.animalStatus,
    'Animal Condition: ' + formData.animalCondition,
    'Wound Washed: ' + formData.woundWashed,
    'Date of First Consult: ' + (formData.firstConsultDate || 'Not specified'),
    'SMS Consent: ' + (formData.smsConsent ? 'Allowed' : 'Declined'),
    'Location Precision: ' + (formData.locationScope === 'outside_digos'
      ? 'Not applicable'
      : (formData.locationMode === 'exact' ? 'Exact Pin' : 'Barangay Only')),
  ].join('\n');
}

function readNoteValue(notes: string | undefined, label: string) {
  const line = (notes || '').split('\n').find((item) => item.toLowerCase().startsWith(label.toLowerCase() + ':'));
  return line ? line.split(':').slice(1).join(':').trim() : '';
}

function getBarangayCoordinates(barangay?: BarangayOption) {
  if (!barangay) return null;

  const latitude = Number(barangay.latitude);
  const longitude = Number(barangay.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude) && barangay.latitude != null && barangay.longitude != null) {
    return { lat: latitude, lng: longitude };
  }

  return DIGOS_BARANGAY_COORDINATES[barangay.name] || null;
}

function ReadOnlyPatientItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-xl border border-border bg-white px-3 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value || 'Not recorded'}</p>
    </div>
  );
}

function normalizeCategoryForForm(category?: string) {
  return (category || '').replace('Category ', '') || '';
}

export function IncidentReport() {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUser = getStoredUser();
  const currentRole = normalizeRoleKey(currentUser?.role);
  const isEditMode = Boolean(id);
  const canUpdateIncident = currentRole === 'clinic_admin' || currentRole === 'nurse_vaccinator';
  const [formData, setFormData] = useState<IncidentFormData>(initialFormData);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [barangays, setBarangays] = useState<BarangayOption[]>(fallbackBarangays);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingIncident, setLoadingIncident] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedIncident, setSavedIncident] = useState<any>(null);
  const [pendingPin, setPendingPin] = useState<{ latitude: string; longitude: string } | null>(null);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [patientsResponse, barangaysResponse] = await Promise.all([
          patientsAPI.getAll(),
          barangaysAPI.getAll(),
        ]);

        if (patientsResponse.success) setPatients(patientsResponse.data || []);
        if (barangaysResponse.success && barangaysResponse.data?.length) {
          setBarangays(barangaysResponse.data);
        }
      } catch {
        toast.error('Some form options could not be loaded. You can still continue with available choices.');
      } finally {
        setLoadingOptions(false);
      }
    }

    loadOptions();
  }, []);

  useEffect(() => {
    async function loadIncidentForEdit() {
      if (!id) return;

      if (!canUpdateIncident) {
        setLoadError('You do not have permission to edit incident reports.');
        return;
      }

      try {
        setLoadingIncident(true);
        setLoadError(null);
        setPendingPin(null);
        const response = await incidentsAPI.getById(id);
        const incident = response.data;
        const patient = incident?.patient || {};
        const nameParts = splitPatientName(patient);
        const notes = incident?.notes || '';
        const locationScope: IncidentFormData['locationScope'] = incident?.location_scope === 'outside_digos'
          ? 'outside_digos'
          : incident?.location_scope === 'within_digos' || incident?.barangay_id
            ? 'within_digos'
            : '';

        setFormData({
          patientType: 'existing',
          patientId: incident?.patient_id ? String(incident.patient_id) : '',
          patientSearch: '',
          firstName: nameParts.firstName,
          middleName: nameParts.middleName,
          lastName: nameParts.lastName,
          suffix: nameParts.suffix,
          age: patient?.age != null ? String(patient.age) : '',
          sex: patient?.sex || '',
          addressLine: patient?.address_line || '',
          residenceBarangay: patient?.residence_barangay || '',
          cityMunicipality: patient?.city_municipality || '',
          province: patient?.province || '',
          legacyAddress: patient?.address || '',
          contact: incident?.contact_number || patient?.contact_number || '',
          smsConsent: patient?.sms_consent === true || Number(patient?.sms_consent) === 1,
          incidentDate: incident?.incident_date || '',
          incidentTime: incident?.incident_time || '',
          firstConsultDate: readNoteValue(notes, 'Date of First Consult') === 'Not specified' ? '' : readNoteValue(notes, 'Date of First Consult'),
          animalType: incident?.animal_type || '',
          exposureType: readNoteValue(notes, 'Exposure Type') || 'Bite',
          animalStatus: readNoteValue(notes, 'Animal Status') || 'Unknown',
          animalCondition: readNoteValue(notes, 'Animal Condition') || 'Under observation',
          woundWashed: readNoteValue(notes, 'Wound Washed') || '',
          biteSite: incident?.bite_site || incident?.bite_location || '',
          whoCategory: normalizeCategoryForForm(incident?.who_category),
          status: incident?.status || 'Active',
          locationScope,
          barangayId: incident?.barangay_id ? String(incident.barangay_id) : '',
          locationLat: incident?.location_lat ? String(incident.location_lat) : '',
          locationLng: incident?.location_lng ? String(incident.location_lng) : '',
          locationMode: readNoteValue(notes, 'Location Precision') === 'Barangay Only'
            ? 'barangay'
            : (incident?.location_lat && incident?.location_lng ? 'exact' : (incident?.barangay_id ? 'barangay' : 'none')),
          incidentCityMunicipality: incident?.incident_city_municipality || '',
          incidentProvince: incident?.incident_province || '',
          incidentSpecificLocation: incident?.incident_specific_location || '',
        });
      } catch (error: any) {
        setLoadError(error.message || 'Unable to load incident report.');
      } finally {
        setLoadingIncident(false);
      }
    }

    loadIncidentForEdit();
  }, [id, canUpdateIncident]);

  const selectedPatient = patients.find((patient) => String(patient.id) === formData.patientId);
  const selectedBarangay = barangays.find((barangay) => String(barangay.id) === formData.barangayId);
  const selectedCategory = categoryCards.find((category) => category.value === formData.whoCategory);
  const linkedPatientName = composePatientName(formData) || selectedPatient?.full_name || 'Linked patient';
  const linkedPatientAgeSex = [formData.age, formData.sex].filter(Boolean).join(' / ');
  const patientResidentialAddress = composePatientAddress({
    address_line: formData.addressLine,
    residence_barangay: formData.residenceBarangay,
    city_municipality: formData.cityMunicipality,
    province: formData.province,
    address: formData.legacyAddress,
  });

  const filteredPatients = useMemo(() => {
    const search = formData.patientSearch.trim().toLowerCase();
    if (!search) return patients.slice(0, 8);

    return patients.filter((patient) => (
      (patient.full_name || '').toLowerCase().includes(search) ||
      (patient.first_name || '').toLowerCase().includes(search) ||
      (patient.last_name || '').toLowerCase().includes(search) ||
      (patient.contact_number || '').toLowerCase().includes(search)
    )).slice(0, 8);
  }, [formData.patientSearch, patients]);

  const barangayOptions = [
    { value: '', label: loadingOptions ? 'Loading barangays...' : 'Select barangay' },
    ...barangays.map((barangay) => ({ value: String(barangay.id), label: barangay.name })),
  ];

  const selectOptions = {
    sex: [
      { value: '', label: 'Select sex' },
      { value: 'Male', label: 'Male' },
      { value: 'Female', label: 'Female' },
    ],
    animal: [
      { value: '', label: 'Select animal type' },
      { value: 'Dog', label: 'Dog' },
      { value: 'Cat', label: 'Cat' },
      { value: 'Other', label: 'Other' },
    ],
    exposure: [
      { value: 'Bite', label: 'Bite' },
      { value: 'Scratch', label: 'Scratch' },
      { value: 'Lick on broken skin', label: 'Lick on broken skin' },
      { value: 'Contact with saliva', label: 'Contact with saliva' },
    ],
    animalStatus: [
      { value: 'Owned', label: 'Owned' },
      { value: 'Stray', label: 'Stray' },
      { value: 'Unknown', label: 'Unknown' },
    ],
    animalCondition: [
      { value: 'Alive', label: 'Alive' },
      { value: 'Dead', label: 'Dead' },
      { value: 'Missing', label: 'Missing' },
      { value: 'Under observation', label: 'Under observation' },
    ],
    yesNo: [
      { value: '', label: 'Select answer' },
      { value: 'Yes', label: 'Yes' },
      { value: 'No', label: 'No' },
    ],
    status: [
      { value: 'Active', label: 'Active' },
      { value: 'Completed', label: 'Completed' },
      { value: 'Missed', label: 'Missed' },
      { value: 'Lost to Follow-up', label: 'Lost to Follow-up' },
    ],
  };

  const updateField = <K extends keyof IncidentFormData>(field: K, value: IncidentFormData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handlePatientTypeChange = (type: 'existing' | 'new') => {
    setFormData((current) => ({
      ...current,
      patientType: type,
      patientId: '',
      patientSearch: '',
      firstName: type === 'new' ? current.firstName : '',
      middleName: type === 'new' ? current.middleName : '',
      lastName: type === 'new' ? current.lastName : '',
      suffix: type === 'new' ? current.suffix : '',
      addressLine: type === 'new' ? current.addressLine : '',
      residenceBarangay: type === 'new' ? current.residenceBarangay : '',
      cityMunicipality: type === 'new' ? (current.cityMunicipality || 'Digos City') : '',
      province: type === 'new' ? (current.province || 'Davao del Sur') : '',
      legacyAddress: '',
      contact: type === 'new' ? current.contact : '',
      smsConsent: type === 'new' ? current.smsConsent : false,
    }));
    setErrors({});
  };

  const handlePatientSelect = (patientId: string) => {
    const patient = patients.find((item) => String(item.id) === patientId);
    const nameParts = splitPatientName(patient);

    setFormData((current) => ({
      ...current,
      patientId,
      firstName: nameParts.firstName,
      middleName: nameParts.middleName,
      lastName: nameParts.lastName,
      suffix: nameParts.suffix,
      age: patient?.age != null ? String(patient.age) : '',
      sex: patient?.sex || '',
      addressLine: patient?.address_line || '',
      residenceBarangay: patient?.residence_barangay || '',
      cityMunicipality: patient?.city_municipality || '',
      province: patient?.province || '',
      legacyAddress: patient?.address || '',
      contact: patient?.contact_number || '',
      smsConsent: patient?.sms_consent === true || Number(patient?.sms_consent) === 1,
    }));
    setErrors((current) => ({ ...current, patientSelection: undefined }));
  };

  const handleBarangayChange = (barangayId: string) => {
    setPendingPin(null);
    setFormData((current) => ({
      ...current,
      barangayId,
      locationLat: '',
      locationLng: '',
      locationMode: barangayId ? 'barangay' : 'none',
    }));
    setErrors((current) => ({ ...current, barangayId: undefined }));
  };

  const handleLocationScopeChange = (locationScope: IncidentFormData['locationScope']) => {
    setPendingPin(null);
    setFormData((current) => ({
      ...current,
      locationScope,
      barangayId: locationScope === 'outside_digos' ? '' : current.barangayId,
      locationLat: locationScope === 'outside_digos' ? '' : current.locationLat,
      locationLng: locationScope === 'outside_digos' ? '' : current.locationLng,
      locationMode: locationScope === 'outside_digos' ? 'none' : current.locationMode,
      incidentCityMunicipality: locationScope === 'within_digos' ? '' : current.incidentCityMunicipality,
      incidentProvince: locationScope === 'within_digos' ? '' : current.incidentProvince,
      incidentSpecificLocation: locationScope === 'within_digos' ? '' : current.incidentSpecificLocation,
    }));
    setErrors((current) => ({
      ...current,
      locationScope: undefined,
      barangayId: undefined,
      locationLat: undefined,
      locationLng: undefined,
      incidentCityMunicipality: undefined,
      incidentProvince: undefined,
      incidentSpecificLocation: undefined,
    }));
  };

  const validateForm = () => {
    const nextErrors: FormErrors = {};
    const today = todayKey();

    if (!isEditMode && formData.patientType === 'existing' && !formData.patientId) {
      nextErrors.patientSelection = 'Select an existing patient.';
    }

    if (!isEditMode) {
      if (!isValidPatientName(formData.firstName, 2)) nextErrors.firstName = 'Enter 2–50 letters; spaces, hyphens, and apostrophes are allowed.';
      if (formData.middleName && !isValidPatientName(formData.middleName, 1)) nextErrors.middleName = 'Enter a valid middle name using letters, spaces, hyphens, or apostrophes.';
      if (!isValidPatientName(formData.lastName, 2)) nextErrors.lastName = 'Enter 2–50 letters; spaces, hyphens, and apostrophes are allowed.';

      const age = Number(formData.age);
      if (!formData.age || !Number.isInteger(age) || age < 0 || age > 120) {
        nextErrors.age = 'Enter a whole-number age from 0 to 120.';
      }

      if (!formData.sex) nextErrors.sex = 'Sex is required.';
      nextErrors.contact = contactNumberError(formData.contact, formData.smsConsent);
      const addressLineLength = normalizePatientText(formData.addressLine).length;
      const residenceBarangayLength = normalizePatientText(formData.residenceBarangay).length;
      const cityMunicipalityLength = normalizePatientText(formData.cityMunicipality).length;
      const provinceLength = normalizePatientText(formData.province).length;
      if (addressLineLength < 3 || addressLineLength > 150) nextErrors.addressLine = 'House No. / Purok / Street must contain 3–150 characters.';
      if (residenceBarangayLength < 2 || residenceBarangayLength > 80) nextErrors.residenceBarangay = 'Barangay must contain 2–80 characters.';
      if (cityMunicipalityLength < 2 || cityMunicipalityLength > 80) nextErrors.cityMunicipality = 'City / Municipality must contain 2–80 characters.';
      if (provinceLength < 2 || provinceLength > 80) nextErrors.province = 'Province must contain 2–80 characters.';
    }

    if (!formData.incidentDate) {
      nextErrors.incidentDate = 'Date of incident is required.';
    } else if (formData.incidentDate > today) {
      nextErrors.incidentDate = 'Date of incident cannot be in the future.';
    }

    if (formData.incidentDate === today && formData.incidentTime) {
      const selectedTime = new Date(today + 'T' + formData.incidentTime);
      if (selectedTime > new Date()) nextErrors.incidentTime = 'Time of incident cannot be in the future.';
    }

    if (!formData.animalType) nextErrors.animalType = 'Animal type is required.';
    if (!formData.whoCategory) nextErrors.whoCategory = 'Select a WHO wound category.';
    if (!formData.locationScope) {
      nextErrors.locationScope = 'Select whether the incident occurred within or outside Digos City.';
    } else if (formData.locationScope === 'within_digos') {
      if (!formData.barangayId) nextErrors.barangayId = 'Barangay of Incident is required.';
    } else {
      const incidentCityLength = normalizePatientText(formData.incidentCityMunicipality).length;
      const incidentProvinceLength = normalizePatientText(formData.incidentProvince).length;
      const specificLocationLength = normalizePatientText(formData.incidentSpecificLocation).length;
      if (incidentCityLength < 2 || incidentCityLength > 100) {
        nextErrors.incidentCityMunicipality = 'City / Municipality of Incident must contain 2–100 characters.';
      }
      if (incidentProvinceLength < 2 || incidentProvinceLength > 100) {
        nextErrors.incidentProvince = 'Province of Incident must contain 2–100 characters.';
      }
      if (specificLocationLength > 200) {
        nextErrors.incidentSpecificLocation = 'Specific Location / Landmark must not exceed 200 characters.';
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingPin) {
      toast.error('Confirm or cancel the selected map pin before saving.');
      return;
    }
    if (!validateForm()) {
      toast.error('Please complete the required incident details.');
      return;
    }

    const fullName = composePatientName(formData);
    const incidentPayload = {
      patient_id: formData.patientId || undefined,
      location_scope: formData.locationScope,
      barangay_id: formData.locationScope === 'within_digos' ? formData.barangayId : null,
      incident_date: formData.incidentDate,
      incident_time: formData.incidentTime || null,
      animal_type: formData.animalType,
      animal_description: 'Status: ' + formData.animalStatus + '; Condition: ' + formData.animalCondition,
      bite_site: formData.biteSite || formData.exposureType,
      who_category: formData.whoCategory,
      status: formData.status,
      location_lat: formData.locationScope === 'within_digos' ? (formData.locationLat || null) : null,
      location_lng: formData.locationScope === 'within_digos' ? (formData.locationLng || null) : null,
      incident_city_municipality: formData.locationScope === 'outside_digos'
        ? normalizePatientText(formData.incidentCityMunicipality)
        : null,
      incident_province: formData.locationScope === 'outside_digos'
        ? normalizePatientText(formData.incidentProvince)
        : null,
      incident_specific_location: formData.locationScope === 'outside_digos'
        ? (normalizePatientText(formData.incidentSpecificLocation) || null)
        : null,
      sms_consent: formData.smsConsent,
      notes: buildNotes(formData),
    };
    const payload = isEditMode ? incidentPayload : {
      ...incidentPayload,
      patient_name: fullName,
      full_name: fullName,
      first_name: normalizePatientText(formData.firstName),
      middle_name: normalizePatientText(formData.middleName) || null,
      last_name: normalizePatientText(formData.lastName),
      suffix: formData.suffix || null,
      age: Number(formData.age),
      sex: formData.sex,
      address_line: normalizePatientText(formData.addressLine),
      residence_barangay: normalizePatientText(formData.residenceBarangay),
      city_municipality: normalizePatientText(formData.cityMunicipality),
      province: normalizePatientText(formData.province),
      address: patientResidentialAddress,
      contact_number: formData.contact.trim() || null,
    };

    try {
      setSaving(true);
      if (isEditMode && id) {
        await incidentsAPI.update(id, payload);
        toast.success('Incident report updated successfully.');
        navigate('/incidents', { state: { refresh: Date.now(), updatedIncidentId: id } });
      } else {
        const response = await incidentsAPI.create(payload);
        setSavedIncident(response.data);
        toast.success('Incident report saved successfully.');
      }
    } catch (error: any) {
      toast.error(error.message || (isEditMode ? 'Failed to update incident report.' : 'Failed to save incident report.'));
    } finally {
      setSaving(false);
    }
  };

  const summaryItems = [
    { label: 'Patient', value: composePatientName(formData) || selectedPatient?.full_name || 'Not selected' },
    { label: 'Contact', value: formData.contact || 'Not provided' },
    { label: 'Animal Type', value: formData.animalType || 'Not selected' },
    { label: 'Exposure', value: formData.exposureType || 'Not selected' },
    { label: 'WHO Category', value: formData.whoCategory ? 'Category ' + formData.whoCategory : 'Not selected' },
    { label: 'Status', value: formData.status || 'Active' },
    {
      label: 'Incident Area',
      value: formData.locationScope === 'within_digos'
        ? 'Within Digos City'
        : formData.locationScope === 'outside_digos'
          ? 'Outside Digos City'
          : 'Not selected',
    },
    ...(formData.locationScope === 'within_digos'
      ? [{ label: 'Barangay', value: selectedBarangay?.name || 'Not selected' }]
      : formData.locationScope === 'outside_digos'
        ? [
            {
              label: 'Location',
              value: [formData.incidentCityMunicipality, formData.incidentProvince].filter(Boolean).join(', ') || 'Not provided',
            },
            ...(formData.incidentSpecificLocation
              ? [{ label: 'Specific Location', value: formData.incidentSpecificLocation }]
              : []),
            { label: 'GIS Inclusion', value: 'Excluded from Digos barangay analysis' },
          ]
        : []),
    {
      label: 'Reminders',
      value: formData.smsConsent ? 'SMS permission enabled' : 'SMS permission disabled',
    },
  ];
  const doseSchedulePreview = useMemo(
    () => formData.incidentDate
      ? pepDoseDayOffsets.map((day) => ({ day, date: addDaysToDateKey(formData.incidentDate, day) }))
      : [],
    [formData.incidentDate]
  );
  const locationHelperText = pendingPin
    ? 'Review the selected location before confirming it as the exact incident pin.'
    : 'Click the map to set an exact incident pin. Barangay is still required for reports and GIS analysis.';
  const barangayCoordinates = getBarangayCoordinates(selectedBarangay);
  const hasLocationPin = Boolean(formData.locationLat && formData.locationLng);
  const hasExactPin = hasLocationPin && formData.locationMode === 'exact';
  const locationPinStatus = pendingPin ? 'Pin selected for review' : (hasExactPin ? 'Exact pin selected' : 'Barangay only');
  const locationStatusDetail = pendingPin
    ? 'Confirm the selected point before saving it as the exact incident pin.'
    : hasExactPin
      ? 'Exact incident location has been saved.'
    : formData.barangayId
      ? 'Using selected barangay for mapping.'
      : 'Select a barangay to identify the incident area.';

  const handleConfirmPin = () => {
    if (!pendingPin) return;

    setFormData((current) => ({
      ...current,
      locationLat: pendingPin.latitude,
      locationLng: pendingPin.longitude,
      locationMode: 'exact',
    }));
    setPendingPin(null);
    toast.success('Exact incident pin confirmed.');
  };

  const handleCancelPin = () => {
    setPendingPin(null);
  };

  if (loadingIncident) {
    return (
      <div className="flex-1 bg-[#f6f8f7] min-h-screen">
        <Header title="Edit Incident Report" breadcrumbs={['Incidents', 'Edit Incident']} />
        <div className="px-5 py-5 lg:px-7 lg:py-6">
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
            Loading incident report...
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex-1 bg-[#f6f8f7] min-h-screen">
        <Header title="Edit Incident Report" breadcrumbs={['Incidents', 'Edit Incident']} />
        <div className="px-5 py-5 lg:px-7 lg:py-6">
          <div className="rounded-2xl border border-destructive/20 bg-destructive-bg p-8 text-center shadow-sm">
            <p className="text-sm font-semibold text-destructive">{loadError}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => navigate('/incidents')}>
              Back to Incidents
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex-1 bg-[#f6f8f7] max-md:fixed max-md:inset-0 max-md:z-30 max-md:overflow-y-auto">
      <Header title={isEditMode ? 'Edit Incident Report' : 'New Incident Report'} breadcrumbs={isEditMode ? ['Incidents', 'Edit Incident'] : ['Incidents', 'New Report']} />

      <div className="px-5 py-5 lg:px-7 lg:py-6">
        <form onSubmit={handleSubmit} className="mx-auto grid max-w-[1480px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-3">
          <div className="bg-card border border-border rounded-2xl p-4 lg:p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">Patient Information</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isEditMode ? 'Review the patient information attached to this incident.' : 'Choose an existing patient or encode a new patient record.'}
                </p>
              </div>
              {!isEditMode && <div className="inline-flex w-fit rounded-xl bg-muted p-1 text-xs font-semibold">
                {(['existing', 'new'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handlePatientTypeChange(type)}
                    className={
                      'rounded-lg px-3 py-1.5 transition-colors ' +
                      (formData.patientType === type ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    {type === 'existing' ? 'Existing Patient' : 'New Patient'}
                  </button>
                ))}
              </div>}
            </div>

            {!isEditMode && formData.patientType === 'existing' && (
              <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)] gap-3">
                  <Input
                    label="Search Existing Patient"
                    placeholder="Search by name or contact number"
                    value={formData.patientSearch}
                    onChange={(e) => updateField('patientSearch', e.target.value)}
                    helperText="Select a patient below to auto-fill available details."
                  />
                  <Select
                    label="Existing Patient *"
                    options={[
                      { value: '', label: filteredPatients.length ? 'Select patient' : 'No matching patients' },
                      ...filteredPatients.map((patient) => ({
                        value: String(patient.id),
                        label: (getPatientDisplayName(patient) || 'Unnamed patient') + (patient.contact_number ? ' - ' + patient.contact_number : ''),
                      })),
                    ]}
                    value={formData.patientId}
                    onChange={(e) => handlePatientSelect(e.target.value)}
                    error={errors.patientSelection}
                  />
                </div>
                {selectedPatient && (
                  <div className="mt-3 rounded-lg border border-emerald-100 bg-white/70 px-3 py-2 text-xs text-emerald-800">
                    <span className="font-semibold">{getPatientDisplayName(selectedPatient) || 'Unnamed patient'}</span>
                    <span className="text-emerald-700"> selected</span>
                    {selectedPatient.contact_number && <span className="text-emerald-700"> - {selectedPatient.contact_number}</span>}
                  </div>
                )}
              </div>
            )}

            {isEditMode ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Linked Patient Record</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Patient profile details are managed in the Patient Registry.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(formData.patientId ? '/patients/' + formData.patientId : '/patients')}
                  >
                    Open Patient Record
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <ReadOnlyPatientItem label="Full Name" value={linkedPatientName} />
                  <ReadOnlyPatientItem label="Age / Sex" value={linkedPatientAgeSex} />
                  <ReadOnlyPatientItem label="Contact Number" value={formData.contact} />
                   <ReadOnlyPatientItem label="Patient Residential Address" value={patientResidentialAddress} />
                </div>
              </div>
            ) : formData.patientType === 'new' ? (
              <div className="space-y-5">
                <section>
                  <h3 className="mb-3 text-sm font-bold text-foreground">A. Patient Identity</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Input label="First Name *" placeholder="Enter first name" value={formData.firstName} onChange={(e) => updateField('firstName', e.target.value)} error={errors.firstName} />
                    <Input label="Middle Name (Optional)" placeholder="Enter full middle name" value={formData.middleName} onChange={(e) => updateField('middleName', e.target.value)} error={errors.middleName} />
                    <Input label="Last Name *" placeholder="Enter last name" value={formData.lastName} onChange={(e) => updateField('lastName', e.target.value)} error={errors.lastName} />
                    <Select label="Suffix (Optional)" options={PATIENT_SUFFIX_OPTIONS} value={formData.suffix} onChange={(e) => updateField('suffix', e.target.value)} error={errors.suffix} />
                  </div>
                </section>

                <section className="border-t border-border pt-4">
                  <h3 className="mb-3 text-sm font-bold text-foreground">B. Demographics and Contact</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <Input label="Age *" type="number" min={0} max={120} step={1} inputMode="numeric" placeholder="Age" value={formData.age} onChange={(e) => updateField('age', e.target.value)} error={errors.age} />
                    <Select label="Sex *" options={selectOptions.sex} value={formData.sex} onChange={(e) => updateField('sex', e.target.value)} error={errors.sex} />
                    <Input label={formData.smsConsent ? 'Contact Number *' : 'Contact Number (Optional)'} type="tel" inputMode="numeric" maxLength={11} placeholder="09XXXXXXXXX" value={formData.contact} onChange={(e) => updateField('contact', e.target.value)} error={errors.contact} />
                  </div>
                </section>

                <section className="border-t border-border pt-4">
                  <h3 className="mb-1 text-sm font-bold text-foreground">C. Patient Residential Address</h3>
                  <p className="mb-3 text-xs text-muted-foreground">This address is separate from the Barangay of Incident and does not affect the incident map pin.</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Input label="House No. / Purok / Street *" placeholder="Enter house number, purok, subdivision, or street" value={formData.addressLine} onChange={(e) => updateField('addressLine', e.target.value)} error={errors.addressLine} />
                    <Input label="Barangay *" placeholder="Enter residential barangay" value={formData.residenceBarangay} onChange={(e) => updateField('residenceBarangay', e.target.value)} error={errors.residenceBarangay} />
                    <Input label="City / Municipality *" placeholder="Enter city or municipality" value={formData.cityMunicipality} onChange={(e) => updateField('cityMunicipality', e.target.value)} error={errors.cityMunicipality} />
                    <Input label="Province *" placeholder="Enter province" value={formData.province} onChange={(e) => updateField('province', e.target.value)} error={errors.province} />
                  </div>
                </section>
              </div>
            ) : (
              <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
                <div className="md:col-span-2">
                  <Input
                    label="First Name"
                    placeholder="First name"
                    value={formData.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    disabled={Boolean(formData.patientId)}
                  />
                </div>
                <Input
                  label="Middle Name"
                  placeholder="Enter full middle name"
                  value={formData.middleName}
                  onChange={(e) => updateField('middleName', e.target.value)}
                  disabled={Boolean(formData.patientId)}
                />
                <div className="md:col-span-2">
                  <Input
                    label="Last Name"
                    placeholder="Last name"
                    value={formData.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    disabled={Boolean(formData.patientId)}
                  />
                </div>
                <Select label="Suffix" options={PATIENT_SUFFIX_OPTIONS} value={formData.suffix} onChange={(e) => updateField('suffix', e.target.value)} disabled={Boolean(formData.patientId)} />
              </div>
              {selectedPatient?.full_name && (
                <p className="text-xs text-muted-foreground">
                  Existing record name: <span className="font-semibold text-foreground">{selectedPatient.full_name}</span>
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  label="Age *"
                  type="number"
                  min={0}
                  max={120}
                  step={1}
                  inputMode="numeric"
                  placeholder="Age"
                  value={formData.age}
                  onChange={(e) => updateField('age', e.target.value)}
                  error={errors.age}
                />
                <Select
                  label="Sex *"
                  options={selectOptions.sex}
                  value={formData.sex}
                  onChange={(e) => updateField('sex', e.target.value)}
                  error={errors.sex}
                />
                <Input
                  label={formData.smsConsent ? 'Contact Number *' : 'Contact Number (Optional)'}
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="09XXXXXXXXX"
                  value={formData.contact}
                  onChange={(e) => updateField('contact', e.target.value)}
                  error={errors.contact}
                />
              </div>
              {selectedPatient && <ReadOnlyPatientItem label="Patient Residential Address" value={patientResidentialAddress} />}
              </div>
            )}

            <div className="mt-3">
              <label className="flex items-start gap-3 rounded-xl border border-border bg-muted/25 p-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={formData.smsConsent}
                  onChange={(e) => updateField('smsConsent', e.target.checked)}
                  disabled={isEditMode || formData.patientType === 'existing'}
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>
                  <span className="font-semibold">D. SMS Reminder Permission</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">Patient agrees to receive vaccination appointment reminders through SMS at the contact number provided. This choice does not affect treatment or PEP scheduling.</span>
                  {(isEditMode || formData.patientType === 'existing') && <span className="mt-1 block text-xs font-medium text-emerald-700">Loaded from the selected patient record. Edit it from Patient Registry.</span>}
                </span>
              </label>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 lg:p-5 shadow-sm">
            <h2 className="text-base font-bold text-foreground mb-1">Bite / Exposure Details</h2>
            <p className="text-xs text-muted-foreground mb-4">Record the exposure details used for clinical workflow and PEP scheduling.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <Input
                label="Date of Incident *"
                type="date"
                max={todayKey()}
                value={formData.incidentDate}
                onChange={(e) => updateField('incidentDate', e.target.value)}
                error={errors.incidentDate}
              />
              <Input
                label="Time of Incident"
                type="time"
                value={formData.incidentTime}
                onChange={(e) => updateField('incidentTime', e.target.value)}
                error={errors.incidentTime}
              />
              <Input
                label="Date of First Consult"
                type="date"
                max={todayKey()}
                value={formData.firstConsultDate}
                onChange={(e) => updateField('firstConsultDate', e.target.value)}
              />
              <Select
                label="Exposure Type"
                options={selectOptions.exposure}
                value={formData.exposureType}
                onChange={(e) => updateField('exposureType', e.target.value)}
              />
              <Select
                label="Animal Type *"
                options={selectOptions.animal}
                value={formData.animalType}
                onChange={(e) => updateField('animalType', e.target.value)}
                error={errors.animalType}
              />
              <Input
                label="Bite Site"
                placeholder="e.g., Left arm, right leg"
                value={formData.biteSite}
                onChange={(e) => updateField('biteSite', e.target.value)}
              />
              <Select
                label="Animal Status"
                options={selectOptions.animalStatus}
                value={formData.animalStatus}
                onChange={(e) => updateField('animalStatus', e.target.value)}
              />
              <Select
                label="Animal Condition"
                options={selectOptions.animalCondition}
                value={formData.animalCondition}
                onChange={(e) => updateField('animalCondition', e.target.value)}
              />
              <Select
                label="Wound Washed"
                options={selectOptions.yesNo}
                value={formData.woundWashed}
                onChange={(e) => updateField('woundWashed', e.target.value)}
              />
              {isEditMode && (
                <Select
                  label="Incident Status"
                  options={selectOptions.status}
                  value={formData.status}
                  onChange={(e) => updateField('status', e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 lg:p-5 shadow-sm">
                <h2 className="text-base font-bold text-foreground mb-1">WHO Wound Category</h2>
                <p className="text-xs text-muted-foreground mb-3">Select the wound category used for clinical workflow guidance.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {categoryCards.map((cat) => (
                    <label
                      key={cat.value}
                      className={
                        'border rounded-xl p-3 cursor-pointer transition-all ' +
                        (formData.whoCategory === cat.value
                          ? cat.activeClass
                          : cat.idleClass)
                      }
                    >
                      <input
                        type="radio"
                        name="whoCategory"
                        value={cat.value}
                        checked={formData.whoCategory === cat.value}
                        onChange={(e) => updateField('whoCategory', e.target.value)}
                        className="sr-only"
                      />
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="font-bold text-sm text-foreground">{cat.label}</div>
                        <span className={'rounded-full px-2 py-0.5 text-[10px] font-bold ' + cat.badgeClass}>{cat.risk}</span>
                      </div>
                      <div className="text-xs text-muted-foreground leading-relaxed">{cat.desc}</div>
                    </label>
                  ))}
                </div>
                {errors.whoCategory && <p className="mt-2 text-xs text-destructive">{errors.whoCategory}</p>}
                {formData.whoCategory && (
                  <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                      <div>
                        <p className="text-sm font-bold text-emerald-950">{categoryGuidance[formData.whoCategory]}</p>
                        <p className="text-xs leading-relaxed text-emerald-700 mt-1">
                          Recommendation is based on encoded category and is subject to doctor or clinic validation.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
          </div>

          <div className="flex flex-wrap gap-3 pb-4 xl:hidden">
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Save Incident Report'}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => navigate('/incidents')}>
              Cancel
            </Button>
          </div>
          </div>

          <aside className="space-y-3 xl:self-start">
          <div className="bg-card border border-border rounded-2xl p-4 lg:p-5 shadow-sm">
            <h2 className="text-base font-bold text-foreground mb-1">Incident Location</h2>

            <Select
              label="Incident occurred within Digos City? *"
              options={[
                { value: '', label: 'Select incident area' },
                { value: 'within_digos', label: 'Within Digos City' },
                { value: 'outside_digos', label: 'Outside Digos City' },
              ]}
              value={formData.locationScope}
              onChange={(e) => handleLocationScopeChange(e.target.value as IncidentFormData['locationScope'])}
              error={errors.locationScope}
            />

            {formData.locationScope === 'within_digos' && (
              <div className="mt-4 space-y-4">
                <Select
                  label="Barangay of Incident *"
                  options={barangayOptions}
                  value={formData.barangayId}
                  onChange={(e) => handleBarangayChange(e.target.value)}
                  error={errors.barangayId}
                />

                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-slate-50 p-3">
              <IncidentLocationPicker
                barangayName={selectedBarangay?.name}
                barangayCoordinates={barangayCoordinates}
                latitude={formData.locationLat}
                longitude={formData.locationLng}
                pendingLatitude={pendingPin?.latitude}
                pendingLongitude={pendingPin?.longitude}
                exactPin={hasExactPin}
                onPinSelect={(latitude, longitude) => {
                  if (!selectedBarangay) {
                    setErrors((current) => ({ ...current, barangayId: 'Select a barangay first.' }));
                    toast.info('Select a barangay first.');
                    return;
                  }
                  setPendingPin({ latitude, longitude });
                }}
              />
              <p className="mt-2 text-[11px] font-medium leading-relaxed text-slate-600">{locationHelperText}</p>

              <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-100 bg-white/85 px-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Location Status</span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                      {locationPinStatus}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">{locationStatusDetail}</p>
                </div>
              </div>

              {pendingPin && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={handleConfirmPin}>Confirm Pin</Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleCancelPin}>Cancel Pin</Button>
                </div>
              )}

                </div>
              </div>
            )}

            {formData.locationScope === 'outside_digos' && (
              <div className="mt-4 space-y-3">
                <Input
                  label="City / Municipality of Incident *"
                  value={formData.incidentCityMunicipality}
                  onChange={(e) => updateField('incidentCityMunicipality', e.target.value)}
                  error={errors.incidentCityMunicipality}
                  maxLength={100}
                />
                <Input
                  label="Province of Incident *"
                  value={formData.incidentProvince}
                  onChange={(e) => updateField('incidentProvince', e.target.value)}
                  error={errors.incidentProvince}
                  maxLength={100}
                />
                <Input
                  label="Specific Location / Landmark (Optional)"
                  value={formData.incidentSpecificLocation}
                  onChange={(e) => updateField('incidentSpecificLocation', e.target.value)}
                  error={errors.incidentSpecificLocation}
                  maxLength={200}
                />
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-medium leading-relaxed text-amber-900">
                  This incident will remain part of the patient’s clinical record but will not be included in Digos City barangay GIS analysis.
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h3 className="text-base font-bold text-foreground">Dose Schedule</h3>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              Dose dates are recalculated when the incident date is corrected. Completed dose records keep their administration history.
            </p>
            {doseSchedulePreview.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                Select the Date of Incident to preview the PEP schedule.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-5 xl:grid-cols-1">
                {doseSchedulePreview.map((dose) => (
                  <div key={dose.day} className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs">
                    <span className="font-extrabold text-emerald-900">Day {dose.day}</span>
                    <span className="font-semibold text-emerald-700">{dose.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm xl:sticky xl:top-24">
            <div className="mb-3">
              <h3 className="text-base font-bold text-foreground">Incident Summary</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Review key values before saving.</p>
            </div>
            <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
              {summaryItems.map((item) => (
                <div key={item.label} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 bg-white px-3 py-2.5 text-xs">
                  <span className="font-semibold text-slate-500">{item.label}</span>
                  <span className="truncate font-semibold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
            {selectedCategory && (
              <div className={'mt-3 rounded-xl border px-3 py-2 text-xs font-bold ' + selectedCategory.idleClass}>
                {selectedCategory.risk} workflow guide selected
              </div>
            )}
            <div className="mt-4 grid gap-2">
              <Button type="submit" size="lg" disabled={saving} className="w-full">
              {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Save Incident Report'}
            </Button>
              <Button type="button" variant="outline" size="lg" onClick={() => navigate('/incidents')} className="w-full">
              Cancel
            </Button>
            </div>
          </div>
          </aside>
        </form>
      </div>

      {savedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Incident report saved successfully.</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  A PEP schedule is created automatically by the system when the incident is saved.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-2">
              <Button
                type="button"
                onClick={() => navigate('/pep-schedule?incident_id=' + encodeURIComponent(String(savedIncident.id)))}
                className="w-full"
              >
                Open PEP Schedule
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(savedIncident.id ? '/incidents/' + savedIncident.id : '/incidents')}
                className="w-full"
              >
                View Incident
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/incidents')} className="w-full">
                Back to Incident List
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
