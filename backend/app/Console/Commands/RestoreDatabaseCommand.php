<?php

namespace App\Console\Commands;

use App\Support\DatabaseBackupManager;
use Illuminate\Console\Command;
use Throwable;

class RestoreDatabaseCommand extends Command
{
    protected $signature = 'bitemap:restore-db
        {file : Path or filename of the verified BITEMAP backup file to restore}
        {--connection= : Target database connection name (use a separate recovery/test database for verification)}
        {--force : Required to overwrite a non-empty database or run in production}';

    protected $description = 'Verify and restore a BITEMAP database backup into a target connection with fail-safe guards';

    public function handle(DatabaseBackupManager $backupManager): int
    {
        $file = (string) $this->argument('file');
        $connection = $this->option('connection') ? (string) $this->option('connection') : null;
        $force = (bool) $this->option('force');

        try {
            $result = $backupManager->restoreBackup(
                file: $file,
                connection: $connection,
                force: $force,
                recordAuditLog: true,
            );
        } catch (Throwable $exception) {
            $this->error('Database restore aborted: '.$exception->getMessage());

            return self::FAILURE;
        }

        $this->info('BITEMAP database backup restored successfully.');
        $this->line('Source file: '.$result['path']);
        $this->line('Target connection: '.$result['connection']);
        $this->line('SHA-256: '.$result['sha256']);
        $this->line('Restored rows: '.$result['total_rows']);

        return self::SUCCESS;
    }
}
