<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     *
     * local/testing: unchanged developer seed (demo accounts with the documented dev password,
     * placeholder inventory, default settings).
     *
     * Anywhere else (production/staging): ONLY insert-only reference data. No users, no
     * hardcoded passwords, no inventory, and existing rows are never overwritten.
     */
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->call(ProductionReferenceSeeder::class);

            return;
        }

        $this->call([
            UserSeeder::class,
            BarangaySeeder::class,
            InventorySeeder::class,
            SettingSeeder::class,
        ]);
    }
}
