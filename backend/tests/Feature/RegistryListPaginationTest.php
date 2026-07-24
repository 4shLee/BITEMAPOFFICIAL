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

class RegistryListPaginationTest extends TestCase
{
    use RefreshDatabase;

    public function test_patient_list_is_paginated_by_default_and_returns_metadata(): void
    {
        $this->actAsClinicUser();
        $barangay = Barangay::create(['name' => 'Aplaya']);

        foreach (range(1, 25) as $number) {
            $this->createPatient($barangay, 'Patient '.$number, 'Family '.$number);
        }

        $this->getJson('/api/patients')
            ->assertOk()
            ->assertJsonCount(20, 'data')
            ->assertJsonPath('pagination.current_page', 1)
            ->assertJsonPath('pagination.last_page', 2)
            ->assertJsonPath('pagination.per_page', 20)
            ->assertJsonPath('pagination.total', 25)
            ->assertJsonPath('pagination.from', 1)
            ->assertJsonPath('pagination.to', 20);
    }

    public function test_patient_list_supports_search_and_barangay_filtering(): void
    {
        $this->actAsClinicUser();
        $applaya = Barangay::create(['name' => 'Aplaya']);
        $zoneTwo = Barangay::create(['name' => 'Zone 2']);
        $match = $this->createPatient($applaya, 'Unique', 'Registry');
        $this->createPatient($zoneTwo, 'Other', 'Patient');

        $this->getJson('/api/patients?search=Unique&barangay_id='.$applaya->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $match->id)
            ->assertJsonPath('pagination.total', 1);

        $this->getJson('/api/patients?search=Zone+2')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_patient_list_payload_is_lightweight(): void
    {
        $this->actAsClinicUser();
        $barangay = Barangay::create(['name' => 'Aplaya']);
        $patient = $this->createPatient($barangay, 'Light', 'Patient');
        $this->createIncident($patient, $barangay);

        $payload = $this->getJson('/api/patients')
            ->assertOk()
            ->json('data.0');

        $this->assertSame($patient->id, $payload['id']);
        $this->assertSame(['id', 'name'], array_keys($payload['barangay']));
        $this->assertArrayNotHasKey('address', $payload);
        $this->assertArrayNotHasKey('email', $payload);
        $this->assertArrayNotHasKey('incidents', $payload);
        $this->assertArrayNotHasKey('notifications', $payload);
        $this->assertArrayNotHasKey('medical_history', $payload);
    }

    public function test_incident_list_supports_pagination_search_status_and_barangay_filters(): void
    {
        $this->actAsClinicUser();
        $applaya = Barangay::create(['name' => 'Aplaya']);
        $zoneTwo = Barangay::create(['name' => 'Zone 2']);
        $matchingPatient = $this->createPatient($applaya, 'Searchable', 'Person');
        $matchingIncident = $this->createIncident($matchingPatient, $applaya, ['status' => 'Active']);

        foreach (range(1, 12) as $number) {
            $patient = $this->createPatient($zoneTwo, 'Other '.$number, 'Person');
            $this->createIncident($patient, $zoneTwo, ['status' => 'Completed']);
        }

        $this->getJson('/api/incidents?search=Searchable&status=Active&barangay_id='.$applaya->id.'&per_page=10')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $matchingIncident->id)
            ->assertJsonPath('pagination.current_page', 1)
            ->assertJsonPath('pagination.per_page', 10)
            ->assertJsonPath('pagination.total', 1)
            ->assertJsonPath('pagination.from', 1)
            ->assertJsonPath('pagination.to', 1);

        $this->getJson('/api/incidents?status=Completed&barangay_id='.$zoneTwo->id.'&page=2&per_page=10')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('pagination.current_page', 2)
            ->assertJsonPath('pagination.last_page', 2)
            ->assertJsonPath('pagination.total', 12)
            ->assertJsonPath('pagination.from', 11)
            ->assertJsonPath('pagination.to', 12);
    }

    public function test_incident_list_uses_counts_and_omits_detailed_data(): void
    {
        $this->actAsClinicUser();
        $barangay = Barangay::create(['name' => 'Aplaya']);
        $patient = $this->createPatient($barangay, 'Dose', 'Counts');
        $incident = $this->createIncident($patient, $barangay);
        PepSchedule::create([
            'incident_id' => $incident->id,
            'dose_day' => 0,
            'scheduled_date' => '2026-07-20',
            'administered_date' => '2026-07-20',
            'status' => 'Done',
        ]);
        PepSchedule::create([
            'incident_id' => $incident->id,
            'dose_day' => 3,
            'scheduled_date' => '2026-07-23',
            'status' => 'Pending',
        ]);

        $payload = $this->getJson('/api/incidents')
            ->assertOk()
            ->json('data.0');

        $this->assertSame(2, $payload['pep_schedules_count']);
        $this->assertSame(1, $payload['completed_pep_schedules_count']);
        $this->assertSame(['id', 'name'], array_keys($payload['barangay']));
        $this->assertArrayNotHasKey('pep_schedules', $payload);
        $this->assertArrayNotHasKey('notes', $payload);
        $this->assertArrayNotHasKey('animal_description', $payload);
        $this->assertArrayNotHasKey('who_category_confirmer', $payload);
        $this->assertArrayNotHasKey('address', $payload['patient']);
        $this->assertArrayNotHasKey('email', $payload['patient']);
    }

    public function test_registry_lists_preserve_authorization(): void
    {
        $this->getJson('/api/incidents')->assertUnauthorized();
        $this->getJson('/api/patients')->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create([
            'role' => 'system_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]));

        $this->getJson('/api/incidents')->assertForbidden();
        $this->getJson('/api/patients')->assertForbidden();
    }

    private function actAsClinicUser(): void
    {
        Sanctum::actingAs(User::factory()->create([
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]));
    }

    private function createPatient(Barangay $barangay, string $firstName, string $lastName): Patient
    {
        return Patient::create([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'full_name' => $firstName.' '.$lastName,
            'age' => 30,
            'sex' => 'Female',
            'address' => 'Test address',
            'residence_barangay' => $barangay->name,
            'barangay_id' => $barangay->id,
            'contact_number' => '09171234567',
        ]);
    }

    private function createIncident(Patient $patient, Barangay $barangay, array $attributes = []): Incident
    {
        return Incident::create(array_merge([
            'patient_id' => $patient->id,
            'barangay_id' => $barangay->id,
            'incident_date' => '2026-07-20',
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'who_category' => 'II',
            'status' => 'Active',
        ], $attributes));
    }
}
