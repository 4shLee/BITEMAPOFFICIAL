<?php

namespace App\Console\Commands;

use App\Support\DatabaseBackupManager;
use Illuminate\Console\Command;
use Throwable;

class BackupDatabaseCommand extends Command
{
    protected $signature = 'bitemap:backup-db
        {--connection= : Source database connection name}
        {--output= : Optional explicit file path for the generated backup}
        {--encrypt : Encrypt the backup payload at rest using APP_KEY (AES-256)}
        {--keep=14 : Number of recent backups to keep in storage/app/private/backups}';

    protected $description = 'Create an integrity-verified logical backup of all BITEMAP operational, clinical, and audit tables';

    public function handle(DatabaseBackupManager $backupManager): int
    {
        $connection = $this->option('connection') ? (string) $this->option('connection') : null;
        $output = $this->option('output') ? (string) $this->option('output') : null;
        $encrypt = (bool) $this->option('encrypt');
        $keep = max(1, (int) $this->option('keep'));

        try {
            $result = $backupManager->createBackup(
                connection: $connection,
                outputPath: $output,
                encrypt: $encrypt,
                keep: $keep,
                recordAuditLog: true,
            );
        } catch (Throwable $exception) {
            $this->error('Backup failed: '.$exception->getMessage());

            return self::FAILURE;
        }

        $this->info('BITEMAP database backup created successfully.');
        $this->line('File: '.$result['path']);
        $this->line('Encrypted: '.($result['encrypted'] ? 'Yes (AES-256)' : 'No'));
        $this->line('SHA-256: '.$result['sha256']);
        $this->line('Total rows: '.$result['total_rows']);

        if ($result['pruned_files'] > 0) {
            $this->line('Pruned older backups: '.$result['pruned_files']);
        }

        return self::SUCCESS;
    }
}
