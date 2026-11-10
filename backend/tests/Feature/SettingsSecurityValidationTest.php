<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Setting;
use App\Models\User;
use App\Support\AuthSessionSecurity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SettingsSecurityValidationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA ignore_check_constraints = ON');
        }
    }

    public function test_role_based_settings_access_and_canonical_role_normalization(): void
    {
        Setting::create(['setting_key' => 'session_timeout_minutes', 'setting_value' => '30']);
        Setting::create(['setting_key' => 'max_failed_login_attempts', 'setting_value' => '5']);
        Setting::create(['setting_key' => 'clinic_name', 'setting_value' => 'Digos City ABTC']);
        Setting::create(['setting_key' => 'twilio_auth_token', 'setting_value' => 'super-secret-twilio-token']);

        // 1. system_admin (including legacy 'Admin' label) sees only system_admin keys, never clinic_admin or secret keys
        $sysAdmin = User::factory()->create([
            'role' => 'Admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        Sanctum::actingAs($sysAdmin);

        $sysRes = $this->getJson('/api/settings')->assertOk();
        $sysKeys = array_column($sysRes->json('data'), 'setting_key');
        $this->assertContains('session_timeout_minutes', $sysKeys);
        $this->assertContains('max_failed_login_attempts', $sysKeys);
        $this->assertNotContains('clinic_name', $sysKeys);
        $this->assertNotContains('twilio_auth_token', $sysKeys);

        // 2. clinic_admin (including legacy 'Clinic Admin' label) sees only clinic_admin keys, never system_admin or secret keys
        $clinicAdmin = User::factory()->create([
            'role' => 'Clinic Admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        Sanctum::actingAs($clinicAdmin);

        $clinicRes = $this->getJson('/api/settings')->assertOk();
        $clinicKeys = array_column($clinicRes->json('data'), 'setting_key');
        $this->assertContains('clinic_name', $clinicKeys);
        $this->assertNotContains('session_timeout_minutes', $clinicKeys);
        $this->assertNotContains('twilio_auth_token', $clinicKeys);
        $this->assertFalse((bool) $clinicRes->json('meta.sms_credentials_configured'));

        // 3. doctor and nurse_vaccinator (canonical and legacy labels) are denied 403
        foreach (['doctor', 'Doctor', 'Health Officer', 'nurse_vaccinator', 'Nurse/Vaccinator'] as $deniedRole) {
            $staff = User::factory()->create([
                'role' => $deniedRole,
                'is_active' => true,
                'approval_status' => 'approved',
            ]);
            Sanctum::actingAs($staff);

            $this->getJson('/api/settings')->assertStatus(403);
            $this->putJson('/api/settings/clinic_name', ['value' => 'Unauthorized'])->assertStatus(403);
            $this->putJson('/api/settings/session_timeout_minutes', ['value' => '30'])->assertStatus(403);
            $this->postJson('/api/settings/sms-credentials', [
                'account_sid' => 'AC123',
                'auth_token' => 'secret',
                'from_number' => '+15005550006',
            ])->assertStatus(403);
        }
    }

    public function test_unknown_cross_role_and_sensitive_setting_keys_are_rejected(): void
    {
        $sysAdmin = User::factory()->create(['role' => 'system_admin', 'is_active' => true, 'approval_status' => 'approved']);
        $clinicAdmin = User::factory()->create(['role' => 'clinic_admin', 'is_active' => true, 'approval_status' => 'approved']);

        Sanctum::actingAs($sysAdmin);

        // Unknown setting key rejected with 403
        $this->putJson('/api/settings/non_existent_setting_key', ['value' => '123'])
            ->assertStatus(403);

        // Secret credential keys cannot be updated through generic PUT /api/settings/{key}
        foreach (['twilio_account_sid', 'twilio_auth_token', 'twilio_from_number'] as $secretKey) {
            $this->putJson("/api/settings/{$secretKey}", ['value' => 'bypass-attempt'])
                ->assertStatus(403);
        }

        // Cross-role key rejected with 403
        $this->putJson('/api/settings/clinic_name', ['value' => 'Cross Role Edit'])
            ->assertStatus(403);

        Sanctum::actingAs($clinicAdmin);
        $this->putJson('/api/settings/session_timeout_minutes', ['value' => '60'])
            ->assertStatus(403);
        $this->putJson('/api/settings/max_failed_login_attempts', ['value' => '10'])
            ->assertStatus(403);
    }

    public function test_security_settings_validation_prevents_weakening_authentication_controls(): void
    {
        $sysAdmin = User::factory()->create(['role' => 'system_admin', 'is_active' => true, 'approval_status' => 'approved']);
        Sanctum::actingAs($sysAdmin);

        // 1. session_timeout_minutes must be an integer between 5 and 480
        foreach (['0', '4', '-10', '481', '99999', 'abc', '15.5', ''] as $invalidTimeout) {
            $this->putJson('/api/settings/session_timeout_minutes', ['value' => $invalidTimeout])
                ->assertStatus(422);
        }

        $this->putJson('/api/settings/session_timeout_minutes', ['value' => '45'])
            ->assertOk()
            ->assertJsonPath('data.setting_value', '45');
        $this->assertSame(45, AuthSessionSecurity::sessionTimeoutMinutes());

        // 2. max_failed_login_attempts must be an integer between 1 and 20
        foreach (['0', '-1', '21', '1000', 'none', '3.5'] as $invalidAttempts) {
            $this->putJson('/api/settings/max_failed_login_attempts', ['value' => $invalidAttempts])
                ->assertStatus(422);
        }

        $this->putJson('/api/settings/max_failed_login_attempts', ['value' => '4'])
            ->assertOk()
            ->assertJsonPath('data.setting_value', '4');
        $this->assertSame(4, AuthSessionSecurity::maxFailedLoginAttempts());

        // 3. account_lock_minutes must be an integer between 1 and 1440
        foreach (['0', '-5', '1441', '999999', 'disabled'] as $invalidLock) {
            $this->putJson('/api/settings/account_lock_minutes', ['value' => $invalidLock])
                ->assertStatus(422);
        }

        $this->putJson('/api/settings/account_lock_minutes', ['value' => '20'])
            ->assertOk()
            ->assertJsonPath('data.setting_value', '20');
        $this->assertSame(20, AuthSessionSecurity::accountLockMinutes());

        // 4. strong_passwords_required cannot be disabled
        foreach (['false', false, '0', 0, 'invalid'] as $disableAttempt) {
            $this->putJson('/api/settings/strong_passwords_required', ['value' => $disableAttempt])
                ->assertStatus(422);
        }

        $this->putJson('/api/settings/strong_passwords_required', ['value' => 'true'])
            ->assertOk()
            ->assertJsonPath('data.setting_value', 'true');

        // 5. Boolean settings reject arbitrary strings and normalize to 'true' / 'false'
        $this->putJson('/api/settings/security_alerts_enabled', ['value' => 'not-a-bool'])
            ->assertStatus(422);
        $this->putJson('/api/settings/security_alerts_enabled', ['value' => false])
            ->assertOk()
            ->assertJsonPath('data.setting_value', 'false');

        // 6. SMS provider and retry attempts validation
        $this->putJson('/api/settings/sms_provider', ['value' => 'InvalidProvider'])
            ->assertStatus(422);
        $this->putJson('/api/settings/sms_provider', ['value' => 'PhilSMS'])
            ->assertOk()
            ->assertJsonPath('data.setting_value', 'PhilSMS');

        $this->putJson('/api/settings/max_sms_retry_attempts', ['value' => '25'])
            ->assertStatus(422);
        $this->putJson('/api/settings/max_sms_retry_attempts', ['value' => '3'])
            ->assertOk()
            ->assertJsonPath('data.setting_value', '3');
    }

    public function test_clinic_settings_validation_rejects_invalid_values_and_accepts_valid_values(): void
    {
        $clinicAdmin = User::factory()->create(['role' => 'clinic_admin', 'is_active' => true, 'approval_status' => 'approved']);
        Sanctum::actingAs($clinicAdmin);

        // Clinic name cannot be empty
        $this->putJson('/api/settings/clinic_name', ['value' => '   '])
            ->assertStatus(422);
        $this->putJson('/api/settings/clinic_name', ['value' => 'Digos City Animal Bite Center'])
            ->assertOk()
            ->assertJsonPath('data.setting_value', 'Digos City Animal Bite Center');

        // Contact email validation
        $this->putJson('/api/settings/contact_email', ['value' => 'not-an-email'])
            ->assertStatus(422);
        $this->putJson('/api/settings/contact_email', ['value' => 'abtc@digoscity.gov.ph'])
            ->assertOk()
            ->assertJsonPath('data.setting_value', 'abtc@digoscity.gov.ph');

        // Contact number validation
        $this->putJson('/api/settings/contact_number', ['value' => 'abc123'])
            ->assertStatus(422);
        $this->putJson('/api/settings/contact_number', ['value' => '09171234567'])
            ->assertOk()
            ->assertJsonPath('data.setting_value', '09171234567');

        // Reminder days before (0..30)
        $this->putJson('/api/settings/reminder_days_before', ['value' => '-1'])
            ->assertStatus(422);
        $this->putJson('/api/settings/reminder_days_before', ['value' => '31'])
            ->assertStatus(422);
        $this->putJson('/api/settings/reminder_days_before', ['value' => '2'])
            ->assertOk()
            ->assertJsonPath('data.setting_value', '2');

        // Timezone and language validation
        $this->putJson('/api/settings/system_timezone', ['value' => 'Invalid/Timezone'])
            ->assertStatus(422);
        $this->putJson('/api/settings/system_timezone', ['value' => 'Asia/Manila'])
            ->assertOk();

        $this->putJson('/api/settings/system_language', ['value' => 'es'])
            ->assertStatus(422);
        $this->putJson('/api/settings/system_language', ['value' => 'fil'])
            ->assertOk();
    }

    public function test_sms_credentials_secrecy_and_audit_logging_for_settings(): void
    {
        $sysAdmin = User::factory()->create(['role' => 'system_admin', 'is_active' => true, 'approval_status' => 'approved']);
        $clinicAdmin = User::factory()->create(['role' => 'clinic_admin', 'is_active' => true, 'approval_status' => 'approved']);

        // Pre-seed existing contact/clinic/SMS sender values to verify old values are also excluded from audit logs
        Setting::create(['setting_key' => 'session_timeout_minutes', 'setting_value' => '30']);
        Setting::create(['setting_key' => 'sms_sender_id', 'setting_value' => 'OldSenderAlpha']);
        Setting::create(['setting_key' => 'contact_email', 'setting_value' => 'old.private.contact@digoscity.gov.ph']);
        Setting::create(['setting_key' => 'contact_number', 'setting_value' => '09170001111']);
        Setting::create(['setting_key' => 'clinic_name', 'setting_value' => 'Old Private Clinic Name']);
        Setting::create(['setting_key' => 'clinic_address', 'setting_value' => 'Old Confidential Street 123']);

        Sanctum::actingAs($sysAdmin);

        // 1. Security-related numeric settings record previous and new values in audit description
        $this->putJson('/api/settings/session_timeout_minutes', ['value' => '60'])->assertOk();
        $this->putJson('/api/settings/max_failed_login_attempts', ['value' => '4'])->assertOk();
        $this->putJson('/api/settings/account_lock_minutes', ['value' => '25'])->assertOk();

        $timeoutLog = AuditLog::where('module', 'Settings')
            ->where('description', 'like', '%session_timeout_minutes%')
            ->latest('id')
            ->first();
        $this->assertNotNull($timeoutLog);
        $this->assertSame('Updated setting session_timeout_minutes from 30 to 60.', $timeoutLog->description);

        // 2. SMS sender ID logs only the setting key, never old or new sender values
        $this->putJson('/api/settings/sms_sender_id', ['value' => 'NewSenderBeta'])->assertOk();
        $senderLog = AuditLog::where('module', 'Settings')
            ->where('description', 'like', '%sms_sender_id%')
            ->latest('id')
            ->first();
        $this->assertNotNull($senderLog);
        $this->assertSame('Updated setting sms_sender_id.', $senderLog->description);

        // 3. Contact information and clinic details log only the setting key, never old or new values
        Sanctum::actingAs($clinicAdmin);

        $sensitiveClinicUpdates = [
            'contact_email' => 'new.secret.email@digoscity.gov.ph',
            'contact_number' => '09189998888',
            'clinic_name' => 'New Confidential ABTC Facility',
            'clinic_address' => 'New Private Building 456, Digos City',
            'clinic_public_notes' => 'Internal note not for audit trail',
        ];

        foreach ($sensitiveClinicUpdates as $key => $newVal) {
            $this->putJson("/api/settings/{$key}", ['value' => $newVal])->assertOk();
            $log = AuditLog::where('module', 'Settings')
                ->where('description', 'like', "%{$key}%")
                ->latest('id')
                ->first();
            $this->assertNotNull($log);
            $this->assertSame("Updated setting {$key}.", $log->description);
        }

        // 4. Update SMS credentials in testing environment (where DB overrides are allowed)
        Sanctum::actingAs($sysAdmin);

        $secretSid = 'AC_SECRET_SID_998877';
        $secretToken = 'AUTH_SECRET_TOKEN_112233';
        $fromNumber = '+15005550006';

        $credResponse = $this->postJson('/api/settings/sms-credentials', [
            'account_sid' => $secretSid,
            'auth_token' => $secretToken,
            'from_number' => $fromNumber,
        ])->assertOk();

        // Response never echoes back the secret credentials
        $rawResponse = $credResponse->getContent();
        $this->assertStringNotContainsString($secretSid, $rawResponse);
        $this->assertStringNotContainsString($secretToken, $rawResponse);

        // GET /api/settings never returns secret credentials in data
        $getSettingsResponse = $this->getJson('/api/settings')->assertOk();
        $this->assertStringNotContainsString($secretSid, $getSettingsResponse->getContent());
        $this->assertStringNotContainsString($secretToken, $getSettingsResponse->getContent());

        // 5. Verify neither audit_logs DB records nor GET /api/audit-logs API responses contain any sensitive old/new values
        $auditApiResponse = $this->getJson('/api/audit-logs?per_page=50')->assertOk();
        $rawAuditApiContent = $auditApiResponse->getContent();

        $forbiddenStrings = [
            $secretSid,
            $secretToken,
            $fromNumber,
            'OldSenderAlpha',
            'NewSenderBeta',
            'old.private.contact@digoscity.gov.ph',
            'new.secret.email@digoscity.gov.ph',
            '09170001111',
            '09189998888',
            'Old Private Clinic Name',
            'New Confidential ABTC Facility',
            'Old Confidential Street 123',
            'New Private Building 456, Digos City',
            'Internal note not for audit trail',
        ];

        foreach ($forbiddenStrings as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $rawAuditApiContent);
        }

        foreach (AuditLog::where('module', 'Settings')->get() as $log) {
            foreach ($forbiddenStrings as $forbidden) {
                $this->assertStringNotContainsString($forbidden, $log->description ?? '');
                $this->assertStringNotContainsString($forbidden, $log->details ?? '');
            }
        }
    }
}
