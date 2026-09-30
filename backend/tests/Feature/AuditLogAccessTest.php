<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditLogAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_system_admin_can_view_audit_logs()
    {
        $admin = User::factory()->create(['role' => 'system_admin']);

        $response = $this->actingAs($admin)->getJson('/api/audit-logs');

        $response->assertStatus(200);
        $response->assertJsonStructure(['success', 'data']);
    }

    public function test_clinic_admin_can_view_audit_logs()
    {
        $admin = User::factory()->create(['role' => 'clinic_admin']);

        $response = $this->actingAs($admin)->getJson('/api/audit-logs');

        $response->assertStatus(200);
        $response->assertJsonStructure(['success', 'data']);
    }

    public function test_doctor_cannot_view_audit_logs()
    {
        $doctor = User::factory()->create(['role' => 'doctor']);

        $response = $this->actingAs($doctor)->getJson('/api/audit-logs');

        $response->assertStatus(403);
    }

    public function test_nurse_cannot_view_audit_logs()
    {
        $nurse = User::factory()->create(['role' => 'nurse_vaccinator']);

        $response = $this->actingAs($nurse)->getJson('/api/audit-logs');

        $response->assertStatus(403);
    }

    public function test_viewing_patient_creates_audit_log_without_pii()
    {
        $doctor = User::factory()->create(['role' => 'doctor']);
        $patient = new Patient([
            'first_name' => 'John', 
            'last_name' => 'Doe', 
            'sex' => 'Male', 
            'birthdate' => '2000-01-01', 
            'age' => 26,
            'address' => 'Test Address',
            'contact_number' => '09123456789'
        ]);
        $patient->save();

        $response = $this->actingAs($doctor)->getJson("/api/patients/{$patient->id}");

        $response->assertStatus(200);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'View record',
            'module' => 'Patients',
            'record_id' => $patient->id,
            'user_id' => $doctor->id,
        ]);

        $log = AuditLog::where('record_id', $patient->id)->first();
        $this->assertStringNotContainsString('John Doe', $log->details ?? '');
        $this->assertStringNotContainsString('John Doe', $log->description ?? '');
    }

    public function test_failed_login_creates_audit_log()
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => bcrypt('password123'),
        ]);

        $response = $this->postJson('/api/auth/signin', [
            'email' => 'test@example.com',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(401);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Failed login',
            'module' => 'Authentication',
        ]);
    }
}
