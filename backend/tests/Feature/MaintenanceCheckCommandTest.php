<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class MaintenanceCheckCommandTest extends TestCase
{
    use RefreshDatabase;

    /** Publicly committed local Docker key (.env.docker.example). */
    private const PUBLIC_DEV_APP_KEY = 'base64:49Tu9TFEezqKOKcymfWXaexNq8gfwpUSdwWFYp6FYQE=';

    private const UNIQUE_TEST_APP_KEY = 'base64:2fl+Ktvkfl+Fuz4Qp/A75G2RTiWVA/ZoKZvp6fiiM10=';

    private string $originalEnv;

    protected function setUp(): void
    {
        parent::setUp();

        $this->originalEnv = $this->app['env'];
    }

    protected function tearDown(): void
    {
        $this->app['env'] = $this->originalEnv;

        parent::tearDown();
    }

    private function seedHealthyDatabase(): void
    {
        Barangay::create(['name' => 'Zone 1 (Pob.)', 'latitude' => 6.7497, 'longitude' => 125.3572]);

        User::factory()->create([
            'role' => 'system_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
    }

    private function configureHealthyProduction(): void
    {
        $this->app['env'] = 'production';

        Config::set('app.debug', false);
        Config::set('app.key', self::UNIQUE_TEST_APP_KEY);
        Config::set('app.url', 'https://bitemap-api.example.test');
        Config::set('app.trusted_proxies', '*');
        Config::set('cors.allowed_origins', ['https://bitemap.example.test']);
        Config::set('session.secure', true);
        Config::set('services.sms.allow_database_credentials', null);
        Config::set('services.sms.enabled', false);
        Config::set('sanctum.expiration', 720);
        Config::set('sanctum.last_used_at', false);
    }

    public function test_healthy_production_configuration_passes_and_never_prints_secrets(): void
    {
        $this->seedHealthyDatabase();
        $this->configureHealthyProduction();
        Config::set('services.twilio.auth_token', 'SUPER_SECRET_TWILIO_TOKEN_123');
        Config::set('database.connections.mysql.password', 'SUPER_SECRET_DB_PASSWORD_456');

        $exitCode = Artisan::call('bitemap:maintenance-check');
        $output = Artisan::output();

        $this->assertSame(0, $exitCode, $output);
        $this->assertStringContainsString('Maintenance check passed', $output);
        $this->assertStringContainsString('All ', $output); // migrations fully applied
        $this->assertStringNotContainsString(self::UNIQUE_TEST_APP_KEY, $output);
        $this->assertStringNotContainsString('SUPER_SECRET_TWILIO_TOKEN_123', $output);
        $this->assertStringNotContainsString('SUPER_SECRET_DB_PASSWORD_456', $output);
    }

    public function test_debug_mode_in_production_fails(): void
    {
        $this->seedHealthyDatabase();
        $this->configureHealthyProduction();
        Config::set('app.debug', true);

        $this->assertSame(1, Artisan::call('bitemap:maintenance-check'));
        $this->assertStringContainsString('APP_DEBUG must be false in production', Artisan::output());
    }

    public function test_public_development_app_key_fails_in_production_without_printing_it(): void
    {
        $this->seedHealthyDatabase();
        $this->configureHealthyProduction();
        Config::set('app.key', self::PUBLIC_DEV_APP_KEY);

        $exitCode = Artisan::call('bitemap:maintenance-check');
        $output = Artisan::output();

        $this->assertSame(1, $exitCode);
        $this->assertStringContainsString('publicly committed local development key', $output);
        $this->assertStringNotContainsString(self::PUBLIC_DEV_APP_KEY, $output);
    }

    public function test_public_development_app_key_is_only_a_warning_locally(): void
    {
        $this->seedHealthyDatabase();
        Config::set('app.key', self::PUBLIC_DEV_APP_KEY);

        $this->assertSame(0, Artisan::call('bitemap:maintenance-check'));
        $this->assertStringContainsString('publicly committed local development key', Artisan::output());
    }

    public function test_wildcard_cors_and_weakened_token_controls_fail_in_production(): void
    {
        $this->seedHealthyDatabase();
        $this->configureHealthyProduction();
        Config::set('cors.allowed_origins', ['*']);

        $this->assertSame(1, Artisan::call('bitemap:maintenance-check'));
        $this->assertStringContainsString('wildcard', Artisan::output());

        $this->configureHealthyProduction();
        Config::set('sanctum.expiration', 10080);
        $this->assertSame(1, Artisan::call('bitemap:maintenance-check'));
        $this->assertStringContainsString('SANCTUM_TOKEN_EXPIRATION must be between', Artisan::output());

        $this->configureHealthyProduction();
        Config::set('sanctum.last_used_at', true);
        $this->assertSame(1, Artisan::call('bitemap:maintenance-check'));
        $this->assertStringContainsString('sanctum.last_used_at must be false', Artisan::output());
    }

    public function test_missing_reference_data_and_admin_are_reported_as_warnings(): void
    {
        $this->configureHealthyProduction();

        $exitCode = Artisan::call('bitemap:maintenance-check');
        $output = Artisan::output();

        $this->assertSame(0, $exitCode, $output);
        $this->assertStringContainsString('No barangays found', $output);
        $this->assertStringContainsString('No active system administrator', $output);
    }

    public function test_command_is_read_only(): void
    {
        $this->seedHealthyDatabase();
        $this->configureHealthyProduction();

        $auditCountBefore = \App\Models\AuditLog::count();
        $userCountBefore = User::count();

        Artisan::call('bitemap:maintenance-check');

        $this->assertSame($auditCountBefore, \App\Models\AuditLog::count());
        $this->assertSame($userCountBefore, User::count());
    }
}
