<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Incident;
use App\Models\Inventory;
use App\Models\InventoryBatch;
use App\Models\Patient;
use App\Models\PepSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class PepDoseInventoryWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-07-20 09:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_recording_a_valid_dose_preserves_batch_traceability_and_deducts_inventory(): void
    {
        $user = $this->actingAsRole('clinic_admin');
        [$schedule, $inventory, $batch] = $this->createDoseInventoryContext($user);

        $this->recordDose($schedule, $inventory, $batch, ['remarks' => 'Dose administered normally.'])
            ->assertOk()
            ->assertJsonPath('message', 'Dose recorded and vaccine inventory updated.')
            ->assertJsonPath('inventory_automatically_deducted', true)
            ->assertJsonPath('data.status', 'Done')
            ->assertJsonPath('data.administration_route', 'Intradermal')
            ->assertJsonPath('data.vaccine_type', 'Anti-rabies Vaccine')
            ->assertJsonPath('data.vaccine_lot_number', 'ARV-2026-001')
            ->assertJsonPath('data.inventory_batch_id', $batch->id)
            ->assertJsonPath('data.inventory_linkage_status', 'Recorded');

        $recorded = $schedule->fresh();
        $this->assertSame('Done', $recorded->status);
        $this->assertSame('2026-07-20', $recorded->administered_date->toDateString());
        $this->assertSame('Intradermal', $recorded->administration_route);
        $this->assertSame($user->id, $recorded->administered_by);
        $this->assertSame('Anti-rabies Vaccine', $recorded->vaccine_type);
        $this->assertSame('ARV-2026-001', $recorded->vaccine_lot_number);
        $this->assertSame($batch->id, $recorded->inventory_batch_id);
        $this->assertSame('Dose administered normally.', $recorded->notes);
        $this->assertInventoryWasDeducted($schedule, $inventory, $batch, 4, 4);
        $this->assertDatabaseHas('audit_logs', [
            'module' => 'PEP Schedule',
            'record_id' => (string) $schedule->id,
            'action_type' => 'Mark vaccination as completed',
        ]);
    }

    #[DataProvider('allowedRoleProvider')]
    public function test_authorized_clinic_roles_can_record_doses(string $role): void
    {
        $user = $this->actingAsRole($role);
        [$schedule, $inventory, $batch] = $this->createDoseInventoryContext($user);

        $this->recordDose($schedule, $inventory, $batch)->assertOk();
        $this->assertSame($user->id, $schedule->fresh()->administered_by);
        $this->assertInventoryWasDeducted($schedule, $inventory, $batch, 4, 4);
    }

    public static function allowedRoleProvider(): array
    {
        return [['clinic_admin'], ['nurse_vaccinator']];
    }

    #[DataProvider('viewOnlyRoleProvider')]
    public function test_doctor_and_system_administrator_cannot_record_doses(string $role): void
    {
        $user = $this->actingAsRole($role);
        [$schedule, $inventory, $batch] = $this->createDoseInventoryContext($user);

        $this->recordDose($schedule, $inventory, $batch)->assertForbidden();
        $this->assertDoseWasNotRecorded($schedule);
        $this->assertInventoryWasNotMutated($inventory, $batch, 5, 5);
    }

    public static function viewOnlyRoleProvider(): array
    {
        return [['doctor'], ['system_admin']];
    }

    #[DataProvider('routeProvider')]
    public function test_supported_administration_routes_are_stored(string $route): void
    {
        $user = $this->actingAsRole('nurse_vaccinator');
        [$schedule, $inventory, $batch] = $this->createDoseInventoryContext($user);

        $this->recordDose($schedule, $inventory, $batch, ['administration_route' => $route])
            ->assertOk()
            ->assertJsonPath('data.administration_route', $route);

        $this->assertSame($route, $schedule->fresh()->administration_route);
        $this->assertInventoryWasDeducted($schedule, $inventory, $batch, 4, 4);
    }

    public static function routeProvider(): array
    {
        return [['Intradermal'], ['Intramuscular']];
    }

    #[DataProvider('missingRequiredFieldProvider')]
    public function test_missing_required_dose_fields_are_rejected(string $missingField): void
    {
        $user = $this->actingAsRole('clinic_admin');
        [$schedule, $inventory, $batch] = $this->createDoseInventoryContext($user);

        $payload = [
            'administered_date' => '2026-07-20',
            'administration_route' => 'Intradermal',
            'inventory_id' => $inventory->id,
            'inventory_batch_id' => $batch->id,
        ];
        unset($payload[$missingField]);

        $this->postJson('/api/pep-schedule/'.$schedule->id.'/record-dose', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors($missingField);

        $this->assertDoseWasNotRecorded($schedule);
        $this->assertInventoryWasNotMutated($inventory, $batch, 5, 5);
    }

    public static function missingRequiredFieldProvider(): array
    {
        return [
            'administered date' => ['administered_date'],
            'administration route' => ['administration_route'],
            'vaccine product' => ['inventory_id'],
            'vaccine batch' => ['inventory_batch_id'],
        ];
    }

    public function test_invalid_administration_route_is_rejected(): void
    {
        $user = $this->actingAsRole('clinic_admin');
        [$schedule, $inventory, $batch] = $this->createDoseInventoryContext($user);

        $this->recordDose($schedule, $inventory, $batch, ['administration_route' => 'Subcutaneous'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('administration_route');

        $this->assertDoseWasNotRecorded($schedule);
        $this->assertInventoryWasNotMutated($inventory, $batch, 5, 5);
    }

    public function test_a_dynamically_classified_vaccine_product_can_be_recorded(): void
    {
        $user = $this->actingAsRole('clinic_admin');
        [$schedule, $inventory, $batch] = $this->createDoseInventoryContext(
            $user,
            ['item_name' => 'Verorab'],
            ['batch_number' => 'VERORAB-2028-01']
        );

        $this->recordDose($schedule, $inventory, $batch)
            ->assertOk()
            ->assertJsonPath('data.vaccine_type', 'Verorab')
            ->assertJsonPath('data.vaccine_lot_number', 'VERORAB-2028-01')
            ->assertJsonPath('data.inventory_batch_id', $batch->id);

        $this->assertSame('Verorab', $schedule->fresh()->vaccine_type);
        $this->assertSame('VERORAB-2028-01', $schedule->fresh()->vaccine_lot_number);
        $this->assertInventoryWasDeducted($schedule, $inventory, $batch, 4, 4);
    }

    public function test_an_expired_batch_is_rejected_without_changes(): void
    {
        $user = $this->actingAsRole('nurse_vaccinator');
        [$schedule, $inventory, $batch] = $this->createDoseInventoryContext($user, [], ['expiry_date' => '2026-07-19']);

        $this->recordDose($schedule, $inventory, $batch)
            ->assertUnprocessable()
            ->assertJsonPath('message', 'The selected vaccine batch has expired.');

        $this->assertDoseWasNotRecorded($schedule);
        $this->assertInventoryWasNotMutated($inventory, $batch, 5, 5);
    }

    public function test_a_batch_from_another_inventory_item_is_rejected(): void
    {
        $user = $this->actingAsRole('clinic_admin');
        [$schedule, $inventory, $batch] = $this->createDoseInventoryContext($user);
        $otherInventory = Inventory::create([
            'item_name' => 'Second Anti-rabies Vaccine',
            'item_type' => 'Vaccine',
            'current_stock' => 5,
            'unit' => 'dose',
            'reorder_level' => 1,
        ]);

        $this->recordDose($schedule, $otherInventory, $batch)
            ->assertUnprocessable()
            ->assertJsonPath('message', 'The selected batch does not belong to this inventory item.');

        $this->assertDoseWasNotRecorded($schedule);
        $this->assertInventoryWasNotMutated($inventory, $batch, 5, 5);
        $this->assertSame(5, $otherInventory->fresh()->current_stock);
    }

    #[DataProvider('ineligibleInventoryProvider')]
    public function test_rig_tetanus_and_supply_inventory_cannot_be_selected(string $name, string $type): void
    {
        $user = $this->actingAsRole('clinic_admin');
        [$schedule, $inventory, $batch] = $this->createDoseInventoryContext($user, [
            'item_name' => $name,
            'item_type' => $type,
        ]);

        $this->recordDose($schedule, $inventory, $batch)->assertUnprocessable();

        $this->assertDoseWasNotRecorded($schedule);
        $this->assertInventoryWasNotMutated($inventory, $batch, 5, 5);
    }

    public static function ineligibleInventoryProvider(): array
    {
        return [
            'RIG' => ['Rabies Immunoglobulin', 'Immunoglobulin'],
            'Equine RIG catalog product' => ['Equine RIG (eRIG) — Equirab', 'Immunoglobulin'],
            'Human RIG catalog product' => ['Human RIG (hRIG) — Berirab', 'Immunoglobulin'],
            'tetanus classified as vaccine' => ['Tetanus Toxoid', 'Vaccine'],
            'tetanus catalog product' => ['Tetanus Toxoid — Abhaytox / Bett', 'Vaccine'],
            'medicine' => ['Amoxicillin', 'Medicine'],
            'supply' => ['Syringes', 'Supply'],
        ];
    }

    public function test_a_repeated_request_cannot_complete_the_dose_twice(): void
    {
        $user = $this->actingAsRole('nurse_vaccinator');
        [$schedule, $inventory, $batch] = $this->createDoseInventoryContext($user);

        $this->recordDose($schedule, $inventory, $batch)->assertOk();
        $this->recordDose($schedule, $inventory, $batch)
            ->assertConflict()
            ->assertJsonPath('message', 'This dose has already been recorded.');

        $this->assertSame(1, AuditLog::where('module', 'PEP Schedule')
            ->where('record_id', (string) $schedule->id)
            ->where('action_type', 'Mark vaccination as completed')
            ->count());
        $this->assertInventoryWasDeducted($schedule, $inventory, $batch, 4, 4);
    }

    public function test_legacy_completed_dose_without_route_or_batch_link_still_loads(): void
    {
        $user = $this->actingAsRole('clinic_admin');
        [$schedule, $inventory, $batch] = $this->createDoseInventoryContext($user, [], [], [
            'status' => 'Done',
            'administered_date' => '2026-07-19',
            'administered_by' => $user->id,
            'vaccine_lot_number' => 'LEGACY-LOT',
        ]);

        $this->getJson('/api/pep-schedule')
            ->assertOk()
            ->assertJsonPath('data.0.administration_route', null)
            ->assertJsonPath('data.0.inventory_batch_id', null)
            ->assertJsonPath('data.0.vaccine_lot_number', 'LEGACY-LOT')
            ->assertJsonPath('data.0.inventory_linkage_status', 'Unavailable / not recorded');

        $this->recordDose($schedule, $inventory, $batch)
            ->assertConflict()
            ->assertJsonPath('message', 'This dose has already been recorded.');
        $this->assertInventoryWasNotMutated($inventory, $batch, 5, 5);
    }

    public function test_future_administered_date_is_rejected_before_mutation(): void
    {
        $user = $this->actingAsRole('clinic_admin');
        [$schedule, $inventory, $batch] = $this->createDoseInventoryContext($user);

        $this->recordDose($schedule, $inventory, $batch, ['administered_date' => '2026-07-21'])
            ->assertUnprocessable();

        $this->assertDoseWasNotRecorded($schedule);
        $this->assertInventoryWasNotMutated($inventory, $batch, 5, 5);
    }

    public function test_the_general_schedule_update_endpoint_cannot_bypass_record_dose(): void
    {
        $user = $this->actingAsRole('clinic_admin');
        [$schedule, $inventory, $batch] = $this->createDoseInventoryContext($user);

        $this->putJson('/api/pep-schedule/'.$schedule->id, [
            'status' => 'Completed',
            'administered_date' => '2026-07-20',
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'Use the record-dose operation to complete a PEP dose.');

        $this->assertDoseWasNotRecorded($schedule);
        $this->assertInventoryWasNotMutated($inventory, $batch, 5, 5);
    }

    public function test_existing_manual_inventory_usage_still_works(): void
    {
        $user = $this->actingAsRole('clinic_admin');
        [, $inventory, $batch] = $this->createDoseInventoryContext($user);

        $this->putJson('/api/inventory/'.$inventory->id, [
            'current_stock' => 4,
            'inventory_batch_id' => $batch->id,
            'transaction_type' => 'Used',
            'transaction_date' => '2026-07-20',
            'notes' => 'Manual usage regression test.',
        ])->assertOk();

        $this->assertSame(4, $inventory->fresh()->current_stock);
        $this->assertSame(4, $batch->fresh()->quantity_remaining);
        $this->assertDatabaseHas('inventory_transactions', [
            'inventory_id' => $inventory->id,
            'inventory_batch_id' => $batch->id,
            'pep_schedule_id' => null,
            'transaction_type' => 'Used',
            'quantity' => 1,
        ]);
    }

    public function test_dose_inventory_options_list_eligible_products_with_matching_product_and_batch_ids(): void
    {
        $user = $this->actingAsRole('nurse_vaccinator');
        [, $inventory, $batch] = $this->createDoseInventoryContext($user);
        $secondBatch = InventoryBatch::create([
            'inventory_id' => $inventory->id,
            'batch_number' => 'ARV-2026-002',
            'quantity_received' => 3,
            'quantity_remaining' => 3,
            'expiry_date' => '2029-01-01',
            'received_date' => '2026-07-02',
            'created_by' => $user->id,
        ]);

        $response = $this->getJson('/api/pep-schedule/dose-inventory-options')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $inventory->id)
            ->assertJsonPath('data.0.item_name', 'Anti-rabies Vaccine')
            ->assertJsonCount(2, 'data.0.batches')
            ->assertJsonPath('data.0.batches.0.id', $batch->id)
            ->assertJsonPath('data.0.batches.0.inventory_id', $inventory->id)
            ->assertJsonPath('data.0.batches.1.id', $secondBatch->id)
            ->assertJsonPath('meta.unavailable', []);

        $this->assertSame([$batch->id, $secondBatch->id], collect($response->json('data.0.batches'))->pluck('id')->all());
    }

    public function test_product_with_aggregate_stock_but_no_eligible_batch_is_unavailable_with_a_reason(): void
    {
        $user = $this->actingAsRole('clinic_admin');
        [, $eligible] = $this->createDoseInventoryContext($user);

        $noBatch = Inventory::create([
            'item_name' => 'Unbatched Rabies Vaccine',
            'item_type' => 'Vaccine',
            'current_stock' => 120,
            'unit' => 'vial',
            'reorder_level' => 10,
        ]);
        $expired = Inventory::create([
            'item_name' => 'Expired Rabies Vaccine',
            'item_type' => 'Vaccine',
            'current_stock' => 4,
            'unit' => 'vial',
            'reorder_level' => 1,
        ]);
        InventoryBatch::create([
            'inventory_id' => $expired->id,
            'batch_number' => 'EXP-1',
            'quantity_received' => 4,
            'quantity_remaining' => 4,
            'expiry_date' => '2026-07-19',
            'received_date' => '2026-01-01',
        ]);
        $depleted = Inventory::create([
            'item_name' => 'Depleted Rabies Vaccine',
            'item_type' => 'Vaccine',
            'current_stock' => 2,
            'unit' => 'vial',
            'reorder_level' => 1,
        ]);
        InventoryBatch::create([
            'inventory_id' => $depleted->id,
            'batch_number' => 'DEP-1',
            'quantity_received' => 5,
            'quantity_remaining' => 0,
            'expiry_date' => '2028-01-01',
            'received_date' => '2026-01-01',
        ]);

        $response = $this->getJson('/api/pep-schedule/dose-inventory-options')->assertOk();

        $this->assertSame([$eligible->id], collect($response->json('data'))->pluck('id')->all());
        $reasons = collect($response->json('meta.unavailable'))->pluck('reason', 'id')->all();
        $this->assertSame('no_batch', $reasons[$noBatch->id]);
        $this->assertSame('batches_expired', $reasons[$expired->id]);
        $this->assertSame('batches_depleted', $reasons[$depleted->id]);
    }

    public function test_dose_inventory_options_exclude_rig_tetanus_and_supplies_and_respect_roles(): void
    {
        $user = $this->actingAsRole('doctor');
        $this->createDoseInventoryContext($user, ['item_name' => 'Rabies Immunoglobulin', 'item_type' => 'Immunoglobulin']);

        $this->getJson('/api/pep-schedule/dose-inventory-options')
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.unavailable', []);

        $this->actingAsRole('system_admin');
        $this->getJson('/api/pep-schedule/dose-inventory-options')->assertForbidden();
    }

    public function test_failed_dose_submission_creates_no_duplicate_dose_or_stock_change(): void
    {
        $user = $this->actingAsRole('nurse_vaccinator');
        [$schedule, $inventory, $batch] = $this->createDoseInventoryContext($user, [], ['quantity_remaining' => 0]);

        $this->recordDose($schedule, $inventory, $batch)
            ->assertUnprocessable()
            ->assertJsonPath('message', 'The selected vaccine batch is out of stock.');
        $this->recordDose($schedule, $inventory, $batch)->assertUnprocessable();

        $this->assertDoseWasNotRecorded($schedule);
        $this->assertSame(0, AuditLog::where('module', 'PEP Schedule')->count());
        $this->assertInventoryWasNotMutated($inventory, $batch, 5, 0);
    }

    public function test_unavailable_diagnostics_classify_mixed_batches_and_stock_mismatches_correctly(): void
    {
        $user = $this->actingAsRole('clinic_admin');

        // Eligible batch alongside expired and depleted ones: product is selectable and exposes ONLY the usable batch.
        [, $mixed, $usable] = $this->createDoseInventoryContext($user, ['item_name' => 'Mixed Batch Vaccine'], ['batch_number' => 'MIX-OK']);
        InventoryBatch::create(['inventory_id' => $mixed->id, 'batch_number' => 'MIX-EXP', 'quantity_received' => 5, 'quantity_remaining' => 5, 'expiry_date' => '2026-07-19', 'received_date' => '2026-01-01']);
        InventoryBatch::create(['inventory_id' => $mixed->id, 'batch_number' => 'MIX-EMPTY', 'quantity_received' => 5, 'quantity_remaining' => 0, 'expiry_date' => '2028-01-01', 'received_date' => '2026-01-01']);

        // Expired batch plus depleted unexpired batch: reported as depleted (an unexpired lot exists but is empty).
        $expiredAndDepleted = Inventory::create(['item_name' => 'Expired And Depleted Vaccine', 'item_type' => 'Vaccine', 'current_stock' => 3, 'unit' => 'vial', 'reorder_level' => 1]);
        InventoryBatch::create(['inventory_id' => $expiredAndDepleted->id, 'batch_number' => 'ED-EXP', 'quantity_received' => 3, 'quantity_remaining' => 3, 'expiry_date' => '2026-07-01', 'received_date' => '2026-01-01']);
        InventoryBatch::create(['inventory_id' => $expiredAndDepleted->id, 'batch_number' => 'ED-EMPTY', 'quantity_received' => 3, 'quantity_remaining' => 0, 'expiry_date' => '2028-01-01', 'received_date' => '2026-01-01']);

        // Product-level stock 0 while a lot still has stock: not selectable, flagged as a data mismatch.
        $drifted = Inventory::create(['item_name' => 'Drifted Stock Vaccine', 'item_type' => 'Vaccine', 'current_stock' => 0, 'unit' => 'vial', 'reorder_level' => 1]);
        InventoryBatch::create(['inventory_id' => $drifted->id, 'batch_number' => 'DR-1', 'quantity_received' => 4, 'quantity_remaining' => 4, 'expiry_date' => '2028-01-01', 'received_date' => '2026-01-01']);

        // Zero stock and no batches: reported as no_batch so newly created products with 0 stock are explained.
        // RIG with batches: never reported.
        $emptyNoBatch = Inventory::create(['item_name' => 'Empty Vaccine', 'item_type' => 'Vaccine', 'current_stock' => 0, 'unit' => 'vial', 'reorder_level' => 1]);
        $rig = Inventory::create(['item_name' => 'Rabies Immunoglobulin', 'item_type' => 'Vaccine', 'current_stock' => 5, 'unit' => 'vial', 'reorder_level' => 1]);

        $response = $this->getJson('/api/pep-schedule/dose-inventory-options')->assertOk();

        $this->assertSame([$mixed->id], collect($response->json('data'))->pluck('id')->all());
        $this->assertSame([$usable->id], collect($response->json('data.0.batches'))->pluck('id')->all());

        $reasons = collect($response->json('meta.unavailable'))->pluck('reason', 'id')->all();
        $this->assertSame('batches_depleted', $reasons[$expiredAndDepleted->id]);
        $this->assertSame('product_stock_zero', $reasons[$drifted->id]);
        $this->assertSame('no_batch', $reasons[$emptyNoBatch->id]);
        $this->assertCount(3, $reasons);
        $this->assertArrayNotHasKey($rig->id, $reasons);

        // A drifted product is still rejected by record-dose (aggregate stock is 0).
        [$schedule] = $this->createDoseInventoryContext($user, ['item_name' => 'Another Vaccine']);
        $driftedBatch = $drifted->batches()->first();
        $this->recordDose($schedule, $drifted, $driftedBatch)
            ->assertUnprocessable()
            ->assertJsonPath('message', 'The selected vaccine inventory item is out of stock.');
        $this->assertDoseWasNotRecorded($schedule);
    }

    public function test_options_endpoint_never_exposes_inventory_to_unauthenticated_or_unauthorized_roles(): void
    {
        $this->getJson('/api/pep-schedule/dose-inventory-options')->assertUnauthorized();

        foreach (['system_admin'] as $role) {
            $this->actingAsRole($role);
            $this->getJson('/api/pep-schedule/dose-inventory-options')
                ->assertForbidden()
                ->assertJsonMissingPath('data')
                ->assertJsonMissingPath('meta');
        }
    }

    public function test_pep_schedule_and_inventory_endpoints_still_load(): void
    {
        $user = $this->actingAsRole('doctor');
        $this->createDoseInventoryContext($user);

        $this->getJson('/api/pep-schedule')->assertOk()->assertJsonPath('success', true);
        $this->getJson('/api/inventory')->assertOk()->assertJsonPath('success', true);
    }

    public function test_end_to_end_add_vaccine_product_then_add_batch_then_record_dose_workflow(): void
    {
        $user = $this->actingAsRole('clinic_admin');
        $patient = Patient::create([
            'full_name' => 'Workflow Patient',
            'age' => 24,
            'sex' => 'Male',
            'address' => 'Digos City',
            'contact_number' => '09171234567',
        ]);
        $incident = Incident::create([
            'patient_id' => $patient->id,
            'incident_date' => '2026-07-20',
            'animal_type' => 'Dog',
            'bite_site' => 'Right hand',
            'who_category' => 'II',
            'status' => 'Active',
        ]);
        $schedule = PepSchedule::create([
            'incident_id' => $incident->id,
            'dose_day' => 0,
            'scheduled_date' => '2026-07-20',
            'status' => 'Pending',
        ]);

        // Step 1: Create Anti-Rabies Vaccine — Abhayrab product without a batch (0 opening stock).
        $createProductResponse = $this->postJson('/api/inventory', [
            'item_name' => 'Anti-Rabies Vaccine — Abhayrab',
            'item_type' => 'Vaccine',
            'current_stock' => 0,
            'unit' => 'Vials',
            'reorder_level' => 10,
            'description' => 'PEP for all bite categories.',
        ])->assertCreated()
            ->assertJsonPath('data.brand', 'Abhayrab')
            ->assertJsonPath('data.item_type', 'Vaccine')
            ->assertJsonPath('data.description', 'PEP for all bite categories.');
        $productId = $createProductResponse->json('data.id');

        // Product without a batch is reported in meta.unavailable as no_batch.
        $this->getJson('/api/pep-schedule/dose-inventory-options')
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.unavailable.0.id', $productId)
            ->assertJsonPath('meta.unavailable.0.item_name', 'Anti-Rabies Vaccine — Abhayrab')
            ->assertJsonPath('meta.unavailable.0.reason', 'no_batch');

        // Step 2: Add an unexpired batch via Add Batch / Restock.
        $addBatchResponse = $this->postJson('/api/inventory/'.$productId.'/batches', [
            'batch_number' => 'ARV-2026-101',
            'quantity_received' => 10,
            'expiry_date' => '2028-07-08',
            'received_date' => '2026-07-20',
            'supplier' => 'DOH Regional Supply',
        ])->assertCreated();
        $batchId = $addBatchResponse->json('batch.id');
        $this->assertSame(10, $addBatchResponse->json('data.current_stock'));

        // Product and batch now appear as selectable in dose-inventory-options.
        $this->getJson('/api/pep-schedule/dose-inventory-options')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $productId)
            ->assertJsonPath('data.0.batches.0.id', $batchId)
            ->assertJsonPath('data.0.batches.0.batch_number', 'ARV-2026-101')
            ->assertJsonPath('meta.unavailable', []);

        // Step 3: Record the dose using the newly added product and batch.
        $this->postJson('/api/pep-schedule/'.$schedule->id.'/record-dose', [
            'administered_date' => '2026-07-20',
            'administration_route' => 'Intradermal',
            'inventory_id' => $productId,
            'inventory_batch_id' => $batchId,
        ])->assertOk()
            ->assertJsonPath('data.status', 'Done')
            ->assertJsonPath('data.vaccine_type', 'Anti-Rabies Vaccine — Abhayrab')
            ->assertJsonPath('data.vaccine_lot_number', 'ARV-2026-101')
            ->assertJsonPath('data.inventory_batch_id', $batchId)
            ->assertJsonPath('inventory_automatically_deducted', true);

        // Stock is decremented by 1 on both product and batch and logged in inventory_transactions.
        $this->assertSame(9, Inventory::findOrFail($productId)->current_stock);
        $this->assertSame(9, InventoryBatch::findOrFail($batchId)->quantity_remaining);
        $this->assertDatabaseHas('inventory_transactions', [
            'inventory_id' => $productId,
            'inventory_batch_id' => $batchId,
            'pep_schedule_id' => $schedule->id,
            'transaction_type' => 'Used',
            'quantity' => 1,
        ]);
    }

    public function test_inventory_catalog_metadata_and_duplicate_product_prevention_and_initial_batch_validation(): void
    {
        $this->actingAsRole('clinic_admin');

        $catalogResponse = $this->getJson('/api/inventory')
            ->assertOk()
            ->assertJsonCount(4, 'meta.catalog');

        $catalogNames = collect($catalogResponse->json('meta.catalog'))->pluck('item_name')->all();
        $this->assertSame([
            'Anti-Rabies Vaccine — Abhayrab',
            'Tetanus Toxoid — Abhaytox / Bett',
            'Equine RIG (eRIG) — Equirab',
            'Human RIG (hRIG) — Berirab',
        ], $catalogNames);

        // Initial stock > 0 requires batch_number and expiry_date.
        $this->postJson('/api/inventory', [
            'item_name' => 'Anti-Rabies Vaccine — Abhayrab',
            'item_type' => 'Vaccine',
            'current_stock' => 5,
            'unit' => 'Vials',
            'reorder_level' => 2,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['batch_number', 'expiry_date']);

        // Registering each catalog product auto-populates brand and item_type.
        $this->postJson('/api/inventory', [
            'item_name' => 'Equine RIG (eRIG) — Equirab',
            'item_type' => 'Vaccine',
            'current_stock' => 0,
            'unit' => 'Vials',
            'reorder_level' => 5,
        ])->assertCreated()
            ->assertJsonPath('data.brand', 'Equirab')
            ->assertJsonPath('data.item_type', 'Immunoglobulin');

        // Duplicate registration of the same catalog product is rejected with guidance to Add Batch / Restock.
        $this->postJson('/api/inventory', [
            'item_name' => 'Equine RIG (eRIG) — Equirab',
            'item_type' => 'Immunoglobulin',
            'current_stock' => 0,
            'unit' => 'Vials',
            'reorder_level' => 5,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('item_name');
    }

    public function test_recording_doses_depletes_batch_stock_and_blocks_subsequent_doses_when_exhausted(): void
    {
        $user = $this->actingAsRole('nurse_vaccinator');
        [$scheduleDay0, $inventory, $batch, $incident] = $this->createDoseInventoryContext(
            $user,
            ['item_name' => 'Anti-Rabies Vaccine — Abhayrab', 'current_stock' => 1],
            ['batch_number' => 'ABH-SINGLE-01', 'quantity_received' => 1, 'quantity_remaining' => 1]
        );
        $scheduleDay3 = PepSchedule::create([
            'incident_id' => $incident->id,
            'dose_day' => 3,
            'scheduled_date' => '2026-07-20',
            'status' => 'Pending',
        ]);

        // First dose consumes the single available unit.
        $this->recordDose($scheduleDay0, $inventory, $batch)->assertOk();
        $this->assertInventoryWasDeducted($scheduleDay0, $inventory, $batch, 0, 0);

        // Depleted product is now listed in meta.unavailable and excluded from selectable options.
        $this->getJson('/api/pep-schedule/dose-inventory-options')
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.unavailable.0.id', $inventory->id)
            ->assertJsonPath('meta.unavailable.0.reason', 'batches_depleted');

        // Second dose attempt against the exhausted batch is rejected.
        $this->recordDose($scheduleDay3, $inventory, $batch)->assertUnprocessable();
        $this->assertDoseWasNotRecorded($scheduleDay3);
    }

    public function test_creating_vaccine_product_with_initial_batch_or_adding_first_batch_to_unbatched_stock_keeps_quantities_consistent(): void
    {
        $this->actingAsRole('clinic_admin');

        // Creating a product with initial stock and batch details creates both atomically.
        $withBatch = $this->postJson('/api/inventory', [
            'item_name' => 'Verorab',
            'item_type' => 'Vaccine',
            'current_stock' => 15,
            'unit' => 'Vials',
            'reorder_level' => 5,
            'batch_number' => 'VER-INIT-01',
            'expiry_date' => '2028-05-01',
            'received_date' => '2026-07-20',
        ])->assertCreated();

        $this->assertSame(15, $withBatch->json('data.current_stock'));
        $this->assertSame('VER-INIT-01', $withBatch->json('data.batches.0.batch_number'));
        $this->assertSame(15, $withBatch->json('data.batches.0.quantity_remaining'));

        // Legacy/unbatched product with placeholder current_stock = 120 and 0 batches:
        // recording the first batch sets current_stock to the batch quantity instead of double-counting to 145.
        $unbatched = Inventory::create([
            'item_name' => 'Legacy Unbatched Vaccine',
            'item_type' => 'Vaccine',
            'current_stock' => 120,
            'unit' => 'Vials',
            'reorder_level' => 10,
        ]);

        $this->postJson('/api/inventory/'.$unbatched->id.'/batches', [
            'batch_number' => 'LEG-2026-01',
            'quantity_received' => 25,
            'expiry_date' => '2028-09-01',
            'received_date' => '2026-07-20',
        ])->assertCreated()
            ->assertJsonPath('data.current_stock', 25)
            ->assertJsonPath('batch.quantity_remaining', 25);
    }

    public function test_audit_failure_rolls_back_the_dose_without_mutating_inventory(): void
    {
        $user = $this->actingAsRole('clinic_admin');
        [$schedule, $inventory, $batch] = $this->createDoseInventoryContext($user);
        AuditLog::creating(function (AuditLog $audit): void {
            if ($audit->module === 'PEP Schedule') {
                throw new RuntimeException('Forced audit failure.');
            }
        });

        $response = $this->recordDose($schedule, $inventory, $batch);
        AuditLog::flushEventListeners();

        $response->assertInternalServerError();
        $this->assertDoseWasNotRecorded($schedule);
        $this->assertInventoryWasNotMutated($inventory, $batch, 5, 5);
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

    private function createDoseInventoryContext(
        User $user,
        array $inventoryOverrides = [],
        array $batchOverrides = [],
        array $scheduleOverrides = []
    ): array {
        $patient = Patient::create([
            'full_name' => 'Dose Traceability Patient',
            'age' => 30,
            'sex' => 'Female',
            'address' => 'Digos City',
            'contact_number' => '09171234567',
        ]);
        $incident = Incident::create([
            'patient_id' => $patient->id,
            'incident_date' => '2026-07-20',
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'who_category' => 'III',
            'status' => 'Active',
        ]);
        $schedule = PepSchedule::create(array_merge([
            'incident_id' => $incident->id,
            'dose_day' => 0,
            'scheduled_date' => '2026-07-20',
            'status' => 'Pending',
        ], $scheduleOverrides));
        $inventory = Inventory::create(array_merge([
            'item_name' => 'Anti-rabies Vaccine',
            'item_type' => 'Vaccine',
            'current_stock' => 5,
            'unit' => 'dose',
            'reorder_level' => 1,
            'updated_by' => $user->id,
        ], $inventoryOverrides));
        $batch = InventoryBatch::create(array_merge([
            'inventory_id' => $inventory->id,
            'batch_number' => 'ARV-2026-001',
            'quantity_received' => 5,
            'quantity_remaining' => 5,
            'expiry_date' => '2028-07-08',
            'received_date' => '2026-07-01',
            'created_by' => $user->id,
        ], $batchOverrides));

        return [$schedule, $inventory, $batch, $incident];
    }

    private function recordDose(
        PepSchedule $schedule,
        Inventory $inventory,
        InventoryBatch $batch,
        array $overrides = []
    ) {
        return $this->postJson('/api/pep-schedule/'.$schedule->id.'/record-dose', array_merge([
            'administered_date' => '2026-07-20',
            'administration_route' => 'Intradermal',
            'inventory_id' => $inventory->id,
            'inventory_batch_id' => $batch->id,
        ], $overrides));
    }

    private function assertDoseWasNotRecorded(PepSchedule $schedule): void
    {
        $schedule = $schedule->fresh();
        $this->assertNull($schedule->administered_date);
        $this->assertNull($schedule->administration_route);
        $this->assertNull($schedule->inventory_batch_id);
        $this->assertSame('Pending', $schedule->status);
    }

    private function assertInventoryWasNotMutated(
        Inventory $inventory,
        InventoryBatch $batch,
        int $expectedInventoryStock,
        int $expectedBatchStock
    ): void {
        $this->assertSame($expectedInventoryStock, $inventory->fresh()->current_stock);
        $this->assertSame($expectedBatchStock, $batch->fresh()->quantity_remaining);
        $this->assertDatabaseCount('inventory_transactions', 0);
    }

    private function assertInventoryWasDeducted(
        PepSchedule $schedule,
        Inventory $inventory,
        InventoryBatch $batch,
        int $expectedInventoryStock,
        int $expectedBatchStock
    ): void {
        $this->assertSame($expectedInventoryStock, $inventory->fresh()->current_stock);
        $this->assertSame($expectedBatchStock, $batch->fresh()->quantity_remaining);
        $this->assertDatabaseHas('inventory_transactions', [
            'inventory_id' => $inventory->id,
            'inventory_batch_id' => $batch->id,
            'pep_schedule_id' => $schedule->id,
            'transaction_type' => 'Used',
            'quantity' => 1,
        ]);
    }
}
