<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Incident;
use App\Models\Patient;
use App\Models\PepSchedule;
use App\Models\Inventory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GlobalSearchTest extends TestCase
{
    use RefreshDatabase;

    private User $clinicUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->clinicUser = User::factory()->create([
            'role' => 'clinic_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        Sanctum::actingAs($this->clinicUser);
    }

    public function test_global_search_returns_patient_and_incident_matching_name(): void
    {
        $barangay = Barangay::create(['name' => 'Zone 1']);

        $patient = Patient::create([
            'first_name' => 'Juan',
            'middle_name' => 'S.',
            'last_name' => 'Dela Cruz',
            'full_name' => 'Juan S. Dela Cruz',
            'age' => 28,
            'sex' => 'Male',
            'contact_number' => '09171234567',
            'barangay_id' => $barangay->id,
            'residence_barangay' => 'Zone 1',
            'address' => 'Zone 1, Digos City',
        ]);

        $incident = Incident::create([
            'patient_id' => $patient->id,
            'barangay_id' => $barangay->id,
            'incident_date' => '2026-10-26',
            'animal_type' => 'Dog',
            'bite_site' => 'Right Leg',
            'who_category' => 'Category II',
            'status' => 'Active',
            'exposure_contact_types' => ['Bite'],
        ]);

        PepSchedule::create([
            'incident_id' => $incident->id,
            'dose_day' => 0,
            'scheduled_date' => '2026-10-26',
            'status' => 'Pending',
        ]);

        Inventory::create([
            'item_name' => 'Anti-Rabies Vaccine',
            'brand' => 'Speeda',
            'item_type' => 'Vaccine',
            'current_stock' => 50,
            'reorder_level' => 10,
            'unit' => 'vials',
        ]);

        $response = $this->getJson('/api/global-search?query=juan');

        $response->assertOk()
            ->assertJsonPath('success', true);

        $data = $response->json('data');
        $this->assertNotEmpty($data['patients'], 'Expected patients not to be empty');
        $this->assertNotEmpty($data['incidents'], 'Expected incidents not to be empty');
        $this->assertNotEmpty($data['pep_schedules'], 'Expected pep_schedules not to be empty');
    }
}
