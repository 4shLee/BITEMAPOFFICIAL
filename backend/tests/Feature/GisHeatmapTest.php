<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Incident;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GisHeatmapTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->authenticateAs('Nurse');
    }

    public function test_authorized_user_receives_expected_heatmap_structure_with_legacy_patient_data(): void
    {
        $incident = $this->createIncident();

        $this->getJson('/api/gis/heatmap')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.0.incident_id', $incident->id)
            ->assertJsonPath('data.0.barangay_name', 'Aplaya')
            ->assertJsonPath('data.0.total_incident_count', 1)
            ->assertJsonPath('heat_points.0.barangay_name', 'Aplaya')
            ->assertJsonStructure([
                'success',
                'data' => [[
                    'incident_id',
                    'incident_ids',
                    'barangay_name',
                    'latitude',
                    'longitude',
                    'total_incident_count',
                    'total_incidents',
                    'top_animal_type',
                    'pep_compliance_rate',
                    'risk_level',
                ]],
                'heat_points' => [[
                    'barangay_name',
                    'latitude',
                    'longitude',
                    'intensity',
                    'total_incident_count',
                ]],
                'bounds' => ['southwest', 'northeast'],
                'center',
                'zoom',
                'generated_at',
            ]);
    }

    public function test_no_incidents_returns_an_empty_valid_dataset(): void
    {
        $this->getJson('/api/gis/heatmap')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(0, 'data')
            ->assertJsonCount(0, 'heat_points');
    }

    public function test_public_heatmap_remains_compatible_with_the_shared_response_builder(): void
    {
        $this->createIncident();

        $this->getJson('/api/public/heatmap')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.0.barangay_name', 'Aplaya')
            ->assertJsonPath('data.0.total_incident_count', 1)
            ->assertJsonCount(1, 'heat_points');
    }

    public function test_null_exact_coordinates_use_the_valid_incident_barangay_location(): void
    {
        $this->createIncident(['location_lat' => null, 'location_lng' => null]);

        $this->getJson('/api/gis/heatmap')
            ->assertOk()
            ->assertJsonPath('data.0.total_incident_count', 1)
            ->assertJsonPath('data.0.latitude', 6.76)
            ->assertJsonPath('data.0.longitude', 125.3425);
    }

    public function test_malformed_coordinates_are_excluded_without_hiding_valid_incidents(): void
    {
        $this->createIncident();
        $barangay = $this->barangay();
        $patient = $this->legacyPatient();

        DB::table('incidents')->insert([
            'patient_id' => $patient->id,
            'barangay_id' => $barangay->id,
            'incident_date' => '2026-07-18',
            'animal_type' => 'Cat',
            'bite_site' => 'Hand',
            'who_category' => 'II',
            'location_lat' => 'not-a-coordinate',
            'location_lng' => '125.34250000',
            'status' => 'Active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->getJson('/api/gis/heatmap')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.total_incident_count', 1)
            ->assertJsonCount(1, 'heat_points');
    }

    public function test_missing_barangay_relationship_does_not_crash_the_endpoint(): void
    {
        $patient = $this->legacyPatient();
        $this->createIncident(['patient_id' => $patient->id, 'barangay_id' => null]);

        $this->getJson('/api/gis/heatmap')
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonCount(0, 'heat_points');
    }

    public function test_date_filters_work_individually_and_as_a_range(): void
    {
        $this->createIncident(['incident_date' => '2026-07-01']);
        $this->createIncident(['incident_date' => '2026-07-10']);
        $this->createIncident(['incident_date' => '2026-07-20']);

        $this->getJson('/api/gis/heatmap?date_from=2026-07-10')
            ->assertOk()
            ->assertJsonPath('data.0.total_incident_count', 2);
        $this->getJson('/api/gis/heatmap?date_to=2026-07-10')
            ->assertOk()
            ->assertJsonPath('data.0.total_incident_count', 2);
        $this->getJson('/api/gis/heatmap?date_from=2026-07-05&date_to=2026-07-15')
            ->assertOk()
            ->assertJsonPath('data.0.total_incident_count', 1);
    }

    public function test_animal_type_and_who_category_filters_work_alone_and_together(): void
    {
        $this->createIncident(['animal_type' => 'Dog', 'who_category' => 'II']);
        $this->createIncident(['animal_type' => 'Cat', 'who_category' => 'III']);
        $this->createIncident(['animal_type' => 'Dog', 'who_category' => 'III']);

        $this->getJson('/api/gis/heatmap?animal_type=Dog')
            ->assertOk()
            ->assertJsonPath('data.0.total_incident_count', 2);
        $this->getJson('/api/gis/heatmap?who_category=III')
            ->assertOk()
            ->assertJsonPath('data.0.total_incident_count', 2);
        $this->getJson('/api/gis/heatmap?animal_type=Cat&who_category=III')
            ->assertOk()
            ->assertJsonPath('data.0.total_incident_count', 1);
    }

    public function test_invalid_date_range_returns_a_clear_422_response(): void
    {
        $this->getJson('/api/gis/heatmap?date_from=2026-07-20&date_to=2026-07-10')
            ->assertUnprocessable()
            ->assertJsonPath('success', false)
            ->assertJsonPath('code', 'GIS_FILTER_VALIDATION_FAILED')
            ->assertJsonValidationErrors('date_to');
    }

    public function test_doctor_is_authorized_while_system_administrator_and_guest_retain_restricted_access(): void
    {
        $this->authenticateAs('Doctor');
        $this->getJson('/api/gis/heatmap')->assertOk();

        $this->authenticateAs('Admin');
        $this->getJson('/api/gis/heatmap')->assertForbidden();

        auth()->forgetGuards();
        $this->getJson('/api/gis/heatmap')->assertUnauthorized();
    }

    private function authenticateAs(string $role): User
    {
        $user = User::factory()->create([
            'role' => $role,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    private function barangay(): Barangay
    {
        return Barangay::firstOrCreate(
            ['name' => 'Aplaya'],
            ['latitude' => 6.76000000, 'longitude' => 125.34250000]
        );
    }

    private function legacyPatient(): Patient
    {
        return Patient::create([
            'full_name' => 'Legacy GIS Patient',
            'age' => 28,
            'sex' => 'Female',
            'address' => 'Legacy residential address',
            'contact_number' => null,
            'sms_consent' => false,
        ]);
    }

    private function createIncident(array $overrides = []): Incident
    {
        return Incident::create(array_merge([
            'patient_id' => $this->legacyPatient()->id,
            'barangay_id' => $this->barangay()->id,
            'incident_date' => '2026-07-18',
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'who_category' => 'II',
            'location_lat' => 6.76100000,
            'location_lng' => 125.34300000,
            'status' => 'Active',
        ], $overrides));
    }
}
