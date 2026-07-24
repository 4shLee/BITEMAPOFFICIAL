<?php

namespace Tests\Feature;

use App\Models\Incident;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WhoExposureConfirmationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Patient $patient;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create([
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        Sanctum::actingAs($this->user);
        $this->patient = Patient::create([
            'full_name' => 'WHO Assessment Patient',
            'age' => 28,
            'sex' => 'Female',
            'address' => 'Digos City',
        ]);
    }

    public function test_backend_recalculates_and_ignores_client_supplied_suggestion_fields(): void
    {
        $response = $this->postJson('/api/incidents', $this->payload([
            'exposure_contact_types' => ['touching_or_feeding'],
            'who_category' => 'Category I',
            'suggested_who_category' => 'III',
            'who_category_suggestion_reason' => 'Client supplied false reason',
        ]))->assertCreated();

        $response->assertJsonPath('data.suggested_who_category', 'Category I')
            ->assertJsonPath('data.who_category_suggestion_reason', 'Contact was limited to touching or feeding the animal.');
        $this->assertDatabaseHas('incidents', [
            'id' => $response->json('data.id'),
            'suggested_who_category' => 'I',
            'who_category_confirmed_by' => $this->user->id,
        ]);
        $this->assertNotNull(Incident::findOrFail($response->json('data.id'))->who_category_confirmed_at);
    }

    public function test_confirming_the_suggestion_needs_no_override_but_a_different_category_does(): void
    {
        $this->postJson('/api/incidents', $this->payload())->assertCreated();

        $this->postJson('/api/incidents', $this->payload([
            'patient_id' => $this->patient->id,
            'who_category' => 'Category III',
        ]))->assertUnprocessable()->assertJsonValidationErrors('who_category_override_reason');

        $this->postJson('/api/incidents', $this->payload([
            'patient_id' => $this->patient->id,
            'who_category' => 'Category III',
            'who_category_override_reason' => '   ',
        ]))->assertUnprocessable()->assertJsonValidationErrors('who_category_override_reason');

        $this->postJson('/api/incidents', $this->payload([
            'patient_id' => $this->patient->id,
            'who_category' => 'Category III',
            'who_category_override_reason' => 'Deeper injury with bleeding identified during examination.',
        ]))->assertCreated()
            ->assertJsonPath('data.suggested_who_category', 'Category II')
            ->assertJsonPath('data.who_category', 'Category III');
    }

    public function test_manual_category_is_allowed_when_no_suggestion_can_be_generated(): void
    {
        $this->postJson('/api/incidents', $this->payload([
            'exposure_contact_types' => ['other'],
            'exposure_skin_condition' => null,
            'exposure_bleeding_present' => null,
            'exposure_transdermal' => null,
            'who_category' => 'Category III',
            'who_category_override_reason' => null,
        ]))->assertCreated()
            ->assertJsonPath('data.suggested_who_category', null)
            ->assertJsonPath('data.who_category_override_reason', null);
    }

    public function test_changed_assessment_requires_reconfirmation_and_recalculates_the_suggestion(): void
    {
        $incidentId = $this->postJson('/api/incidents', $this->payload())->assertCreated()->json('data.id');
        $changed = $this->payload([
            'patient_id' => $this->patient->id,
            'exposure_contact_types' => ['bite'],
            'exposure_skin_condition' => 'broken',
            'exposure_bleeding_present' => true,
            'exposure_transdermal' => true,
            'who_category' => 'Category III',
            'who_category_confirmed' => false,
        ]);

        $this->putJson('/api/incidents/'.$incidentId, $changed)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('who_category_confirmed');

        $changed['who_category_confirmed'] = true;
        $this->putJson('/api/incidents/'.$incidentId, $changed)
            ->assertOk()
            ->assertJsonPath('data.suggested_who_category', 'Category III')
            ->assertJsonPath('data.who_category', 'Category III');
    }

    public function test_legacy_incident_loads_without_invented_assessment_or_audit_data(): void
    {
        $legacy = Incident::create([
            'patient_id' => $this->patient->id,
            'incident_date' => now()->toDateString(),
            'pep_start_date' => now()->toDateString(),
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'who_category' => 'III',
            'status' => 'Active',
        ]);

        $this->getJson('/api/incidents/'.$legacy->id)->assertOk()
            ->assertJsonPath('data.who_category', 'Category III')
            ->assertJsonPath('data.exposure_contact_types', null)
            ->assertJsonPath('data.suggested_who_category', null)
            ->assertJsonPath('data.who_category_confirmed_at', null);
    }

    public function test_existing_pep_schedule_generation_is_unchanged_for_all_confirmed_categories(): void
    {
        foreach (['I', 'II', 'III'] as $index => $category) {
            $payload = match ($category) {
                'I' => $this->payload(['exposure_contact_types' => ['touching_or_feeding'], 'who_category' => 'Category I']),
                'II' => $this->payload(),
                default => $this->payload([
                    'exposure_contact_types' => ['bite'],
                    'exposure_skin_condition' => 'broken',
                    'exposure_bleeding_present' => true,
                    'exposure_transdermal' => true,
                    'who_category' => 'Category III',
                ]),
            };
            $payload['patient_id'] = $this->patient->id;
            $payload['incident_specific_location'] = 'Test '.($index + 1);

            $this->postJson('/api/incidents', $payload)
                ->assertCreated()
                ->assertJsonCount(5, 'data.pep_schedules')
                ->assertJsonPath('data.pep_schedules.0.dose_day', 0)
                ->assertJsonPath('data.pep_schedules.4.dose_day', 28);
        }
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'patient_id' => $this->patient->id,
            'location_scope' => 'outside_digos',
            'incident_city_municipality' => 'Bansalan',
            'incident_province' => 'Davao del Sur',
            'incident_date' => now()->toDateString(),
            'pep_start_date' => now()->toDateString(),
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'exposure_contact_types' => ['scratch'],
            'exposure_skin_condition' => 'broken',
            'exposure_bleeding_present' => false,
            'exposure_transdermal' => false,
            'who_category' => 'Category II',
            'who_category_confirmed' => true,
            'status' => 'Active',
        ], $overrides);
    }
}
