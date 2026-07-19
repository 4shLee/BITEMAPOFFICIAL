<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Incident;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class IncidentLocationPersistenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_exact_incident_coordinates_are_saved_loaded_and_cleared_without_removing_barangay(): void
    {
        $user = User::factory()->create([
            'role' => 'Nurse',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        Sanctum::actingAs($user);

        $barangay = Barangay::create([
            'name' => 'Location Test Barangay',
            'latitude' => 6.75000000,
            'longitude' => 125.35750000,
        ]);
        $patient = Patient::create([
            'full_name' => 'Location Test Patient',
            'age' => 29,
            'sex' => 'Female',
            'address' => 'Digos City',
            'barangay_id' => $barangay->id,
            'contact_number' => '09171234567',
        ]);

        $createResponse = $this->postJson('/api/incidents', [
            'patient_id' => $patient->id,
            'location_scope' => 'within_digos',
            'barangay_id' => $barangay->id,
            'incident_date' => '2026-07-14',
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'who_category' => 'Category III',
            'status' => 'Active',
            'location_lat' => 6.75234567,
            'location_lng' => 125.36123456,
            'notes' => 'Location Precision: Exact Pin',
        ]);

        $createResponse->assertCreated()
            ->assertJsonPath('data.barangay_id', $barangay->id)
            ->assertJsonPath('data.location_lat', '6.75234567')
            ->assertJsonPath('data.location_lng', '125.36123456')
            ->assertJsonPath('data.notes', 'Location Precision: Exact Pin');

        $incidentId = $createResponse->json('data.id');
        $this->getJson('/api/incidents/'.$incidentId)
            ->assertOk()
            ->assertJsonPath('data.barangay_id', $barangay->id)
            ->assertJsonPath('data.location_lat', '6.75234567')
            ->assertJsonPath('data.location_lng', '125.36123456');

        $this->putJson('/api/incidents/'.$incidentId, [
            'patient_id' => $patient->id,
            'location_scope' => 'within_digos',
            'barangay_id' => $barangay->id,
            'incident_date' => '2026-07-14',
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'who_category' => 'Category III',
            'status' => 'Active',
            'location_lat' => null,
            'location_lng' => null,
            'notes' => 'Location Precision: Barangay Only',
        ])->assertOk()
            ->assertJsonPath('data.barangay_id', $barangay->id)
            ->assertJsonPath('data.location_lat', null)
            ->assertJsonPath('data.location_lng', null)
            ->assertJsonPath('data.notes', 'Location Precision: Barangay Only');

        $incident = Incident::findOrFail($incidentId);
        $this->assertSame($barangay->id, $incident->barangay_id);
        $this->assertNull($incident->location_lat);
        $this->assertNull($incident->location_lng);
    }
}
