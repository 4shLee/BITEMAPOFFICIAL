<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthenticationSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_repeated_failed_login_attempts_trigger_cooldown_and_return_429_with_retry_after(): void
    {
        Setting::updateOrCreate(['setting_key' => 'max_failed_login_attempts'], ['setting_value' => '3']);
        Setting::updateOrCreate(['setting_key' => 'account_lock_minutes'], ['setting_value' => '10']);

        $user = User::factory()->create([
            'email' => 'doctor.lockout@example.test',
            'password' => 'StrongPass123!',
            'role' => 'doctor',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/auth/signin', [
                'email' => 'doctor.lockout@example.test',
                'password' => 'WrongPassword123!',
            ])->assertStatus(401)
                ->assertJsonPath('error', 'Invalid email or password.');
        }

        $blocked = $this->postJson('/api/auth/signin', [
            'email' => 'doctor.lockout@example.test',
            'password' => 'StrongPass123!',
        ]);

        $blocked->assertStatus(429)
            ->assertJsonPath('success', false)
            ->assertHeader('Retry-After');

        $retryAfter = (int) $blocked->json('retry_after');
        $this->assertGreaterThan(0, $retryAfter);
        $this->assertLessThanOrEqual(600, $retryAfter);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Login blocked',
            'module' => 'Authentication',
            'user_id' => $user->id,
        ]);
    }

    public function test_successful_login_resets_failed_attempt_limiter_and_returns_token_expiration_metadata(): void
    {
        Setting::updateOrCreate(['setting_key' => 'max_failed_login_attempts'], ['setting_value' => '3']);
        Setting::updateOrCreate(['setting_key' => 'account_lock_minutes'], ['setting_value' => '15']);
        Setting::updateOrCreate(['setting_key' => 'session_timeout_minutes'], ['setting_value' => '25']);

        User::factory()->create([
            'email' => 'nurse.reset@example.test',
            'password' => 'StrongPass123!',
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        for ($i = 0; $i < 2; $i++) {
            $this->postJson('/api/auth/signin', [
                'email' => 'nurse.reset@example.test',
                'password' => 'WrongPass!',
            ])->assertStatus(401);
        }

        $login = $this->postJson('/api/auth/signin', [
            'email' => 'nurse.reset@example.test',
            'password' => 'StrongPass123!',
        ]);

        $login->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('sessionTimeoutMinutes', 25);
        $this->assertNotEmpty($login->json('accessToken'));
        $this->assertNotEmpty($login->json('expiresAt'));

        for ($i = 0; $i < 2; $i++) {
            $this->postJson('/api/auth/signin', [
                'email' => 'nurse.reset@example.test',
                'password' => 'WrongPass!',
            ])->assertStatus(401);
        }
    }

    public function test_nonexistent_and_existing_accounts_return_identical_error_response(): void
    {
        User::factory()->create([
            'email' => 'existing.staff@example.test',
            'password' => 'StrongPass123!',
            'role' => 'doctor',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $existingResponse = $this->postJson('/api/auth/signin', [
            'email' => 'existing.staff@example.test',
            'password' => 'WrongPassword!',
        ])->assertStatus(401);

        $nonExistentResponse = $this->postJson('/api/auth/signin', [
            'email' => 'missing.staff@example.test',
            'password' => 'WrongPassword!',
        ])->assertStatus(401);

        $this->assertSame($existingResponse->json(), $nonExistentResponse->json());
    }

    public function test_logout_revokes_current_personal_access_token(): void
    {
        $user = User::factory()->create([
            'email' => 'logout.test@example.test',
            'password' => 'StrongPass123!',
            'role' => 'doctor',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $login = $this->postJson('/api/auth/signin', [
            'email' => 'logout.test@example.test',
            'password' => 'StrongPass123!',
        ])->assertOk();

        $token = (string) $login->json('accessToken');
        $this->assertSame(1, $user->tokens()->count());

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/auth/signout')
            ->assertOk();

        $this->assertSame(0, $user->tokens()->count());

        Auth::forgetGuards();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/auth/session')
            ->assertStatus(401);
    }

    public function test_unattended_session_expires_after_configured_idle_timeout(): void
    {
        Setting::updateOrCreate(['setting_key' => 'session_timeout_minutes'], ['setting_value' => '15']);

        User::factory()->create([
            'email' => 'idle.doctor@example.test',
            'password' => 'StrongPass123!',
            'role' => 'doctor',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $login = $this->postJson('/api/auth/signin', [
            'email' => 'idle.doctor@example.test',
            'password' => 'StrongPass123!',
        ])->assertOk();

        $token = (string) $login->json('accessToken');

        // After 16 minutes of inactivity (timeout is 15m), the token must be rejected and deleted
        $this->travel(16)->minutes();
        Auth::forgetGuards();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/dashboard/stats')
            ->assertStatus(401);

        $this->assertSame(0, PersonalAccessToken::count());
    }

    public function test_genuine_user_activity_extends_idle_timeout_until_absolute_token_expiration_cap(): void
    {
        Setting::updateOrCreate(['setting_key' => 'session_timeout_minutes'], ['setting_value' => '20']);
        config(['sanctum.expiration' => 50]);

        User::factory()->create([
            'email' => 'sliding.doctor@example.test',
            'password' => 'StrongPass123!',
            'role' => 'doctor',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $login = $this->postJson('/api/auth/signin', [
            'email' => 'sliding.doctor@example.test',
            'password' => 'StrongPass123!',
        ])->assertOk();

        $token = (string) $login->json('accessToken');
        $tokenRecord = PersonalAccessToken::firstOrFail();
        $initialLastUsedAt = $tokenRecord->last_used_at;
        $initialExpiresAt = $tokenRecord->expires_at;

        // At t+15m (within 20m idle window), genuine activity on /api/patients extends last_used_at & expires_at
        $this->travel(15)->minutes();
        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/patients')
            ->assertOk();

        $tokenRecord->refresh();
        $this->assertTrue($tokenRecord->last_used_at->gt($initialLastUsedAt));
        $this->assertTrue($tokenRecord->expires_at->gt($initialExpiresAt));

        // At t+30m (only 15m since last genuine activity, though >20m since login), still valid!
        $this->travel(15)->minutes();
        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/patients')
            ->assertOk();

        // At t+45m (15m since last genuine activity), still valid, but capped at absolute 50m lifetime
        $this->travel(15)->minutes();
        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/patients')
            ->assertOk();

        // At t+52m (exceeds 50m absolute token lifetime despite recent genuine activity), rejected!
        $this->travel(7)->minutes();
        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/patients')
            ->assertStatus(401);

        $this->assertSame(0, PersonalAccessToken::count());
    }

    public function test_background_polling_does_not_update_last_used_at_or_extend_idle_timeout(): void
    {
        Setting::updateOrCreate(['setting_key' => 'session_timeout_minutes'], ['setting_value' => '20']);

        User::factory()->create([
            'email' => 'poll.admin@example.test',
            'password' => 'StrongPass123!',
            'role' => 'clinic_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $login = $this->postJson('/api/auth/signin', [
            'email' => 'poll.admin@example.test',
            'password' => 'StrongPass123!',
        ])->assertOk();

        $token = (string) $login->json('accessToken');
        $tokenRecord = PersonalAccessToken::firstOrFail();
        $initialLastUsedTimestamp = $tokenRecord->last_used_at->getTimestamp();
        $initialExpiresTimestamp = $tokenRecord->expires_at->getTimestamp();

        // At t+10m, background poll runs on /api/notifications/summary (even without custom header)
        $this->travel(10)->minutes();
        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/notifications/summary')
            ->assertOk();

        $tokenRecord->refresh();
        $this->assertSame($initialLastUsedTimestamp, $tokenRecord->last_used_at->getTimestamp());
        $this->assertSame($initialExpiresTimestamp, $tokenRecord->expires_at->getTimestamp());

        // At t+15m, background poll runs on /api/audit-logs with X-Background-Poll: 1
        $this->travel(5)->minutes();
        Auth::forgetGuards();
        $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
            'X-Background-Poll' => '1',
        ])->getJson('/api/audit-logs?per_page=25')->assertOk();

        $tokenRecord->refresh();
        $this->assertSame($initialLastUsedTimestamp, $tokenRecord->last_used_at->getTimestamp());
        $this->assertSame($initialExpiresTimestamp, $tokenRecord->expires_at->getTimestamp());

        // Even if session_timeout_minutes is increased to 25m in settings, last_used_at was NOT refreshed by polls,
        // so at t+26m (26m since login, though only 11m since last background poll), the session is expired!
        Setting::updateOrCreate(['setting_key' => 'session_timeout_minutes'], ['setting_value' => '25']);
        $this->travel(11)->minutes();
        Auth::forgetGuards();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/dashboard/stats')
            ->assertStatus(401);
    }

    public function test_periodic_session_verification_does_not_update_last_used_at_or_extend_idle_timeout(): void
    {
        Setting::updateOrCreate(['setting_key' => 'session_timeout_minutes'], ['setting_value' => '20']);

        User::factory()->create([
            'email' => 'session.check@example.test',
            'password' => 'StrongPass123!',
            'role' => 'doctor',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $login = $this->postJson('/api/auth/signin', [
            'email' => 'session.check@example.test',
            'password' => 'StrongPass123!',
        ])->assertOk();

        $token = (string) $login->json('accessToken');
        $initialExpiresAtIso = (string) $login->json('expiresAt');
        $tokenRecord = PersonalAccessToken::firstOrFail();
        $initialLastUsedTimestamp = $tokenRecord->last_used_at->getTimestamp();
        $initialExpiresTimestamp = $tokenRecord->expires_at->getTimestamp();

        // Periodic session verification at t+8m and t+16m (even without custom header) must NOT extend session
        $this->travel(8)->minutes();
        Auth::forgetGuards();
        $check1 = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/auth/session')
            ->assertOk();

        $this->assertSame($initialExpiresAtIso, $check1->json('expiresAt'));

        $this->travel(8)->minutes();
        Auth::forgetGuards();
        $check2 = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
            'X-Session-Check' => '1',
        ])->getJson('/api/auth/session')
            ->assertOk();

        $this->assertSame($initialExpiresAtIso, $check2->json('expiresAt'));

        $tokenRecord->refresh();
        $this->assertSame($initialLastUsedTimestamp, $tokenRecord->last_used_at->getTimestamp());
        $this->assertSame($initialExpiresTimestamp, $tokenRecord->expires_at->getTimestamp());

        // At t+21m (21m since login, only 5m since last /api/auth/session check), session must be expired!
        $this->travel(5)->minutes();
        Auth::forgetGuards();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/auth/session')
            ->assertStatus(401);

        $this->assertSame(0, PersonalAccessToken::count());
    }

    public function test_tokens_are_revoked_when_user_is_deactivated_role_changed_password_reset_or_rejected(): void
    {
        $admin = User::factory()->create([
            'role' => 'system_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $staff = User::factory()->create([
            'role' => 'doctor',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        // 1. Role change revokes existing tokens
        $staff->createToken('bitemap-web');
        $this->assertSame(1, $staff->tokens()->count());

        Sanctum::actingAs($admin);
        $this->putJson('/api/users/'.$staff->id, [
            'role' => 'nurse_vaccinator',
        ])->assertOk();
        $this->assertSame(0, $staff->tokens()->count());

        // 2. Password reset revokes existing tokens
        $staff->createToken('bitemap-web');
        $this->assertSame(1, $staff->tokens()->count());

        $this->putJson('/api/users/'.$staff->id, [
            'password' => 'UpdatedPass123!',
        ])->assertOk();
        $this->assertSame(0, $staff->tokens()->count());

        // 3. Deactivation revokes existing tokens
        $staff->createToken('bitemap-web');
        $this->assertSame(1, $staff->tokens()->count());

        $this->putJson('/api/users/'.$staff->id, [
            'status' => 'Inactive',
        ])->assertOk();
        $this->assertSame(0, $staff->tokens()->count());

        // 4. Rejection revokes existing tokens
        $staff->createToken('bitemap-web');
        $this->assertSame(1, $staff->tokens()->count());

        $this->putJson('/api/users/'.$staff->id.'/reject')->assertOk();
        $this->assertSame(0, $staff->tokens()->count());
    }

    public function test_middleware_and_session_endpoint_reject_inactive_or_unapproved_users(): void
    {
        $inactiveDoctor = User::factory()->create([
            'role' => 'doctor',
            'is_active' => false,
            'approval_status' => 'approved',
        ]);

        Sanctum::actingAs($inactiveDoctor);

        $this->getJson('/api/dashboard/stats')
            ->assertStatus(403)
            ->assertJsonPath('error', 'Your account is inactive or not approved.');

        $this->getJson('/api/auth/session')
            ->assertStatus(403)
            ->assertJsonPath('error', 'Your account is inactive or not approved.');

        RateLimiter::clear('test');
    }
}
