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
  contact_number?: string;
  barangay_id?: number | string;
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
  address: string;
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
  barangayId: string;
  locationLat: string;
  locationLng: string;
  locationMode: 'none' | 'barangay' | 'exact';
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
  address: '',
  contact: '',
  smsConsent: true,
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
  barangayId: '',
  locationLat: '',
  locationLng: '',
  locationMode: 'none',
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

function normalizeContact(value: string) {
  return value.replace(/[\s-]/g, '');
}

function isValidPhilippineMobile(value: string) {
  const contact = normalizeContact(value);
  return /^09\d{9}$/.test(contact) || /^\+639\d{9}$/.test(contact);
}

function composePatientName(formData: IncidentFormData) {
  return [
    formData.firstName.trim(),
    formData.middleName.trim(),
    formData.lastName.trim(),
    formData.suffix.trim(),
  ].filter(Boolean).join(' ');
}

function splitPatientName(patient: PatientOption | undefined) {
  if (!patient) {
    return { firstName: '', middleName: '', lastName: '', suffix: '' };
  }

  const fullName = (patient.full_name || '').trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const suffixes = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v'];
  const structuredFirst = patient.first_name || '';
  const structuredMiddle = patient.middle_name || '';
  const structuredLast = patient.last_name || '';
  const structuredSuffix = patient.suffix || '';

  if (structuredFirst || structuredMiddle || structuredLast || structuredSuffix) {
    return {
      firstName: structuredFirst,
      middleName: structuredMiddle,
      lastName: structuredLast,
      suffix: structuredSuffix,
    };
  }

  if (parts.length === 0) {
    return { firstName: '', middleName: '', lastName: '', suffix: '' };
  }

  const lastPart = parts[parts.length - 1];
  const hasSuffix = suffixes.includes(lastPart.toLowerCase());
  const suffix = hasSuffix ? lastPart : '';
  const nameParts = hasSuffix ? parts.slice(0, -1) : parts;

  if (nameParts.length === 1) {
    return { firstName: nameParts[0], middleName: '', lastName: '', suffix };
  }

  return {
    firstName: nameParts[0] || '',
    middleName: nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '',
    lastName: nameParts[nameParts.length - 1] || '',
    suffix,
  };
}

function buildNotes(formData: IncidentFormData) {
  return [
    'Exposure Type: ' + formData.exposureType,
    'Animal Status: ' + formData.animalStatus,
    'Animal Condition: ' + formData.animalCondition,
    'Wound Washed: ' + formData.woundWashed,
    'Date of First Consult: ' + (formData.firstConsultDate || 'Not specified'),
    'SMS Consent: ' + (formData.smsConsent ? 'Allowed' : 'Declined'),
    'Location Precision: ' + (formData.locationMode === 'exact' ? 'Exact Pin' : 'Barangay Only'),
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

        setFormData({
          patientType: 'existing',
          patientId: incident?.patient_id ? String(incident.patient_id) : '',
          patientSearch: '',
          firstName: nameParts.firstName,
          middleName: nameParts.middleName,
          lastName: nameParts.lastName,
          suffix: nameParts.suffix,
          age: patient?.age ? String(patient.age) : '',
          sex: patient?.sex || '',
          address: patient?.address || '',
          contact: incident?.contact_number || patient?.contact_number || '',
          smsConsent: !['Declined', 'Not allowed'].includes(readNoteValue(notes, 'SMS Consent')),
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
          barangayId: incident?.barangay_id ? String(incident.barangay_id) : '',
          locationLat: incident?.location_lat ? String(incident.location_lat) : '',
          locationLng: incident?.location_lng ? String(incident.location_lng) : '',
          locationMode: readNoteValue(notes, 'Location Precision') === 'Barangay Only'
            ? 'barangay'
            : (incident?.location_lat && incident?.location_lng ? 'exact' : (incident?.barangay_id ? 'barangay' : 'none')),
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
      age: patient?.age ? String(patient.age) : '',
      sex: patient?.sex || '',
      address: patient?.address || '',
      contact: patient?.contact_number || '',
      smsConsent: patient?.sms_consent !== false && Number(patient?.sms_consent) !== 0,
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

  const validateForm = () => {
    const nextErrors: FormErrors = {};
    const today = todayKey();

    if (!isEditMode && formData.patientType === 'existing' && !formData.patientId) {
      nextErrors.patientSelection = 'Select an existing patient.';
    }

    if (!isEditMode) {
      if (!formData.firstName.trim()) {
        nextErrors.firstName = 'First name is required.';
      }

      if (!formData.lastName.trim()) {
        nextErrors.lastName = 'Last name is required.';
      }

      const age = Number(formData.age);
      if (!formData.age || Number.isNaN(age) || age < 0 || age > 120) {
        nextErrors.age = 'Enter a valid age from 0 to 120.';
      }

      if (!formData.sex) nextErrors.sex = 'Sex is required.';
      if (!formData.contact.trim()) {
        nextErrors.contact = 'Contact number is required.';
      } else if (!isValidPhilippineMobile(formData.contact)) {
        nextErrors.contact = 'Use a Philippine mobile number, e.g. 09XXXXXXXXX.';
      }
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
    if (!formData.barangayId) nextErrors.barangayId = 'Barangay of Incident is required.';

    setErrors(nextErrors);
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
      barangay_id: formData.barangayId,
      incident_date: formData.incidentDate,
      incident_time: formData.incidentTime || null,
      animal_type: formData.animalType,
      animal_description: 'Status: ' + formData.animalStatus + '; Condition: ' + formData.animalCondition,
      bite_site: formData.biteSite || formData.exposureType,
      who_category: formData.whoCategory,
      status: formData.status,
      location_lat: formData.locationLat || null,
      location_lng: formData.locationLng || null,
      sms_consent: formData.smsConsent,
      notes: buildNotes(formData),
    };
    const payload = isEditMode ? incidentPayload : {
      ...incidentPayload,
      patient_name: fullName,
      full_name: fullName,
      first_name: formData.firstName,
      middle_name: formData.middleName,
      last_name: formData.lastName,
      suffix: formData.suffix,
      age: Number(formData.age),
      sex: formData.sex,
      address: formData.address || 'Not provided',
      contact_number: normalizeContact(formData.contact),
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
    { label: 'Barangay', value: selectedBarangay?.name || 'Not selected' },
    {
      label: 'Reminders',
      value: formData.smsConsent ? 'SMS consent allowed' : 'SMS consent declined',
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
    <div className="flex-1 bg-[#f6f8f7] min-h-screen">
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
                        label: (patient.full_name || 'Unnamed patient') + (patient.contact_number ? ' - ' + patient.contact_number : ''),
                      })),
                    ]}
                    value={formData.patientId}
                    onChange={(e) => handlePatientSelect(e.target.value)}
                    error={errors.patientSelection}
                  />
                </div>
                {selectedPatient && (
                  <div className="mt-3 rounded-lg border border-emerald-100 bg-white/70 px-3 py-2 text-xs text-emerald-800">
                    <span className="font-semibold">{selectedPatient.full_name || 'Unnamed patient'}</span>
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
                  <ReadOnlyPatientItem label="Address" value={formData.address} />
                </div>
              </div>
            ) : formData.patientType === 'new' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
                <div className="md:col-span-2">
                  <Input
                    label="First Name *"
                    placeholder="First name"
                    value={formData.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    error={errors.firstName}
                  />
                </div>
                <Input
                  label="Middle Name / Initial"
                  placeholder="M.I. or middle name"
                  value={formData.middleName}
                  onChange={(e) => updateField('middleName', e.target.value)}
                />
                <div className="md:col-span-2">
                  <Input
                    label="Last Name *"
                    placeholder="Last name"
                    value={formData.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    error={errors.lastName}
                  />
                </div>
                <Input
                  label="Suffix"
                  placeholder="Jr., Sr., III"
                  value={formData.suffix}
                  onChange={(e) => updateField('suffix', e.target.value)}
                />
                <Input
                  label="Age *"
                  type="number"
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
                <div className="md:col-span-2">
                  <Input
                    label="Address"
                    placeholder="Enter complete address"
                    value={formData.address}
                    onChange={(e) => updateField('address', e.target.value)}
                  />
                </div>
                <Input
                  label="Contact Number *"
                  type="tel"
                  placeholder="09XXXXXXXXX"
                  value={formData.contact}
                  onChange={(e) => updateField('contact', e.target.value)}
                  error={errors.contact}
                />
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
                  label="Middle Name / Initial"
                  placeholder="M.I. or middle name"
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
                <Input
                  label="Suffix"
                  placeholder="Jr., Sr., III"
                  value={formData.suffix}
                  onChange={(e) => updateField('suffix', e.target.value)}
                  disabled={Boolean(formData.patientId)}
                />
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
                  label="Contact Number *"
                  type="tel"
                  placeholder="09XXXXXXXXX"
                  value={formData.contact}
                  onChange={(e) => updateField('contact', e.target.value)}
                  error={errors.contact}
                />
              </div>
              </div>
            )}

            <div className="mt-3">
              <label className="flex items-start gap-3 rounded-xl border border-border bg-muted/25 p-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={formData.smsConsent}
                  onChange={(e) => updateField('smsConsent', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>
                  <span className="font-semibold">SMS Consent</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">Patients who provide SMS consent may receive vaccination reminders based on their PEP schedule.</span>
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
              label="Barangay of Incident *"
              options={barangayOptions}
              value={formData.barangayId}
              onChange={(e) => handleBarangayChange(e.target.value)}
              error={errors.barangayId}
            />

            <div className="mt-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-slate-50 p-3">
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
