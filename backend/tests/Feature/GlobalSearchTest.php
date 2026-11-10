<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Incident;
use App\Models\Inventory;
use App\Models\Patient;
use App\Models\PepSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GlobalSearchTest extends TestCase
{
    use RefreshDatabase;

    private User $clinicUser;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA ignore_check_constraints = ON');
        }

        $this->clinicUser = User::factory()->create([
            'role' => 'clinic_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        Sanctum::actingAs($this->clinicUser);
    }

    private function seedClinicalAndUserSearchData(): array
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

        $schedule = PepSchedule::create([
            'incident_id' => $incident->id,
            'dose_day' => 0,
            'scheduled_date' => '2026-10-26',
            'status' => 'Pending',
            'vaccine_type' => 'Juan Speeda',
        ]);

        $inventory = Inventory::create([
            'item_name' => 'Juan Rabies Vaccine',
            'brand' => 'Speeda',
            'item_type' => 'Vaccine',
            'current_stock' => 50,
            'reorder_level' => 10,
            'unit' => 'vials',
        ]);

        $sysAdmin = User::factory()->create([
            'name' => 'Juan System Admin',
            'email' => 'juan.sysadmin@bitemap.local',
            'role' => 'system_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $doctorStaff = User::factory()->create([
            'name' => 'Juan Doctor Staff',
            'email' => 'juan.doctor@bitemap.local',
            'role' => 'Doctor',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        return compact('patient', 'incident', 'schedule', 'inventory', 'sysAdmin', 'doctorStaff');
    }

    public function test_global_search_returns_patient_and_incident_matching_name(): void
    {
        $this->seedClinicalAndUserSearchData();

        $response = $this->getJson('/api/global-search?query=juan');

        $response->assertOk()
            ->assertJsonPath('success', true);

        $data = $response->json('data');
        $this->assertNotEmpty($data['patients'], 'Expected patients not to be empty');
        $this->assertNotEmpty($data['incidents'], 'Expected incidents not to be empty');
        $this->assertNotEmpty($data['pep_schedules'], 'Expected pep_schedules not to be empty');
        $this->assertNotEmpty($data['inventory'], 'Expected inventory not to be empty');
    }

    public function test_global_search_system_admin_cannot_access_clinical_patient_pii_incidents_pep_or_inventory(): void
    {
        $seeded = $this->seedClinicalAndUserSearchData();

        Sanctum::actingAs($seeded['sysAdmin']);

        $response = $this->getJson('/api/global-search?query=juan');

        $response->assertOk()
            ->assertJsonPath('success', true);

        $data = $response->json('data');
        $this->assertSame([], $data['patients'], 'system_admin must not receive patient PII from globalSearch');
        $this->assertSame([], $data['incidents'], 'system_admin must not receive incident records from globalSearch');
        $this->assertSame([], $data['pep_schedules'], 'system_admin must not receive PEP schedule records from globalSearch');
        $this->assertSame([], $data['inventory'], 'system_admin must not receive clinic inventory records from globalSearch');
        $this->assertNotEmpty($data['users'], 'system_admin should still be able to search user accounts');

        $navResponse = $this->getJson('/api/global-search?query=patient');
        $navResponse->assertOk();
        $navUrls = array_column($navResponse->json('data.navigation'), 'url');
        $this->assertNotContains('/patients', $navUrls, 'system_admin navigation search must not expose clinical routes');
    }

    public function test_global_search_clinic_admin_cannot_see_system_admin_accounts_in_user_search(): void
    {
        $seeded = $this->seedClinicalAndUserSearchData();

        Sanctum::actingAs($this->clinicUser);

        $response = $this->getJson('/api/global-search?query=juan');
        $response->assertOk();

        $userIds = array_column($response->json('data.users'), 'id');
        $this->assertContains($seeded['doctorStaff']->id, $userIds);
        $this->assertNotContains($seeded['sysAdmin']->id, $userIds, 'clinic_admin must not see system_admin accounts in globalSearch');
    }

    public function test_global_search_doctor_and_nurse_cannot_see_user_accounts_but_can_see_clinical_records(): void
    {
        $seeded = $this->seedClinicalAndUserSearchData();

        foreach (['doctor', 'nurse_vaccinator'] as $clinicalRole) {
            $staff = User::factory()->create([
                'role' => $clinicalRole,
                'is_active' => true,
                'approval_status' => 'approved',
            ]);

            Sanctum::actingAs($staff);

            $response = $this->getJson('/api/global-search?query=juan');
            $response->assertOk();

            $data = $response->json('data');
            $this->assertNotEmpty($data['patients'], "{$clinicalRole} should see matching patients");
            $this->assertNotEmpty($data['incidents'], "{$clinicalRole} should see matching incidents");
            $this->assertNotEmpty($data['pep_schedules'], "{$clinicalRole} should see matching PEP schedules");
            $this->assertNotEmpty($data['inventory'], "{$clinicalRole} should see matching inventory");
            $this->assertSame([], $data['users'], "{$clinicalRole} must not receive user accounts in globalSearch");
        }

        $nurse = User::factory()->create([
            'role' => 'Nurse/Vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        Sanctum::actingAs($nurse);

        $navResponse = $this->getJson('/api/global-search?query=reports');
        $navResponse->assertOk();
        $navUrls = array_column($navResponse->json('data.navigation'), 'url');
        $this->assertNotContains('/reports', $navUrls, 'nurse_vaccinator navigation search must not expose /reports');
    }

    public function test_global_search_normalizes_legacy_database_role_values(): void
    {
        $seeded = $this->seedClinicalAndUserSearchData();

        $legacyClinicAdmin = User::factory()->create([
            'role' => 'Clinic Admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        Sanctum::actingAs($legacyClinicAdmin);
        $clinicAdminRes = $this->getJson('/api/global-search?query=juan')->assertOk();
        $this->assertNotEmpty($clinicAdminRes->json('data.patients'));
        $this->assertNotEmpty($clinicAdminRes->json('data.users'));
        $this->assertNotContains($seeded['sysAdmin']->id, array_column($clinicAdminRes->json('data.users'), 'id'));

        $legacyHealthOfficer = User::factory()->create([
            'role' => 'Health Officer',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        Sanctum::actingAs($legacyHealthOfficer);
        $doctorRes = $this->getJson('/api/global-search?query=juan')->assertOk();
        $this->assertNotEmpty($doctorRes->json('data.patients'));
        $this->assertSame([], $doctorRes->json('data.users'));

        $legacyAdmin = User::factory()->create([
            'role' => 'Admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        Sanctum::actingAs($legacyAdmin);
        $adminRes = $this->getJson('/api/global-search?query=juan')->assertOk();
        $this->assertSame([], $adminRes->json('data.patients'));
        $this->assertSame([], $adminRes->json('data.incidents'));
        $this->assertNotEmpty($adminRes->json('data.users'));
    }
}
