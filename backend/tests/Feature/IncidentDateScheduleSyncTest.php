<?php

namespace Tests\Feature;

use App\Models\Incident;
use App\Models\Patient;
use App\Models\PepSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class IncidentDateScheduleSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_updating_incident_date_recalculates_existing_schedule_without_losing_completion_data(): void
    {
        $user = User::factory()->create([
            'role' => 'Nurse',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        Sanctum::actingAs($user);

        $patient = Patient::create([
            'full_name' => 'Schedule Sync Patient',
            'age' => 30,
            'sex' => 'Female',
            'address' => 'Digos City',
            'contact_number' => '09171234567',
        ]);

        $incident = Incident::create([
            'patient_id' => $patient->id,
            'incident_date' => '2026-07-05',
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'who_category' => 'II',
            'status' => 'Active',
        ]);

        foreach ([0, 3, 7, 14, 28] as $day) {
            PepSchedule::create([
                'incident_id' => $incident->id,
                'dose_day' => $day,
                'scheduled_date' => Carbon::parse('2026-07-05')->addDays($day)->toDateString(),
                'status' => $day === 0 ? 'Done' : 'Pending',
                'administered_date' => $day === 0 ? '2026-07-05' : null,
                'administered_by' => $day === 0 ? $user->id : null,
                'vaccine_lot_number' => $day === 0 ? 'LOT-001' : null,
            ]);
        }

        $response = $this->putJson('/api/incidents/'.$incident->id, [
            'patient_id' => $patient->id,
            'incident_date' => '2026-07-06',
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'who_category' => 'Category II',
            'status' => 'Active',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.incident_date', '2026-07-06');

        foreach ([0 => '2026-07-06', 3 => '2026-07-09', 7 => '2026-07-13', 14 => '2026-07-20', 28 => '2026-08-03'] as $day => $date) {
            $schedule = PepSchedule::where('incident_id', $incident->id)
                ->where('dose_day', $day)
                ->firstOrFail();
            $this->assertSame($date, $schedule->scheduled_date->toDateString());
        }

        $this->assertSame(5, PepSchedule::where('incident_id', $incident->id)->count());
        $completedDose = PepSchedule::where('incident_id', $incident->id)
            ->where('dose_day', 0)
            ->firstOrFail();
        $this->assertSame('Done', $completedDose->status);
        $this->assertSame('2026-07-05', $completedDose->administered_date->toDateString());
        $this->assertSame($user->id, $completedDose->administered_by);
        $this->assertSame('LOT-001', $completedDose->vaccine_lot_number);

        $patientResponse = $this->getJson('/api/patients/'.$patient->id);
        $patientResponse->assertOk()
            ->assertJsonPath('data.incidents.0.incident_date', '2026-07-06');

        $scheduleResponse = $this->getJson('/api/pep-schedule');
        $scheduleResponse->assertOk();
        $this->assertSame(
            ['2026-07-06', '2026-07-09', '2026-07-13', '2026-07-20', '2026-08-03'],
            collect($scheduleResponse->json('data'))->pluck('scheduled_date')->all()
        );
    }
}
