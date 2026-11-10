<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Barangay;
use App\Models\Incident;
use App\Models\Patient;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use LogicException;
use Tests\TestCase;

class AuditLogAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA ignore_check_constraints = ON');
        }
    }

    public function test_system_admin_can_view_audit_logs(): void
    {
        $admin = User::factory()->create(['role' => 'system_admin', 'is_active' => true, 'approval_status' => 'approved']);

        $response = $this->actingAs($admin)->getJson('/api/audit-logs');

        $response->assertStatus(200);
        $response->assertJsonStructure(['success', 'data', 'pagination', 'summary']);
    }

    public function test_clinic_admin_can_view_audit_logs(): void
    {
        $admin = User::factory()->create(['role' => 'clinic_admin', 'is_active' => true, 'approval_status' => 'approved']);

        $response = $this->actingAs($admin)->getJson('/api/audit-logs');

        $response->assertStatus(200);
        $response->assertJsonStructure(['success', 'data', 'pagination', 'summary']);
    }

    public function test_doctor_cannot_view_or_download_audit_logs(): void
    {
        $doctor = User::factory()->create(['role' => 'doctor', 'is_active' => true, 'approval_status' => 'approved']);

        $this->actingAs($doctor)->getJson('/api/audit-logs')->assertStatus(403);
        $this->actingAs($doctor)->getJson('/api/audit-logs/download?format=PDF')->assertStatus(403);
    }

    public function test_nurse_cannot_view_or_download_audit_logs(): void
    {
        $nurse = User::factory()->create(['role' => 'nurse_vaccinator', 'is_active' => true, 'approval_status' => 'approved']);

        $this->actingAs($nurse)->getJson('/api/audit-logs')->assertStatus(403);
        $this->actingAs($nurse)->getJson('/api/audit-logs/download?format=Excel')->assertStatus(403);
    }

    public function test_unauthenticated_users_cannot_view_or_download_audit_logs(): void
    {
        $this->getJson('/api/audit-logs')->assertStatus(401);
        $this->getJson('/api/audit-logs/download')->assertStatus(401);
    }

    public function test_audit_logs_are_append_only_and_cannot_be_updated_or_deleted(): void
    {
        $admin = User::factory()->create(['role' => 'system_admin', 'is_active' => true, 'approval_status' => 'approved']);

        $log = AuditLog::create([
            'user_id' => $admin->id,
            'user_name' => $admin->name,
            'user_role' => $admin->role,
            'action' => 'Login',
            'action_type' => 'Login',
            'module' => 'Authentication',
            'record_id' => (string) $admin->id,
            'details' => 'User signed in.',
            'description' => 'User signed in.',
            'ip_address' => '127.0.0.1',
        ]);

        // No HTTP routes exist to mutate or delete audit logs
        $this->actingAs($admin)->putJson('/api/audit-logs/'.$log->id, ['action' => 'Tampered'])->assertStatus(404);
        $this->actingAs($admin)->deleteJson('/api/audit-logs/'.$log->id)->assertStatus(404);

        // Model-level immutability prevents updating
        try {
            $log->update(['description' => 'Tampered description']);
            $this->fail('Expected LogicException when updating an AuditLog record.');
        } catch (LogicException $e) {
            $this->assertStringContainsString('append-only', $e->getMessage());
        }

        // Model-level immutability prevents deleting
        try {
            $log->delete();
            $this->fail('Expected LogicException when deleting an AuditLog record.');
        } catch (LogicException $e) {
            $this->assertStringContainsString('append-only', $e->getMessage());
        }

        $this->assertDatabaseHas('audit_logs', [
            'id' => $log->id,
            'description' => 'User signed in.',
        ]);
    }

    public function test_viewing_and_deleting_patient_or_incident_creates_audit_log_without_pii(): void
    {
        $clinicAdmin = User::factory()->create(['role' => 'clinic_admin', 'is_active' => true, 'approval_status' => 'approved']);
        $barangay = Barangay::create(['name' => 'Zone 1']);

        $patient = Patient::create([
            'first_name' => 'John',
            'last_name' => 'SecretDoe',
            'full_name' => 'John SecretDoe',
            'sex' => 'Male',
            'age' => 26,
            'barangay_id' => $barangay->id,
            'residence_barangay' => 'Zone 1',
            'address' => 'Test Address',
            'contact_number' => '09123456789',
        ]);

        $incident = Incident::create([
            'patient_id' => $patient->id,
            'barangay_id' => $barangay->id,
            'incident_date' => '2026-10-26',
            'animal_type' => 'Dog',
            'bite_site' => 'Hand',
            'who_category' => 'Category II',
            'status' => 'Active',
            'exposure_contact_types' => ['Bite'],
        ]);

        $this->actingAs($clinicAdmin)->getJson("/api/patients/{$patient->id}")->assertOk();
        $this->actingAs($clinicAdmin)->deleteJson("/api/incidents/{$incident->id}")->assertOk();

        $patient2 = Patient::create([
            'first_name' => 'Jane',
            'last_name' => 'PrivateRoe',
            'full_name' => 'Jane PrivateRoe',
            'sex' => 'Female',
            'age' => 30,
            'barangay_id' => $barangay->id,
            'residence_barangay' => 'Zone 1',
            'address' => 'Test Address 2',
            'contact_number' => '09198887766',
        ]);
        $this->actingAs($clinicAdmin)->deleteJson("/api/patients/{$patient2->id}")->assertOk();

        $logs = AuditLog::whereIn('module', ['Patients', 'Incidents'])->get();
        $this->assertNotEmpty($logs);

        foreach ($logs as $log) {
            $this->assertStringNotContainsString('SecretDoe', $log->details ?? '');
            $this->assertStringNotContainsString('SecretDoe', $log->description ?? '');
            $this->assertStringNotContainsString('PrivateRoe', $log->details ?? '');
            $this->assertStringNotContainsString('PrivateRoe', $log->description ?? '');
        }
    }

    public function test_authentication_security_events_are_logged_without_exposing_secrets(): void
    {
        Setting::create(['setting_key' => 'max_failed_login_attempts', 'setting_value' => '3']);
        Setting::create(['setting_key' => 'account_lock_minutes', 'setting_value' => '10']);

        // 1. Account signup / request
        $signupSecret = 'SignupPass!2026';
        $signupResponse = $this->postJson('/api/auth/signup', [
            'first_name' => 'Maria',
            'last_name' => 'Reyes',
            'email' => 'maria.reyes@bitemap.local',
            'password' => $signupSecret,
            'role' => 'doctor',
        ])->assertCreated();

        $pendingUserId = $signupResponse->json('user.id');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Request account',
            'module' => 'Authentication',
            'record_id' => (string) $pendingUserId,
        ]);

        // 2. Pending account sign-in attempt logs Failed login
        $this->postJson('/api/auth/signin', [
            'email' => 'maria.reyes@bitemap.local',
            'password' => $signupSecret,
        ])->assertStatus(403);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Failed login',
            'module' => 'Authentication',
            'record_id' => (string) $pendingUserId,
        ]);

        // 3. Wrong password attempts + lockout log Failed login and Login blocked
        $activeUser = User::factory()->create([
            'email' => 'active.doctor@bitemap.local',
            'password' => bcrypt('CorrectPass!123'),
            'role' => 'doctor',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/auth/signin', [
                'email' => 'active.doctor@bitemap.local',
                'password' => 'WrongAttempt!999',
            ])->assertStatus(401);
        }

        $this->postJson('/api/auth/signin', [
            'email' => 'active.doctor@bitemap.local',
            'password' => 'WrongAttempt!999',
        ])->assertStatus(429);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Login blocked',
            'module' => 'Authentication',
            'record_id' => (string) $activeUser->id,
        ]);

        // Verify no plaintext password was ever written to audit_logs
        foreach (AuditLog::all() as $log) {
            $this->assertStringNotContainsString($signupSecret, $log->description ?? '');
            $this->assertStringNotContainsString('WrongAttempt!999', $log->description ?? '');
            $this->assertStringNotContainsString('CorrectPass!123', $log->description ?? '');
        }
    }

    public function test_account_lifecycle_role_change_and_password_reset_events_are_logged(): void
    {
        $sysAdmin = User::factory()->create([
            'name' => 'Chief System Admin',
            'email' => 'chief@bitemap.local',
            'role' => 'system_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $pendingStaff = User::factory()->create([
            'name' => 'Pending Nurse',
            'email' => 'pending.nurse@bitemap.local',
            'role' => 'nurse_vaccinator',
            'is_active' => false,
            'approval_status' => 'pending',
        ]);

        Sanctum::actingAs($sysAdmin);

        // 1. Approve user
        $this->putJson("/api/users/{$pendingStaff->id}/approve", [
            'role' => 'nurse_vaccinator',
        ])->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Approve user',
            'module' => 'User Management',
            'record_id' => (string) $pendingStaff->id,
        ]);

        // 2. Role change (nurse_vaccinator -> doctor) logs Update role with old and new roles
        $this->putJson("/api/users/{$pendingStaff->id}", [
            'role' => 'doctor',
        ])->assertOk();

        $roleLog = AuditLog::where('action', 'Update role')
            ->where('record_id', (string) $pendingStaff->id)
            ->latest('id')
            ->first();
        $this->assertNotNull($roleLog);
        $this->assertStringContainsString('from nurse_vaccinator to doctor', $roleLog->description ?? '');

        // 3. Password reset logs Reset password without leaking the new password
        $newSecretPassword = 'NewResetPassword!2026';
        $this->putJson("/api/users/{$pendingStaff->id}", [
            'password' => $newSecretPassword,
        ])->assertOk();

        $resetLog = AuditLog::where('action', 'Reset password')
            ->where('record_id', (string) $pendingStaff->id)
            ->latest('id')
            ->first();
        $this->assertNotNull($resetLog);
        $this->assertStringNotContainsString($newSecretPassword, $resetLog->description ?? '');
        $this->assertStringNotContainsString($newSecretPassword, $resetLog->details ?? '');

        // 4. Deactivate user logs Deactivate user
        $this->putJson("/api/users/{$pendingStaff->id}", [
            'status' => 'Inactive',
        ])->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Deactivate user',
            'module' => 'User Management',
            'record_id' => (string) $pendingStaff->id,
        ]);

        // 5. Reactivate user logs Activate user
        $this->putJson("/api/users/{$pendingStaff->id}", [
            'status' => 'Active',
        ])->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Activate user',
            'module' => 'User Management',
            'record_id' => (string) $pendingStaff->id,
        ]);

        // 6. Reject user logs Reject user
        $secondPending = User::factory()->create([
            'name' => 'Rejected Applicant',
            'email' => 'rejected@bitemap.local',
            'role' => 'doctor',
            'is_active' => false,
            'approval_status' => 'pending',
        ]);

        $this->putJson("/api/users/{$secondPending->id}/reject")->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Reject user',
            'module' => 'User Management',
            'record_id' => (string) $secondPending->id,
        ]);

        // 7. Filtering audit logs via GET /api/audit-logs by new security action and role works
        $filteredRes = $this->getJson('/api/audit-logs?action='.urlencode('Reset password').'&role=system_admin')
            ->assertOk();

        $this->assertCount(1, $filteredRes->json('data'));
        $this->assertSame('Reset password', $filteredRes->json('data.0.action'));
    }
}
