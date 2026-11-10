<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Patient;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RbacLeastPrivilegeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA ignore_check_constraints = ON');
        }
    }

    public function test_clinic_admin_cannot_retrieve_system_admin_accounts_from_users_index(): void
    {
        $sysAdmin = User::factory()->create([
            'name' => 'Root System Admin',
            'email' => 'root@bitemap.local',
            'role' => 'system_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $legacySysAdmin = User::factory()->create([
            'name' => 'Legacy Admin',
            'email' => 'legacy-admin@bitemap.local',
            'role' => 'Admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $clinicAdmin = User::factory()->create([
            'name' => 'Clinic Admin User',
            'email' => 'clinic.admin@bitemap.local',
            'role' => 'Clinic Admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $doctor = User::factory()->create([
            'name' => 'Clinic Doctor',
            'email' => 'doctor@bitemap.local',
            'role' => 'Doctor',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        Sanctum::actingAs($clinicAdmin);

        $response = $this->getJson('/api/users')->assertOk();
        $returnedIds = array_column($response->json('data'), 'id');

        $this->assertContains($clinicAdmin->id, $returnedIds);
        $this->assertContains($doctor->id, $returnedIds);
        $this->assertNotContains($sysAdmin->id, $returnedIds, 'clinic_admin must not receive system_admin accounts in GET /api/users');
        $this->assertNotContains($legacySysAdmin->id, $returnedIds, 'clinic_admin must not receive legacy Admin accounts in GET /api/users');

        Sanctum::actingAs($sysAdmin);
        $sysAdminResponse = $this->getJson('/api/users')->assertOk();
        $sysAdminReturnedIds = array_column($sysAdminResponse->json('data'), 'id');
        $this->assertContains($sysAdmin->id, $sysAdminReturnedIds);
        $this->assertContains($legacySysAdmin->id, $sysAdminReturnedIds);
        $this->assertContains($clinicAdmin->id, $sysAdminReturnedIds);
        $this->assertContains($doctor->id, $sysAdminReturnedIds);
    }

    public function test_clinic_admin_cannot_create_update_approve_or_reject_system_admin_accounts(): void
    {
        $sysAdmin = User::factory()->create([
            'name' => 'Protected System Admin',
            'email' => 'protected.sysadmin@bitemap.local',
            'role' => 'system_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $pendingStaff = User::factory()->create([
            'name' => 'Pending Staff',
            'email' => 'pending.staff@bitemap.local',
            'role' => 'Doctor',
            'is_active' => false,
            'approval_status' => 'pending',
        ]);

        $clinicAdmin = User::factory()->create([
            'name' => 'Clinic Admin',
            'email' => 'clinic@bitemap.local',
            'role' => 'clinic_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        // 1. Public signup cannot request system_admin role
        $this->postJson('/api/auth/signup', [
            'first_name' => 'Escalated',
            'last_name' => 'Admin',
            'email' => 'escalated@bitemap.local',
            'role' => 'system_admin',
            'password' => 'StrongPass!123',
        ])->assertStatus(422);

        Sanctum::actingAs($clinicAdmin);

        // 2. Cannot update an existing system_admin account
        $this->putJson("/api/users/{$sysAdmin->id}", [
            'name' => 'Modified By Clinic Admin',
        ])->assertStatus(403);

        // 3. Cannot promote a staff user to system_admin via update (using canonical or legacy label)
        $this->putJson("/api/users/{$pendingStaff->id}", [
            'role' => 'system_admin',
        ])->assertStatus(403);

        $this->putJson("/api/users/{$pendingStaff->id}", [
            'role' => 'Admin',
        ])->assertStatus(403);

        // 4. Cannot approve a user as system_admin
        $this->putJson("/api/users/{$pendingStaff->id}/approve", [
            'role' => 'system_admin',
        ])->assertStatus(403);

        // 5. Cannot approve or reject a system_admin user
        $this->putJson("/api/users/{$sysAdmin->id}/approve")->assertStatus(403);
        $this->putJson("/api/users/{$sysAdmin->id}/reject")->assertStatus(403);

        // 6. Legitimate management of clinic staff by clinic_admin still works
        $this->putJson("/api/users/{$pendingStaff->id}/approve", [
            'role' => 'doctor',
        ])->assertOk();
        $this->assertTrue((bool) $pendingStaff->fresh()->is_active);
    }

    public function test_users_cannot_deactivate_or_demote_themselves(): void
    {
        $sysAdmin = User::factory()->create([
            'name' => 'Self System Admin',
            'email' => 'self.sysadmin@bitemap.local',
            'role' => 'system_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $clinicAdmin = User::factory()->create([
            'name' => 'Self Clinic Admin',
            'email' => 'self.clinicadmin@bitemap.local',
            'role' => 'Clinic Admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        foreach ([$sysAdmin, $clinicAdmin] as $actor) {
            Sanctum::actingAs($actor);

            // Self-deactivation via PUT /api/users/{self}
            $this->putJson("/api/users/{$actor->id}", [
                'status' => 'Inactive',
            ])->assertStatus(403)
                ->assertJsonPath('message', 'You cannot deactivate your own account.');

            $this->assertTrue((bool) $actor->fresh()->is_active);

            // Self-deactivation via PUT /api/users/{self}/reject
            $this->putJson("/api/users/{$actor->id}/reject")
                ->assertStatus(403)
                ->assertJsonPath('message', 'You cannot deactivate your own account.');

            $this->assertTrue((bool) $actor->fresh()->is_active);

            // Self-role-demotion via PUT /api/users/{self}
            $this->putJson("/api/users/{$actor->id}", [
                'role' => 'doctor',
            ])->assertStatus(403)
                ->assertJsonPath('message', 'You cannot change or demote your own role.');
        }

        // Legitimate self-update (phone/name with same canonical role and Active status) succeeds
        Sanctum::actingAs($clinicAdmin);
        $this->putJson("/api/users/{$clinicAdmin->id}", [
            'phone' => '09171112233',
            'role' => 'clinic_admin',
            'status' => 'Active',
        ])->assertOk();

        $this->assertSame('09171112233', $clinicAdmin->fresh()->phone);
    }

    public function test_settings_role_normalization_and_authorization_boundaries(): void
    {
        Setting::create(['setting_key' => 'session_timeout_minutes', 'setting_value' => '30']);
        Setting::create(['setting_key' => 'clinic_name', 'setting_value' => 'Digos City Animal Bite Center']);

        // 1. Legacy 'Clinic Admin' DB role is normalized and can read/update clinic_admin settings
        $legacyClinicAdmin = User::factory()->create([
            'role' => 'Clinic Admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        Sanctum::actingAs($legacyClinicAdmin);

        $clinicSettingsRes = $this->getJson('/api/settings')->assertOk();
        $clinicKeys = array_column($clinicSettingsRes->json('data'), 'setting_key');
        $this->assertContains('clinic_name', $clinicKeys);
        $this->assertNotContains('session_timeout_minutes', $clinicKeys);
        $this->assertFalse((bool) $clinicSettingsRes->json('meta.sms_credentials_configured'));

        $this->putJson('/api/settings/clinic_name', [
            'value' => 'Updated Digos ABTC',
        ])->assertOk();

        // clinic_admin cannot update system_admin security settings
        $this->putJson('/api/settings/session_timeout_minutes', [
            'value' => '15',
        ])->assertStatus(403);

        // clinic_admin cannot access system_admin SMS gateway endpoints
        $this->postJson('/api/settings/sms-credentials', [
            'account_sid' => 'AC123',
            'auth_token' => 'secret',
            'from_number' => '+15005550006',
        ])->assertStatus(403);

        $this->postJson('/api/settings/test-sms', [
            'phone' => '09171234567',
            'message' => 'Test',
        ])->assertStatus(403);

        // 2. Legacy 'Admin' / 'system_admin' can read/update system_admin settings, but not clinic_admin settings
        $sysAdmin = User::factory()->create([
            'role' => 'Admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        Sanctum::actingAs($sysAdmin);

        $sysSettingsRes = $this->getJson('/api/settings')->assertOk();
        $sysKeys = array_column($sysSettingsRes->json('data'), 'setting_key');
        $this->assertContains('session_timeout_minutes', $sysKeys);
        $this->assertNotContains('clinic_name', $sysKeys);

        $this->putJson('/api/settings/session_timeout_minutes', [
            'value' => '45',
        ])->assertOk();

        $this->putJson('/api/settings/clinic_name', [
            'value' => 'Unauthorized Change',
        ])->assertStatus(403);

        // 3. Doctor and Nurse/Vaccinator cannot access settings at all
        foreach (['Doctor', 'Nurse/Vaccinator'] as $clinicalRole) {
            $clinicalUser = User::factory()->create([
                'role' => $clinicalRole,
                'is_active' => true,
                'approval_status' => 'approved',
            ]);

            Sanctum::actingAs($clinicalUser);
            $this->getJson('/api/settings')->assertStatus(403);
            $this->putJson('/api/settings/clinic_name', ['value' => 'Denied'])->assertStatus(403);
        }
    }

    public function test_legitimate_module_access_is_preserved_for_all_roles(): void
    {
        $barangay = Barangay::create(['name' => 'Zone 2']);
        $patient = Patient::create([
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'full_name' => 'Maria Santos',
            'age' => 31,
            'sex' => 'Female',
            'contact_number' => '09181234567',
            'barangay_id' => $barangay->id,
            'residence_barangay' => 'Zone 2',
            'address' => 'Zone 2, Digos City',
        ]);

        $sysAdmin = User::factory()->create(['role' => 'system_admin', 'is_active' => true, 'approval_status' => 'approved']);
        $clinicAdmin = User::factory()->create(['role' => 'Clinic Admin', 'is_active' => true, 'approval_status' => 'approved']);
        $doctor = User::factory()->create(['role' => 'Doctor', 'is_active' => true, 'approval_status' => 'approved']);
        $nurse = User::factory()->create(['role' => 'Nurse/Vaccinator', 'is_active' => true, 'approval_status' => 'approved']);

        // system_admin: allowed users, settings, audit-logs; denied clinical PII
        Sanctum::actingAs($sysAdmin);
        $this->getJson('/api/users')->assertOk();
        $this->getJson('/api/settings')->assertOk();
        $this->getJson('/api/audit-logs')->assertOk();
        $this->getJson('/api/patients')->assertStatus(403);
        $this->getJson("/api/patients/{$patient->id}")->assertStatus(403);
        $this->getJson('/api/incidents')->assertStatus(403);
        $this->getJson('/api/pep-schedule')->assertStatus(403);
        $this->getJson('/api/inventory')->assertStatus(403);

        // clinic_admin: allowed clinical, GIS, reports, users, settings, audit-logs
        Sanctum::actingAs($clinicAdmin);
        $this->getJson('/api/patients')->assertOk();
        $this->getJson('/api/incidents')->assertOk();
        $this->getJson('/api/pep-schedule')->assertOk();
        $this->getJson('/api/inventory')->assertOk();
        $this->getJson('/api/gis/heatmap')->assertOk();
        $this->getJson('/api/reports/summary')->assertOk();
        $this->getJson('/api/users')->assertOk();
        $this->getJson('/api/settings')->assertOk();
        $this->getJson('/api/audit-logs')->assertOk();

        // doctor: allowed clinical (read), GIS, reports; denied patient/incident creation, users, settings, audit-logs
        Sanctum::actingAs($doctor);
        $this->getJson('/api/patients')->assertOk();
        $this->getJson('/api/incidents')->assertOk();
        $this->getJson('/api/pep-schedule')->assertOk();
        $this->getJson('/api/inventory')->assertOk();
        $this->getJson('/api/gis/heatmap')->assertOk();
        $this->getJson('/api/reports/summary')->assertOk();
        $this->postJson('/api/patients', [])->assertStatus(403);
        $this->postJson('/api/incidents', [])->assertStatus(403);
        $this->getJson('/api/users')->assertStatus(403);
        $this->getJson('/api/settings')->assertStatus(403);
        $this->getJson('/api/audit-logs')->assertStatus(403);

        // nurse_vaccinator: allowed patients, incidents, pep-schedule, inventory; denied reports, inventory deletion, users, settings, audit-logs
        Sanctum::actingAs($nurse);
        $this->getJson('/api/patients')->assertOk();
        $this->getJson('/api/incidents')->assertOk();
        $this->getJson('/api/pep-schedule')->assertOk();
        $this->getJson('/api/inventory')->assertOk();
        $this->getJson('/api/gis/heatmap')->assertOk();
        $this->getJson('/api/reports/summary')->assertStatus(403);
        $this->deleteJson("/api/patients/{$patient->id}")->assertStatus(403);
        $this->getJson('/api/users')->assertStatus(403);
        $this->getJson('/api/settings')->assertStatus(403);
        $this->getJson('/api/audit-logs')->assertStatus(403);
    }
}
