<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Barangay;
use App\Models\Incident;
use App\Models\Inventory;
use App\Models\InventoryBatch;
use App\Models\InventoryTransaction;
use App\Models\Notification;
use App\Models\Patient;
use App\Models\PepSchedule;
use App\Models\Setting;
use App\Models\User;
use App\Support\DatabaseBackupManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class BackupRecoverySecurityTest extends TestCase
{
    use RefreshDatabase;

    private string $tempBackupDir;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement('PRAGMA ignore_check_constraints = ON');
        }

        $this->tempBackupDir = storage_path('app/private/backups/test-run-'.uniqid());
        File::makeDirectory($this->tempBackupDir, 0700, true, true);
    }

    protected function tearDown(): void
    {
        if (isset($this->tempBackupDir) && is_dir($this->tempBackupDir)) {
            File::deleteDirectory($this->tempBackupDir);
        }

        parent::tearDown();
    }

    private function seedCompleteBitemapDataset(): array
    {
        $barangay = Barangay::create([
            'name' => 'Zone 1 (Pob.)',
            'latitude' => 6.7497,
            'longitude' => 125.3572,
        ]);

        $admin = User::factory()->create([
            'name' => 'System Admin',
            'email' => 'sysadmin@bitemap.test',
            'role' => 'system_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $doctor = User::factory()->create([
            'name' => 'Dr. Maria Santos',
            'email' => 'doctor@bitemap.test',
            'role' => 'doctor',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        // Create an active Sanctum token that MUST NOT be included in backups
        $admin->createToken('active-web-session');

        Setting::updateOrCreate(['setting_key' => 'session_timeout_minutes'], ['setting_value' => '30']);
        Setting::updateOrCreate(['setting_key' => 'clinic_name'], ['setting_value' => 'Digos City Animal Bite Center']);
        // Sensitive Twilio secrets in DB that MUST be stripped from backups
        Setting::updateOrCreate(['setting_key' => 'twilio_account_sid'], ['setting_value' => 'AC_SECRET_SID_99999']);
        Setting::updateOrCreate(['setting_key' => 'twilio_auth_token'], ['setting_value' => 'SUPER_SECRET_TWILIO_TOKEN_88888']);
        Setting::updateOrCreate(['setting_key' => 'twilio_from_number'], ['setting_value' => '+15005550006']);

        $patient = Patient::create([
            'full_name' => 'Juan Dela Cruz',
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'age' => 29,
            'sex' => 'Male',
            'contact_number' => '09171234567',
            'barangay_id' => $barangay->id,
            'address' => 'Purok Mangga, Zone 1',
            'sms_consent' => true,
        ]);

        $incident = Incident::create([
            'patient_id' => $patient->id,
            'barangay_id' => $barangay->id,
            'location_scope' => 'digos',
            'incident_date' => '2026-07-01',
            'animal_type' => 'Dog',
            'animal_description' => 'Stray brown dog',
            'bite_site' => 'Right Forearm',
            'who_category' => 'II',
            'location_lat' => 6.7501,
            'location_lng' => 125.3575,
            'status' => 'Active',
            'reported_by' => $doctor->id,
            'notes' => 'Wound washed for 15 minutes',
        ]);

        $inventory = Inventory::create([
            'item_name' => 'Purified Vero Cell Rabies Vaccine (PVRV)',
            'brand' => 'Verorab',
            'item_type' => 'Vaccine',
            'current_stock' => 45,
            'unit' => 'vials',
            'reorder_level' => 10,
            'expiry_date' => '2027-12-31',
            'description' => 'WHO prequalified rabies vaccine',
            'updated_by' => $admin->id,
        ]);

        $batch = InventoryBatch::create([
            'inventory_id' => $inventory->id,
            'batch_number' => 'LOT-2026-VR01',
            'quantity_received' => 50,
            'quantity_remaining' => 45,
            'expiry_date' => '2027-12-31',
            'received_date' => '2026-06-01',
            'supplier' => 'DOH Regional Warehouse',
            'created_by' => $admin->id,
        ]);

        $pepDose0 = PepSchedule::create([
            'incident_id' => $incident->id,
            'dose_day' => 0,
            'scheduled_date' => '2026-07-01',
            'administered_date' => '2026-07-01',
            'status' => 'Done',
            'vaccine_type' => 'PVRV',
            'administration_route' => 'ID',
            'inventory_batch_id' => $batch->id,
            'vaccine_lot_number' => $batch->batch_number,
            'administered_by' => $doctor->id,
        ]);

        $pepDose3 = PepSchedule::create([
            'incident_id' => $incident->id,
            'dose_day' => 3,
            'scheduled_date' => '2026-07-04',
            'status' => 'Upcoming',
            'vaccine_type' => 'PVRV',
            'administration_route' => 'ID',
        ]);

        $transaction = InventoryTransaction::create([
            'inventory_id' => $inventory->id,
            'inventory_batch_id' => $batch->id,
            'pep_schedule_id' => $pepDose0->id,
            'transaction_type' => 'Used',
            'quantity' => 1,
            'transaction_date' => '2026-07-01',
            'notes' => 'Administered Day 0 dose',
            'created_by' => $doctor->id,
        ]);

        $notification = Notification::create([
            'patient_id' => $patient->id,
            'incident_id' => $incident->id,
            'pep_schedule_id' => $pepDose3->id,
            'notification_type' => 'SMS',
            'reminder_type' => 'upcoming',
            'scheduled_date' => '2026-07-04',
            'reminder_key' => 'pep-'.$pepDose3->id.'-upcoming',
            'recipient' => '09171234567',
            'message' => 'Reminder: Day 3 anti-rabies dose scheduled on 2026-07-04.',
            'status' => 'Sent',
            'sent_at' => now(),
        ]);

        $auditLog = AuditLog::create([
            'action' => 'Create incident',
            'action_type' => 'Create incident',
            'module' => 'Incident Logging',
            'record_id' => (string) $incident->id,
            'details' => 'Created incident record #'.$incident->id.'.',
            'description' => 'Created incident record #'.$incident->id.'.',
            'user_id' => $doctor->id,
            'user_name' => $doctor->name,
            'user_role' => 'doctor',
            'ip_address' => '127.0.0.1',
        ]);

        return compact(
            'barangay',
            'admin',
            'doctor',
            'patient',
            'incident',
            'inventory',
            'batch',
            'pepDose0',
            'pepDose3',
            'transaction',
            'notification',
            'auditLog'
        );
    }

    public function test_backup_creation_and_verification_excludes_tokens_and_secrets(): void
    {
        $this->seedCompleteBitemapDataset();

        $outputPath = $this->tempBackupDir.DIRECTORY_SEPARATOR.'standard-backup.json';

        $exitCode = Artisan::call('bitemap:backup-db', [
            '--output' => $outputPath,
        ]);

        $this->assertSame(0, $exitCode);
        $this->assertFileExists($outputPath);

        $rawContents = (string) file_get_contents($outputPath);
        $this->assertStringNotContainsString('AC_SECRET_SID_99999', $rawContents);
        $this->assertStringNotContainsString('SUPER_SECRET_TWILIO_TOKEN_88888', $rawContents);
        $this->assertStringNotContainsString('active-web-session', $rawContents);

        $verifyCode = Artisan::call('bitemap:verify-backup', [
            'file' => $outputPath,
        ]);
        $this->assertSame(0, $verifyCode);

        $backupAudit = AuditLog::query()
            ->where('action', 'Create backup')
            ->where('module', 'System Maintenance')
            ->latest('id')
            ->first();

        $this->assertNotNull($backupAudit);
        $this->assertStringNotContainsString('Juan Dela Cruz', (string) $backupAudit->description);
        $this->assertStringNotContainsString('09171234567', (string) $backupAudit->description);
    }

    public function test_encrypted_backup_protects_patient_pii_at_rest_and_passes_verification(): void
    {
        $this->seedCompleteBitemapDataset();

        $outputPath = $this->tempBackupDir.DIRECTORY_SEPARATOR.'encrypted-backup.json';

        $exitCode = Artisan::call('bitemap:backup-db', [
            '--output' => $outputPath,
            '--encrypt' => true,
        ]);

        $this->assertSame(0, $exitCode);
        $this->assertFileExists($outputPath);

        $rawContents = (string) file_get_contents($outputPath);
        // Patient PII and clinical notes must NOT appear in plaintext on disk when --encrypt is used
        $this->assertStringNotContainsString('Juan Dela Cruz', $rawContents);
        $this->assertStringNotContainsString('09171234567', $rawContents);
        $this->assertStringNotContainsString('Purok Mangga', $rawContents);
        $this->assertStringNotContainsString('LOT-2026-VR01', $rawContents);

        $envelope = json_decode($rawContents, true);
        $this->assertTrue($envelope['encrypted']);

        $verifyCode = Artisan::call('bitemap:verify-backup', [
            'file' => $outputPath,
        ]);
        $this->assertSame(0, $verifyCode);
    }

    public function test_tampered_or_corrupted_backup_fails_verification_and_refuses_restore(): void
    {
        $this->seedCompleteBitemapDataset();

        $outputPath = $this->tempBackupDir.DIRECTORY_SEPARATOR.'tampered-backup.json';
        Artisan::call('bitemap:backup-db', [
            '--output' => $outputPath,
        ]);

        $envelope = json_decode((string) file_get_contents($outputPath), true);
        // Tamper with the payload without updating the SHA-256 integrity hash
        $envelope['payload'] = str_replace('Juan Dela Cruz', 'Modified Patient', (string) $envelope['payload']);
        file_put_contents($outputPath, json_encode($envelope, JSON_PRETTY_PRINT));

        $verifyCode = Artisan::call('bitemap:verify-backup', [
            'file' => $outputPath,
        ]);
        $this->assertSame(1, $verifyCode);

        $restoreCode = Artisan::call('bitemap:restore-db', [
            'file' => $outputPath,
            '--force' => true,
        ]);
        $this->assertSame(1, $restoreCode);
    }

    public function test_restore_into_isolated_test_database_recovers_all_bitemap_tables(): void
    {
        $seeded = $this->seedCompleteBitemapDataset();

        $outputPath = $this->tempBackupDir.DIRECTORY_SEPARATOR.'recovery-test.encrypted.json';
        $this->assertSame(0, Artisan::call('bitemap:backup-db', [
            '--output' => $outputPath,
            '--encrypt' => true,
        ]));

        // Configure a completely separate isolated SQLite database for recovery verification
        $isolatedSqlitePath = $this->tempBackupDir.DIRECTORY_SEPARATOR.'isolated_recovery.sqlite';
        touch($isolatedSqlitePath);

        Config::set('database.connections.sqlite_recovery', [
            'driver' => 'sqlite',
            'database' => $isolatedSqlitePath,
            'prefix' => '',
            'foreign_key_constraints' => true,
        ]);

        // Run migrations on the isolated recovery database
        $this->assertSame(0, Artisan::call('migrate', [
            '--database' => 'sqlite_recovery',
            '--force' => true,
        ]));

        // Restore the encrypted backup into the empty isolated database (no --force needed when empty)
        $restoreCode = Artisan::call('bitemap:restore-db', [
            'file' => $outputPath,
            '--connection' => 'sqlite_recovery',
        ]);
        $this->assertSame(0, $restoreCode, Artisan::output());

        $recoveryDb = DB::connection('sqlite_recovery');

        $this->assertSame(1, $recoveryDb->table('barangays')->count());
        $this->assertSame(2, $recoveryDb->table('users')->count());
        $this->assertSame(1, $recoveryDb->table('patients')->where('full_name', 'Juan Dela Cruz')->count());
        $this->assertSame(1, $recoveryDb->table('incidents')->where('bite_site', 'Right Forearm')->count());
        $this->assertSame(2, $recoveryDb->table('pep_schedules')->where('incident_id', $seeded['incident']->id)->count());
        $this->assertSame(1, $recoveryDb->table('inventory')->where('brand', 'Verorab')->count());
        $this->assertSame(1, $recoveryDb->table('inventory_batches')->where('batch_number', 'LOT-2026-VR01')->count());
        $this->assertSame(1, $recoveryDb->table('inventory_transactions')->count());
        $this->assertSame(1, $recoveryDb->table('notifications')->where('recipient', '09171234567')->count());
        $this->assertSame('30', $recoveryDb->table('settings')->where('setting_key', 'session_timeout_minutes')->value('setting_value'));

        // Sensitive Twilio settings and personal_access_tokens must NOT exist in the restored DB
        $this->assertSame(0, $recoveryDb->table('settings')->whereIn('setting_key', DatabaseBackupManager::REDACTED_SETTING_KEYS)->count());
        $this->assertSame(0, $recoveryDb->table('personal_access_tokens')->count());

        // Post-restore audit log entry must be recorded
        $this->assertSame(1, $recoveryDb->table('audit_logs')->where('action', 'Restore backup')->count());

        DB::purge('sqlite_recovery');
    }

    public function test_restore_refuses_to_overwrite_non_empty_database_or_production_without_force(): void
    {
        $this->seedCompleteBitemapDataset();

        $outputPath = $this->tempBackupDir.DIRECTORY_SEPARATOR.'guard-test.json';
        Artisan::call('bitemap:backup-db', [
            '--output' => $outputPath,
        ]);

        // 1. Non-empty database without --force must fail safely
        $nonEmptyRestoreCode = Artisan::call('bitemap:restore-db', [
            'file' => $outputPath,
        ]);
        $this->assertSame(1, $nonEmptyRestoreCode);

        // 2. Production environment without --force must fail safely
        $originalEnv = $this->app['env'];
        $this->app['env'] = 'production';

        try {
            $prodRestoreCode = Artisan::call('bitemap:restore-db', [
                'file' => $outputPath,
            ]);
            $this->assertSame(1, $prodRestoreCode);
        } finally {
            $this->app['env'] = $originalEnv;
        }
    }
}
