import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, CheckCircle2, MessageSquare, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Button } from '../components/UI/Button';
import { patientsAPI, barangaysAPI } from '../../lib/services/api';
import { canPerformAction, getStoredUser } from '../../lib/auth/roleAccess';

type PatientFormData = {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  age: string;
  sex: string;
  contactNumber: string;
  email: string;
  address: string;
  barangayId: string;
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
  address: '',
  barangayId: '',
  smsConsent: true,
};

function composeFullName(formData: PatientFormData) {
  return [
    formData.firstName.trim(),
    formData.middleName.trim(),
    formData.lastName.trim(),
    formData.suffix.trim(),
  ].filter(Boolean).join(' ');
}

function splitFullName(fullName?: string) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  const suffixes = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v'];

  if (parts.length === 0) return { firstName: '', middleName: '', lastName: '', suffix: '' };

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

function normalizeContact(value: string) {
  return value.replace(/[\s-]/g, '');
}

function isValidPhilippineMobile(value: string) {
  const contact = normalizeContact(value);
  return /^09\d{9}$/.test(contact) || /^\+639\d{9}$/.test(contact);
}

function SummaryRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 bg-white px-3 py-2.5 text-xs">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="truncate font-semibold text-slate-900">{value || 'Not provided'}</span>
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
  const [barangays, setBarangays] = useState<any[]>([]);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadBarangays() {
      try {
        const response = await barangaysAPI.getAll();
        if (response.success) setBarangays(response.data || []);
      } catch {
        toast.error('Failed to load barangay options.');
      }
    }

    loadBarangays();
  }, []);

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
        const name = splitFullName(patient?.full_name);

        setFormData({
          firstName: name.firstName,
          middleName: name.middleName,
          lastName: name.lastName,
          suffix: name.suffix,
          age: patient?.age ? String(patient.age) : '',
          sex: patient?.sex || '',
          contactNumber: patient?.contact_number || '',
          email: patient?.email || '',
          address: patient?.address || '',
          barangayId: patient?.barangay_id ? String(patient.barangay_id) : '',
          smsConsent: patient?.sms_consent !== false && Number(patient?.sms_consent) !== 0,
        });
      } catch (error: any) {
        setLoadError(error.message || 'Unable to load patient record.');
      } finally {
        setLoadingPatient(false);
      }
    }

    loadPatient();
  }, [id, canSavePatient]);

  const barangayOptions = useMemo(() => [
    { value: '', label: 'Select barangay' },
    ...barangays.map((barangay) => ({ value: String(barangay.id), label: barangay.name })),
  ], [barangays]);

  const selectedBarangay = barangays.find((barangay) => String(barangay.id) === formData.barangayId);
  const fullName = composeFullName(formData);

  const updateField = <K extends keyof PatientFormData>(field: K, value: PatientFormData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateForm = () => {
    const nextErrors: PatientFormErrors = {};
    const age = Number(formData.age);

    if (!formData.firstName.trim()) nextErrors.firstName = 'First name is required.';
    if (!formData.lastName.trim()) nextErrors.lastName = 'Last name is required.';
    if (!formData.age || Number.isNaN(age) || age < 0 || age > 120) nextErrors.age = 'Enter a valid age from 0 to 120.';
    if (!formData.sex) nextErrors.sex = 'Sex is required.';
    if (!formData.contactNumber.trim()) {
      nextErrors.contactNumber = 'Contact number is required.';
    } else if (!isValidPhilippineMobile(formData.contactNumber)) {
      nextErrors.contactNumber = 'Use a Philippine mobile number, e.g. 09XXXXXXXXX.';
    }
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!formData.address.trim()) nextErrors.address = 'Complete address is required.';
    if (!formData.barangayId) nextErrors.barangayId = 'Barangay is required.';

    setErrors(nextErrors);
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
      full_name: fullName,
      age: Number(formData.age),
      sex: formData.sex,
      contact_number: normalizeContact(formData.contactNumber),
      email: formData.email.trim() || null,
      address: formData.address.trim(),
      barangay_id: formData.barangayId,
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
    <div className="flex-1 bg-[#f6f8f7] min-h-screen">
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

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
                <div className="md:col-span-2">
                  <Input label="First Name *" placeholder="First name" value={formData.firstName} onChange={(event) => updateField('firstName', event.target.value)} error={errors.firstName} />
                </div>
                <Input label="Middle Name / Initial" placeholder="M.I. or middle name" value={formData.middleName} onChange={(event) => updateField('middleName', event.target.value)} />
                <div className="md:col-span-2">
                  <Input label="Last Name *" placeholder="Last name" value={formData.lastName} onChange={(event) => updateField('lastName', event.target.value)} error={errors.lastName} />
                </div>
                <Input label="Suffix" placeholder="Jr., Sr., III" value={formData.suffix} onChange={(event) => updateField('suffix', event.target.value)} />
                <Input label="Age *" type="number" placeholder="Age" value={formData.age} onChange={(event) => updateField('age', event.target.value)} error={errors.age} />
                <Select label="Sex *" options={[{ value: '', label: 'Select sex' }, { value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]} value={formData.sex} onChange={(event) => updateField('sex', event.target.value)} error={errors.sex} />
                <Input label="Contact Number *" type="tel" placeholder="09XXXXXXXXX" value={formData.contactNumber} onChange={(event) => updateField('contactNumber', event.target.value)} error={errors.contactNumber} />
                <Input label="Email" type="email" placeholder="patient@email.com" value={formData.email} onChange={(event) => updateField('email', event.target.value)} error={errors.email} />
                <div className="md:col-span-2">
                  <Input label="Complete Address *" placeholder="House no., street, purok, landmark" value={formData.address} onChange={(event) => updateField('address', event.target.value)} error={errors.address} />
                </div>
                <div className="md:col-span-2">
                  <Select label="Barangay *" options={barangayOptions} value={formData.barangayId} onChange={(event) => updateField('barangayId', event.target.value)} error={errors.barangayId} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-xl bg-emerald-50 p-2 text-primary">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Reminder Preferences</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Used as a clinic reference for PEP reminders.</p>
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
                    <span className="font-semibold">SMS Consent</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">Patients who provide SMS consent may receive vaccination reminders based on their PEP schedule.</span>
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
                <SummaryRow label="Barangay" value={selectedBarangay?.name} />
                <SummaryRow label="SMS Consent" value={formData.smsConsent ? 'Allowed' : 'Declined'} />
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
