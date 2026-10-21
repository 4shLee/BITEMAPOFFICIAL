<?php

namespace App\Services\Sms;

use App\Models\Incident;
use App\Models\Notification;
use App\Models\Patient;
use App\Models\PepSchedule;
use App\Models\Setting;
use App\Support\PhoneNumber;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class VaccinationReminderService
{
    /**
     * Standard PEP schedule day offsets for human bite cases.
     *
     * @var array<int, int>
     */
    public const PEP_DOSE_DAYS = [0, 3, 7, 14, 28];

    public function __construct(
        private readonly SmsGateway $smsGateway = new SmsGateway,
    ) {}

    /**
     * Check whether automated clinic SMS reminders are enabled in settings (defaults to true).
     */
    public function isClinicRemindersEnabled(): bool
    {
        $setting = Setting::query()->where('setting_key', 'sms_reminders_enabled')->value('setting_value');
        if ($setting === null || trim((string) $setting) === '') {
            return true;
        }

        return filter_var($setting, FILTER_VALIDATE_BOOL);
    }

    /**
     * Resolve the configured clinic/facility name used in SMS templates.
     */
    public function facilityName(): string
    {
        return (string) config(
            'services.sms.facility_name',
            config('services.twilio.facility_name', 'Animal Bite Treatment Center')
        );
    }

    /**
     * Determine whether a patient & incident have explicit SMS consent.
     */
    public function hasExplicitSmsConsent(?Patient $patient, ?Incident $incident = null): bool
    {
        if (! $patient || $patient->sms_consent !== true) {
            return false;
        }

        if ($incident && preg_match('/^SMS Consent:\s*(.+)$/mi', (string) $incident->notes, $matches) === 1) {
            $consentValue = strtolower(trim($matches[1]));

            return in_array($consentValue, ['allowed', 'yes', 'true'], true);
        }

        return true;
    }

    /**
     * Query PEP schedules eligible for reminder consideration under the requested scope.
     *
     * Excludes:
     * - Doses that have already been administered (`administered_date` not null or status Done/Completed/Cancelled/Skipped)
     * - Incidents already marked Completed or Cancelled
     *
     * @return Collection<int, PepSchedule>
     */
    public function eligibleSchedulesForScope(string $scope, ?Carbon $referenceDate = null): Collection
    {
        $ref = ($referenceDate ?? today())->copy()->startOfDay();
        $upcomingWindowDays = max(1, (int) (Setting::query()->where('setting_key', 'reminder_days_before')->value('setting_value') ?: 3));

        $query = PepSchedule::with(['incident.patient'])
            ->whereIn('dose_day', self::PEP_DOSE_DAYS)
            ->whereNull('administered_date')
            ->whereIn('status', ['Pending', 'Upcoming', 'Rescheduled', 'Missed'])
            ->whereHas('incident', function ($incidentQuery) {
                $incidentQuery->whereNotIn('status', ['Completed', 'Cancelled']);
            });

        if ($scope === 'upcoming') {
            $query->whereIn('status', ['Pending', 'Upcoming', 'Rescheduled'])
                ->whereDate('scheduled_date', '>=', $ref->copy()->addDay()->toDateString())
                ->whereDate('scheduled_date', '<=', $ref->copy()->addDays($upcomingWindowDays)->toDateString());
        } elseif ($scope === 'missed') {
            $query->where('status', 'Missed');
        } else {
            $query->whereDate('scheduled_date', $ref->toDateString());
        }

        return $query->orderBy('scheduled_date')->orderBy('id')->get();
    }

    /**
     * Map a reminder scope ('today', 'upcoming', 'missed') to its human-readable reminder_type.
     */
    public function reminderTypeForScope(string $scope): string
    {
        return match ($scope) {
            'missed' => 'Missed Appointment Follow-up',
            'upcoming' => 'Upcoming Vaccination Reminder',
            default => 'Due Today Vaccination Reminder',
        };
    }

    /**
     * Format the vaccination reminder message for a patient and PEP schedule.
     */
    public function formatMessage(string $scope, Patient $patient, PepSchedule $schedule, ?string $facilityName = null): string
    {
        $facility = $facilityName ?? $this->facilityName();
        $dateString = $schedule->scheduled_date->toDateString();

        return match ($scope) {
            'upcoming' => 'Good day, '.$patient->full_name.'. This is a reminder that your next anti-rabies vaccination dose is scheduled on '.$dateString.'. Please do not miss your schedule.',
            'missed' => 'Good day, '.$patient->full_name.'. Our record shows that you missed your anti-rabies vaccination schedule on '.$dateString.'. Please contact or visit '.$facility.' as soon as possible.',
            default => 'Good day, '.$patient->full_name.'. This is a reminder that your anti-rabies vaccination dose is scheduled today at '.$facility.'. Please visit the center within working hours. Thank you.',
        };
    }

    /**
     * Build the deterministic SHA-256 reminder identity key used to prevent duplicate sends.
     */
    public function buildReminderKey(
        int|string $patientId,
        int|string $incidentId,
        int|string $pepScheduleId,
        string $reminderType,
        string $scheduledDate
    ): string {
        return hash('sha256', implode('|', [
            $patientId,
            $incidentId,
            $pepScheduleId,
            strtolower(trim($reminderType)),
            $scheduledDate,
        ]));
    }

    /**
     * Execute a batch of scheduled reminders for the given scope ('today', 'upcoming', 'missed').
     *
     * @return array{sent: int, pending: int, failed: int, declined: int, duplicates: int, skipped_disabled: bool}
     */
    public function dispatchScheduledReminders(string $scope = 'today', ?Carbon $referenceDate = null): array
    {
        $counts = [
            'sent' => 0,
            'pending' => 0,
            'failed' => 0,
            'declined' => 0,
            'duplicates' => 0,
            'skipped_disabled' => false,
        ];

        if (! $this->isClinicRemindersEnabled()) {
            $counts['skipped_disabled'] = true;

            return $counts;
        }

        $schedules = $this->eligibleSchedulesForScope($scope, $referenceDate);
        $facility = $this->facilityName();
        $reminderType = $this->reminderTypeForScope($scope);

        foreach ($schedules as $schedule) {
            $incident = $schedule->incident;
            $patient = $incident?->patient;
            $recipient = $patient?->contact_number;

            if (! $this->hasExplicitSmsConsent($patient, $incident)) {
                $counts['declined']++;

                continue;
            }

            if (! $patient || blank($recipient) || ! PhoneNumber::isValidPhilippineMobile((string) $recipient)) {
                $counts['failed']++;

                continue;
            }

            $message = $this->formatMessage($scope, $patient, $schedule, $facility);
            $scheduledDate = $schedule->scheduled_date->toDateString();
            $reminderKey = $this->buildReminderKey(
                $patient->id,
                $schedule->incident_id,
                $schedule->id,
                $reminderType,
                $scheduledDate
            );

            // Prevent duplicate sends across manual and scheduled triggers for the same PEP schedule + date
            $existingForScheduleDate = Notification::query()
                ->where('patient_id', $patient->id)
                ->where('incident_id', $schedule->incident_id)
                ->where('pep_schedule_id', $schedule->id)
                ->where('notification_type', 'SMS')
                ->whereDate('scheduled_date', $scheduledDate)
                ->whereIn('status', ['Pending', 'Sent', 'Delivered'])
                ->where(function ($query) use ($reminderKey, $reminderType) {
                    $query->where('reminder_key', $reminderKey)
                        ->orWhere('reminder_type', $reminderType)
                        ->orWhere('reminder_type', 'Vaccination Reminder');
                })
                ->exists();

            if ($existingForScheduleDate) {
                $counts['duplicates']++;

                continue;
            }

            $legacyPending = Notification::query()
                ->whereNull('reminder_key')
                ->where('patient_id', $patient->id)
                ->where('incident_id', $schedule->incident_id)
                ->where('notification_type', 'SMS')
                ->where('recipient', $recipient)
                ->where('message', $message)
                ->where('status', 'Pending')
                ->exists();

            if ($legacyPending) {
                $counts['duplicates']++;

                continue;
            }

            $notification = Notification::firstOrCreate(
                ['reminder_key' => $reminderKey],
                [
                    'patient_id' => $patient->id,
                    'incident_id' => $schedule->incident_id,
                    'pep_schedule_id' => $schedule->id,
                    'notification_type' => 'SMS',
                    'reminder_type' => $reminderType,
                    'scheduled_date' => $scheduledDate,
                    'recipient' => $recipient,
                    'message' => $message,
                    'status' => 'Pending',
                    'delivery_response' => 'Reminder reserved for processing.',
                ]
            );

            if (! $notification->wasRecentlyCreated) {
                $counts['duplicates']++;

                continue;
            }

            $result = $this->smsGateway->send((string) $recipient, $message, [
                'scope' => $scope,
                'pep_schedule_id' => $schedule->id,
                'dose_day' => $schedule->dose_day,
                'reminder_type' => $reminderType,
            ]);

            $notification->update([
                'status' => $result->status,
                'sent_at' => in_array($result->status, ['Sent', 'Delivered'], true) ? now() : null,
                'delivery_response' => $result->deliveryResponse,
            ]);

            if ($result->status === 'Sent' || $result->status === 'Delivered') {
                $counts['sent']++;
            } elseif ($result->status === 'Failed') {
                $counts['failed']++;
            } else {
                $counts['pending']++;
            }
        }

        return $counts;
    }
}
