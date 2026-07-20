<?php

namespace Tests\Feature;

use App\Models\Incident;
use App\Models\Inventory;
use App\Models\InventoryBatch;
use App\Models\Patient;
use App\Models\PepSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PepScheduleOverdueWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_staff_can_reschedule_only_one_overdue_dose_without_shifting_future_doses(): void
    {
        Carbon::setTestNow('2026-07-15 09:00:00');
        $user = User::factory()->create([
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        Sanctum::actingAs($user);

        [$incident, $doses] = $this->createSchedule($user);

        $this->putJson('/api/pep-schedule/'.$doses[7]->id.'/reschedule', [
            'scheduled_date' => '2026-07-16',
            'reason' => 'Patient was unable to visit the clinic.',
        ])->assertOk()
            ->assertJsonPath('data.scheduled_date', '2026-07-16')
            ->assertJsonPath('data.status', 'Upcoming');

        $rescheduled = $doses[7]->fresh();
        $this->assertSame('2026-07-16', $rescheduled->scheduled_date->toDateString());
        $this->assertStringContainsString('Patient was unable to visit the clinic.', $rescheduled->notes);
        $this->assertNull($rescheduled->administered_date);
        $this->assertSame('2026-07-28', $doses[14]->fresh()->scheduled_date->toDateString());
        $this->assertSame('2026-08-11', $doses[28]->fresh()->scheduled_date->toDateString());
        $this->assertSame(5, PepSchedule::where('incident_id', $incident->id)->count());
    }

    public function test_recording_an_overdue_dose_keeps_its_scheduled_date_and_saves_actual_administration_date(): void
    {
        Carbon::setTestNow('2026-07-16 09:00:00');
        $user = User::factory()->create([
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        Sanctum::actingAs($user);

        [, $doses] = $this->createSchedule($user);

        $inventory = Inventory::create([
            'item_name' => 'Anti-rabies Vaccine',
            'item_type' => 'Vaccine',
            'current_stock' => 5,
            'unit' => 'dose',
            'reorder_level' => 1,
        ]);
        $batch = InventoryBatch::create([
            'inventory_id' => $inventory->id,
            'batch_number' => 'LATE-LOT-7',
            'quantity_received' => 5,
            'quantity_remaining' => 5,
            'expiry_date' => '2028-07-16',
            'received_date' => '2026-07-01',
            'created_by' => $user->id,
        ]);

        $this->postJson('/api/pep-schedule/'.$doses[7]->id.'/record-dose', [
            'administered_date' => '2026-07-16',
            'administration_route' => 'Intramuscular',
            'inventory_id' => $inventory->id,
            'inventory_batch_id' => $batch->id,
            'remarks' => 'Patient returned after the scheduled date.',
        ])->assertOk();

        $recorded = $doses[7]->fresh();
        $this->assertSame('2026-07-14', $recorded->scheduled_date->toDateString());
        $this->assertSame('2026-07-16', $recorded->administered_date->toDateString());
        $this->assertSame('Done', $recorded->status);
        $this->assertSame('Intramuscular', $recorded->administration_route);
        $this->assertSame($user->id, $recorded->administered_by);
        $this->assertSame('LATE-LOT-7', $recorded->vaccine_lot_number);
        $this->assertSame($batch->id, $recorded->inventory_batch_id);
        $this->assertSame(5, $inventory->fresh()->current_stock);
        $this->assertSame(5, $batch->fresh()->quantity_remaining);
        $this->assertDatabaseCount('inventory_transactions', 0);
    }

    public function test_completed_and_non_overdue_doses_cannot_be_rescheduled(): void
    {
        Carbon::setTestNow('2026-07-15 09:00:00');
        $user = User::factory()->create([
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        Sanctum::actingAs($user);

        [, $doses] = $this->createSchedule($user);

        $this->putJson('/api/pep-schedule/'.$doses[0]->id.'/reschedule', [
            'scheduled_date' => '2026-07-16',
            'reason' => 'Invalid completed-dose attempt.',
        ])->assertStatus(422);

        $this->putJson('/api/pep-schedule/'.$doses[14]->id.'/reschedule', [
            'scheduled_date' => '2026-07-29',
            'reason' => 'Invalid future-dose attempt.',
        ])->assertStatus(422);
    }

    private function createSchedule(User $user): array
    {
        $patient = Patient::create([
            'full_name' => 'Overdue Workflow Patient',
            'age' => 32,
            'sex' => 'Female',
            'address' => 'Digos City',
            'contact_number' => '09171234567',
        ]);
        $incident = Incident::create([
            'patient_id' => $patient->id,
            'incident_date' => '2026-07-07',
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'who_category' => 'III',
            'status' => 'Active',
        ]);

        $dates = [
            0 => '2026-07-07',
            3 => '2026-07-10',
            7 => '2026-07-14',
            14 => '2026-07-28',
            28 => '2026-08-11',
        ];
        $doses = [];
        foreach ($dates as $day => $date) {
            $doses[$day] = PepSchedule::create([
                'incident_id' => $incident->id,
                'dose_day' => $day,
                'scheduled_date' => $date,
                'status' => $day === 0 ? 'Done' : 'Pending',
                'administered_date' => $day === 0 ? $date : null,
                'administered_by' => $day === 0 ? $user->id : null,
            ]);
        }

        return [$incident, $doses];
    }
}
