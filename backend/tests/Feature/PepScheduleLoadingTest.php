<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Incident;
use App\Models\Inventory;
use App\Models\InventoryBatch;
use App\Models\InventoryTransaction;
use App\Models\Patient;
use App\Models\PepSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PepScheduleLoadingTest extends TestCase
{
    use RefreshDatabase;

    public function test_schedule_list_is_lightweight_and_uses_bounded_queries(): void
    {
        $user = $this->actingAsRole('nurse_vaccinator');
        $barangay = Barangay::create(['name' => 'Aplaya']);
        $patient = Patient::create([
            'first_name' => 'Schedule',
            'last_name' => 'Patient',
            'full_name' => 'Schedule Patient',
            'age' => 30,
            'sex' => 'Female',
            'address' => 'Digos City',
            'barangay_id' => $barangay->id,
            'residence_barangay' => $barangay->name,
            'contact_number' => '09171234567',
            'sms_consent' => true,
        ]);
        $incident = Incident::create([
            'patient_id' => $patient->id,
            'barangay_id' => $barangay->id,
            'incident_date' => today(),
            'pep_start_date' => today(),
            'animal_type' => 'Dog',
            'bite_site' => 'Arm',
            'who_category' => 'III',
            'status' => 'Active',
        ]);
        $inventory = $this->createInventory('Anti-rabies Vaccine');
        $batch = $this->createBatch($inventory, 'ARV-001', 5, today()->addYear()->toDateString());
        $schedule = PepSchedule::create([
            'incident_id' => $incident->id,
            'dose_day' => 0,
            'scheduled_date' => today(),
            'administered_date' => today(),
            'administration_route' => 'Intradermal',
            'vaccine_type' => $inventory->item_name,
            'vaccine_lot_number' => $batch->batch_number,
            'administered_by' => $user->id,
            'inventory_batch_id' => $batch->id,
            'status' => 'Done',
        ]);
        InventoryTransaction::create([
            'inventory_id' => $inventory->id,
            'inventory_batch_id' => $batch->id,
            'pep_schedule_id' => $schedule->id,
            'transaction_type' => 'Used',
            'quantity' => 1,
            'transaction_date' => today(),
        ]);

        DB::flushQueryLog();
        DB::enableQueryLog();
        $response = $this->getJson('/api/pep-schedule')->assertOk();
        $queryCount = count(DB::getQueryLog());
        $payload = $response->json('data.0');

        $this->assertLessThanOrEqual(7, $queryCount);
        $this->assertSame($schedule->id, $payload['id']);
        $this->assertSame('Schedule Patient', $payload['patient']['full_name']);
        $this->assertSame('Aplaya', $payload['incident']['barangay']['name']);
        $this->assertTrue($payload['incident']['sms_consent']);
        $this->assertSame($user->name, $payload['administrator']['name']);
        $this->assertSame($batch->id, $payload['inventory_batch_id']);
        $this->assertSame('Recorded', $payload['inventory_linkage_status']);
        $this->assertArrayNotHasKey('created_at', $payload);
        $this->assertArrayNotHasKey('updated_at', $payload);
        $this->assertArrayNotHasKey('inventory_batch', $payload);
        $this->assertSame(
            ['id', 'first_name', 'middle_name', 'last_name', 'suffix', 'full_name', 'contact_number'],
            array_keys($payload['patient'])
        );
        $this->assertSame(
            ['id', 'pep_start_date', 'who_category', 'barangay', 'sms_consent'],
            array_keys($payload['incident'])
        );
    }

    public function test_dose_inventory_options_exclude_ineligible_unusable_and_unrelated_data(): void
    {
        $this->actingAsRole('nurse_vaccinator');
        $eligible = $this->createInventory('Verorab');
        $usable = $this->createBatch($eligible, 'VER-001', 4, today()->addYear()->toDateString());
        $this->createBatch($eligible, 'VER-EXPIRED', 3, today()->subDay()->toDateString());
        $this->createBatch($eligible, 'VER-EMPTY', 0, today()->addYear()->toDateString());
        InventoryTransaction::create([
            'inventory_id' => $eligible->id,
            'inventory_batch_id' => $usable->id,
            'transaction_type' => 'Restocked',
            'quantity' => 4,
            'transaction_date' => today(),
            'notes' => 'Must not appear in dose options.',
        ]);

        foreach (['Rabies Immunoglobulin', 'eRIG', 'Tetanus Toxoid'] as $name) {
            $ineligible = $this->createInventory($name);
            $this->createBatch($ineligible, $name.'-001', 2, today()->addYear()->toDateString());
        }
        $outOfStock = $this->createInventory('Second Anti-rabies Vaccine', 0);
        $this->createBatch($outOfStock, 'ARV-EMPTY-ITEM', 2, today()->addYear()->toDateString());

        DB::flushQueryLog();
        DB::enableQueryLog();
        $response = $this->getJson('/api/pep-schedule/dose-inventory-options')
            ->assertOk()
            ->assertJsonCount(1, 'data');
        $queryCount = count(DB::getQueryLog());
        $item = $response->json('data.0');

        $this->assertLessThanOrEqual(2, $queryCount);
        $this->assertSame(['id', 'item_name', 'current_stock', 'batches'], array_keys($item));
        $this->assertSame($eligible->id, $item['id']);
        $this->assertSame(['id', 'inventory_id', 'batch_number', 'quantity_remaining', 'expiry_date'], array_keys($item['batches'][0]));
        $this->assertSame($usable->id, $item['batches'][0]['id']);
        $this->assertArrayNotHasKey('transactions', $item);
        $this->assertArrayNotHasKey('item_type', $item);
    }

    public function test_dose_inventory_options_preserve_schedule_view_permissions(): void
    {
        $this->getJson('/api/pep-schedule/dose-inventory-options')->assertUnauthorized();

        $this->actingAsRole('doctor');
        $this->getJson('/api/pep-schedule/dose-inventory-options')->assertOk();

        $this->actingAsRole('system_admin');
        $this->getJson('/api/pep-schedule/dose-inventory-options')->assertForbidden();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create([
            'role' => $role,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    private function createInventory(string $name, int $stock = 5): Inventory
    {
        return Inventory::create([
            'item_name' => $name,
            'item_type' => 'Vaccine',
            'current_stock' => $stock,
            'unit' => 'dose',
            'reorder_level' => 1,
        ]);
    }

    private function createBatch(Inventory $inventory, string $number, int $remaining, string $expiryDate): InventoryBatch
    {
        return InventoryBatch::create([
            'inventory_id' => $inventory->id,
            'batch_number' => $number,
            'quantity_received' => max(1, $remaining),
            'quantity_remaining' => $remaining,
            'expiry_date' => $expiryDate,
            'received_date' => today(),
        ]);
    }
}
