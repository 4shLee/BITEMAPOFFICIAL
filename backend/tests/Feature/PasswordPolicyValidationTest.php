<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PasswordPolicyValidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_account_creation_rejects_passwords_that_violate_password_policy(): void
    {
        $invalidCases = [
            'shorter_than_8_chars' => 'Ab1!xyz',
            'missing_uppercase' => 'password123!',
            'missing_lowercase' => 'PASSWORD123!',
            'missing_number' => 'Password!@#$',
            'missing_special_character' => 'Password1234',
            'whitespace_instead_of_special_character' => 'Password 123',
        ];

        foreach ($invalidCases as $caseName => $invalidPassword) {
            $response = $this->postJson('/api/auth/signup', [
                'first_name' => 'Test',
                'last_name' => 'Staff',
                'email' => $caseName.'@example.test',
                'password' => $invalidPassword,
                'role' => 'doctor',
            ]);

            $response->assertStatus(422, "Expected password case [{$caseName}] to fail validation.")
                ->assertJsonValidationErrors(['password']);

            $this->assertDatabaseMissing('users', [
                'email' => $caseName.'@example.test',
            ]);
        }
    }

    public function test_account_creation_accepts_compliant_password_and_hashes_it_securely(): void
    {
        $plainPassword = 'Strong@Password9';

        $response = $this->postJson('/api/auth/signup', [
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'email' => 'maria.santos@example.test',
            'password' => $plainPassword,
            'role' => 'nurse_vaccinator',
        ]);

        $response->assertCreated()
            ->assertJsonPath('success', true);

        $user = User::where('email', 'maria.santos@example.test')->firstOrFail();

        $this->assertNotSame($plainPassword, $user->password);
        $this->assertTrue(Hash::check($plainPassword, $user->password));
    }

    public function test_password_change_enforces_password_policy_and_hashes_valid_passwords(): void
    {
        $admin = User::factory()->create([
            'role' => 'system_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $originalPlain = 'Initial#Pass1';
        $staff = User::factory()->create([
            'name' => 'Clinic Nurse',
            'first_name' => 'Clinic',
            'last_name' => 'Nurse',
            'email' => 'clinic.nurse@example.test',
            'password' => $originalPlain,
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        $originalHash = $staff->fresh()->password;

        Sanctum::actingAs($admin);

        foreach (['short1!', 'nouppercase1!', 'NOLOWERCASE1!', 'NoNumbersHere!', 'NoSpecialChar123'] as $weakPassword) {
            $this->putJson('/api/users/'.$staff->id, [
                'password' => $weakPassword,
            ])->assertStatus(422)
                ->assertJsonValidationErrors(['password']);

            $this->assertSame($originalHash, $staff->fresh()->password);
        }

        // Updating non-password fields with null/empty password preserves the existing password hash
        $this->putJson('/api/users/'.$staff->id, [
            'phone' => '09171234567',
            'password' => '',
        ])->assertOk();
        $this->assertSame($originalHash, $staff->fresh()->password);

        // Updating with a valid strong password succeeds and hashes the new password
        $newPlain = 'Updated$Pass2026';
        $this->putJson('/api/users/'.$staff->id, [
            'password' => $newPlain,
        ])->assertOk()
            ->assertJsonPath('success', true);

        $updatedStaff = $staff->fresh();
        $this->assertNotSame($newPlain, $updatedStaff->password);
        $this->assertNotSame($originalHash, $updatedStaff->password);
        $this->assertTrue(Hash::check($newPlain, $updatedStaff->password));
    }

    public function test_existing_valid_accounts_can_log_in_without_unexpected_password_change_requirements(): void
    {
        $legacyPassword = 'simplelegacylogin';
        $existingUser = User::factory()->create([
            'name' => 'Existing Doctor',
            'email' => 'existing.doctor@example.test',
            'password' => $legacyPassword,
            'role' => 'doctor',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $response = $this->postJson('/api/auth/signin', [
            'email' => 'existing.doctor@example.test',
            'password' => $legacyPassword,
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.id', $existingUser->id)
            ->assertJsonPath('user.email', 'existing.doctor@example.test');
        $this->assertNotEmpty($response->json('accessToken'));
    }
}
