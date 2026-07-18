<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\PepSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SmsConsentReminderWorkflowTest extends TestCase
{
    use RefreshDatabase;

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
        config([
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

        $this->postJson('/api/send-sms', [
            'phone' => '09171234567',
            'message' => 'PEP reminder',
            'patientId' => $incidentResponse->json('data.patient_id'),
            'incidentId' => $incidentResponse->json('data.id'),
        ])->assertOk()
            ->assertJsonPath('data.status', 'Pending');

        $this->assertDatabaseHas('notifications', [
            'incident_id' => $incidentResponse->json('data.id'),
            'notification_type' => 'SMS',
            'status' => 'Pending',
        ]);
    }

    private function incidentPayload(bool $smsConsent): array
    {
        return [
            'patient_name' => $smsConsent ? 'Allowed Consent Patient' : 'Declined Consent Patient',
            'age' => 30,
            'sex' => 'Female',
            'address' => 'Digos City',
            'contact_number' => '09171234567',
            'incident_date' => '2026-07-18',
            'animal_type' => 'Dog',
            'bite_site' => 'Left arm',
            'who_category' => 'Category II',
            'status' => 'Active',
            'sms_consent' => $smsConsent,
            'notes' => 'SMS Consent: '.($smsConsent ? 'Allowed' : 'Declined'),
        ];
    }
}
