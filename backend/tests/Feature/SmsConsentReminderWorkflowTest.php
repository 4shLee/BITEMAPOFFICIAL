<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\PepSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SmsConsentReminderWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_declined_consent_keeps_pep_schedule_but_blocks_sms_notification(): void
    {
        Sanctum::actingAs(User::factory()->create([
            'role' => 'Nurse',
            'is_active' => true,
            'approval_status' => 'approved',
        ]));

        $incidentResponse = $this->postJson('/api/incidents', $this->incidentPayload(false));

        $incidentResponse->assertCreated()
            ->assertJsonPath('data.sms_consent', false)
            ->assertJsonCount(5, 'data.pep_schedules');

        $incidentId = $incidentResponse->json('data.id');
        $patientId = $incidentResponse->json('data.patient_id');

        $this->assertSame(5, PepSchedule::where('incident_id', $incidentId)->count());

        $this->postJson('/api/send-sms', [
            'phone' => '09171234567',
            'message' => 'PEP reminder',
            'patientId' => $patientId,
            'incidentId' => $incidentId,
        ])->assertUnprocessable()
            ->assertJsonPath('success', false);

        $this->assertSame(0, Notification::where('incident_id', $incidentId)->count());
    }

    public function test_allowed_consent_queues_notification_when_twilio_is_unavailable(): void
    {
        Http::preventStrayRequests();
        config([
            'services.sms.enabled' => false,
            'services.twilio.sid' => null,
            'services.twilio.token' => null,
            'services.twilio.from' => null,
        ]);

        Sanctum::actingAs(User::factory()->create([
            'role' => 'Nurse',
            'is_active' => true,
            'approval_status' => 'approved',
        ]));

        $incidentResponse = $this->postJson('/api/incidents', $this->incidentPayload(true));
        $incidentResponse->assertCreated()->assertJsonPath('data.sms_consent', true);
        $schedule = PepSchedule::where('incident_id', $incidentResponse->json('data.id'))->orderBy('dose_day')->firstOrFail();

        $this->postJson('/api/send-sms', [
            'phone' => '09171234567',
            'message' => 'PEP reminder',
            'patientId' => $incidentResponse->json('data.patient_id'),
            'incidentId' => $incidentResponse->json('data.id'),
            'pepScheduleId' => $schedule->id,
            'reminderType' => 'Vaccination Reminder',
            'scheduledDate' => $schedule->scheduled_date->toDateString(),
        ])->assertOk()
            ->assertJsonPath('data.status', 'Pending');

        Http::assertNothingSent();

        $this->assertDatabaseHas('notifications', [
            'incident_id' => $incidentResponse->json('data.id'),
            'notification_type' => 'SMS',
            'status' => 'Pending',
        ]);
    }

    public function test_reprocessing_an_existing_pending_reminder_does_not_create_a_duplicate(): void
    {
        Http::preventStrayRequests();
        config(['services.sms.enabled' => false]);
        $this->authenticateNurse();

        $incidentResponse = $this->postJson('/api/incidents', $this->incidentPayload(true))->assertCreated();
        $schedule = PepSchedule::where('incident_id', $incidentResponse->json('data.id'))->orderBy('dose_day')->firstOrFail();
        $payload = $this->reminderPayload($incidentResponse, $schedule);

        $this->postJson('/api/send-sms', $payload)
            ->assertOk()
            ->assertJsonPath('data.status', 'Pending')
            ->assertJsonPath('meta.duplicate', false);
        $this->postJson('/api/send-sms', $payload)
            ->assertOk()
            ->assertJsonPath('data.status', 'Pending')
            ->assertJsonPath('meta.duplicate', true);

        $this->assertSame(1, Notification::where('reminder_key', '!=', null)->count());
        Http::assertNothingSent();
    }

    public function test_legacy_pending_reminder_without_identity_is_not_duplicated(): void
    {
        Http::preventStrayRequests();
        config(['services.sms.enabled' => false]);
        $this->authenticateNurse();

        $incidentResponse = $this->postJson('/api/incidents', $this->incidentPayload(true))->assertCreated();
        $schedule = PepSchedule::where('incident_id', $incidentResponse->json('data.id'))->orderBy('dose_day')->firstOrFail();
        $payload = $this->reminderPayload($incidentResponse, $schedule);
        Notification::create([
            'patient_id' => $incidentResponse->json('data.patient_id'),
            'incident_id' => $incidentResponse->json('data.id'),
            'notification_type' => 'SMS',
            'recipient' => $payload['phone'],
            'message' => $payload['message'],
            'status' => 'Pending',
        ]);

        $this->postJson('/api/send-sms', $payload)
            ->assertOk()
            ->assertJsonPath('meta.duplicate', true);

        $this->assertDatabaseCount('notifications', 1);
        Http::assertNothingSent();
    }

    public function test_sms_enabled_calls_gateway_and_records_returned_status(): void
    {
        Http::fake(['api.twilio.com/*' => Http::response(['sid' => 'SM_TEST'], 201)]);
        config([
            'services.sms.enabled' => true,
            'services.twilio.sid' => 'AC_TEST',
            'services.twilio.token' => 'secret',
            'services.twilio.from' => '+15551234567',
        ]);
        $this->authenticateNurse();

        $incidentResponse = $this->postJson('/api/incidents', $this->incidentPayload(true))->assertCreated();
        $schedule = PepSchedule::where('incident_id', $incidentResponse->json('data.id'))->orderBy('dose_day')->firstOrFail();

        $this->postJson('/api/send-sms', $this->reminderPayload($incidentResponse, $schedule))
            ->assertOk()
            ->assertJsonPath('data.status', 'Sent');

        Http::assertSentCount(1);
        $this->assertDatabaseHas('notifications', ['pep_schedule_id' => $schedule->id, 'status' => 'Sent']);
    }

    public function test_missing_explicit_consent_does_not_queue_or_send(): void
    {
        Http::preventStrayRequests();
        config(['services.sms.enabled' => false]);
        $this->authenticateNurse();
        $payload = $this->incidentPayload(true);
        unset($payload['sms_consent'], $payload['notes']);

        $incidentResponse = $this->postJson('/api/incidents', $payload)->assertCreated();
        $schedule = PepSchedule::where('incident_id', $incidentResponse->json('data.id'))->orderBy('dose_day')->firstOrFail();

        $this->postJson('/api/send-sms', $this->reminderPayload($incidentResponse, $schedule))
            ->assertUnprocessable()
            ->assertJsonPath('success', false);

        $this->assertDatabaseCount('notifications', 0);
        Http::assertNothingSent();
    }

    public function test_repeated_scheduled_execution_does_not_duplicate_pending_reminder(): void
    {
        Carbon::setTestNow('2026-07-18 07:00:00');
        Http::preventStrayRequests();
        config(['services.sms.enabled' => false]);
        $this->authenticateNurse();
        $this->postJson('/api/incidents', $this->incidentPayload(true))->assertCreated();

        $this->artisan('bitemap:send-sms-reminders --scope=today')->assertSuccessful();
        $this->artisan('bitemap:send-sms-reminders --scope=today')->assertSuccessful();

        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseHas('notifications', ['status' => 'Pending']);
        Http::assertNothingSent();
    }

    private function authenticateNurse(): void
    {
        Sanctum::actingAs(User::factory()->create([
            'role' => 'Nurse',
            'is_active' => true,
            'approval_status' => 'approved',
        ]));
    }

    private function reminderPayload($incidentResponse, PepSchedule $schedule): array
    {
        return [
            'phone' => '09171234567',
            'message' => 'PEP reminder for Day '.$schedule->dose_day,
            'patientId' => $incidentResponse->json('data.patient_id'),
            'incidentId' => $incidentResponse->json('data.id'),
            'pepScheduleId' => $schedule->id,
            'reminderType' => 'Vaccination Reminder',
            'scheduledDate' => $schedule->scheduled_date->toDateString(),
        ];
    }

    private function incidentPayload(bool $smsConsent): array
    {
        return [
            'patient_name' => $smsConsent ? 'Allowed Consent Patient' : 'Declined Consent Patient',
            'age' => 30,
            'sex' => 'Female',
            'address' => 'Digos City',
            'contact_number' => '09171234567',
            'location_scope' => 'outside_digos',
            'incident_city_municipality' => 'Bansalan',
            'incident_province' => 'Davao del Sur',
            'incident_date' => '2026-07-18',
            'pep_start_date' => '2026-07-18',
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'exposure_contact_types' => ['scratch'],
            'exposure_skin_condition' => 'broken',
            'exposure_bleeding_present' => false,
            'exposure_transdermal' => false,
            'who_category' => 'Category II',
            'who_category_confirmed' => true,
            'status' => 'Active',
            'sms_consent' => $smsConsent,
            'notes' => 'SMS Consent: '.($smsConsent ? 'Allowed' : 'Declined'),
        ];
    }
}
