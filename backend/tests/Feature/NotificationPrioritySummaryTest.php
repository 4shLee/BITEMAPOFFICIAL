<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\PepSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationPrioritySummaryTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_priority_uses_highest_non_zero_category_in_clinic_order(): void
    {
        Carbon::setTestNow('2026-07-18 09:00:00');
        Sanctum::actingAs(User::factory()->create([
            'role' => 'Nurse',
            'is_active' => true,
            'approval_status' => 'approved',
        ]));

        $incidentIds = collect(range(1, 4))->map(fn (int $number) => $this->createIncident('Overdue Patient '.$number));
        PepSchedule::whereIn('incident_id', $incidentIds)->update(['status' => 'Done']);
        foreach ($incidentIds as $incidentId) {
            PepSchedule::where('incident_id', $incidentId)->orderBy('dose_day')->firstOrFail()->update([
                'scheduled_date' => '2026-07-17',
                'status' => 'Missed',
            ]);
        }

        $referenceSchedule = PepSchedule::where('incident_id', $incidentIds->first())->firstOrFail();
        $this->createNotificationRows($referenceSchedule, 'Failed', 2);
        $this->createNotificationRows($referenceSchedule, 'Pending', 17);

        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('meta.summary.overdue_patients', 4)
            ->assertJsonPath('meta.summary.failed_sms', 2)
            ->assertJsonPath('meta.summary.due_today_patients', 0)
            ->assertJsonPath('meta.summary.pending_sms', 17)
            ->assertJsonPath('meta.priority_alert.category', 'overdue_patients')
            ->assertJsonPath('meta.priority_alert.count', 4);

        PepSchedule::whereIn('incident_id', $incidentIds)->update(['status' => 'Done']);
        $dueIncidentIds = collect(range(1, 3))->map(fn (int $number) => $this->createIncident('Due Patient '.$number));
        PepSchedule::whereIn('incident_id', $dueIncidentIds)->update(['status' => 'Done']);
        foreach ($dueIncidentIds as $incidentId) {
            PepSchedule::where('incident_id', $incidentId)->orderBy('dose_day')->firstOrFail()->update([
                'scheduled_date' => '2026-07-18',
                'status' => 'Pending',
            ]);
        }

        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('meta.summary.overdue_patients', 0)
            ->assertJsonPath('meta.summary.failed_sms', 2)
            ->assertJsonPath('meta.summary.due_today_patients', 3)
            ->assertJsonPath('meta.summary.pending_sms', 17)
            ->assertJsonPath('meta.priority_alert.category', 'failed_sms')
            ->assertJsonPath('meta.priority_alert.count', 2);
    }

    private function createIncident(string $patientName): int
    {
        return (int) $this->postJson('/api/incidents', [
            'patient_name' => $patientName,
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
        ])->assertCreated()->json('data.id');
    }

    private function createNotificationRows(PepSchedule $schedule, string $status, int $count): void
    {
        foreach (range(1, $count) as $number) {
            Notification::create([
                'patient_id' => $schedule->incident->patient_id,
                'incident_id' => $schedule->incident_id,
                'notification_type' => 'SMS',
                'recipient' => '09171234567',
                'message' => $status.' reminder '.$number,
                'status' => $status,
            ]);
        }
    }
}
