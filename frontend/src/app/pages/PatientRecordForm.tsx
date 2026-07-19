import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, MessageSquare, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Button } from '../components/UI/Button';
import { patientsAPI } from '../../lib/services/api';
import { canPerformAction, getStoredUser } from '../../lib/auth/roleAccess';
import {
  PATIENT_SUFFIX_OPTIONS,
  composePatientAddress,
  composePatientFullName,
  contactNumberError,
  getPatientNameFields,
  isValidPatientName,
  normalizePatientText,
} from '../../lib/patient';

type PatientFormData = {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  age: string;
  sex: string;
  contactNumber: string;
  email: string;
  addressLine: string;
  residenceBarangay: string;
  cityMunicipality: string;
  province: string;
  legacyAddress: string;
  smsConsent: boolean;
};

type PatientFormErrors = Partial<Record<keyof PatientFormData, string>>;

const initialFormData: PatientFormData = {
  firstName: '',
  middleName: '',
  lastName: '',
  suffix: '',
  age: '',
  sex: '',
  contactNumber: '',
  email: '',
  addressLine: '',
  residenceBarangay: '',
  cityMunicipality: 'Digos City',
  province: 'Davao del Sur',
  legacyAddress: '',
  smsConsent: false,
};

function SummaryRow({ label, value }: { label: string; value?: string | number | null }) {
  const displayValue = value === null || value === undefined || value === '' ? 'Not provided' : value;
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 bg-white px-3 py-2.5 text-xs">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="truncate font-semibold text-slate-900">{displayValue}</span>
    </div>
  );
}

export function PatientRecordForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  const currentUser = getStoredUser();
  const canSavePatient = canPerformAction(currentUser?.role, isEditMode ? 'patients.update' : 'patients.create');
  const [formData, setFormData] = useState<PatientFormData>(initialFormData);
  const [errors, setErrors] = useState<PatientFormErrors>({});
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadPatient() {
      if (!id) return;
      if (!canSavePatient) {
        setLoadError('You do not have permission to edit patient records.');
        return;
      }

      try {
        setLoadingPatient(true);
        setLoadError(null);
        const response = await patientsAPI.getById(id);
        const patient = response.data;
        const name = getPatientNameFields(patient);

        setFormData({
          firstName: name.firstName,
          middleName: name.middleName,
          lastName: name.lastName,
          suffix: name.suffix,
          age: patient?.age != null ? String(patient.age) : '',
          sex: patient?.sex || '',
          contactNumber: patient?.contact_number || '',
          email: patient?.email || '',
          addressLine: patient?.address_line || '',
          residenceBarangay: patient?.residence_barangay || '',
          cityMunicipality: patient?.city_municipality || 'Digos City',
          province: patient?.province || 'Davao del Sur',
          legacyAddress: patient?.address || '',
          smsConsent: patient?.sms_consent === true || Number(patient?.sms_consent) === 1,
        });
      } catch (error: any) {
        setLoadError(error.message || 'Unable to load patient record.');
      } finally {
        setLoadingPatient(false);
      }
    }

    loadPatient();
  }, [id, canSavePatient]);

  const fullName = composePatientFullName({
    first_name: formData.firstName,
    middle_name: formData.middleName,
    last_name: formData.lastName,
    suffix: formData.suffix,
  });
  const completeAddress = composePatientAddress({
    address_line: formData.addressLine,
    residence_barangay: formData.residenceBarangay,
    city_municipality: formData.cityMunicipality,
    province: formData.province,
    address: formData.legacyAddress,
  });

  const updateField = <K extends keyof PatientFormData>(field: K, value: PatientFormData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateForm = () => {
    const nextErrors: PatientFormErrors = {};
    const age = Number(formData.age);

    if (!isValidPatientName(formData.firstName, 2)) nextErrors.firstName = 'Enter 2–50 letters; spaces, hyphens, and apostrophes are allowed.';
    if (formData.middleName && !isValidPatientName(formData.middleName, 1)) nextErrors.middleName = 'Enter a valid middle name using letters, spaces, hyphens, or apostrophes.';
    if (!isValidPatientName(formData.lastName, 2)) nextErrors.lastName = 'Enter 2–50 letters; spaces, hyphens, and apostrophes are allowed.';
    if (!formData.age || !Number.isInteger(age) || age < 0 || age > 120) nextErrors.age = 'Enter a whole-number age from 0 to 120.';
    if (!formData.sex) nextErrors.sex = 'Sex is required.';
    nextErrors.contactNumber = contactNumberError(formData.contactNumber, formData.smsConsent);
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    const addressLineLength = normalizePatientText(formData.addressLine).length;
    const residenceBarangayLength = normalizePatientText(formData.residenceBarangay).length;
    const cityMunicipalityLength = normalizePatientText(formData.cityMunicipality).length;
    const provinceLength = normalizePatientText(formData.province).length;
    if (addressLineLength < 3 || addressLineLength > 150) nextErrors.addressLine = 'House No. / Purok / Street must contain 3–150 characters.';
    if (residenceBarangayLength < 2 || residenceBarangayLength > 80) nextErrors.residenceBarangay = 'Barangay must contain 2–80 characters.';
    if (cityMunicipalityLength < 2 || cityMunicipalityLength > 80) nextErrors.cityMunicipality = 'City / Municipality must contain 2–80 characters.';
    if (provinceLength < 2 || provinceLength > 80) nextErrors.province = 'Province must contain 2–80 characters.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSavePatient) {
      toast.error('You do not have permission to save patient records.');
      return;
    }

    if (!validateForm()) {
      toast.error('Please complete the required patient details.');
      return;
    }

    const payload = {
      first_name: normalizePatientText(formData.firstName),
      middle_name: normalizePatientText(formData.middleName) || null,
      last_name: normalizePatientText(formData.lastName),
      suffix: formData.suffix || null,
      full_name: fullName,
      age: Number(formData.age),
      sex: formData.sex,
      contact_number: formData.contactNumber.trim() || null,
      email: formData.email.trim() || null,
      address_line: normalizePatientText(formData.addressLine),
      residence_barangay: normalizePatientText(formData.residenceBarangay),
      city_municipality: normalizePatientText(formData.cityMunicipality),
      province: normalizePatientText(formData.province),
      address: completeAddress,
      sms_consent: formData.smsConsent,
    };

    try {
      setSaving(true);
      const response = isEditMode && id
        ? await patientsAPI.update(id, payload)
        : await patientsAPI.create(payload);

      const patientId = response.data?.id || id;
      toast.success(isEditMode ? 'Patient record updated successfully.' : 'Patient record created successfully.');
      navigate('/patients/' + patientId);
    } catch (error: any) {
      toast.error(error.message || (isEditMode ? 'Failed to update patient record.' : 'Failed to create patient record.'));
    } finally {
      setSaving(false);
    }
  };

  if (!canSavePatient && !isEditMode) {
    return (
      <div className="flex-1 bg-[#f6f8f7] min-h-screen">
        <Header title="New Patient Record" breadcrumbs={['Patients', 'New Patient']} />
        <div className="px-5 py-5 lg:px-7 lg:py-6">
          <div className="rounded-2xl border border-destructive/20 bg-destructive-bg p-8 text-center shadow-sm">
            <p className="text-sm font-semibold text-destructive">You do not have permission to create patient records.</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => navigate('/patients')}>
              Back to Patients
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingPatient) {
    return (
      <div className="flex-1 bg-[#f6f8f7] min-h-screen">
        <Header title="Edit Patient Record" breadcrumbs={['Patients', 'Edit Patient']} />
        <div className="px-5 py-5 lg:px-7 lg:py-6">
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
            Loading patient record...
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex-1 bg-[#f6f8f7] min-h-screen">
        <Header title="Edit Patient Record" breadcrumbs={['Patients', 'Edit Patient']} />
        <div className="px-5 py-5 lg:px-7 lg:py-6">
          <div className="rounded-2xl border border-destructive/20 bg-destructive-bg p-8 text-center shadow-sm">
            <p className="text-sm font-semibold text-destructive">{loadError}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => navigate('/patients')}>
              Back to Patients
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex-1 bg-[#f6f8f7] max-md:fixed max-md:inset-0 max-md:z-30 max-md:overflow-y-auto">
      <Header title={isEditMode ? 'Edit Patient Record' : 'New Patient Record'} breadcrumbs={isEditMode ? ['Patients', 'Edit Patient'] : ['Patients', 'New Patient']} />

      <div className="px-5 py-5 lg:px-7 lg:py-6">
        <form onSubmit={handleSubmit} className="mx-auto grid max-w-[1480px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground">Patient Information</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Encode the patient profile used by the registry, incident records, PEP schedules, and reminders.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => navigate(isEditMode && id ? '/patients/' + id : '/patients')}>
                  <ArrowLeft className="h-4 w-4" />
                  {isEditMode ? 'Back to Patient' : 'Back to Patients'}
                </Button>
              </div>

              <section>
                <h3 className="mb-3 text-sm font-bold text-foreground">A. Patient Identity</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Input label="First Name *" placeholder="Enter first name" value={formData.firstName} onChange={(event) => updateField('firstName', event.target.value)} error={errors.firstName} />
                  <Input label="Middle Name (Optional)" placeholder="Enter full middle name" value={formData.middleName} onChange={(event) => updateField('middleName', event.target.value)} error={errors.middleName} />
                  <Input label="Last Name *" placeholder="Enter last name" value={formData.lastName} onChange={(event) => updateField('lastName', event.target.value)} error={errors.lastName} />
                  <Select label="Suffix (Optional)" options={PATIENT_SUFFIX_OPTIONS} value={formData.suffix} onChange={(event) => updateField('suffix', event.target.value)} error={errors.suffix} />
                </div>
              </section>

              <section className="mt-5 border-t border-border pt-4">
                <h3 className="mb-3 text-sm font-bold text-foreground">B. Demographics and Contact</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Input label="Age *" type="number" min={0} max={120} step={1} inputMode="numeric" placeholder="Age" value={formData.age} onChange={(event) => updateField('age', event.target.value)} error={errors.age} />
                  <Select label="Sex *" options={[{ value: '', label: 'Select sex' }, { value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]} value={formData.sex} onChange={(event) => updateField('sex', event.target.value)} error={errors.sex} />
                  <Input label={formData.smsConsent ? 'Contact Number *' : 'Contact Number (Optional)'} type="tel" inputMode="numeric" maxLength={11} placeholder="09XXXXXXXXX" value={formData.contactNumber} onChange={(event) => updateField('contactNumber', event.target.value)} error={errors.contactNumber} />
                  <Input label="Email (Optional)" type="email" placeholder="patient@email.com" value={formData.email} onChange={(event) => updateField('email', event.target.value)} error={errors.email} />
                </div>
              </section>

              <section className="mt-5 border-t border-border pt-4">
                <h3 className="mb-1 text-sm font-bold text-foreground">C. Patient Residential Address</h3>
                <p className="mb-3 text-xs text-muted-foreground">This is the patient's residence and is separate from the location of an animal-bite incident.</p>
                {formData.legacyAddress && !formData.addressLine && (
                  <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Legacy address on file: {formData.legacyAddress}</p>
                )}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input label="House No. / Purok / Street *" placeholder="Enter house number, purok, subdivision, or street" value={formData.addressLine} onChange={(event) => updateField('addressLine', event.target.value)} error={errors.addressLine} />
                  <Input label="Barangay *" placeholder="Enter residential barangay" value={formData.residenceBarangay} onChange={(event) => updateField('residenceBarangay', event.target.value)} error={errors.residenceBarangay} />
                  <Input label="City / Municipality *" placeholder="Enter city or municipality" value={formData.cityMunicipality} onChange={(event) => updateField('cityMunicipality', event.target.value)} error={errors.cityMunicipality} />
                  <Input label="Province *" placeholder="Enter province" value={formData.province} onChange={(event) => updateField('province', event.target.value)} error={errors.province} />
                </div>
              </section>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-xl bg-emerald-50 p-2 text-primary">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">D. SMS Reminder Permission</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Patient messaging permission only; treatment and clinic monitoring remain unaffected.</p>
                </div>
              </div>
              <div>
                <label className="flex items-start gap-3 rounded-xl border border-border bg-muted/25 p-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={formData.smsConsent}
                    onChange={(event) => updateField('smsConsent', event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>
                    <span className="font-semibold">SMS Reminder Permission</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">Patient agrees to receive vaccination appointment reminders through SMS at the contact number provided. This choice does not affect treatment or PEP scheduling.</span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <aside className="space-y-3 xl:self-start">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm xl:sticky xl:top-24">
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-xl bg-emerald-50 p-2 text-primary">
                  <UserRound className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Patient Summary</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Review before saving.</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-border">
                <SummaryRow label="Patient" value={fullName || 'Not entered'} />
                <SummaryRow label="Age / Sex" value={[formData.age, formData.sex].filter(Boolean).join(' / ')} />
                <SummaryRow label="Contact" value={formData.contactNumber} />
                <SummaryRow label="Residence" value={completeAddress} />
                <SummaryRow label="SMS Permission" value={formData.smsConsent ? 'Enabled' : 'Disabled'} />
              </div>
              <div className="mt-4 grid gap-2">
                <Button type="submit" size="lg" disabled={saving} className="w-full">
                  {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Save Patient Record'}
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={() => navigate(isEditMode && id ? '/patients/' + id : '/patients')} className="w-full">
                  Cancel
                </Button>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
