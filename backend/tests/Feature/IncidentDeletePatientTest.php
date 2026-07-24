<?php

namespace Tests\Feature;

use App\Models\Incident;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class IncidentDeletePatientTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create([
            'role' => 'clinic_admin',
        ]));
    }

    public function test_deleting_a_patients_only_incident_deletes_the_patient_record(): void
    {
        $patient = Patient::create([
            'full_name' => 'Juan Test Patient',
            'age' => 25,
            'sex' => 'Male',
            'address' => 'Digos City',
            'contact_number' => '09171234567',
        ]);

        $incident = Incident::create([
            'patient_id' => $patient->id,
            'incident_date' => '2026-06-29',
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'who_category' => 'II',
            'status' => 'Active',
        ]);

        $this->deleteJson('/api/incidents/'.$incident->id)
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('incidents', ['id' => $incident->id]);
        $this->assertDatabaseMissing('patients', ['id' => $patient->id]);
    }

    public function test_deleting_one_incident_keeps_patient_when_other_incidents_exist(): void
    {
        $patient = Patient::create([
            'full_name' => 'Maria Multiple Incident',
            'age' => 31,
            'sex' => 'Female',
            'address' => 'Digos City',
            'contact_number' => '09179876543',
        ]);

        $firstIncident = Incident::create([
            'patient_id' => $patient->id,
            'incident_date' => '2026-06-29',
            'animal_type' => 'Dog',
            'bite_site' => 'Left leg',
            'who_category' => 'II',
            'status' => 'Active',
        ]);

        $secondIncident = Incident::create([
            'patient_id' => $patient->id,
            'incident_date' => '2026-06-30',
            'animal_type' => 'Cat',
            'bite_site' => 'Right hand',
            'who_category' => 'III',
            'status' => 'Active',
        ]);

        $this->deleteJson('/api/incidents/'.$firstIncident->id)
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('incidents', ['id' => $firstIncident->id]);
        $this->assertDatabaseHas('incidents', ['id' => $secondIncident->id]);
        $this->assertDatabaseHas('patients', ['id' => $patient->id]);
    }
}
