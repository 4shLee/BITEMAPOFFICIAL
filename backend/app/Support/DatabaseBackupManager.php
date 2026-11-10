<?php

namespace App\Support;

use App\Models\AuditLog;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class DatabaseBackupManager
{
    public const FORMAT_VERSION = 'bitemap-logical-backup-v1';

    /**
     * Core BITEMAP tables ordered by foreign-key parent -> child dependencies.
     *
     * @var list<string>
     */
    public const BACKUP_TABLES = [
        'barangays',
        'users',
        'settings',
        'patients',
        'incidents',
        'inventory',
        'inventory_batches',
        'pep_schedules',
        'inventory_transactions',
        'notifications',
        'audit_logs',
    ];

    /**
     * Ephemeral or authentication-token tables intentionally excluded from backups
     * so restoring a snapshot never resurrects expired or revoked bearer tokens.
     *
     * @var list<string>
     */
    public const EXCLUDED_TABLES = [
        'personal_access_tokens',
        'password_reset_tokens',
        'sessions',
        'cache',
        'cache_locks',
        'jobs',
        'job_batches',
        'failed_jobs',
    ];

    /**
     * Sensitive setting keys that must never be written into backup files.
     *
     * @var list<string>
     */
    public const REDACTED_SETTING_KEYS = [
        'twilio_account_sid',
        'twilio_auth_token',
        'twilio_from_number',
    ];

    public static function defaultBackupDirectory(): string
    {
        return storage_path('app/private/backups');
    }

    /**
     * Resolve a backup path (accepts absolute path, relative path, or filename in default backup directory).
     */
    public function resolveBackupPath(string $file): string
    {
        $trimmed = trim($file);
        if ($trimmed === '') {
            throw new RuntimeException('Backup file path cannot be empty.');
        }

        if (is_file($trimmed)) {
            return realpath($trimmed) ?: $trimmed;
        }

        $inDefaultDir = self::defaultBackupDirectory().DIRECTORY_SEPARATOR.basename($trimmed);
        if (is_file($inDefaultDir)) {
            return realpath($inDefaultDir) ?: $inDefaultDir;
        }

        return $trimmed;
    }

    /**
     * Create a logical BITEMAP backup with SHA-256 integrity manifest and optional AES-256 encryption.
     *
     * @return array{
     *     path: string,
     *     filename: string,
     *     encrypted: bool,
     *     sha256: string,
     *     table_counts: array<string, int>,
     *     total_rows: int,
     *     pruned_files: int
     * }
     */
    public function createBackup(
        ?string $connection = null,
        ?string $outputPath = null,
        bool $encrypt = false,
        int $keep = 14,
        bool $recordAuditLog = true
    ): array {
        $conn = DB::connection($connection);

        foreach (self::BACKUP_TABLES as $table) {
            if (! Schema::connection($connection)->hasTable($table)) {
                throw new RuntimeException("Required BITEMAP table [{$table}] does not exist on connection [".($connection ?? config('database.default')).'].');
            }
        }

        $tablesData = [];
        $tableCounts = [];
        $totalRows = 0;

        foreach (self::BACKUP_TABLES as $table) {
            $query = $conn->table($table);

            if (Schema::connection($connection)->hasColumn($table, 'id')) {
                $query->orderBy('id');
            }

            if ($table === 'settings') {
                $query->whereNotIn('setting_key', self::REDACTED_SETTING_KEYS);
            }

            $rows = $query->get()
                ->map(fn ($row): array => (array) $row)
                ->values()
                ->all();

            $tablesData[$table] = $rows;
            $count = count($rows);
            $tableCounts[$table] = $count;
            $totalRows += $count;
        }

        $createdAt = now()->utc()->toIso8601String();

        $payloadArray = [
            'schema_version' => 1,
            'application' => 'BITEMAP',
            'created_at' => $createdAt,
            'table_counts' => $tableCounts,
            'total_rows' => $totalRows,
            'excluded_tables' => self::EXCLUDED_TABLES,
            'redacted_setting_keys' => self::REDACTED_SETTING_KEYS,
            'tables' => $tablesData,
        ];

        $payloadJson = json_encode($payloadArray, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $sha256 = hash('sha256', $payloadJson);

        $envelope = [
            'format' => self::FORMAT_VERSION,
            'application' => 'BITEMAP',
            'created_at' => $createdAt,
            'encrypted' => $encrypt,
            'sha256' => $sha256,
            'table_counts' => $tableCounts,
            'total_rows' => $totalRows,
            'excluded_tables' => self::EXCLUDED_TABLES,
            'redacted_setting_keys' => self::REDACTED_SETTING_KEYS,
            'payload' => $encrypt ? Crypt::encryptString($payloadJson) : $payloadJson,
        ];

        $targetPath = $this->prepareTargetFilePath($outputPath, $encrypt);
        $encodedEnvelope = json_encode($envelope, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

        if (file_put_contents($targetPath, $encodedEnvelope, LOCK_EX) === false) {
            throw new RuntimeException("Unable to write backup file to [{$targetPath}].");
        }

        @chmod($targetPath, 0600);

        $prunedFiles = 0;
        if ($outputPath === null && $keep > 0) {
            $prunedFiles = $this->pruneOldBackups(self::defaultBackupDirectory(), $keep);
        }

        $filename = basename($targetPath);

        if ($recordAuditLog && Schema::connection($connection)->hasTable('audit_logs')) {
            $modeLabel = $encrypt ? 'encrypted' : 'standard';
            $checksumPrefix = substr($sha256, 0, 12);
            $summary = "Created {$modeLabel} database backup {$filename} ({$totalRows} rows across ".count(self::BACKUP_TABLES)." tables, sha256: {$checksumPrefix}).";

            $conn->table('audit_logs')->insert([
                'action' => 'Create backup',
                'action_type' => 'Create backup',
                'module' => 'System Maintenance',
                'record_id' => $filename,
                'details' => $summary,
                'description' => $summary,
                'user_id' => null,
                'user_name' => 'System',
                'user_role' => 'system_admin',
                'ip_address' => '127.0.0.1',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return [
            'path' => $targetPath,
            'filename' => $filename,
            'encrypted' => $encrypt,
            'sha256' => $sha256,
            'table_counts' => $tableCounts,
            'total_rows' => $totalRows,
            'pruned_files' => $prunedFiles,
        ];
    }

    /**
     * Verify backup file structure, decryption, SHA-256 checksum, required BITEMAP tables, and row counts.
     *
     * @return array{
     *     valid: bool,
     *     path: string,
     *     encrypted: bool,
     *     sha256: string,
     *     created_at: string,
     *     table_counts: array<string, int>,
     *     total_rows: int,
     *     payload: array<string, mixed>
     * }
     */
    public function verifyBackup(string $file): array
    {
        $resolvedPath = $this->resolveBackupPath($file);

        if (! is_file($resolvedPath)) {
            throw new RuntimeException("Backup file [{$file}] does not exist.");
        }

        $rawContents = file_get_contents($resolvedPath);
        if ($rawContents === false || trim($rawContents) === '') {
            throw new RuntimeException("Backup file [{$resolvedPath}] is empty or unreadable.");
        }

        $envelope = json_decode($rawContents, true);
        if (! is_array($envelope)) {
            throw new RuntimeException('Backup file is not valid JSON.');
        }

        if (($envelope['format'] ?? null) !== self::FORMAT_VERSION) {
            throw new RuntimeException('Unsupported or invalid BITEMAP backup format.');
        }

        $expectedSha256 = (string) ($envelope['sha256'] ?? '');
        if (! preg_match('/^[a-f0-9]{64}$/', $expectedSha256)) {
            throw new RuntimeException('Backup manifest is missing a valid SHA-256 checksum.');
        }

        $encrypted = (bool) ($envelope['encrypted'] ?? false);
        $rawPayload = $envelope['payload'] ?? null;
        if (! is_string($rawPayload) || $rawPayload === '') {
            throw new RuntimeException('Backup payload is missing or corrupted.');
        }

        if ($encrypted) {
            try {
                $payloadJson = Crypt::decryptString($rawPayload);
            } catch (DecryptException $exception) {
                throw new RuntimeException('Failed to decrypt backup payload. The file may be tampered with or APP_KEY does not match.', previous: $exception);
            }
        } else {
            $payloadJson = $rawPayload;
        }

        $actualSha256 = hash('sha256', $payloadJson);
        if (! hash_equals($expectedSha256, $actualSha256)) {
            throw new RuntimeException('Backup SHA-256 checksum mismatch. The backup file is corrupted or has been modified.');
        }

        $payload = json_decode($payloadJson, true);
        if (! is_array($payload) || ! isset($payload['tables']) || ! is_array($payload['tables'])) {
            throw new RuntimeException('Decoded backup payload does not contain a valid tables structure.');
        }

        $manifestCounts = $envelope['table_counts'] ?? null;
        if (! is_array($manifestCounts)) {
            throw new RuntimeException('Backup manifest is missing table_counts.');
        }

        $verifiedCounts = [];
        $totalRows = 0;

        foreach (self::BACKUP_TABLES as $requiredTable) {
            if (! array_key_exists($requiredTable, $payload['tables']) || ! is_array($payload['tables'][$requiredTable])) {
                throw new RuntimeException("Backup payload is missing required BITEMAP table [{$requiredTable}].");
            }

            $actualRowCount = count($payload['tables'][$requiredTable]);
            $expectedRowCount = isset($manifestCounts[$requiredTable]) ? (int) $manifestCounts[$requiredTable] : -1;

            if ($actualRowCount !== $expectedRowCount) {
                throw new RuntimeException(
                    "Row count mismatch for table [{$requiredTable}]: manifest declared {$expectedRowCount}, payload contains {$actualRowCount}."
                );
            }

            $verifiedCounts[$requiredTable] = $actualRowCount;
            $totalRows += $actualRowCount;
        }

        if (array_key_exists('personal_access_tokens', $payload['tables'])) {
            throw new RuntimeException('Backup payload must not contain personal_access_tokens.');
        }

        return [
            'valid' => true,
            'path' => $resolvedPath,
            'encrypted' => $encrypted,
            'sha256' => $actualSha256,
            'created_at' => (string) ($envelope['created_at'] ?? ''),
            'table_counts' => $verifiedCounts,
            'total_rows' => $totalRows,
            'payload' => $payload,
        ];
    }

    /**
     * Restore a verified backup into the target database connection with fail-safe guards.
     *
     * @return array{
     *     path: string,
     *     connection: string,
     *     sha256: string,
     *     table_counts: array<string, int>,
     *     total_rows: int
     * }
     */
    public function restoreBackup(
        string $file,
        ?string $connection = null,
        bool $force = false,
        bool $recordAuditLog = true
    ): array {
        if (app()->environment('production') && ! $force) {
            throw new RuntimeException('Refusing to restore over a production environment database without --force.');
        }

        $verification = $this->verifyBackup($file);
        $targetConnectionName = $connection ?: (string) config('database.default');
        $conn = DB::connection($targetConnectionName);

        foreach (self::BACKUP_TABLES as $table) {
            if (! Schema::connection($targetConnectionName)->hasTable($table)) {
                throw new RuntimeException("Target connection [{$targetConnectionName}] is missing required table [{$table}]. Run migrations first.");
            }
        }

        if (! $force && $this->targetDatabaseHasExistingData($targetConnectionName)) {
            throw new RuntimeException(
                "Target database on connection [{$targetConnectionName}] is not empty. Restore into a separate test/recovery connection or pass --force to overwrite."
            );
        }

        /** @var array<string, list<array<string, mixed>>> $tables */
        $tables = $verification['payload']['tables'];
        $isSqlite = $conn->getDriverName() === 'sqlite';

        Schema::connection($targetConnectionName)->disableForeignKeyConstraints();
        if ($isSqlite) {
            $conn->statement('PRAGMA ignore_check_constraints = ON');
        }

        try {
            $conn->transaction(function () use ($conn, $targetConnectionName, $tables): void {
                if (Schema::connection($targetConnectionName)->hasTable('personal_access_tokens')) {
                    $conn->table('personal_access_tokens')->delete();
                }

                foreach (array_reverse(self::BACKUP_TABLES) as $table) {
                    $conn->table($table)->delete();
                }

                foreach (self::BACKUP_TABLES as $table) {
                    $rows = $tables[$table] ?? [];
                    if ($rows === []) {
                        continue;
                    }

                    if ($table === 'settings') {
                        $rows = array_values(array_filter(
                            $rows,
                            fn (array $row): bool => ! in_array((string) ($row['setting_key'] ?? ''), self::REDACTED_SETTING_KEYS, true)
                        ));
                    }

                    foreach (array_chunk($rows, 200) as $chunk) {
                        $conn->table($table)->insert($chunk);
                    }
                }
            });
        } finally {
            Schema::connection($targetConnectionName)->enableForeignKeyConstraints();
        }

        if ($recordAuditLog && Schema::connection($targetConnectionName)->hasTable('audit_logs')) {
            $filename = basename($verification['path']);
            $checksumPrefix = substr($verification['sha256'], 0, 12);
            $summary = "Restored database backup {$filename} ({$verification['total_rows']} rows across ".count(self::BACKUP_TABLES)." tables, sha256: {$checksumPrefix}).";

            $conn->table('audit_logs')->insert([
                'action' => 'Restore backup',
                'action_type' => 'Restore backup',
                'module' => 'System Maintenance',
                'record_id' => $filename,
                'details' => $summary,
                'description' => $summary,
                'user_id' => null,
                'user_name' => 'System',
                'user_role' => 'system_admin',
                'ip_address' => '127.0.0.1',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return [
            'path' => $verification['path'],
            'connection' => $targetConnectionName,
            'sha256' => $verification['sha256'],
            'table_counts' => $verification['table_counts'],
            'total_rows' => $verification['total_rows'],
        ];
    }

    private function targetDatabaseHasExistingData(string $connection): bool
    {
        $conn = DB::connection($connection);

        foreach (['users', 'patients', 'incidents', 'pep_schedules', 'inventory'] as $sentinelTable) {
            if (Schema::connection($connection)->hasTable($sentinelTable) && $conn->table($sentinelTable)->exists()) {
                return true;
            }
        }

        return false;
    }

    private function prepareTargetFilePath(?string $outputPath, bool $encrypt): string
    {
        if ($outputPath !== null && trim($outputPath) !== '') {
            $directory = dirname($outputPath);
            if (! is_dir($directory)) {
                File::makeDirectory($directory, 0700, true, true);
            }

            return $outputPath;
        }

        $directory = self::defaultBackupDirectory();
        if (! is_dir($directory)) {
            File::makeDirectory($directory, 0700, true, true);
        }

        $timestamp = now()->utc()->format('Ymd-His');
        $suffix = $encrypt ? '.encrypted.json' : '.json';

        return $directory.DIRECTORY_SEPARATOR."bitemap-backup-{$timestamp}{$suffix}";
    }

    private function pruneOldBackups(string $directory, int $keep): int
    {
        if (! is_dir($directory) || $keep < 1) {
            return 0;
        }

        $files = glob($directory.DIRECTORY_SEPARATOR.'bitemap-backup-*.json') ?: [];
        if (count($files) <= $keep) {
            return 0;
        }

        usort($files, function (string $a, string $b): int {
            $timeDiff = ((int) @filemtime($b)) <=> ((int) @filemtime($a));

            return $timeDiff !== 0 ? $timeDiff : strcmp($b, $a);
        });

        $toDelete = array_slice($files, $keep);
        $deleted = 0;

        foreach ($toDelete as $oldFile) {
            if (@unlink($oldFile)) {
                $deleted++;
            }
        }

        return $deleted;
    }
}
