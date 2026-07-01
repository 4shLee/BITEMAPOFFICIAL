<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\DefaultAdminAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LocalDefaultAdminLoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_admin_login_repairs_a_missing_local_admin_account(): void
    {
        $response = $this->postJson('/api/auth/signin', [
            'email' => DefaultAdminAccount::EMAIL,
            'password' => DefaultAdminAccount::PASSWORD,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.email', DefaultAdminAccount::EMAIL)
            ->assertJsonPath('user.role', DefaultAdminAccount::ROLE);

        $this->assertDatabaseHas('users', [
            'email' => DefaultAdminAccount::EMAIL,
            'role' => DefaultAdminAccount::ROLE,
            'is_active' => true,
        ]);
    }

    public function test_default_admin_login_repairs_a_stale_local_admin_account(): void
    {
        User::factory()->create([
            'email' => DefaultAdminAccount::EMAIL,
            'password' => 'old-password',
            'role' => 'Nurse',
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/auth/signin', [
            'email' => DefaultAdminAccount::EMAIL,
            'password' => DefaultAdminAccount::PASSWORD,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.role', DefaultAdminAccount::ROLE)
            ->assertJsonPath('user.is_active', true);
    }
}
