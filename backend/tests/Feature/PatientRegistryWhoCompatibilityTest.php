<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Incident;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PatientRegistryWhoCompatibilityTest extends TestCase
{
    use RefreshDatabase;

    private User $clinicUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->clinicUser = User::factory()->create([
            'role' => 'Nurse',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        Sanctum::actingAs($this->clinicUser);
    }

    public function test_patient_list_returns_existing_legacy_and_structured_patients_in_the_expected_shape(): void
    {
        $barangay = Barangay::create(['name' => 'Aplaya']);
        $legacy = $this->createLegacyPatient($barangay);
        $structured = $this->createStructuredPatient();

        $response = $this->getJson('/api/patients')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(2, 'data');

        $patients = collect($response->json('data'));
        $legacyPayload = $patients->firstWhere('id', $legacy->id);
        $structuredPayload = $patients->firstWhere('id', $structured->id);

        $this->assertSame('Legacy Patient Record', $legacyPayload['display_name']);
        $this->assertSame('Aplaya', $legacyPayload['barangay']['name']);
        $this->assertSame('Structured P. Patient', $structuredPayload['display_name']);
        $this->assertSame('Zone 2', $structuredPayload['residence_barangay']);

        $nameMatches = $patients->filter(fn (array $patient): bool => str_contains(
            strtolower($patient['display_name']),
            'structured'
        ));
        $barangayMatches = $patients->filter(fn (array $patient): bool => ($patient['residence_barangay'] ?? $patient['barangay']['name'] ?? null) === 'Aplaya');

        $this->assertCount(1, $nameMatches, 'Patient Registry name search data changed unexpectedly.');
        $this->assertCount(1, $barangayMatches, 'Patient Registry barangay filter data changed unexpectedly.');
    }

    public function test_legacy_patient_with_legacy_who_incident_and_null_assessment_loads_in_list_and_detail(): void
    {
        $barangay = Barangay::create(['name' => 'Zone 3']);
        $patient = $this->createLegacyPatient($barangay);
        $incident = Incident::create([
            'patient_id' => $patient->id,
            'barangay_id' => $barangay->id,
            'incident_date' => '2026-07-01',
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'who_category' => 'III',
            'status' => 'Active',
            'exposure_contact_types' => null,
            'exposure_skin_condition' => null,
            'exposure_bleeding_present' => null,
            'exposure_transdermal' => null,
            'exposure_saliva_contact_site' => null,
            'exposure_direct_bat_contact' => null,
            'suggested_who_category' => null,
            'who_category_suggestion_reason' => null,
            'who_category_override_reason' => null,
            'who_category_confirmed_by' => null,
            'who_category_confirmed_at' => null,
        ]);

        $this->getJson('/api/patients')
            ->assertOk()
            ->assertJsonFragment(['id' => $patient->id, 'full_name' => 'Legacy Patient Record']);

        $this->getJson('/api/patients/'.$patient->id)
            ->assertOk()
            ->assertJsonPath('data.incidents.0.id', $incident->id)
            ->assertJsonPath('data.incidents.0.who_category', 'Category III')
            ->assertJsonPath('data.incidents.0.exposure_contact_types', null)
            ->assertJsonPath('data.incidents.0.suggested_who_category', null)
            ->assertJsonPath('data.incidents.0.who_category_confirmer', null);
    }

    public function test_patient_with_structured_who_assessment_loads_in_list_and_detail(): void
    {
        $barangay = Barangay::create(['name' => 'Zone 2']);
        $patient = $this->createStructuredPatient();
        $incident = Incident::create([
            'patient_id' => $patient->id,
            'barangay_id' => $barangay->id,
            'location_scope' => 'within_digos',
            'incident_date' => '2026-07-18',
            'animal_type' => 'Cat',
            'bite_site' => 'Right hand',
            'who_category' => 'II',
            'exposure_contact_types' => ['scratch'],
            'exposure_skin_condition' => 'broken',
            'exposure_bleeding_present' => false,
            'exposure_transdermal' => false,
            'exposure_saliva_contact_site' => 'none',
            'exposure_direct_bat_contact' => false,
            'suggested_who_category' => 'II',
            'who_category_suggestion_reason' => 'Minor scratch or abrasion without bleeding.',
            'who_category_confirmed_by' => $this->clinicUser->id,
            'who_category_confirmed_at' => '2026-07-18 09:30:00',
            'status' => 'Active',
        ]);

        $this->getJson('/api/patients')
            ->assertOk()
            ->assertJsonFragment(['id' => $patient->id, 'full_name' => 'Structured Paula Patient']);

        $this->getJson('/api/patients/'.$patient->id)
            ->assertOk()
            ->assertJsonPath('data.incidents.0.id', $incident->id)
            ->assertJsonPath('data.incidents.0.exposure_contact_types.0', 'scratch')
            ->assertJsonPath('data.incidents.0.suggested_who_category', 'Category II')
            ->assertJsonPath('data.incidents.0.who_category_confirmer.id', $this->clinicUser->id);

        $this->getJson('/api/incidents')->assertOk();
        $this->getJson('/api/incidents/'.$incident->id)
            ->assertOk()
            ->assertJsonPath('data.id', $incident->id);
    }

    public function test_empty_patient_registry_returns_a_valid_empty_response(): void
    {
        $this->getJson('/api/patients')
            ->assertOk()
            ->assertExactJson([
                'success' => true,
                'data' => [],
            ]);
    }

    private function createLegacyPatient(Barangay $barangay): Patient
    {
        return Patient::create([
            'full_name' => 'Legacy Patient Record',
            'age' => 42,
            'sex' => 'Female',
            'address' => 'Old free-form address',
            'barangay_id' => $barangay->id,
            'contact_number' => null,
            'sms_consent' => false,
        ]);
    }

    private function createStructuredPatient(): Patient
    {
        return Patient::create([
            'first_name' => 'Structured',
            'middle_name' => 'Paula',
            'last_name' => 'Patient',
            'full_name' => 'Structured Paula Patient',
            'age' => 28,
            'sex' => 'Female',
            'address_line' => 'Purok 4',
            'residence_barangay' => 'Zone 2',
            'city_municipality' => 'Digos City',
            'province' => 'Davao del Sur',
            'address' => 'Purok 4, Zone 2, Digos City, Davao del Sur',
            'contact_number' => '09171234567',
            'sms_consent' => true,
        ]);
    }
}
