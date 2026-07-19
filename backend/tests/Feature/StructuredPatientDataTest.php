<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Notification;
use App\Models\Patient;
use App\Models\PepSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StructuredPatientDataTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create([
            'role' => 'Nurse',
            'is_active' => true,
            'approval_status' => 'approved',
        ]));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_new_incident_creates_structured_patient_and_complete_pep_schedule_without_sending_sms(): void
    {
        $response = $this->postJson('/api/incidents', $this->incidentPayload());

        $response->assertCreated()
            ->assertJsonPath('data.patient.first_name', 'Vict')
            ->assertJsonPath('data.patient.middle_name', 'Christine')
            ->assertJsonPath('data.patient.last_name', 'De Asis')
            ->assertJsonPath('data.patient.display_name', 'Vict C. De Asis Jr.')
            ->assertJsonPath('data.patient.full_name', 'Vict Christine De Asis Jr.')
            ->assertJsonPath('data.patient.address', 'Purok 4, Zone 2, Digos City, Davao del Sur')
            ->assertJsonCount(5, 'data.pep_schedules');

        $this->assertDatabaseHas('patients', [
            'middle_name' => 'Christine',
            'residence_barangay' => 'Zone 2',
            'sms_consent' => false,
        ]);
        $this->assertSame(5, PepSchedule::where('incident_id', $response->json('data.id'))->count());
        $this->assertSame(0, Notification::count());
    }

    public function test_entered_contact_number_must_be_exactly_eleven_digits_and_start_with_09(): void
    {
        foreach ([
            '0917123456' => 'Contact number must contain exactly 11 digits.',
            '091712345678' => 'Contact number must contain exactly 11 digits.',
            '08171234567' => 'Contact number must start with 09.',
            '0917 123456' => 'Contact number must contain exactly 11 digits.',
        ] as $contact => $message) {
            $payload = $this->incidentPayload(['contact_number' => $contact]);
            $this->postJson('/api/incidents', $payload)
                ->assertUnprocessable()
                ->assertJsonValidationErrors('contact_number')
                ->assertJsonFragment([$message]);
        }
    }

    public function test_sms_permission_requires_a_valid_contact_and_accepts_one_when_present(): void
    {
        $this->postJson('/api/incidents', $this->incidentPayload([
            'contact_number' => null,
            'sms_consent' => true,
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors('contact_number')
            ->assertJsonFragment(['A valid contact number is required to enable SMS reminders.']);

        $this->postJson('/api/incidents', $this->incidentPayload([
            'contact_number' => '09171234567',
            'sms_consent' => true,
        ]))->assertCreated()->assertJsonPath('data.sms_consent', true);
    }

    public function test_missing_null_and_false_sms_permission_all_remain_disabled(): void
    {
        foreach (['missing', 'null', 'false'] as $index => $state) {
            $payload = $this->incidentPayload([
                'first_name' => 'Patient',
                'last_name' => 'State'.chr(65 + $index),
                'full_name' => 'Patient State'.chr(65 + $index),
            ]);

            if ($state === 'missing') {
                unset($payload['sms_consent']);
            } else {
                $payload['sms_consent'] = $state === 'false' ? false : null;
            }

            $this->postJson('/api/incidents', $payload)
                ->assertCreated()
                ->assertJsonPath('data.sms_consent', false);
        }
    }

    public function test_patient_without_contact_or_sms_permission_can_be_registered(): void
    {
        $payload = $this->patientPayload([
            'contact_number' => null,
            'sms_consent' => false,
        ]);

        $this->postJson('/api/patients', $payload)
            ->assertCreated()
            ->assertJsonPath('data.contact_number', null)
            ->assertJsonPath('data.sms_consent', false);
    }

    public function test_age_outside_zero_to_one_hundred_twenty_is_rejected(): void
    {
        foreach ([-1, 121] as $age) {
            $this->postJson('/api/patients', $this->patientPayload(['age' => $age]))
                ->assertUnprocessable()
                ->assertJsonValidationErrors('age');
        }
    }

    public function test_numeric_characters_and_punctuation_only_names_are_rejected(): void
    {
        foreach ([['first_name' => 'Vict2'], ['middle_name' => '---'], ['last_name' => '123']] as $invalid) {
            $this->postJson('/api/patients', $this->patientPayload($invalid))
                ->assertUnprocessable()
                ->assertJsonValidationErrors(array_key_first($invalid));
        }
    }

    public function test_full_middle_name_and_compact_middle_initial_are_preserved(): void
    {
        $response = $this->postJson('/api/patients', $this->patientPayload([
            'middle_name' => 'Marie Anne',
        ]));

        $response->assertCreated()
            ->assertJsonPath('data.middle_name', 'Marie Anne')
            ->assertJsonPath('data.display_name', 'Vict M. De Asis Jr.');
    }

    public function test_patient_without_middle_name_has_no_extra_period_or_space(): void
    {
        $this->postJson('/api/patients', $this->patientPayload(['middle_name' => null]))
            ->assertCreated()
            ->assertJsonPath('data.display_name', 'Vict De Asis Jr.');
    }

    public function test_patient_residence_does_not_overwrite_incident_location(): void
    {
        $incidentBarangay = Barangay::create(['name' => 'Aplaya']);
        $response = $this->postJson('/api/incidents', $this->incidentPayload([
            'barangay_id' => $incidentBarangay->id,
            'residence_barangay' => 'Zone 2',
        ]))->assertCreated();

        $response->assertJsonPath('data.barangay.name', 'Aplaya')
            ->assertJsonPath('data.patient.residence_barangay', 'Zone 2')
            ->assertJsonPath('data.patient.barangay_id', null);
    }

    public function test_legacy_patient_with_only_full_name_and_address_still_loads(): void
    {
        $patient = Patient::create([
            'full_name' => 'Legacy Patient Record',
            'age' => 40,
            'sex' => 'Male',
            'address' => 'Old free-form address',
            'contact_number' => null,
            'sms_consent' => false,
        ]);

        $this->getJson('/api/patients/'.$patient->id)
            ->assertOk()
            ->assertJsonPath('data.full_name', 'Legacy Patient Record')
            ->assertJsonPath('data.display_name', 'Legacy Patient Record')
            ->assertJsonPath('data.address', 'Old free-form address')
            ->assertJsonPath('data.address_line', null);
    }

    public function test_selecting_existing_patient_and_editing_incident_do_not_overwrite_patient_permission(): void
    {
        $patient = Patient::create($this->patientPayload([
            'contact_number' => '09171234567',
            'sms_consent' => true,
        ]));

        $create = $this->postJson('/api/incidents', [
            'patient_id' => $patient->id,
            'incident_date' => '2026-07-18',
            'animal_type' => 'Dog',
            'who_category' => 'Category II',
            'sms_consent' => false,
        ])->assertCreated();

        $this->assertTrue($patient->fresh()->sms_consent);

        $this->putJson('/api/incidents/'.$create->json('data.id'), [
            'patient_id' => $patient->id,
            'incident_date' => '2026-07-17',
            'animal_type' => 'Cat',
            'who_category' => 'Category II',
            'sms_consent' => false,
        ])->assertOk();

        $this->assertTrue($patient->fresh()->sms_consent);
        $this->assertSame('Vict Christine De Asis Jr.', $patient->fresh()->full_name);
    }

    public function test_overdue_clinic_summary_remains_available_without_patient_sms_permission(): void
    {
        Carbon::setTestNow('2026-07-19 09:00:00');
        $this->postJson('/api/incidents', $this->incidentPayload([
            'incident_date' => '2026-06-01',
            'sms_consent' => false,
        ]))->assertCreated();

        $response = $this->getJson('/api/notifications')->assertOk();
        $this->assertGreaterThan(0, $response->json('meta.summary.overdue_patients'));
    }

    private function patientPayload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Vict',
            'middle_name' => 'Christine',
            'last_name' => 'De Asis',
            'suffix' => 'Jr.',
            'full_name' => 'This value is regenerated',
            'age' => 30,
            'sex' => 'Female',
            'address_line' => 'Purok 4',
            'residence_barangay' => 'Zone 2',
            'city_municipality' => 'Digos City',
            'province' => 'Davao del Sur',
            'address' => 'This value is regenerated',
            'contact_number' => null,
            'sms_consent' => false,
        ], $overrides);
    }

    private function incidentPayload(array $overrides = []): array
    {
        return array_merge($this->patientPayload(), [
            'patient_name' => 'This value is regenerated',
            'incident_date' => '2026-07-18',
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'who_category' => 'Category II',
            'status' => 'Active',
        ], $overrides);
    }
}
