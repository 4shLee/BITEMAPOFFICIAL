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

    public function test_recording_a_valid_dose_preserves_batch_traceability_without_mutating_inventory(): void
    {
        $user = $this->actingAsRole('clinic_admin');
        [$schedule, $inventory, $batch] = $this->createDoseInventoryContext($user);

        $this->recordDose($schedule, $inventory, $batch, ['remarks' => 'Dose administered normally.'])
            ->assertOk()
            ->assertJsonPath('message', 'Dose recorded successfully. Record the actual vaccine stock consumed in the Inventory module.')
            ->assertJsonPath('inventory_automatically_deducted', false)
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
        $this->assertInventoryWasNotMutated($inventory, $batch, 5, 5);
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
        $this->assertInventoryWasNotMutated($inventory, $batch, 5, 5);
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
        $this->assertInventoryWasNotMutated($inventory, $batch, 5, 5);
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
        $this->assertInventoryWasNotMutated($inventory, $batch, 5, 5);
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
            'tetanus classified as vaccine' => ['Tetanus Toxoid', 'Vaccine'],
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
        $this->assertInventoryWasNotMutated($inventory, $batch, 5, 5);
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

    public function test_pep_schedule_and_inventory_endpoints_still_load(): void
    {
        $user = $this->actingAsRole('doctor');
        $this->createDoseInventoryContext($user);

        $this->getJson('/api/pep-schedule')->assertOk()->assertJsonPath('success', true);
        $this->getJson('/api/inventory')->assertOk()->assertJsonPath('success', true);
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
}
