<?php

namespace Tests\Feature;

use App\Models\Incident;
use App\Models\Patient;
use App\Models\PepSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class IncidentDateScheduleSyncTest extends TestCase
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
            'full_name' => 'Schedule Patient',
            'age' => 30,
            'sex' => 'Female',
            'address' => 'Digos City',
        ]);
    }

    public function test_day_zero_and_follow_up_doses_use_pep_start_date_not_incident_date(): void
    {
        $response = $this->postJson('/api/incidents', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.incident_date', '2026-07-01')
            ->assertJsonPath('data.pep_start_date', '2026-07-04');

        $this->assertSame(
            ['2026-07-04', '2026-07-07', '2026-07-11', '2026-07-18', '2026-08-01'],
            collect($response->json('data.pep_schedules'))->pluck('scheduled_date')->all()
        );
        $incident = Incident::findOrFail($response->json('data.id'));
        $this->assertSame('2026-07-01', $incident->incident_date->toDateString());
        $this->assertSame('2026-07-04', $incident->pep_start_date->toDateString());
    }

    public function test_changing_incident_date_does_not_move_an_established_pep_schedule(): void
    {
        $incidentId = $this->postJson('/api/incidents', $this->payload())->assertCreated()->json('data.id');

        $this->putJson('/api/incidents/'.$incidentId, $this->payload([
            'incident_date' => '2026-07-02',
        ]))->assertOk()->assertJsonPath('data.incident_date', '2026-07-02');

        $this->assertSame(
            ['2026-07-04', '2026-07-07', '2026-07-11', '2026-07-18', '2026-08-01'],
            PepSchedule::where('incident_id', $incidentId)->orderBy('dose_day')->get()
                ->map(fn (PepSchedule $schedule) => $schedule->scheduled_date->toDateString())->all()
        );
    }

    public function test_pending_schedule_requires_confirmation_then_recalculates_from_new_day_zero(): void
    {
        $incidentId = $this->postJson('/api/incidents', $this->payload())->assertCreated()->json('data.id');
        $changed = $this->payload(['pep_start_date' => '2026-07-05']);

        $this->putJson('/api/incidents/'.$incidentId, $changed)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('pep_start_date')
            ->assertJsonFragment(['Confirm recalculation of the pending PEP schedule from the new Day 0 date.']);

        $this->putJson('/api/incidents/'.$incidentId, array_merge($changed, [
            'confirm_pep_schedule_recalculation' => true,
        ]))->assertOk();

        $this->assertSame(
            ['2026-07-05', '2026-07-08', '2026-07-12', '2026-07-19', '2026-08-02'],
            PepSchedule::where('incident_id', $incidentId)->orderBy('dose_day')->get()
                ->map(fn (PepSchedule $schedule) => $schedule->scheduled_date->toDateString())->all()
        );
    }

    public function test_completed_dose_history_blocks_day_zero_rewrite(): void
    {
        $incidentId = $this->postJson('/api/incidents', $this->payload())->assertCreated()->json('data.id');
        $dayZero = PepSchedule::where('incident_id', $incidentId)->where('dose_day', 0)->firstOrFail();
        $dayZero->update([
            'status' => 'Done',
            'administered_date' => '2026-07-04',
            'administered_by' => $this->user->id,
            'vaccine_lot_number' => 'LOT-001',
        ]);

        $this->putJson('/api/incidents/'.$incidentId, $this->payload([
            'pep_start_date' => '2026-07-05',
            'confirm_pep_schedule_recalculation' => true,
        ]))->assertUnprocessable()->assertJsonValidationErrors('pep_start_date');

        $completedDose = $dayZero->fresh();
        $this->assertSame('2026-07-04', $completedDose->scheduled_date->toDateString());
        $this->assertSame('2026-07-04', $completedDose->administered_date->toDateString());
        $this->assertSame('LOT-001', $completedDose->vaccine_lot_number);
    }

    public function test_legacy_incident_without_pep_start_date_still_loads_without_rewriting_schedule(): void
    {
        $incident = Incident::create([
            'patient_id' => $this->patient->id,
            'incident_date' => '2026-06-01',
            'animal_type' => 'Dog',
            'bite_site' => 'Left hand',
            'who_category' => 'II',
        ]);
        PepSchedule::create([
            'incident_id' => $incident->id,
            'dose_day' => 0,
            'scheduled_date' => '2026-06-03',
            'status' => 'Done',
            'administered_date' => '2026-06-03',
        ]);

        $this->getJson('/api/incidents/'.$incident->id)
            ->assertOk()
            ->assertJsonPath('data.pep_start_date', null)
            ->assertJsonPath('data.pep_schedules.0.scheduled_date', '2026-06-03');

        $this->putJson('/api/incidents/'.$incident->id, [
            'patient_id' => $this->patient->id,
            'location_scope' => 'outside_digos',
            'incident_city_municipality' => 'Bansalan',
            'incident_province' => 'Davao del Sur',
            'incident_date' => '2026-06-02',
            'animal_type' => 'Dog',
            'who_category' => 'Category II',
        ])->assertOk();

        $this->assertNull($incident->fresh()->pep_start_date);
        $this->assertSame('2026-06-03', PepSchedule::firstOrFail()->scheduled_date->toDateString());
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'patient_type' => 'existing',
            'patient_id' => $this->patient->id,
            'location_scope' => 'outside_digos',
            'incident_city_municipality' => 'Bansalan',
            'incident_province' => 'Davao del Sur',
            'incident_date' => '2026-07-01',
            'first_consult_date' => '2026-07-03',
            'pep_start_date' => '2026-07-04',
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
