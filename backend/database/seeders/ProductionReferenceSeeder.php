<?php

namespace Database\Seeders;

use App\Models\Barangay;
use App\Models\Setting;
use App\Support\DigosBarangayCoordinates;
use Illuminate\Database\Seeder;

/**
 * Safe, repeatable initialisation of REQUIRED reference data for a real deployment.
 *
 *  - INSERT-ONLY: rows that already exist are never modified, so re-running it can not
 *    overwrite barangay coordinates or clinic settings that were edited in production.
 *  - Creates NO users, NO passwords, NO inventory/stock and NO patient data.
 *  - Live SMS reminders are seeded as disabled; enable them deliberately in Settings.
 *
 * Run:  php artisan db:seed --class=ProductionReferenceSeeder --force
 * Then: php artisan bitemap:create-admin <email>
 */
class ProductionReferenceSeeder extends Seeder
{
    public function run(): void
    {
        $barangaysCreated = 0;
        foreach (DigosBarangayCoordinates::POINTS as $name => $point) {
            $barangay = Barangay::firstOrCreate(
                ['name' => $name],
                ['latitude' => $point['lat'], 'longitude' => $point['lng']]
            );
            $barangaysCreated += $barangay->wasRecentlyCreated ? 1 : 0;
        }

        $settingsCreated = 0;
        foreach (array_merge(SettingSeeder::defaults(), ['sms_reminders_enabled' => 'false']) as $key => $value) {
            $setting = Setting::firstOrCreate(
                ['setting_key' => $key],
                ['setting_value' => $value]
            );
            $settingsCreated += $setting->wasRecentlyCreated ? 1 : 0;
        }

        $this->command?->info("Reference data ready. Barangays added: {$barangaysCreated}, settings added: {$settingsCreated} (existing rows untouched).");
        $this->command?->line('No users, passwords or inventory were created. Next: php artisan bitemap:create-admin <email>');
    }
}
