<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Incident;
use App\Models\Notification;
use App\Models\Patient;
use App\Models\PepSchedule;
use App\Models\Setting;
use App\Models\User;
use App\Services\Sms\Drivers\MockSmsProvider;
use App\Services\Sms\SmsGateway;
use App\Services\Sms\VaccinationReminderService;
use App\Support\PhoneNumber;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SmsGatewayAndReminderUatTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        MockSmsProvider::clear();
    }

    protected function tearDown(): void
    {
        MockSmsProvider::clear();
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_pep_day_0_3_7_14_28_schedule_dates_and_reminder_eligibility_are_evaluated_independently(): void
    {
        $this->authenticate('nurse_vaccinator');

        $response = $this->postJson('/api/incidents', $this->incidentPayload([
            'incident_date' => '2026-07-01',
            'pep_start_date' => '2026-07-01',
        ]))->assertCreated();

        $incidentId = $response->json('data.id');
        $schedules = PepSchedule::where('incident_id', $incidentId)
            ->orderBy('dose_day')
            ->get()
            ->keyBy('dose_day');

        $this->assertSame([0, 3, 7, 14, 28], $schedules->keys()->all());
        $this->assertSame('2026-07-01', $schedules[0]->scheduled_date->toDateString());
        $this->assertSame('2026-07-04', $schedules[3]->scheduled_date->toDateString());
        $this->assertSame('2026-07-08', $schedules[7]->scheduled_date->toDateString());
        $this->assertSame('2026-07-15', $schedules[14]->scheduled_date->toDateString());
        $this->assertSame('2026-07-29', $schedules[28]->scheduled_date->toDateString());

        $service = app(VaccinationReminderService::class);

        // Day 0 is due today on 2026-07-01; Day 3 (2026-07-04) is upcoming within 3 days
        $dueToday = $service->eligibleSchedulesForScope('today', Carbon::parse('2026-07-01'));
        $this->assertCount(1, $dueToday);
        $this->assertSame(0, $dueToday->first()->dose_day);

        $upcoming = $service->eligibleSchedulesForScope('upcoming', Carbon::parse('2026-07-01'));
        $this->assertCount(1, $upcoming);
        $this->assertSame(3, $upcoming->first()->dose_day);

        // Once Day 0 is administered, it is no longer eligible even if queried on 2026-07-01
        $schedules[0]->update([
            'status' => 'Done',
            'administered_date' => '2026-07-01',
        ]);
        $this->assertCount(0, $service->eligibleSchedulesForScope('today', Carbon::parse('2026-07-01')));

        // Check Day 7 eligibility on 2026-07-08, Day 14 on 2026-07-15, Day 28 on 2026-07-29
        $this->assertSame(7, $service->eligibleSchedulesForScope('today', Carbon::parse('2026-07-08'))->first()?->dose_day);
        $this->assertSame(14, $service->eligibleSchedulesForScope('today', Carbon::parse('2026-07-15'))->first()?->dose_day);
        $this->assertSame(28, $service->eligibleSchedulesForScope('today', Carbon::parse('2026-07-29'))->first()?->dose_day);

        // Completed or Cancelled incidents are excluded from reminder eligibility
        Incident::whereKey($incidentId)->update(['status' => 'Completed']);
        $this->assertCount(0, $service->eligibleSchedulesForScope('today', Carbon::parse('2026-07-29')));
    }

    public function test_message_formatting_is_testable_independently_of_sms_provider(): void
    {
        $patient = new Patient(['full_name' => 'Juan Dela Cruz']);
        $schedule = new PepSchedule(['dose_day' => 3, 'scheduled_date' => '2026-07-04']);
        $service = app(VaccinationReminderService::class);

        $todayMsg = $service->formatMessage('today', $patient, $schedule, 'Digos City ABTC');
        $upcomingMsg = $service->formatMessage('upcoming', $patient, $schedule, 'Digos City ABTC');
        $missedMsg = $service->formatMessage('missed', $patient, $schedule, 'Digos City ABTC');

        $this->assertStringContainsString('Juan Dela Cruz', $todayMsg);
        $this->assertStringContainsString('scheduled today at Digos City ABTC', $todayMsg);

        $this->assertStringContainsString('2026-07-04', $upcomingMsg);
        $this->assertStringContainsString('next anti-rabies vaccination dose is scheduled on 2026-07-04', $upcomingMsg);

        $this->assertStringContainsString('missed your anti-rabies vaccination schedule on 2026-07-04', $missedMsg);
        $this->assertStringContainsString('Digos City ABTC', $missedMsg);
    }

    public function test_mock_driver_records_messages_without_external_calls_and_cannot_be_mistaken_for_live_delivery(): void
    {
        Http::preventStrayRequests();
        config([
            'services.sms.enabled' => true,
            'services.sms.provider' => 'Mock',
        ]);

        $this->authenticate('system_admin');

        $testResponse = $this->postJson('/api/settings/test-sms', [
            'phone' => '09171234567',
            'message' => 'UAT mock mode verification',
        ])->assertOk();

        $testResponse->assertJsonPath('data.status', 'Pending')
            ->assertJsonPath('data.simulated', true)
            ->assertJsonPath('data.provider', 'mock');

        $this->assertStringContainsString(
            '[MOCK SMS - NOT SENT]',
            (string) $testResponse->json('data.delivery_response')
        );

        Http::assertNothingSent();
        $this->assertCount(1, MockSmsProvider::recorded());
        $this->assertSame('+639171234567', MockSmsProvider::last()['e164']);
        $this->assertSame('639171234567', MockSmsProvider::last()['philsms_number']);
        $this->assertSame('UAT mock mode verification', MockSmsProvider::last()['message']);
    }

    public function test_seeded_demo_patient_numbers_cannot_trigger_live_sms_even_when_service_is_enabled(): void
    {
        Http::preventStrayRequests();
        config([
            'services.sms.enabled' => true,
            'services.sms.provider' => 'PhilSMS',
            'services.philsms.token' => 'philsms_live_secret_token',
            'services.philsms.sender_id' => 'PhilSMS',
        ]);

        $this->assertTrue(PhoneNumber::isDemoOrReservedNumber('09000000001'));
        $this->assertTrue(PhoneNumber::isDemoOrReservedNumber('+639000000032'));
        $this->assertFalse(PhoneNumber::isDemoOrReservedNumber('09171234567'));

        $this->authenticate('nurse_vaccinator');
        $incidentResponse = $this->postJson('/api/incidents', $this->incidentPayload([
            'patient_name' => 'Seeded Demo Patient',
            'contact_number' => '09000000001',
        ]))->assertCreated();

        $schedule = PepSchedule::where('incident_id', $incidentResponse->json('data.id'))->orderBy('dose_day')->firstOrFail();

        $sendResponse = $this->postJson('/api/send-sms', [
            'phone' => '09000000001',
            'message' => 'Reminder for demo patient',
            'patientId' => $incidentResponse->json('data.patient_id'),
            'incidentId' => $incidentResponse->json('data.id'),
            'pepScheduleId' => $schedule->id,
            'scheduledDate' => $schedule->scheduled_date->toDateString(),
        ])->assertOk();

        // Must be intercepted into Pending simulation mode, never 'Sent'
        $sendResponse->assertJsonPath('data.status', 'Pending');
        $this->assertStringContainsString('Seeded/demo contact number detected', (string) $sendResponse->json('data.delivery_response'));
        Http::assertNothingSent();
        $this->assertSame('demo_number_blocked', MockSmsProvider::last()['reason']);
    }

    public function test_missing_or_invalid_phone_numbers_are_rejected_and_counted_as_failed(): void
    {
        Http::preventStrayRequests();
        Carbon::setTestNow('2026-07-18 07:00:00');
        config(['services.sms.enabled' => false]);

        $this->authenticate('nurse_vaccinator');
        $incidentResponse = $this->postJson('/api/incidents', $this->incidentPayload())->assertCreated();
        $incidentId = $incidentResponse->json('data.id');
        $patientId = $incidentResponse->json('data.patient_id');

        // Manual send with invalid phone number fails with 422
        $this->postJson('/api/send-sms', [
            'phone' => 'invalid-phone',
            'message' => 'Reminder',
            'patientId' => $patientId,
            'incidentId' => $incidentId,
        ])->assertUnprocessable()
            ->assertJsonPath('success', false);

        // Corrupt patient contact number in DB to simulate legacy missing/invalid phone during scheduled batch
        Patient::whereKey($patientId)->update(['contact_number' => '']);

        $counts = app(VaccinationReminderService::class)->dispatchScheduledReminders('today');
        $this->assertSame(1, $counts['failed']);
        $this->assertSame(0, $counts['sent']);
        $this->assertSame(0, $counts['pending']);
        Http::assertNothingSent();
    }

    public function test_manual_send_followed_by_scheduled_command_prevents_duplicate_reminder_for_same_schedule(): void
    {
        Carbon::setTestNow('2026-07-18 07:00:00');
        Http::preventStrayRequests();
        config(['services.sms.enabled' => false]);

        $this->authenticate('nurse_vaccinator');
        $incidentResponse = $this->postJson('/api/incidents', $this->incidentPayload())->assertCreated();
        $schedule = PepSchedule::where('incident_id', $incidentResponse->json('data.id'))
            ->where('dose_day', 0)
            ->firstOrFail();

        // Nurse triggers manual reminder from PEP Schedule / Notifications screen
        $this->postJson('/api/send-sms', [
            'phone' => '09171234567',
            'message' => 'Manual Day 0 reminder',
            'patientId' => $incidentResponse->json('data.patient_id'),
            'incidentId' => $incidentResponse->json('data.id'),
            'pepScheduleId' => $schedule->id,
            'reminderType' => 'Vaccination Reminder',
            'scheduledDate' => $schedule->scheduled_date->toDateString(),
        ])->assertOk();

        // Scheduled 07:00 job runs afterwards for due-today schedules
        $counts = app(VaccinationReminderService::class)->dispatchScheduledReminders('today');
        $this->assertSame(1, $counts['duplicates']);
        $this->assertSame(1, Notification::count());
        Http::assertNothingSent();
    }

    public function test_scheduled_command_followed_by_manual_send_prevents_duplicate_reminder_for_same_schedule(): void
    {
        Carbon::setTestNow('2026-07-18 07:00:00');
        Http::preventStrayRequests();
        config(['services.sms.enabled' => false]);

        $this->authenticate('nurse_vaccinator');
        $incidentResponse = $this->postJson('/api/incidents', $this->incidentPayload())->assertCreated();
        $schedule = PepSchedule::where('incident_id', $incidentResponse->json('data.id'))
            ->where('dose_day', 0)
            ->firstOrFail();

        // Scheduled 07:00 job runs first (records 'Due Today Vaccination Reminder')
        $counts = app(VaccinationReminderService::class)->dispatchScheduledReminders('today');
        $this->assertSame(1, $counts['pending']);
        $this->assertSame(1, Notification::count());

        // Nurse subsequently clicks Send Reminder in PEP Schedule UI (which sends 'Vaccination Reminder')
        $this->postJson('/api/send-sms', [
            'phone' => '09171234567',
            'message' => 'Manual Day 0 reminder from PEP Schedule page',
            'patientId' => $incidentResponse->json('data.patient_id'),
            'incidentId' => $incidentResponse->json('data.id'),
            'pepScheduleId' => $schedule->id,
            'reminderType' => 'Vaccination Reminder',
            'scheduledDate' => $schedule->scheduled_date->toDateString(),
        ])->assertOk()
            ->assertJsonPath('meta.duplicate', true);

        $this->assertSame(1, Notification::count());
        Http::assertNothingSent();
    }

    public function test_rescheduling_overdue_dose_allows_new_reminder_for_updated_schedule_date_and_verifies_registered_scheduler_commands(): void
    {
        Carbon::setTestNow('2026-07-20 08:00:00');
        Http::preventStrayRequests();
        config(['services.sms.enabled' => false]);

        $this->authenticate('nurse_vaccinator');
        $incidentResponse = $this->postJson('/api/incidents', $this->incidentPayload([
            'incident_date' => '2026-07-18',
            'pep_start_date' => '2026-07-18',
        ]))->assertCreated();

        $dayZero = PepSchedule::where('incident_id', $incidentResponse->json('data.id'))
            ->where('dose_day', 0)
            ->firstOrFail();

        // Mark overdue Day 0 as Missed via command, then send missed reminder for 2026-07-18
        $this->artisan('bitemap:mark-missed-schedules')->assertSuccessful();
        $this->assertSame('Missed', $dayZero->fresh()->status);

        $missedCounts = app(VaccinationReminderService::class)->dispatchScheduledReminders('missed');
        $this->assertSame(1, $missedCounts['pending']);
        $this->assertSame(1, Notification::count());

        // Reschedule Day 0 to 2026-07-21 (tomorrow, within 1..3 days upcoming window)
        $dayZero->update([
            'scheduled_date' => '2026-07-21',
            'status' => 'Rescheduled',
        ]);

        // Both rescheduled Day 0 (2026-07-21) and Day 3 (2026-07-21) are due within the 1..3 day upcoming window
        $upcomingCounts = app(VaccinationReminderService::class)->dispatchScheduledReminders('upcoming');
        $this->assertSame(2, $upcomingCounts['pending']);
        $this->assertSame(3, Notification::count());
        $this->assertTrue(
            Notification::where('pep_schedule_id', $dayZero->id)
                ->where('reminder_type', 'Upcoming Vaccination Reminder')
                ->whereDate('scheduled_date', '2026-07-21')
                ->exists()
        );

        // Verify all 4 daily SMS/PEP schedule commands are registered with expected cron expressions
        $events = collect(app(\Illuminate\Console\Scheduling\Schedule::class)->events())
            ->mapWithKeys(fn ($event) => [
                trim(str_replace(["'", '"'], '', (string) $event->command)) => $event->expression,
            ]);

        $matchedExpressions = [];
        foreach ($events as $command => $expression) {
            foreach ([
                'bitemap:mark-missed-schedules',
                'bitemap:send-sms-reminders --scope=today',
                'bitemap:send-sms-reminders --scope=upcoming',
                'bitemap:send-sms-reminders --scope=missed',
            ] as $expectedCmd) {
                if (str_contains($command, $expectedCmd)) {
                    $matchedExpressions[$expectedCmd] = $expression;
                }
            }
        }

        $this->assertSame('15 0 * * *', $matchedExpressions['bitemap:mark-missed-schedules'] ?? null);
        $this->assertSame('0 7 * * *', $matchedExpressions['bitemap:send-sms-reminders --scope=today'] ?? null);
        $this->assertSame('30 7 * * *', $matchedExpressions['bitemap:send-sms-reminders --scope=upcoming'] ?? null);
        $this->assertSame('0 8 * * *', $matchedExpressions['bitemap:send-sms-reminders --scope=missed'] ?? null);
    }

    public function test_clinic_sms_reminders_disabled_setting_skips_scheduled_batch(): void
    {
        Carbon::setTestNow('2026-07-18 07:00:00');
        Http::preventStrayRequests();
        Setting::updateOrCreate(
            ['setting_key' => 'sms_reminders_enabled'],
            ['setting_value' => 'false']
        );

        $this->authenticate('nurse_vaccinator');
        $this->postJson('/api/incidents', $this->incidentPayload())->assertCreated();

        $this->artisan('bitemap:send-sms-reminders --scope=today')->assertSuccessful();
        $this->assertSame(0, Notification::count());
        Http::assertNothingSent();
    }

    public function test_philsms_provider_sends_formatted_payload_and_redacts_pii_from_delivery_response(): void
    {
        Http::fake([
            'app.philsms.com/api/v3/sms/send' => Http::response([
                'status' => 'success',
                'message' => 'Your message was successfully delivered to 639171234567',
                'data' => [
                    'uid' => 'philsms_uid_998877',
                    'to' => '639171234567',
                    'message' => 'Good day, Confidential Patient Name. Dose today.',
                    'status' => 'Delivered',
                ],
            ], 200),
        ]);

        config([
            'services.sms.enabled' => true,
            'services.sms.provider' => 'PhilSMS',
            'services.philsms.token' => 'philsms_secret_token_xyz',
            'services.philsms.sender_id' => 'BITEMAP',
        ]);

        $this->authenticate('nurse_vaccinator');
        $incidentResponse = $this->postJson('/api/incidents', $this->incidentPayload([
            'patient_name' => 'Confidential Patient Name',
        ]))->assertCreated();
        $schedule = PepSchedule::where('incident_id', $incidentResponse->json('data.id'))->orderBy('dose_day')->firstOrFail();

        $sendResponse = $this->postJson('/api/send-sms', [
            'phone' => '09171234567',
            'message' => 'Good day, Confidential Patient Name. Dose today.',
            'patientId' => $incidentResponse->json('data.patient_id'),
            'incidentId' => $incidentResponse->json('data.id'),
            'pepScheduleId' => $schedule->id,
            'reminderType' => 'Due Today Vaccination Reminder',
            'scheduledDate' => $schedule->scheduled_date->toDateString(),
        ])->assertOk()
            ->assertJsonPath('data.status', 'Sent');

        Http::assertSent(function (Request $request) {
            return $request->url() === 'https://app.philsms.com/api/v3/sms/send'
                && $request->hasHeader('Authorization', 'Bearer philsms_secret_token_xyz')
                && $request['recipient'] === '639171234567'
                && $request['sender_id'] === 'BITEMAP'
                && $request['type'] === 'plain';
        });

        $deliveryResponse = (string) $sendResponse->json('data.delivery_response');
        $this->assertStringContainsString('philsms_uid_998877', $deliveryResponse);
        $this->assertStringContainsString('awaiting handset delivery', $deliveryResponse);
        $this->assertStringNotContainsString('Confidential Patient Name', $deliveryResponse);
        $this->assertStringNotContainsString('639171234567', $deliveryResponse);
        $this->assertStringNotContainsString('philsms_secret_token_xyz', $deliveryResponse);

        // Verify AuditLog also masks the recipient phone number
        $audit = AuditLog::where('module', 'Notifications')->latest('id')->firstOrFail();
        $this->assertStringNotContainsString('09171234567', (string) $audit->details);
        $this->assertStringContainsString('0917****567', (string) $audit->details);
    }

    public function test_semaphore_provider_acceptance_and_failure_with_retry_workflow(): void
    {
        Http::fakeSequence('api.semaphore.co/api/v4/messages')
            ->push(['message' => 'Insufficient credit balance for 639171234567 using sema_secret_key'], 422)
            ->push([
                [
                    'message_id' => 554433,
                    'user_id' => 101,
                    'user' => 'clinic@example.com',
                    'account_id' => 202,
                    'account' => 'BITEMAP ABTC',
                    'recipient' => '639171234567',
                    'message' => 'Confidential retry message',
                    'sender_name' => 'SEMAPHORE',
                    'network' => 'Globe',
                    'status' => 'Queued',
                    'type' => 'Single',
                    'source' => 'Api',
                ],
            ], 200);

        config([
            'services.sms.enabled' => true,
            'services.sms.provider' => 'Semaphore',
            'services.semaphore.api_key' => 'sema_secret_key',
            'services.semaphore.sender_name' => 'SEMAPHORE',
        ]);

        $this->authenticate('nurse_vaccinator');
        $incidentResponse = $this->postJson('/api/incidents', $this->incidentPayload())->assertCreated();
        $schedule = PepSchedule::where('incident_id', $incidentResponse->json('data.id'))->orderBy('dose_day')->firstOrFail();

        // 1. First attempt fails (HTTP 422 Insufficient credit balance)
        $failedResponse = $this->postJson('/api/send-sms', [
            'phone' => '09171234567',
            'message' => 'Confidential retry message',
            'patientId' => $incidentResponse->json('data.patient_id'),
            'incidentId' => $incidentResponse->json('data.id'),
            'pepScheduleId' => $schedule->id,
            'reminderType' => 'Vaccination Reminder',
            'scheduledDate' => $schedule->scheduled_date->toDateString(),
        ])->assertUnprocessable()
            ->assertJsonPath('success', false)
            ->assertJsonPath('data.status', 'Failed');

        $notificationId = $failedResponse->json('data.id');
        $failedDeliveryResponse = (string) $failedResponse->json('data.delivery_response');
        $this->assertStringNotContainsString('sema_secret_key', $failedDeliveryResponse);
        $this->assertStringNotContainsString('639171234567', $failedDeliveryResponse);

        // 2. Retry the failed notification -> succeeds with HTTP 200
        $retryResponse = $this->postJson('/api/send-sms', [
            'phone' => '09171234567',
            'message' => 'Confidential retry message',
            'patientId' => $incidentResponse->json('data.patient_id'),
            'incidentId' => $incidentResponse->json('data.id'),
            'pepScheduleId' => $schedule->id,
            'reminderType' => 'Vaccination Reminder',
            'scheduledDate' => $schedule->scheduled_date->toDateString(),
            'retryNotificationId' => $notificationId,
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'Sent')
            ->assertJsonPath('meta.retried', true);

        $this->assertStringContainsString('554433', (string) $retryResponse->json('data.delivery_response'));
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Retry SMS',
            'module' => 'Notifications',
            'record_id' => (string) $notificationId,
        ]);

        // 3. Attempting to retry an already-Sent notification is rejected with 422
        $this->postJson('/api/send-sms', [
            'phone' => '09171234567',
            'message' => 'Confidential retry message',
            'patientId' => $incidentResponse->json('data.patient_id'),
            'incidentId' => $incidentResponse->json('data.id'),
            'retryNotificationId' => $notificationId,
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'Only failed SMS reminders can be retried.');
    }

    public function test_null_sms_enabled_config_fails_closed_into_simulation_mode(): void
    {
        Http::preventStrayRequests();
        config([
            'services.sms.enabled' => null,
            'services.sms.provider' => 'PhilSMS',
            'services.philsms.token' => 'philsms_token',
            'services.philsms.sender_id' => 'PhilSMS',
        ]);

        $this->assertFalse(app(SmsGateway::class)->isLiveSendingEnabled());
        $result = app(SmsGateway::class)->send('09171234567', 'Should not send live');
        $this->assertTrue($result->simulated);
        $this->assertSame('Pending', $result->status);
        Http::assertNothingSent();
    }

    private function authenticate(string $role): void
    {
        Sanctum::actingAs(User::factory()->create([
            'role' => $role,
            'is_active' => true,
            'approval_status' => 'approved',
        ]));
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function incidentPayload(array $overrides = []): array
    {
        return array_merge([
            'patient_name' => 'Maria Clara UAT',
            'age' => 28,
            'sex' => 'Female',
            'address' => 'Digos City',
            'contact_number' => '09171234567',
            'location_scope' => 'outside_digos',
            'incident_city_municipality' => 'Bansalan',
            'incident_province' => 'Davao del Sur',
            'incident_date' => '2026-07-18',
            'pep_start_date' => '2026-07-18',
            'animal_type' => 'Dog',
            'bite_site' => 'Right hand',
            'exposure_contact_types' => ['bite'],
            'exposure_skin_condition' => 'broken',
            'exposure_bleeding_present' => true,
            'exposure_transdermal' => true,
            'who_category' => 'Category III',
            'who_category_confirmed' => true,
            'status' => 'Active',
            'sms_consent' => true,
            'notes' => 'SMS Consent: Allowed',
        ], $overrides);
    }
}
