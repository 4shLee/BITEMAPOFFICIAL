<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\DatabaseBackupManager;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Read-only pre-/post-deployment readiness check for BITEMAP.
 *
 * It never modifies data and never prints secret values (APP_KEY, database
 * credentials, SMS tokens). Each check reports only PASS / WARN / FAIL plus a
 * non-sensitive explanation. Exit code 1 when any FAIL is found.
 *
 * See docs/MAINTENANCE_AND_UPDATES.md.
 */
class MaintenanceCheckCommand extends Command
{
    protected $signature = 'bitemap:maintenance-check';

    protected $description = 'Read-only production readiness check (configuration, database, migrations, backups). Never prints secrets.';

    /**
     * SHA-256 fingerprints of APP_KEY values that are publicly known because they are
     * committed to the repository for local Docker development (.env.docker.example).
     * Only fingerprints are stored so the key itself is not duplicated in code.
     */
    private const PUBLIC_DEV_APP_KEY_FINGERPRINTS = [
        '9ee66ab43611ea076fe61e9b20dbc400bb9a039fdd8487a65344e5642fd68ec8',
    ];

    private const MAX_ABSOLUTE_TOKEN_MINUTES = 720;

    private const BACKUP_STALE_HOURS = 36;

    /** @var list<array{0: string, 1: string, 2: string}> */
    private array $results = [];

    public function handle(): int
    {
        $isProduction = app()->environment('production');

        $this->checkEnvironment($isProduction);
        $this->checkAppKey($isProduction);
        $this->checkHttpsAndProxies($isProduction);
        $this->checkCors($isProduction);
        $this->checkSessionAndTokens($isProduction);
        $this->checkSmsSafety($isProduction);
        $this->checkLogging($isProduction);
        $databaseReachable = $this->checkDatabase();

        if ($databaseReachable) {
            $this->checkMigrations();
            $this->checkReferenceDataAndAdmin();
        }

        $this->checkLocalBackups();

        $this->table(['Check', 'Status', 'Detail'], $this->results);

        $failures = count(array_filter($this->results, fn (array $row): bool => $row[1] === 'FAIL'));
        $warnings = count(array_filter($this->results, fn (array $row): bool => $row[1] === 'WARN'));

        if ($failures > 0) {
            $this->error("Maintenance check failed: {$failures} failure(s), {$warnings} warning(s).");

            return self::FAILURE;
        }

        $this->info("Maintenance check passed with {$warnings} warning(s).");

        return self::SUCCESS;
    }

    private function record(string $check, string $status, string $detail): void
    {
        $this->results[] = [$check, $status, $detail];
    }

    private function checkEnvironment(bool $isProduction): void
    {
        $this->record('Environment', 'INFO', 'APP_ENV='.app()->environment());

        if ($isProduction && config('app.debug')) {
            $this->record('Debug mode', 'FAIL', 'APP_DEBUG must be false in production (stack traces would expose internals).');
        } else {
            $this->record('Debug mode', config('app.debug') ? 'WARN' : 'PASS', config('app.debug') ? 'APP_DEBUG is enabled (acceptable only for local development).' : 'APP_DEBUG is disabled.');
        }
    }

    private function checkAppKey(bool $isProduction): void
    {
        $key = (string) config('app.key');

        if ($key === '') {
            $this->record('APP_KEY', 'FAIL', 'APP_KEY is not set.');

            return;
        }

        if (in_array(hash('sha256', $key), self::PUBLIC_DEV_APP_KEY_FINGERPRINTS, true)) {
            $this->record(
                'APP_KEY',
                $isProduction ? 'FAIL' : 'WARN',
                'APP_KEY matches the publicly committed local development key. Generate a unique key for any non-local environment.'
            );

            return;
        }

        $this->record('APP_KEY', 'PASS', 'APP_KEY is set and is not a known public development key (value not shown).');
    }

    private function checkHttpsAndProxies(bool $isProduction): void
    {
        $appUrl = (string) config('app.url');
        $usesHttps = str_starts_with(strtolower($appUrl), 'https://');

        if ($isProduction) {
            $this->record('APP_URL scheme', $usesHttps ? 'PASS' : 'WARN', $usesHttps ? 'APP_URL uses https.' : 'APP_URL should use https in production.');
            $this->record(
                'Trusted proxies',
                filled(config('app.trusted_proxies')) ? 'PASS' : 'WARN',
                filled(config('app.trusted_proxies'))
                    ? 'TRUSTED_PROXIES is configured.'
                    : 'TRUSTED_PROXIES is not set; audit-log IPs and rate limits may use the proxy address.'
            );
        } else {
            $this->record('APP_URL scheme', 'INFO', $usesHttps ? 'APP_URL uses https.' : 'APP_URL uses http (acceptable locally).');
        }
    }

    private function checkCors(bool $isProduction): void
    {
        $origins = (array) config('cors.allowed_origins', []);

        if (in_array('*', $origins, true)) {
            $this->record('CORS origins', $isProduction ? 'FAIL' : 'WARN', 'CORS_ALLOWED_ORIGINS contains a wildcard (*).');

            return;
        }

        $this->record('CORS origins', 'PASS', count($origins).' explicit origin(s) configured; no wildcard.');
    }

    private function checkSessionAndTokens(bool $isProduction): void
    {
        $expiration = config('sanctum.expiration');
        $expirationOk = is_numeric($expiration) && (int) $expiration > 0 && (int) $expiration <= self::MAX_ABSOLUTE_TOKEN_MINUTES;
        $this->record(
            'Token absolute expiry',
            $expirationOk ? 'PASS' : 'FAIL',
            $expirationOk
                ? 'Sanctum tokens expire after '.(int) $expiration.' minute(s) (max '.self::MAX_ABSOLUTE_TOKEN_MINUTES.').'
                : 'SANCTUM_TOKEN_EXPIRATION must be between 1 and '.self::MAX_ABSOLUTE_TOKEN_MINUTES.' minutes.'
        );

        $lastUsedAtDisabled = config('sanctum.last_used_at') === false;
        $this->record(
            'Idle-timeout tracking',
            $lastUsedAtDisabled ? 'PASS' : 'FAIL',
            $lastUsedAtDisabled
                ? 'Automatic Sanctum last_used_at updates are disabled (idle timeout counts genuine activity only).'
                : 'sanctum.last_used_at must be false so background polling cannot keep idle sessions alive.'
        );

        if ($isProduction) {
            $secure = (bool) config('session.secure');
            $this->record('Secure cookies', $secure ? 'PASS' : 'WARN', $secure ? 'Session cookies are marked Secure.' : 'SESSION_SECURE_COOKIE should be true in production.');
        }
    }

    private function checkSmsSafety(bool $isProduction): void
    {
        $liveEnabled = filter_var(config('services.sms.enabled'), FILTER_VALIDATE_BOOLEAN);
        $this->record('SMS live sending', 'INFO', $liveEnabled ? 'Live SMS sending is ENABLED.' : 'Live SMS sending is disabled (simulation mode).');

        $allowDbCredentials = filter_var(config('services.sms.allow_database_credentials'), FILTER_VALIDATE_BOOLEAN);
        if ($isProduction && $allowDbCredentials) {
            $this->record('SMS credential storage', 'WARN', 'SMS_ALLOW_DB_CREDENTIALS=true allows plaintext SMS credentials in the database. Prefer environment variables.');
        } else {
            $this->record('SMS credential storage', 'PASS', 'SMS credentials are expected from environment variables only.');
        }
    }

    private function checkLogging(bool $isProduction): void
    {
        if (! $isProduction) {
            return;
        }

        $level = strtolower((string) config('logging.channels.'.config('logging.default').'.level', env('LOG_LEVEL', 'debug')));
        $this->record('Log level', $level === 'debug' ? 'WARN' : 'PASS', $level === 'debug' ? 'LOG_LEVEL=debug in production may log excessive detail; use info.' : 'LOG_LEVEL='.$level.'.');
    }

    private function checkDatabase(): bool
    {
        try {
            DB::connection()->select('select 1');
            $this->record('Database connection', 'PASS', 'Connected using driver ['.DB::connection()->getDriverName().'].');

            return true;
        } catch (Throwable) {
            // Never echo the exception message: it can contain host names or credentials.
            $this->record('Database connection', 'FAIL', 'Unable to connect to the configured database (details withheld; check provider logs).');

            return false;
        }
    }

    private function checkMigrations(): void
    {
        try {
            $migrator = app('migrator');

            if (! $migrator->repositoryExists()) {
                $this->record('Migrations', 'FAIL', 'Migration table does not exist. Run php artisan migrate --force.');

                return;
            }

            $files = array_keys($migrator->getMigrationFiles([database_path('migrations')]));
            $ran = $migrator->getRepository()->getRan();
            $pending = array_values(array_diff($files, $ran));

            $this->record(
                'Migrations',
                $pending === [] ? 'PASS' : 'WARN',
                $pending === [] ? 'All '.count($files).' migration(s) applied.' : count($pending).' pending migration(s). Take a backup, then run php artisan migrate --force.'
            );
        } catch (Throwable) {
            $this->record('Migrations', 'WARN', 'Unable to determine migration status.');
        }
    }

    private function checkReferenceDataAndAdmin(): void
    {
        if (Schema::hasTable('barangays')) {
            $barangays = DB::table('barangays')->count();
            $this->record('Reference data', $barangays > 0 ? 'PASS' : 'WARN', $barangays > 0 ? $barangays.' barangay record(s) present.' : 'No barangays found. Run ProductionReferenceSeeder.');
        }

        if (Schema::hasTable('users')) {
            $activeAdmins = User::query()
                ->where('role', 'system_admin')
                ->where('is_active', true)
                ->where('approval_status', 'approved')
                ->count();

            $this->record('System administrator', $activeAdmins > 0 ? 'PASS' : 'WARN', $activeAdmins > 0 ? $activeAdmins.' active system administrator account(s).' : 'No active system administrator. Run php artisan bitemap:create-admin.');
        }
    }

    private function checkLocalBackups(): void
    {
        $files = glob(DatabaseBackupManager::defaultBackupDirectory().DIRECTORY_SEPARATOR.'bitemap-backup-*.json') ?: [];

        if ($files === []) {
            $this->record('Local logical backups', 'WARN', 'No bitemap:backup-db files on this machine/container. Confirm an off-site or provider backup exists before migrating.');

            return;
        }

        $latest = max(array_map(fn (string $file): int => (int) @filemtime($file), $files));
        $ageHours = (int) floor((time() - $latest) / 3600);

        $this->record(
            'Local logical backups',
            $ageHours <= self::BACKUP_STALE_HOURS ? 'PASS' : 'WARN',
            count($files).' file(s) on this machine/container; newest is '.$ageHours.' hour(s) old. Local files are not off-site copies.'
        );
    }
}
