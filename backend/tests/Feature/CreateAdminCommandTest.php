<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DemoUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CreateAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    private const STRONG = 'Tr1cky-Unique!Phrase#2026';

    protected function tearDown(): void
    {
        putenv('BITEMAP_ADMIN_PASSWORD');
        parent::tearDown();
    }

    public function test_creates_a_system_admin_with_the_supplied_password_and_never_prints_it(): void
    {
        putenv('BITEMAP_ADMIN_PASSWORD='.self::STRONG);

        $exit = Artisan::call('bitemap:create-admin', ['email' => 'Owner@Clinic.Example', '--no-interaction' => true]);

        $this->assertSame(0, $exit);
        $this->assertStringNotContainsString(self::STRONG, Artisan::output());
        $user = User::where('email', 'owner@clinic.example')->firstOrFail();
        $this->assertSame('system_admin', $user->role);
        $this->assertTrue($user->is_active);
        $this->assertSame('approved', $user->approval_status);
        $this->assertTrue(Hash::check(self::STRONG, $user->password));
        $this->assertNotSame(self::STRONG, $user->password);
    }

    public function test_the_new_admin_can_sign_in(): void
    {
        putenv('BITEMAP_ADMIN_PASSWORD='.self::STRONG);
        Artisan::call('bitemap:create-admin', ['email' => 'owner@clinic.example', '--no-interaction' => true]);

        $this->postJson('/api/auth/signin', ['email' => 'owner@clinic.example', 'password' => self::STRONG])
            ->assertOk()
            ->assertJsonPath('user.role', 'system_admin');
    }

    public function test_interactive_hidden_prompt_with_confirmation_works(): void
    {
        $this->artisan('bitemap:create-admin', ['email' => 'owner@clinic.example'])
            ->expectsQuestion('Password (min 12 chars, hidden)', self::STRONG)
            ->expectsQuestion('Confirm password', self::STRONG)
            ->assertSuccessful();

        $this->assertTrue(Hash::check(self::STRONG, User::firstOrFail()->password));
    }

    public function test_mismatched_confirmation_is_rejected(): void
    {
        $this->artisan('bitemap:create-admin', ['email' => 'owner@clinic.example'])
            ->expectsQuestion('Password (min 12 chars, hidden)', self::STRONG)
            ->expectsQuestion('Confirm password', self::STRONG.'x')
            ->assertFailed();

        $this->assertSame(0, User::count());
    }

    public function test_weak_or_default_passwords_are_rejected(): void
    {
        foreach (['password', 'short1!A', 'alllowercase-no-digits!', DemoUserSeeder::PASSWORD, 'owner-Owner1234!'] as $weak) {
            putenv('BITEMAP_ADMIN_PASSWORD='.$weak);

            $exit = Artisan::call('bitemap:create-admin', ['email' => 'owner@clinic.example', '--no-interaction' => true]);

            $this->assertSame(1, $exit, "accepted weak password: {$weak}");
        }

        $this->assertSame(0, User::count());
    }

    public function test_refuses_without_a_password_when_non_interactive(): void
    {
        $exit = Artisan::call('bitemap:create-admin', ['email' => 'owner@clinic.example', '--no-interaction' => true]);

        $this->assertSame(1, $exit);
        $this->assertSame(0, User::count());
    }

    public function test_never_modifies_an_existing_account(): void
    {
        $existing = User::factory()->create(['email' => 'owner@clinic.example', 'role' => 'nurse_vaccinator']);
        $hash = $existing->password;
        putenv('BITEMAP_ADMIN_PASSWORD='.self::STRONG);

        $exit = Artisan::call('bitemap:create-admin', ['email' => 'owner@clinic.example', '--no-interaction' => true]);

        $this->assertSame(1, $exit);
        $existing->refresh();
        $this->assertSame('nurse_vaccinator', $existing->role);
        $this->assertSame($hash, $existing->password);
    }

    public function test_rejects_the_well_known_default_emails(): void
    {
        putenv('BITEMAP_ADMIN_PASSWORD='.self::STRONG);

        $exit = Artisan::call('bitemap:create-admin', ['email' => 'admin@bitemap.local', '--no-interaction' => true]);

        $this->assertSame(1, $exit);
        $this->assertSame(0, User::count());
    }

    public function test_legacy_reset_admin_command_is_refused_in_production(): void
    {
        $this->app['env'] = 'production';

        $this->artisan('bitemap:reset-admin')->assertFailed();

        $this->assertSame(0, User::count());
    }

    public function test_legacy_reset_admin_command_still_works_locally(): void
    {
        $this->artisan('bitemap:reset-admin')->assertSuccessful();

        $this->assertDatabaseHas('users', ['email' => 'admin@bitemap.local']);
    }
}
