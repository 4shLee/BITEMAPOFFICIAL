<?php

namespace Tests\Feature;

use App\Models\Incident;
use App\Models\Patient;
use App\Models\PepSchedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PatientDeleteTest extends TestCase
{
    use RefreshDatabase;

    public function test_patient_record_can_be_deleted(): void
    {
        $patient = Patient::create([
            'full_name' => 'Delete Me Patient',
            'age' => 24,
            'sex' => 'Male',
            'address' => 'Digos City',
            'contact_number' => '09171234567',
        ]);

        $this->deleteJson('/api/patients/'.$patient->id)
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('patients', ['id' => $patient->id]);
    }

    public function test_deleting_patient_removes_related_incidents_and_pep_schedules(): void
    {
        $patient = Patient::create([
            'full_name' => 'Cascade Delete Patient',
            'age' => 35,
            'sex' => 'Female',
            'address' => 'Digos City',
            'contact_number' => '09179876543',
        ]);

        $incident = Incident::create([
            'patient_id' => $patient->id,
            'incident_date' => '2026-06-29',
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'who_category' => 'II',
            'status' => 'Active',
        ]);

        $schedule = PepSchedule::create([
            'incident_id' => $incident->id,
            'dose_day' => 0,
            'scheduled_date' => '2026-06-29',
            'status' => 'Upcoming',
        ]);

        $this->deleteJson('/api/patients/'.$patient->id)
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('patients', ['id' => $patient->id]);
        $this->assertDatabaseMissing('incidents', ['id' => $incident->id]);
        $this->assertDatabaseMissing('pep_schedules', ['id' => $schedule->id]);
    }
}
