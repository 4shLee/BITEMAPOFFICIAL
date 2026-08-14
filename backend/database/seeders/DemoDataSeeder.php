<?php

namespace Database\Seeders;

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
use App\Support\DigosBarangayCoordinates;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DemoDataSeeder extends Seeder
{
    private const PATIENT_COUNT = 32;

    private const INCIDENT_COUNT = 40;

    private const PEP_DAYS = [0, 3, 7, 14, 28];

    /**
     * Seed clearly fictional, local-only capstone demonstration data.
     */
    public function run(): void
    {
        $this->guardLocalDatabase();
        DB::transaction(function (): void {
            $barangays = $this->seedBarangays();
            $users = app(DemoUserSeeder::class)->seedUsers();
            [$inventory, $batches, $batchDefinitions] = $this->seedInventory($users['clinic_admin']);
            $patients = $this->seedPatients($barangays);
            [$incidents, $schedules, $completedPerBatch] = $this->seedIncidentsAndSchedules(
                $patients,
                $barangays,
                $users,
                $inventory['vaccine'],
                [$batches['vaccine_standard'], $batches['vaccine_expiring']]
            );

            $this->seedInventoryTransactionsAndBalances(
                $inventory,
                $batches,
                $batchDefinitions,
                $completedPerBatch,
                $users['nurse_vaccinator']
            );
            $this->seedNotifications($schedules);
            $this->seedClinicSettings($users['clinic_admin']);

            if ($incidents->count() !== self::INCIDENT_COUNT) {
                throw new RuntimeException('The demo incident set was not created completely.');
            }
        }, 3);

        $this->command?->newLine();
        $this->command?->info('BITEMAP fictional demo data is ready.');
        $this->command?->table(
            ['Demo record type', 'Count'],
            [
                ['Users', User::whereIn('email', array_values(DemoUserSeeder::EMAILS))->count()],
                ['Patients', Patient::where('email', 'like', 'demo.patient.%@example.invalid')->count()],
                ['Incidents', Incident::where('notes', 'like', '%[DEMO:INC-%')->count()],
                ['PEP schedules', PepSchedule::whereHas('incident', fn ($query) => $query->where('notes', 'like', '%[DEMO:INC-%'))->count()],
                ['Inventory items', Inventory::where('item_name', 'like', 'Demo %')->count()],
                ['Inventory batches', InventoryBatch::where('batch_number', 'like', 'DEMO-%')->count()],
                ['Inventory transactions', InventoryTransaction::where('notes', 'like', '[DEMO:%')->count()],
                ['Notifications', Notification::whereNotNull('reminder_key')->where('message', 'like', '[DEMO] %')->count()],
            ]
        );
        $this->command?->warn('Demo login password (local use only): '.DemoUserSeeder::PASSWORD);
        $this->command?->line('Demo user emails: '.implode(', ', array_values(DemoUserSeeder::EMAILS)));
    }

    private function guardLocalDatabase(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('DemoDataSeeder is restricted to local and testing environments.');
        }

        if (app()->environment('testing')) {
            return;
        }

        $connectionName = (string) config('database.default');
        $connection = (array) config('database.connections.'.$connectionName, []);
        $actual = [
            'host' => (string) ($connection['host'] ?? ''),
            'port' => (string) ($connection['port'] ?? ''),
            'database' => (string) ($connection['database'] ?? ''),
        ];
        $expected = [
            'host' => '127.0.0.1',
            'port' => '3307',
            'database' => 'bitemap_db',
        ];

        if ($actual !== $expected) {
            throw new RuntimeException(sprintf(
                'Refusing to seed demo data. Expected %s:%s/%s; connected configuration is %s:%s/%s.',
                $expected['host'],
                $expected['port'],
                $expected['database'],
                $actual['host'],
                $actual['port'],
                $actual['database']
            ));
        }
    }

    /**
     * @return array<string, Barangay>
     */
    private function seedBarangays(): array
    {
        $barangays = [];

        foreach (DigosBarangayCoordinates::POINTS as $name => $point) {
            $barangays[$name] = Barangay::updateOrCreate(
                ['name' => $name],
                ['latitude' => $point['lat'], 'longitude' => $point['lng']]
            );
        }

        return $barangays;
    }

    /**
     * @return array{0: array<string, Inventory>, 1: array<string, InventoryBatch>, 2: array<string, array<string, mixed>>}
     */
    private function seedInventory(User $clinicAdmin): array
    {
        $itemDefinitions = [
            'vaccine' => [
                'item_name' => 'Demo Purified Vero Cell Rabies Vaccine',
                'item_type' => 'Vaccine',
                'unit' => 'vials',
                'reorder_level' => 40,
            ],
            'immunoglobulin' => [
                'item_name' => 'Demo Rabies Immunoglobulin',
                'item_type' => 'Immunoglobulin',
                'unit' => 'vials',
                'reorder_level' => 10,
            ],
            'tetanus' => [
                'item_name' => 'Demo Tetanus Toxoid',
                'item_type' => 'Medicine',
                'unit' => 'vials',
                'reorder_level' => 12,
            ],
            'syringe' => [
                'item_name' => 'Demo Sterile Syringe',
                'item_type' => 'Supply',
                'unit' => 'pieces',
                'reorder_level' => 100,
            ],
            'wound_kit' => [
                'item_name' => 'Demo Wound Care Kit',
                'item_type' => 'Supply',
                'unit' => 'kits',
                'reorder_level' => 20,
            ],
        ];
        $inventory = [];

        foreach ($itemDefinitions as $key => $definition) {
            $inventory[$key] = Inventory::updateOrCreate(
                ['item_name' => $definition['item_name']],
                [
                    ...$definition,
                    'current_stock' => 0,
                    'expiry_date' => null,
                    'updated_by' => $clinicAdmin->id,
                ]
            );
        }

        $today = CarbonImmutable::today();
        $batchDefinitions = [
            'vaccine_standard' => [
                'inventory_key' => 'vaccine',
                'batch_number' => 'DEMO-PVRV-STD-001',
                'quantity_received' => 140,
                'expiry_date' => $today->addMonths(9)->toDateString(),
                'received_date' => $today->subMonths(3)->toDateString(),
                'supplier' => 'Demo Medical Supply Cooperative',
                'manual_deduction' => 22,
                'manual_type' => 'Used',
            ],
            'vaccine_expiring' => [
                'inventory_key' => 'vaccine',
                'batch_number' => 'DEMO-PVRV-EXP-002',
                'quantity_received' => 110,
                'expiry_date' => $today->addDays(35)->toDateString(),
                'received_date' => $today->subMonths(5)->toDateString(),
                'supplier' => 'Demo Medical Supply Cooperative',
                'manual_deduction' => 18,
                'manual_type' => 'Used',
            ],
            'immunoglobulin_low' => [
                'inventory_key' => 'immunoglobulin',
                'batch_number' => 'DEMO-RIG-LOW-001',
                'quantity_received' => 24,
                'expiry_date' => $today->addMonths(5)->toDateString(),
                'received_date' => $today->subMonths(2)->toDateString(),
                'supplier' => 'Fictional Biologics Laboratory',
                'manual_deduction' => 19,
                'manual_type' => 'Used',
            ],
            'tetanus_expiring' => [
                'inventory_key' => 'tetanus',
                'batch_number' => 'DEMO-TT-EXP-001',
                'quantity_received' => 36,
                'expiry_date' => $today->addDays(25)->toDateString(),
                'received_date' => $today->subMonths(4)->toDateString(),
                'supplier' => 'Fictional Biologics Laboratory',
                'manual_deduction' => 26,
                'manual_type' => 'Used',
            ],
            'syringe_normal' => [
                'inventory_key' => 'syringe',
                'batch_number' => 'DEMO-SYR-STD-001',
                'quantity_received' => 500,
                'expiry_date' => $today->addYears(2)->toDateString(),
                'received_date' => $today->subMonth()->toDateString(),
                'supplier' => 'Demo Community Health Supplies',
                'manual_deduction' => 150,
                'manual_type' => 'Used',
            ],
            'wound_kit_normal' => [
                'inventory_key' => 'wound_kit',
                'batch_number' => 'DEMO-WCK-STD-001',
                'quantity_received' => 80,
                'expiry_date' => $today->addYear()->toDateString(),
                'received_date' => $today->subMonths(2)->toDateString(),
                'supplier' => 'Demo Community Health Supplies',
                'manual_deduction' => 25,
                'manual_type' => 'Used',
            ],
        ];
        $batches = [];

        foreach ($batchDefinitions as $key => $definition) {
            $item = $inventory[$definition['inventory_key']];
            $batches[$key] = InventoryBatch::updateOrCreate(
                [
                    'inventory_id' => $item->id,
                    'batch_number' => $definition['batch_number'],
                ],
                [
                    'quantity_received' => $definition['quantity_received'],
                    'quantity_remaining' => $definition['quantity_received'],
                    'expiry_date' => $definition['expiry_date'],
                    'received_date' => $definition['received_date'],
                    'supplier' => $definition['supplier'],
                    'notes' => '[DEMO:BATCH:'.$key.'] Fictional capstone inventory batch.',
                    'created_by' => $clinicAdmin->id,
                ]
            );
        }

        return [$inventory, $batches, $batchDefinitions];
    }

    /**
     * @param  array<string, Barangay>  $barangays
     * @return array<int, Patient>
     */
    private function seedPatients(array $barangays): array
    {
        $numberWords = [
            'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
            'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
            'Seventeen', 'Eighteen', 'Nineteen', 'Twenty', 'Twenty-One', 'Twenty-Two',
            'Twenty-Three', 'Twenty-Four', 'Twenty-Five', 'Twenty-Six', 'Twenty-Seven',
            'Twenty-Eight', 'Twenty-Nine', 'Thirty', 'Thirty-One', 'Thirty-Two',
        ];
        $residences = ['Aplaya', 'Balabag', 'Cogon', 'Dawis', 'Matti', 'San Jose', 'Tiguman', 'Zone 1', 'Zone 2', 'Zone 3'];
        $patients = [];

        for ($number = 1; $number <= self::PATIENT_COUNT; $number++) {
            $isDemoPatient = $number % 2 === 1;
            $barangayName = $residences[($number - 1) % count($residences)];
            $patients[$number] = Patient::updateOrCreate(
                ['email' => sprintf('demo.patient.%03d@example.invalid', $number)],
                [
                    'first_name' => $isDemoPatient ? 'Demo' : 'Test',
                    'middle_name' => $isDemoPatient ? 'Patient' : 'Resident',
                    'last_name' => $numberWords[$number - 1],
                    'suffix' => null,
                    'age' => 5 + (($number * 7) % 73),
                    'sex' => $number % 2 === 0 ? 'Female' : 'Male',
                    'address_line' => sprintf('Demo Block %02d, Sample Street', $number),
                    'residence_barangay' => $barangayName,
                    'city_municipality' => 'Digos City',
                    'province' => 'Davao del Sur',
                    'barangay_id' => $barangays[$barangayName]->id,
                    'contact_number' => sprintf('09000000%03d', $number),
                    'sms_consent' => $number % 3 !== 0,
                ]
            );
        }

        return $patients;
    }

    /**
     * @param  array<int, Patient>  $patients
     * @param  array<string, Barangay>  $barangays
     * @param  array<string, User>  $users
     * @param  array<int, InventoryBatch>  $vaccineBatches
     * @return array{0: \Illuminate\Support\Collection<int, Incident>, 1: \Illuminate\Support\Collection<int, PepSchedule>, 2: array<int, int>}
     */
    private function seedIncidentsAndSchedules(
        array $patients,
        array $barangays,
        array $users,
        Inventory $vaccine,
        array $vaccineBatches
    ): array {
        $incidentBarangays = ['Aplaya', 'Balabag', 'Cogon', 'Dawis', 'Matti', 'San Jose', 'Tiguman', 'Zone 1', 'Zone 2', 'Zone 3'];
        $biteSites = ['Left hand', 'Right calf', 'Left ankle', 'Right forearm', 'Lower leg', 'Left foot'];
        $today = CarbonImmutable::today();
        $incidents = collect();
        $schedules = collect();
        $completedPerBatch = [];
        $completedSequence = 0;

        for ($number = 1; $number <= self::INCIDENT_COUNT; $number++) {
            $scenario = ($number - 1) % 8;
            $cycle = intdiv($number - 1, 8);
            $daysAgo = match ($scenario) {
                0 => 80 + ($cycle * 7),
                1 => 2 + ($cycle * 3),
                2 => 40 + ($cycle * 5),
                3 => 12 + ($cycle * 4),
                4 => 5 + ($cycle * 2),
                5 => 55 + ($cycle * 8),
                6 => 70 + ($cycle * 4),
                default => $cycle * 2,
            };
            $incidentDate = $today->subDays($daysAgo);
            $firstConsultDate = $incidentDate->addDays($number % 2);
            $pepStartDate = $firstConsultDate;
            $patientNumber = $number <= self::PATIENT_COUNT ? $number : $number - self::PATIENT_COUNT;
            $patient = $patients[$patientNumber];
            $barangayName = $incidentBarangays[($number - 1) % count($incidentBarangays)];
            $latitude = DigosBarangayCoordinates::POINTS[$barangayName]['lat'];
            $longitude = DigosBarangayCoordinates::POINTS[$barangayName]['lng'];
            $category = ['I', 'II', 'III'][($number - 1) % 3];
            $animalType = match ($number % 10) {
                0 => 'Other',
                2, 5, 8 => 'Cat',
                default => 'Dog',
            };
            $marker = sprintf('[DEMO:INC-%03d]', $number);
            $incident = Incident::query()->where('notes', 'like', '%'.$marker.'%')->first() ?? new Incident;
            $incident->fill([
                'patient_id' => $patient->id,
                'barangay_id' => $barangays[$barangayName]->id,
                'location_scope' => 'within_digos',
                'incident_date' => $incidentDate->toDateString(),
                'incident_time' => sprintf('%02d:%02d:00', 7 + ($number % 10), ($number * 7) % 60),
                'first_consult_date' => $firstConsultDate->toDateString(),
                'pep_start_date' => $pepStartDate->toDateString(),
                'animal_type' => $animalType,
                'animal_description' => $animalType === 'Other'
                    ? 'Fictional captive monkey used only for a capstone scenario'
                    : 'Fictional '.strtolower($animalType).' used only for demonstration',
                'bite_site' => $biteSites[($number - 1) % count($biteSites)],
                ...$this->exposureForCategory($category),
                'who_category' => $category,
                'suggested_who_category' => $category,
                'who_category_suggestion_reason' => $this->categoryReason($category),
                'who_category_override_reason' => null,
                'who_category_confirmed_by' => $users['doctor']->id,
                'who_category_confirmed_at' => $firstConsultDate->setTime(10, 0),
                'location_lat' => $latitude + ((($number % 5) - 2) * 0.0004),
                'location_lng' => $longitude + ((($number % 7) - 3) * 0.0004),
                'incident_city_municipality' => null,
                'incident_province' => null,
                'incident_specific_location' => null,
                'status' => $this->incidentStatusForScenario($scenario),
                'reported_by' => $users['nurse_vaccinator']->id,
                'notes' => $marker.' Fictional capstone demonstration incident; no real patient data.',
            ]);
            $incident->save();
            $incidents->push($incident);

            foreach (self::PEP_DAYS as $doseDay) {
                $standardDate = $pepStartDate->addDays($doseDay);
                [$status, $scheduledDate, $isCompleted, $scheduleNote] = $this->scheduleState(
                    $scenario,
                    $doseDay,
                    $standardDate,
                    $today
                );
                $scheduleValues = [
                    'scheduled_date' => $scheduledDate->toDateString(),
                    'administered_date' => null,
                    'administration_route' => null,
                    'vaccine_type' => 'Anti-rabies Vaccine',
                    'vaccine_lot_number' => null,
                    'inventory_batch_id' => null,
                    'administered_by' => null,
                    'status' => $status,
                    'notes' => sprintf('[DEMO:PEP-%03d-D%02d] %s', $number, $doseDay, $scheduleNote),
                ];

                if ($isCompleted) {
                    $batch = $vaccineBatches[$completedSequence % count($vaccineBatches)];
                    $administeredDate = $standardDate->addDays(($number + $doseDay) % 2);
                    if ($administeredDate->isAfter($today)) {
                        $administeredDate = $today;
                    }

                    $scheduleValues = array_merge($scheduleValues, [
                        'administered_date' => $administeredDate->toDateString(),
                        'administration_route' => ($number + $doseDay) % 2 === 0 ? 'Intradermal' : 'Intramuscular',
                        'vaccine_type' => $vaccine->item_name,
                        'vaccine_lot_number' => $batch->batch_number,
                        'inventory_batch_id' => $batch->id,
                        'administered_by' => $users['nurse_vaccinator']->id,
                    ]);
                    $completedSequence++;
                    $completedPerBatch[$batch->id] = ($completedPerBatch[$batch->id] ?? 0) + 1;
                }

                $schedule = PepSchedule::updateOrCreate(
                    ['incident_id' => $incident->id, 'dose_day' => $doseDay],
                    $scheduleValues
                );
                $schedules->push($schedule);

                if ($isCompleted) {
                    InventoryTransaction::updateOrCreate(
                        ['pep_schedule_id' => $schedule->id],
                        [
                            'inventory_id' => $vaccine->id,
                            'inventory_batch_id' => $schedule->inventory_batch_id,
                            'transaction_type' => 'Used',
                            'quantity' => 1,
                            'transaction_date' => $schedule->administered_date?->toDateString(),
                            'notes' => sprintf('[DEMO:PEP-TXN-%03d-D%02d] Vaccine dose administered for fictional demonstration.', $number, $doseDay),
                            'created_by' => $users['nurse_vaccinator']->id,
                        ]
                    );
                }
            }
        }

        return [$incidents, $schedules, $completedPerBatch];
    }

    /**
     * @return array<string, mixed>
     */
    private function exposureForCategory(string $category): array
    {
        return match ($category) {
            'I' => [
                'exposure_contact_types' => ['touching_or_feeding'],
                'exposure_skin_condition' => null,
                'exposure_bleeding_present' => null,
                'exposure_transdermal' => null,
                'exposure_saliva_contact_site' => null,
                'exposure_direct_bat_contact' => null,
            ],
            'II' => [
                'exposure_contact_types' => ['scratch'],
                'exposure_skin_condition' => 'broken',
                'exposure_bleeding_present' => false,
                'exposure_transdermal' => false,
                'exposure_saliva_contact_site' => null,
                'exposure_direct_bat_contact' => null,
            ],
            default => [
                'exposure_contact_types' => ['bite'],
                'exposure_skin_condition' => 'broken',
                'exposure_bleeding_present' => true,
                'exposure_transdermal' => true,
                'exposure_saliva_contact_site' => null,
                'exposure_direct_bat_contact' => null,
            ],
        };
    }

    private function categoryReason(string $category): string
    {
        return match ($category) {
            'I' => 'Contact was limited to touching or feeding the fictional animal.',
            'II' => 'A superficial scratch without bleeding was recorded in the fictional scenario.',
            default => 'A transdermal bite with bleeding was recorded in the fictional scenario.',
        };
    }

    private function incidentStatusForScenario(int $scenario): string
    {
        return match ($scenario) {
            0, 5 => 'Completed',
            2 => 'Missed',
            6 => 'Lost to Follow-up',
            default => 'Active',
        };
    }

    /**
     * @return array{0: string, 1: CarbonImmutable, 2: bool, 3: string}
     */
    private function scheduleState(
        int $scenario,
        int $doseDay,
        CarbonImmutable $standardDate,
        CarbonImmutable $today
    ): array {
        if (in_array($scenario, [0, 5], true)) {
            return [
                $doseDay % 14 === 0 ? 'Completed' : 'Done',
                $standardDate,
                true,
                'Dose completed for the fictional demonstration course.',
            ];
        }

        if ($scenario === 2) {
            if (in_array($doseDay, [0, 3], true)) {
                return ['Done', $standardDate, true, 'Dose completed before later missed follow-ups.'];
            }

            return ['Missed', $standardDate, false, 'Fictional missed follow-up for reminder demonstration.'];
        }

        if ($scenario === 3) {
            if (in_array($doseDay, [0, 3, 7], true)) {
                return ['Done', $standardDate, true, 'Dose completed before a fictional rescheduling event.'];
            }

            if ($doseDay === 14) {
                return ['Rescheduled', $today->addDays(2), false, 'Rescheduled from the standard Day 14 date for demonstration.'];
            }

            return ['Pending', $today->addDays(16), false, 'Pending after a fictional schedule adjustment.'];
        }

        if ($scenario === 6) {
            if ($doseDay === 0) {
                return ['Done', $standardDate, true, 'Initial dose completed before fictional loss to follow-up.'];
            }

            return ['Missed', $standardDate, false, 'Fictional missed dose for loss-to-follow-up demonstration.'];
        }

        if ($standardDate->isBefore($today) || ($scenario === 7 && $standardDate->isSameDay($today))) {
            return ['Done', $standardDate, true, 'Dose completed on or near the scheduled date.'];
        }

        if ($standardDate->isSameDay($today) || $doseDay <= 7) {
            return ['Upcoming', $standardDate, false, 'Upcoming fictional appointment.'];
        }

        return ['Pending', $standardDate, false, 'Pending fictional appointment.'];
    }

    /**
     * @param  array<string, Inventory>  $inventory
     * @param  array<string, InventoryBatch>  $batches
     * @param  array<string, array<string, mixed>>  $batchDefinitions
     * @param  array<int, int>  $completedPerBatch
     */
    private function seedInventoryTransactionsAndBalances(
        array $inventory,
        array $batches,
        array $batchDefinitions,
        array $completedPerBatch,
        User $creator
    ): void {
        foreach ($batchDefinitions as $key => $definition) {
            $item = $inventory[$definition['inventory_key']];
            $batch = $batches[$key];
            $linkedPepDoses = $completedPerBatch[$batch->id] ?? 0;
            $manualDeduction = (int) $definition['manual_deduction'];
            $remaining = (int) $definition['quantity_received'] - $linkedPepDoses - $manualDeduction;

            if ($remaining < 0) {
                throw new RuntimeException('Demo batch '.$batch->batch_number.' cannot cover its linked transactions.');
            }

            $batch->update(['quantity_remaining' => $remaining]);

            InventoryTransaction::updateOrCreate(
                [
                    'inventory_id' => $item->id,
                    'inventory_batch_id' => $batch->id,
                    'notes' => '[DEMO:RESTOCK:'.$key.'] Fictional batch receipt.',
                ],
                [
                    'pep_schedule_id' => null,
                    'transaction_type' => 'Restocked',
                    'quantity' => $definition['quantity_received'],
                    'transaction_date' => $definition['received_date'],
                    'created_by' => $creator->id,
                ]
            );

            InventoryTransaction::updateOrCreate(
                [
                    'inventory_id' => $item->id,
                    'inventory_batch_id' => $batch->id,
                    'notes' => '[DEMO:MANUAL:'.$key.'] Aggregated fictional clinic consumption.',
                ],
                [
                    'pep_schedule_id' => null,
                    'transaction_type' => $definition['manual_type'],
                    'quantity' => $manualDeduction,
                    'transaction_date' => CarbonImmutable::today()->subDays(4)->toDateString(),
                    'created_by' => $creator->id,
                ]
            );
        }

        foreach ($inventory as $item) {
            $currentStock = (int) $item->batches()->sum('quantity_remaining');
            $nearestExpiry = $item->batches()
                ->where('quantity_remaining', '>', 0)
                ->whereDate('expiry_date', '>=', CarbonImmutable::today())
                ->orderBy('expiry_date')
                ->value('expiry_date');

            $item->update([
                'current_stock' => $currentStock,
                'expiry_date' => $nearestExpiry,
                'updated_by' => $creator->id,
            ]);
        }
    }

    /**
     * @param  \Illuminate\Support\Collection<int, PepSchedule>  $schedules
     */
    private function seedNotifications($schedules): void
    {
        $attentionSchedules = $schedules
            ->filter(fn (PepSchedule $schedule) => ! in_array($schedule->status, ['Done', 'Completed', 'Skipped', 'Cancelled'], true))
            ->sortBy(fn (PepSchedule $schedule) => [$schedule->scheduled_date?->toDateString(), $schedule->id])
            ->take(20)
            ->values();
        $statuses = ['Pending', 'Sent', 'Failed', 'Delivered'];

        foreach ($attentionSchedules as $index => $schedule) {
            $schedule->loadMissing('incident.patient');
            $patient = $schedule->incident?->patient;
            if (! $patient) {
                continue;
            }

            $useSms = $patient->sms_consent && filled($patient->contact_number);
            $status = $statuses[$index % count($statuses)];
            $reminderKey = hash('sha256', 'bitemap-demo-reminder-'.$schedule->id);

            Notification::updateOrCreate(
                ['reminder_key' => $reminderKey],
                [
                    'patient_id' => $patient->id,
                    'incident_id' => $schedule->incident_id,
                    'pep_schedule_id' => $schedule->id,
                    'notification_type' => $useSms ? 'SMS' : 'Email',
                    'reminder_type' => $schedule->status === 'Missed' ? 'Missed Dose Follow-up' : 'Vaccination Reminder',
                    'scheduled_date' => $schedule->scheduled_date?->toDateString(),
                    'recipient' => $useSms ? $patient->contact_number : $patient->email,
                    'message' => sprintf(
                        '[DEMO] Fictional reminder for %s: PEP Day %d is scheduled for %s.',
                        $patient->full_name,
                        $schedule->dose_day,
                        $schedule->scheduled_date?->toDateString()
                    ),
                    'status' => $status,
                    'sent_at' => in_array($status, ['Sent', 'Delivered'], true) ? now()->subHours($index + 1) : null,
                    'delivery_response' => match ($status) {
                        'Failed' => 'Demo-only simulated delivery failure; no message was sent.',
                        'Sent', 'Delivered' => 'Demo-only simulated delivery result; no message was sent.',
                        default => 'Demo-only pending reminder; no message will be sent automatically.',
                    },
                ]
            );
        }
    }

    private function seedClinicSettings(User $clinicAdmin): void
    {
        $settings = [
            'organization_name' => 'BITEMAP Fictional Demonstration',
            'clinic_name' => 'BITEMAP Demo Animal Bite Center',
            'clinic_type' => 'Local Development Demonstration Clinic',
            'clinic_address' => 'Demo Civic Complex, Sample Street, Digos City',
            'clinic_barangay' => 'Zone 1',
            'contact_email' => 'demo.clinic@example.invalid',
            'contact_number' => '09000000000',
            'clinic_public_listing_enabled' => 'true',
            'clinic_operating_hours' => 'Monday-Friday, 8:00 AM-5:00 PM (Demo Only)',
            'clinic_services' => json_encode(['Animal bite assessment', 'PEP vaccination', 'Fictional capstone demonstration']),
            'clinic_latitude' => '6.7494',
            'clinic_longitude' => '125.3569',
            'clinic_public_notes' => 'Fictional local-development listing. Not a real clinic.',
            'clinic_verified_at' => CarbonImmutable::today()->toDateString(),
            'system_timezone' => 'Asia/Manila',
            'system_language' => 'en',
            'sms_reminders_enabled' => 'false',
            'low_stock_alert_enabled' => 'true',
            'expiring_batch_alert_enabled' => 'true',
            'low_stock_threshold' => '20',
            'map_default_center' => '6.7494,125.3569',
        ];

        foreach ($settings as $key => $value) {
            Setting::firstOrCreate(
                ['setting_key' => $key],
                ['setting_value' => $value, 'updated_by' => $clinicAdmin->id]
            );
        }
    }
}
