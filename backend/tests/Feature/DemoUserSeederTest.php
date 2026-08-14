<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DemoUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DemoUserSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_accounts_are_working_and_idempotent(): void
    {
        $this->seed(DemoUserSeeder::class);
        $this->seed(DemoUserSeeder::class);

        $users = User::whereIn('email', array_values(DemoUserSeeder::EMAILS))->get();

        $this->assertCount(4, $users);

        foreach ($users as $user) {
            $this->assertTrue(Hash::check(DemoUserSeeder::PASSWORD, $user->password));
            $this->assertTrue($user->is_active);
            $this->assertSame('approved', $user->approval_status);
            $this->assertNotNull($user->email_verified_at);
        }

        $this->postJson('/api/auth/signin', [
            'email' => DemoUserSeeder::EMAILS['system_admin'],
            'password' => DemoUserSeeder::PASSWORD,
        ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.email', DemoUserSeeder::EMAILS['system_admin']);
    }
}
