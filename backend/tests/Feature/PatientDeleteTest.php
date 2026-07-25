<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Incident;
use App\Models\Patient;
use App\Models\PepSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use RuntimeException;
use Tests\TestCase;

class PatientDeleteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create([
            'role' => 'clinic_admin',
        ]));
    }

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

    public function test_audit_failure_rolls_back_patient_deletion(): void
    {
        $patient = Patient::create([
            'full_name' => 'Transactional Patient',
            'age' => 28,
            'sex' => 'Female',
            'address' => 'Digos City',
            'contact_number' => '09170000001',
        ]);

        AuditLog::creating(function (AuditLog $audit): void {
            if ($audit->module === 'Patients') {
                throw new RuntimeException('Forced audit failure.');
            }
        });
        $this->withoutExceptionHandling();

        try {
            $this->deleteJson('/api/patients/'.$patient->id);
            $this->fail('The forced audit failure was not thrown.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Forced audit failure.', $exception->getMessage());
        } finally {
            AuditLog::flushEventListeners();
        }

        $this->assertDatabaseHas('patients', ['id' => $patient->id]);
    }
}
