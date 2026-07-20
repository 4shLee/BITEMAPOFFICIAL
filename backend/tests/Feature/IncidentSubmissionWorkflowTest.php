<?php

namespace Tests\Feature;

use App\Models\Incident;
use App\Models\Patient;
use App\Models\PepSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class IncidentSubmissionWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private Patient $patient;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create([
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]));

        $this->patient = Patient::create([
            'full_name' => 'Existing Patient',
            'age' => 44,
            'sex' => 'Female',
            'address' => 'Digos City',
        ]);
    }

    public function test_existing_patient_incident_needs_no_hidden_new_patient_fields_and_does_not_overwrite_patient(): void
    {
        $original = $this->patient->toArray();

        $response = $this->postJson('/api/incidents', $this->existingPayload())
            ->assertCreated()
            ->assertJsonPath('data.patient_id', $this->patient->id)
            ->assertJsonCount(5, 'data.pep_schedules');

        $this->assertSame(1, Patient::count());
        $this->assertSame(1, Incident::count());
        $this->assertSame($original['full_name'], $this->patient->fresh()->full_name);
        $this->assertSame($response->json('data.id'), Incident::firstOrFail()->id);
    }

    public function test_new_patient_submission_creates_exactly_one_patient_and_one_linked_incident(): void
    {
        $response = $this->postJson('/api/incidents', $this->newPatientPayload())
            ->assertCreated()
            ->assertJsonPath('data.patient.first_name', 'New')
            ->assertJsonPath('data.patient.last_name', 'Patient');

        $this->assertSame(2, Patient::count());
        $this->assertSame(1, Incident::count());
        $this->assertSame(5, PepSchedule::count());
        $this->assertSame($response->json('data.patient_id'), Incident::firstOrFail()->patient_id);
    }

    public function test_exact_validation_error_is_returned_and_failed_new_patient_is_rolled_back(): void
    {
        $payload = $this->newPatientPayload();
        unset($payload['pep_start_date']);

        $this->postJson('/api/incidents', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('pep_start_date')
            ->assertJsonFragment(['Enter the first vaccine dose date to generate the PEP schedule.']);

        $this->assertSame(1, Patient::count());
        $this->assertSame(0, Incident::count());

        $this->postJson('/api/incidents', $this->newPatientPayload())->assertCreated();
        $this->assertSame(2, Patient::count());
        $this->assertSame(1, Incident::count());
    }

    public function test_existing_patient_mode_returns_exact_patient_selection_error(): void
    {
        $payload = $this->existingPayload();
        unset($payload['patient_id']);

        $this->postJson('/api/incidents', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('patient_id')
            ->assertJsonFragment(['Select an existing patient.']);
    }

    public function test_incident_list_detail_patient_registry_and_pep_schedule_endpoints_still_load(): void
    {
        $incidentId = $this->postJson('/api/incidents', $this->existingPayload())->assertCreated()->json('data.id');

        $this->getJson('/api/incidents')->assertOk();
        $this->getJson('/api/incidents/'.$incidentId)->assertOk();
        $this->getJson('/api/patients')->assertOk();
        $this->getJson('/api/patients/'.$this->patient->id)->assertOk();
        $this->getJson('/api/pep-schedule')->assertOk();
    }

    private function existingPayload(): array
    {
        return [
            'patient_type' => 'existing',
            'patient_id' => $this->patient->id,
            ...$this->incidentFields(),
        ];
    }

    private function newPatientPayload(): array
    {
        return [
            'patient_type' => 'new',
            'first_name' => 'New',
            'last_name' => 'Patient',
            'full_name' => 'New Patient',
            'age' => 20,
            'sex' => 'Male',
            'address_line' => 'Purok 1',
            'residence_barangay' => 'Zone 1',
            'city_municipality' => 'Digos City',
            'province' => 'Davao del Sur',
            'address' => 'Purok 1, Zone 1, Digos City, Davao del Sur',
            ...$this->incidentFields(),
        ];
    }

    private function incidentFields(): array
    {
        return [
            'location_scope' => 'outside_digos',
            'incident_city_municipality' => 'Bansalan',
            'incident_province' => 'Davao del Sur',
            'incident_date' => '2026-07-01',
            'first_consult_date' => '2026-07-02',
            'pep_start_date' => '2026-07-03',
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'exposure_contact_types' => ['scratch'],
            'exposure_skin_condition' => 'broken',
            'exposure_bleeding_present' => false,
            'exposure_transdermal' => false,
            'who_category' => 'Category II',
            'who_category_confirmed' => true,
            'status' => 'Active',
        ];
    }
}
