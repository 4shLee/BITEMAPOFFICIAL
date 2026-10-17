<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Inventory;
use App\Models\Setting;
use App\Models\User;
use App\Support\DigosBarangayCoordinates;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\InventorySeeder;
use Database\Seeders\ProductionReferenceSeeder;
use Database\Seeders\SettingSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class ProductionSeedingSafetyTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seeder_in_production_creates_no_users_and_no_inventory(): void
    {
        $this->app['env'] = 'production';

        (new DatabaseSeeder)->setContainer($this->app)->__invoke();

        $this->assertSame(0, User::count(), 'production seeding must never create accounts');
        $this->assertSame(0, Inventory::count(), 'production seeding must never fabricate stock');
        $this->assertSame(count(DigosBarangayCoordinates::POINTS), Barangay::count());
        $this->assertSame('false', Setting::where('setting_key', 'sms_reminders_enabled')->value('setting_value'));
    }

    public function test_db_seed_command_in_production_only_adds_reference_data(): void
    {
        $this->app['env'] = 'production';

        $this->artisan('db:seed', ['--force' => true])->assertSuccessful();

        $this->assertSame(0, User::count());
        $this->assertSame(0, Inventory::count());
        $this->assertGreaterThan(0, Barangay::count());
    }

    public function test_reference_seeder_never_overwrites_existing_settings_or_barangays(): void
    {
        $name = array_key_first(DigosBarangayCoordinates::POINTS);
        Barangay::create(['name' => $name, 'latitude' => 1.5, 'longitude' => 2.5]);
        Setting::create(['setting_key' => 'clinic_name', 'setting_value' => 'Edited In Production']);
        Setting::create(['setting_key' => 'sms_reminders_enabled', 'setting_value' => 'true']);

        foreach ([1, 2] as $run) {
            (new ProductionReferenceSeeder)->setContainer($this->app)->run();
        }

        $this->assertSame('Edited In Production', Setting::where('setting_key', 'clinic_name')->value('setting_value'));
        $this->assertSame('true', Setting::where('setting_key', 'sms_reminders_enabled')->value('setting_value'));
        $barangay = Barangay::where('name', $name)->firstOrFail();
        $this->assertEquals(1.5, (float) $barangay->latitude);
        $this->assertEquals(2.5, (float) $barangay->longitude);
        $this->assertSame(1, Barangay::where('name', $name)->count());
        $this->assertSame(1, Setting::where('setting_key', 'clinic_name')->count());
    }

    public function test_destructive_legacy_seeders_refuse_to_run_in_production(): void
    {
        $this->app['env'] = 'production';
        Setting::create(['setting_key' => 'clinic_name', 'setting_value' => 'Keep Me']);

        foreach ([UserSeeder::class, InventorySeeder::class, SettingSeeder::class] as $seeder) {
            try {
                (new $seeder)->setContainer($this->app)->run();
                $this->fail($seeder.' ran in production');
            } catch (RuntimeException $exception) {
                $this->assertStringContainsString('restricted to local and testing', $exception->getMessage());
            }
        }

        $this->assertSame(0, User::count());
        $this->assertSame(0, Inventory::count());
        $this->assertSame('Keep Me', Setting::where('setting_key', 'clinic_name')->value('setting_value'));
    }

    public function test_db_seed_with_a_legacy_seeder_class_is_blocked_in_production(): void
    {
        $this->app['env'] = 'production';

        $this->expectException(RuntimeException::class);

        $this->artisan('db:seed', ['--class' => UserSeeder::class, '--force' => true]);
    }

    public function test_local_and_testing_seeding_behaviour_is_preserved(): void
    {
        // The suite runs with APP_ENV=testing.
        (new DatabaseSeeder)->setContainer($this->app)->__invoke();

        $this->assertDatabaseHas('users', ['email' => 'admin@bitemap.local', 'role' => 'system_admin']);
        $this->assertSame(5, Inventory::count());
        $this->assertSame('true', Setting::where('setting_key', 'sms_reminders_enabled')->value('setting_value'));
    }
}
