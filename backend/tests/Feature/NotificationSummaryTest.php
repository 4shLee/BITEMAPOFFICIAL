<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Incident;
use App\Models\Notification;
use App\Models\Patient;
use App\Models\PepSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationSummaryTest extends TestCase
{
    use RefreshDatabase;

    public function test_summary_returns_header_counts_without_notification_records(): void
    {
        $this->actAsClinicUser();
        $barangay = Barangay::create(['name' => 'Aplaya']);
        $overduePatient = $this->createPatient($barangay, 'Overdue Patient');
        $duePatient = $this->createPatient($barangay, 'Due Patient');
        $overdueIncident = $this->createIncident($overduePatient, $barangay);
        $dueIncident = $this->createIncident($duePatient, $barangay);

        foreach ([-2, -1] as $days) {
            PepSchedule::create([
                'incident_id' => $overdueIncident->id,
                'dose_day' => abs($days),
                'scheduled_date' => today()->addDays($days),
                'status' => 'Pending',
            ]);
        }
        PepSchedule::create([
            'incident_id' => $dueIncident->id,
            'dose_day' => 0,
            'scheduled_date' => today(),
            'status' => 'Pending',
        ]);
        Notification::create([
            'patient_id' => $overduePatient->id,
            'incident_id' => $overdueIncident->id,
            'notification_type' => 'SMS',
            'recipient' => '09171234567',
            'message' => 'Pending reminder',
            'status' => 'Pending',
        ]);
        Notification::create([
            'patient_id' => $duePatient->id,
            'incident_id' => $dueIncident->id,
            'notification_type' => 'SMS',
            'recipient' => '09171234568',
            'message' => 'Failed reminder',
            'status' => 'Failed',
        ]);

        config()->set('services.twilio.sid', null);
        DB::flushQueryLog();
        DB::enableQueryLog();
        $response = $this->getJson('/api/notifications/summary')->assertOk();
        $queryCount = count(DB::getQueryLog());

        $response
            ->assertJsonMissingPath('data')
            ->assertJsonPath('meta.summary.overdue_patients', 1)
            ->assertJsonPath('meta.summary.due_today_patients', 1)
            ->assertJsonPath('meta.summary.pending_sms', 1)
            ->assertJsonPath('meta.summary.failed_sms', 1)
            ->assertJsonPath('meta.priority_alert.category', 'overdue_patients')
            ->assertJsonPath('meta.priority_alert.count', 1);
        $this->assertLessThanOrEqual(3, $queryCount);
        $this->assertSame(
            $response->json('meta'),
            $this->getJson('/api/notifications')->assertOk()->json('meta')
        );
    }

    public function test_summary_preserves_notification_permissions(): void
    {
        $this->getJson('/api/notifications/summary')->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create([
            'role' => 'system_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]));

        $this->getJson('/api/notifications/summary')->assertForbidden();
    }

    private function actAsClinicUser(): void
    {
        Sanctum::actingAs(User::factory()->create([
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]));
    }

    private function createPatient(Barangay $barangay, string $name): Patient
    {
        return Patient::create([
            'full_name' => $name,
            'age' => 30,
            'sex' => 'Female',
            'address' => 'Test address',
            'residence_barangay' => $barangay->name,
            'barangay_id' => $barangay->id,
            'contact_number' => '09171234567',
        ]);
    }

    private function createIncident(Patient $patient, Barangay $barangay): Incident
    {
        return Incident::create([
            'patient_id' => $patient->id,
            'barangay_id' => $barangay->id,
            'incident_date' => today(),
            'animal_type' => 'Dog',
            'bite_site' => 'Arm',
            'who_category' => 'II',
            'status' => 'Active',
        ]);
    }
}
