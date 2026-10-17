<?php

namespace Tests\Feature;

use App\Models\PepSchedule;
use App\Models\Setting;
use App\Models\User;
use App\Support\PhoneNumber;
use App\Support\SmsCredentials;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SmsProductionSafetyTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_phone_numbers_are_normalised_to_e164(): void
    {
        $this->assertSame('+639171234567', PhoneNumber::toE164('09171234567'));
        $this->assertSame('+639171234567', PhoneNumber::toE164(' 09171234567 '));
        $this->assertSame('+639171234567', PhoneNumber::toE164('639171234567'));
        $this->assertSame('+639171234567', PhoneNumber::toE164('+639171234567'));
        $this->assertSame('+15551234567', PhoneNumber::toE164('+15551234567'));
        $this->assertSame('12345', PhoneNumber::toE164('12345'));
    }

    public function test_manual_reminder_sends_e164_number_to_twilio_but_stores_the_entered_number(): void
    {
        $this->enableFakeTwilio();
        $this->authenticate('nurse_vaccinator');
        $incident = $this->postJson('/api/incidents', $this->incidentPayload())->assertCreated();
        $schedule = PepSchedule::where('incident_id', $incident->json('data.id'))->orderBy('dose_day')->firstOrFail();

        $this->postJson('/api/send-sms', [
            'phone' => '09171234567',
            'message' => 'PEP reminder',
            'patientId' => $incident->json('data.patient_id'),
            'incidentId' => $incident->json('data.id'),
            'pepScheduleId' => $schedule->id,
            'reminderType' => 'Vaccination Reminder',
            'scheduledDate' => $schedule->scheduled_date->toDateString(),
        ])->assertOk()->assertJsonPath('data.status', 'Sent');

        Http::assertSent(fn (Request $request) => $request['To'] === '+639171234567');
        $this->assertDatabaseHas('notifications', ['recipient' => '09171234567', 'status' => 'Sent']);
    }

    public function test_scheduled_reminders_send_e164_number_to_twilio(): void
    {
        Carbon::setTestNow('2026-07-18 07:00:00');
        $this->enableFakeTwilio();
        $this->authenticate('nurse_vaccinator');
        $this->postJson('/api/incidents', $this->incidentPayload())->assertCreated();

        $this->artisan('bitemap:send-sms-reminders --scope=today')->assertSuccessful();

        Http::assertSentCount(1);
        Http::assertSent(fn (Request $request) => $request['To'] === '+639171234567');
    }

    public function test_database_stored_credentials_are_ignored_in_production_by_default(): void
    {
        Setting::create(['setting_key' => 'twilio_account_sid', 'setting_value' => 'AC_FROM_DB']);
        config(['services.twilio.sid' => 'AC_FROM_ENV', 'services.sms.allow_database_credentials' => null]);

        $this->assertSame('AC_FROM_DB', SmsCredentials::resolve()['sid'], 'local/testing keeps the existing behaviour');

        $this->app['env'] = 'production';
        $this->assertSame('AC_FROM_ENV', SmsCredentials::resolve()['sid']);

        config(['services.sms.allow_database_credentials' => true]);
        $this->assertSame('AC_FROM_DB', SmsCredentials::resolve()['sid']);
    }

    public function test_saving_plaintext_twilio_credentials_is_blocked_in_production(): void
    {
        $this->authenticate('system_admin');
        $payload = ['account_sid' => 'AC_X', 'auth_token' => 'tok', 'from_number' => '+15551234567'];

        $this->app['env'] = 'production';
        $this->postJson('/api/settings/sms-credentials', $payload)->assertForbidden();
        $this->assertSame(0, Setting::where('setting_key', 'like', 'twilio_%')->count());

        $this->app['env'] = 'testing';
        $this->postJson('/api/settings/sms-credentials', $payload)->assertOk();
        $this->assertSame(3, Setting::where('setting_key', 'like', 'twilio_%')->count());
    }

    public function test_live_sms_stays_in_simulation_unless_explicitly_enabled(): void
    {
        Http::preventStrayRequests();
        config([
            'services.sms.enabled' => false,
            'services.twilio.sid' => 'AC_TEST',
            'services.twilio.token' => 'secret',
            'services.twilio.from' => '+15551234567',
        ]);
        $this->authenticate('nurse_vaccinator');
        $incident = $this->postJson('/api/incidents', $this->incidentPayload())->assertCreated();
        $schedule = PepSchedule::where('incident_id', $incident->json('data.id'))->orderBy('dose_day')->firstOrFail();

        $this->postJson('/api/send-sms', [
            'phone' => '09171234567',
            'message' => 'PEP reminder',
            'patientId' => $incident->json('data.patient_id'),
            'incidentId' => $incident->json('data.id'),
            'pepScheduleId' => $schedule->id,
            'scheduledDate' => $schedule->scheduled_date->toDateString(),
        ])->assertOk()->assertJsonPath('data.status', 'Pending');

        Http::assertNothingSent();
    }

    private function enableFakeTwilio(): void
    {
        Http::fake(['api.twilio.com/*' => Http::response(['sid' => 'SM_TEST'], 201)]);
        config([
            'services.sms.enabled' => true,
            'services.twilio.sid' => 'AC_TEST',
            'services.twilio.token' => 'secret',
            'services.twilio.from' => '+15551234567',
        ]);
    }

    private function authenticate(string $role): void
    {
        Sanctum::actingAs(User::factory()->create([
            'role' => $role,
            'is_active' => true,
            'approval_status' => 'approved',
        ]));
    }

    private function incidentPayload(): array
    {
        return [
            'patient_name' => 'Dummy Test Patient',
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
            'sms_consent' => true,
            'notes' => 'SMS Consent: Allowed',
        ];
    }
}
