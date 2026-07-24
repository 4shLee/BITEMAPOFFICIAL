<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Incident;
use App\Models\Patient;
use App\Models\PepSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class IncidentLocationScopeTest extends TestCase
{
    use RefreshDatabase;

    private Patient $patient;

    private Barangay $barangay;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create([
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]));

        $this->patient = Patient::create([
            'full_name' => 'Location Scope Patient',
            'age' => 32,
            'sex' => 'Female',
            'address' => 'Digos City',
            'contact_number' => null,
            'sms_consent' => false,
        ]);
        $this->barangay = Barangay::create([
            'name' => 'Aplaya',
            'latitude' => 6.76000000,
            'longitude' => 125.34250000,
        ]);
    }

    public function test_location_scope_is_always_required(): void
    {
        $this->postJson('/api/incidents', $this->basePayload())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('location_scope');
    }

    public function test_within_digos_incident_requires_a_barangay(): void
    {
        $this->postJson('/api/incidents', $this->withinPayload(['barangay_id' => null]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('barangay_id');
    }

    public function test_outside_digos_incident_requires_city_and_province(): void
    {
        $this->postJson('/api/incidents', $this->outsidePayload([
            'incident_city_municipality' => null,
            'incident_province' => null,
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['incident_city_municipality', 'incident_province']);
    }

    public function test_outside_digos_incident_saves_with_null_digos_fields_and_keeps_pep_schedule(): void
    {
        $response = $this->postJson('/api/incidents', $this->outsidePayload())
            ->assertCreated()
            ->assertJsonPath('data.location_scope', 'outside_digos')
            ->assertJsonPath('data.barangay_id', null)
            ->assertJsonPath('data.location_lat', null)
            ->assertJsonPath('data.location_lng', null)
            ->assertJsonPath('data.incident_city_municipality', 'Bansalan')
            ->assertJsonPath('data.incident_province', 'Davao del Sur')
            ->assertJsonPath('data.incident_specific_location', 'Near the municipal hall')
            ->assertJsonCount(5, 'data.pep_schedules');

        $incidentId = $response->json('data.id');
        $this->assertSame(5, PepSchedule::where('incident_id', $incidentId)->count());
        $this->assertDatabaseHas('incidents', [
            'id' => $incidentId,
            'location_scope' => 'outside_digos',
            'barangay_id' => null,
            'location_lat' => null,
            'location_lng' => null,
        ]);
    }

    public function test_outside_incidents_are_excluded_while_within_incidents_remain_in_gis_results(): void
    {
        $outsideId = $this->postJson('/api/incidents', $this->outsidePayload())
            ->assertCreated()
            ->json('data.id');
        $withinId = $this->postJson('/api/incidents', $this->withinPayload())
            ->assertCreated()
            ->json('data.id');

        $response = $this->getJson('/api/gis/heatmap')->assertOk();
        $incidentIds = collect($response->json('data'))->flatMap(fn (array $item) => $item['incident_ids'])->all();

        $this->assertContains($withinId, $incidentIds);
        $this->assertNotContains($outsideId, $incidentIds);
        $response->assertJsonPath('data.0.total_incident_count', 1);
    }

    public function test_switching_scope_clears_incompatible_location_values(): void
    {
        $incidentId = $this->postJson('/api/incidents', $this->withinPayload([
            'location_lat' => 6.75234567,
            'location_lng' => 125.36123456,
        ]))->assertCreated()->json('data.id');

        $this->putJson('/api/incidents/'.$incidentId, $this->outsidePayload())
            ->assertOk()
            ->assertJsonPath('data.location_scope', 'outside_digos')
            ->assertJsonPath('data.barangay_id', null)
            ->assertJsonPath('data.location_lat', null)
            ->assertJsonPath('data.location_lng', null);

        $this->putJson('/api/incidents/'.$incidentId, $this->withinPayload())
            ->assertOk()
            ->assertJsonPath('data.location_scope', 'within_digos')
            ->assertJsonPath('data.incident_city_municipality', null)
            ->assertJsonPath('data.incident_province', null)
            ->assertJsonPath('data.incident_specific_location', null);
    }

    public function test_outside_scope_rejects_stale_digos_values_and_coordinates_use_valid_ranges(): void
    {
        $this->postJson('/api/incidents', $this->outsidePayload([
            'barangay_id' => $this->barangay->id,
            'location_lat' => 6.75,
            'location_lng' => 125.35,
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['barangay_id', 'location_lat', 'location_lng']);

        $this->postJson('/api/incidents', $this->withinPayload([
            'location_lat' => 91,
            'location_lng' => 181,
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['location_lat', 'location_lng']);
    }

    public function test_legacy_incidents_with_or_without_location_information_still_load(): void
    {
        $legacyWithin = Incident::create(array_merge($this->basePayload(), [
            'barangay_id' => $this->barangay->id,
            'who_category' => 'II',
        ]));
        $legacyIncomplete = Incident::create(array_merge($this->basePayload(), [
            'who_category' => 'II',
        ]));

        $this->getJson('/api/incidents/'.$legacyWithin->id)
            ->assertOk()
            ->assertJsonPath('data.location_scope', null)
            ->assertJsonPath('data.barangay.name', 'Aplaya');
        $this->getJson('/api/incidents/'.$legacyIncomplete->id)
            ->assertOk()
            ->assertJsonPath('data.location_scope', null)
            ->assertJsonPath('data.barangay', null);

        $gisIncidentIds = collect($this->getJson('/api/gis/heatmap')->assertOk()->json('data'))
            ->flatMap(fn (array $item) => $item['incident_ids'])
            ->all();
        $this->assertContains($legacyWithin->id, $gisIncidentIds);
        $this->assertNotContains($legacyIncomplete->id, $gisIncidentIds);
    }

    public function test_incident_detail_api_returns_the_correct_location_fields(): void
    {
        $incidentId = $this->postJson('/api/incidents', $this->outsidePayload())
            ->assertCreated()
            ->json('data.id');

        $this->getJson('/api/incidents/'.$incidentId)
            ->assertOk()
            ->assertJsonPath('data.location_scope', 'outside_digos')
            ->assertJsonPath('data.incident_city_municipality', 'Bansalan')
            ->assertJsonPath('data.incident_province', 'Davao del Sur')
            ->assertJsonPath('data.incident_specific_location', 'Near the municipal hall')
            ->assertJsonPath('data.barangay', null);
    }

    private function basePayload(): array
    {
        return [
            'patient_id' => $this->patient->id,
            'incident_date' => now()->toDateString(),
            'pep_start_date' => now()->toDateString(),
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'who_category' => 'Category II',
            'status' => 'Active',
            'sms_consent' => false,
        ];
    }

    private function withinPayload(array $overrides = []): array
    {
        return array_merge($this->basePayload(), $this->assessmentPayload(), [
            'location_scope' => 'within_digos',
            'barangay_id' => $this->barangay->id,
            'location_lat' => null,
            'location_lng' => null,
            'incident_city_municipality' => null,
            'incident_province' => null,
            'incident_specific_location' => null,
        ], $overrides);
    }

    private function outsidePayload(array $overrides = []): array
    {
        return array_merge($this->basePayload(), $this->assessmentPayload(), [
            'location_scope' => 'outside_digos',
            'barangay_id' => null,
            'location_lat' => null,
            'location_lng' => null,
            'incident_city_municipality' => 'Bansalan',
            'incident_province' => 'Davao del Sur',
            'incident_specific_location' => 'Near the municipal hall',
        ], $overrides);
    }

    private function assessmentPayload(): array
    {
        return [
            'exposure_contact_types' => ['scratch'],
            'exposure_skin_condition' => 'broken',
            'exposure_bleeding_present' => false,
            'exposure_transdermal' => false,
            'who_category_confirmed' => true,
        ];
    }
}
