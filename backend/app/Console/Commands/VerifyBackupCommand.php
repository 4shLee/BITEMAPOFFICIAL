<?php

namespace App\Console\Commands;

use App\Support\DatabaseBackupManager;
use Illuminate\Console\Command;
use Throwable;

class VerifyBackupCommand extends Command
{
    protected $signature = 'bitemap:verify-backup
        {file : Path or filename of the BITEMAP backup file to verify}';

    protected $description = 'Verify the structure, encryption, SHA-256 integrity hash, and table counts of a BITEMAP backup file';

    public function handle(DatabaseBackupManager $backupManager): int
    {
        $file = (string) $this->argument('file');

        try {
            $verification = $backupManager->verifyBackup($file);
        } catch (Throwable $exception) {
            $this->error('Backup verification failed: '.$exception->getMessage());

            return self::FAILURE;
        }

        $this->info('Backup verification passed.');
        $this->line('File: '.$verification['path']);
        $this->line('Created at: '.$verification['created_at']);
        $this->line('Encrypted: '.($verification['encrypted'] ? 'Yes (AES-256)' : 'No'));
        $this->line('SHA-256: '.$verification['sha256']);
        $this->line('Total verified rows: '.$verification['total_rows']);

        return self::SUCCESS;
    }
}
