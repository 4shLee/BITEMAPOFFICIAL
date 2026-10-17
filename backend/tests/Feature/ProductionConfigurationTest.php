<?php

namespace Tests\Feature;

use Tests\TestCase;

class ProductionConfigurationTest extends TestCase
{
    public function test_cors_allows_a_configured_origin_and_rejects_others(): void
    {
        config(['cors.allowed_origins' => ['https://bitemap.example.test']]);

        $allowed = $this->withHeaders([
            'Origin' => 'https://bitemap.example.test',
            'Access-Control-Request-Method' => 'GET',
        ])->options('/api/barangays');
        $allowed->assertHeader('Access-Control-Allow-Origin', 'https://bitemap.example.test');

        // With a single configured origin the server always answers with that origin, so a
        // browser on any other origin sees a mismatch and blocks the call. What must never
        // happen is echoing the foreign origin or answering with a wildcard.
        $blocked = $this->withHeaders([
            'Origin' => 'https://evil.example.test',
            'Access-Control-Request-Method' => 'GET',
        ])->options('/api/barangays');
        $this->assertNotSame('https://evil.example.test', $blocked->headers->get('Access-Control-Allow-Origin'));
        $this->assertNotSame('*', $blocked->headers->get('Access-Control-Allow-Origin'));
    }

    public function test_cors_origins_come_from_environment_and_never_default_to_wildcard(): void
    {
        $cors = $this->loadConfigWithEnv('cors', ['CORS_ALLOWED_ORIGINS' => ' https://a.example.test , https://b.example.test ,']);
        $this->assertSame(['https://a.example.test', 'https://b.example.test'], $cors['allowed_origins']);
        $this->assertFalse($cors['supports_credentials']);

        $default = $this->loadConfigWithEnv('cors', ['CORS_ALLOWED_ORIGINS' => null, 'CORS_ALLOWED_ORIGIN_PATTERNS' => null]);
        $this->assertNotContains('*', $default['allowed_origins']);
        $this->assertSame([], $default['allowed_origins_patterns']);

        $patterns = $this->loadConfigWithEnv('cors', ['CORS_ALLOWED_ORIGIN_PATTERNS' => '#^https://bitemap-[a-z0-9-]+\.vercel\.app$#']);
        $this->assertSame(['#^https://bitemap-[a-z0-9-]+\.vercel\.app$#'], $patterns['allowed_origins_patterns']);
    }

    public function test_timezone_is_configurable_and_defaults_to_utc(): void
    {
        $this->assertSame('Asia/Manila', $this->loadConfigWithEnv('app', ['APP_TIMEZONE' => 'Asia/Manila'])['timezone']);
        $this->assertSame('UTC', $this->loadConfigWithEnv('app', ['APP_TIMEZONE' => null])['timezone']);
        $this->assertContains('Asia/Manila', timezone_identifiers_list());
    }

    public function test_sms_live_sending_and_database_credentials_have_safe_defaults(): void
    {
        $services = $this->loadConfigWithEnv('services', [
            'SMS_SERVICE_ENABLED' => null,
            'SMS_ALLOW_DB_CREDENTIALS' => null,
        ]);

        $this->assertFalse(filter_var($services['sms']['enabled'], FILTER_VALIDATE_BOOL));
        $this->assertNull($services['sms']['allow_database_credentials']);
    }

    public function test_production_logs_can_be_sent_to_stderr(): void
    {
        $this->assertSame('php://stderr', config('logging.channels.stderr.handler_with.stream'));
        $logging = $this->loadConfigWithEnv('logging', ['LOG_CHANNEL' => 'stderr']);
        $this->assertSame('stderr', $logging['default']);
    }

    public function test_trusted_proxies_is_configurable_via_config(): void
    {
        $this->assertSame('*', $this->loadConfigWithEnv('app', ['TRUSTED_PROXIES' => '*'])['trusted_proxies']);
        $this->assertSame('10.0.0.1,10.0.0.2', $this->loadConfigWithEnv('app', ['TRUSTED_PROXIES' => '10.0.0.1,10.0.0.2'])['trusted_proxies']);
        $this->assertNull($this->loadConfigWithEnv('app', ['TRUSTED_PROXIES' => null])['trusted_proxies']);
    }

    public function test_trusted_proxies_booted_callback_applies_configuration(): void
    {
        config(['app.trusted_proxies' => '*']);
        // Fire the booted callbacks so TrustProxies::at() is configured from config('app.trusted_proxies')
        $this->app->boot();

        $this->get('/up', ['X-Forwarded-For' => '203.0.113.195'])->assertOk();
    }

    /**
     * Evaluate a config file with temporary environment values (null = unset).
     *
     * @param  array<string, string|null>  $vars
     */
    private function loadConfigWithEnv(string $file, array $vars): array
    {
        $previous = [];
        foreach ($vars as $key => $value) {
            $previous[$key] = [getenv($key), $_ENV[$key] ?? null, $_SERVER[$key] ?? null];
            if ($value === null) {
                putenv($key);
                unset($_ENV[$key], $_SERVER[$key]);
            } else {
                putenv("{$key}={$value}");
                $_ENV[$key] = $_SERVER[$key] = $value;
            }
        }

        try {
            return require config_path($file.'.php');
        } finally {
            foreach ($previous as $key => [$getenv, $env, $server]) {
                $getenv === false ? putenv($key) : putenv("{$key}={$getenv}");
                $env === null ? null : $_ENV[$key] = $env;
                $server === null ? null : $_SERVER[$key] = $server;
            }
        }
    }
}
