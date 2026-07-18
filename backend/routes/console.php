<?php

use App\Models\AuditLog;
use App\Models\Notification;
use App\Models\PepSchedule;
use App\Models\Setting;
use App\Support\DefaultAdminAccount;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('bitemap:reset-admin', function () {
    $user = DefaultAdminAccount::reset();

    $this->info('BITEMAP admin account is ready.');
    $this->line('Email: '.DefaultAdminAccount::EMAIL);
    $this->line('Password: '.DefaultAdminAccount::PASSWORD);
    $this->line('User ID: '.$user->id);
})->purpose('Reset the local BITEMAP admin account');

Artisan::command('bitemap:mark-missed-schedules', function () {
    $updated = PepSchedule::query()
        ->whereDate('scheduled_date', '<', today())
        ->whereIn('status', ['Pending', 'Upcoming', 'Rescheduled'])
        ->update(['status' => 'Missed']);

    AuditLog::create([
        'action' => 'Missed schedule detection',
        'action_type' => 'Missed schedule detection',
        'module' => 'PEP Schedule',
        'details' => 'Automatically marked '.$updated.' schedule(s) as missed.',
        'description' => 'Automatically marked '.$updated.' schedule(s) as missed.',
        'user_name' => 'System',
        'user_role' => 'System',
    ]);

    $this->info('Marked '.$updated.' missed schedule(s).');
})->purpose('Mark overdue PEP schedules as missed');

Artisan::command('bitemap:send-sms-reminders {--scope=today}', function () {
    $scope = (string) $this->option('scope');
    $query = PepSchedule::with(['incident.patient'])
        ->whereIn('status', ['Pending', 'Upcoming', 'Rescheduled', 'Missed']);

    if ($scope === 'upcoming') {
        $query->whereBetween('scheduled_date', [today()->addDay(), today()->addDays(3)]);
    } elseif ($scope === 'missed') {
        $query->where('status', 'Missed');
    } else {
        $query->whereDate('scheduled_date', today());
    }

    $configuredSettings = Setting::query()
        ->whereIn('setting_key', ['twilio_account_sid', 'twilio_auth_token', 'twilio_from_number'])
        ->pluck('setting_value', 'setting_key');
    $sid = $configuredSettings->get('twilio_account_sid') ?: config('services.twilio.sid');
    $token = $configuredSettings->get('twilio_auth_token') ?: config('services.twilio.token');
    $from = $configuredSettings->get('twilio_from_number') ?: config('services.twilio.from');
    $serviceFlag = config('services.sms.enabled');
    $smsServiceEnabled = ! blank($sid) && ! blank($token) && ! blank($from)
        && ($serviceFlag === null || filter_var($serviceFlag, FILTER_VALIDATE_BOOL));
    $facility = config('services.twilio.facility_name', 'Animal Bite Treatment Center');
    $sent = 0;
    $failed = 0;
    $pending = 0;
    $declined = 0;
    $duplicates = 0;

    foreach ($query->get() as $schedule) {
        $patient = $schedule->incident?->patient;
        $recipient = $patient?->contact_number;

        $consentValue = null;
        if (preg_match('/^SMS Consent:\s*(.+)$/mi', (string) $schedule->incident?->notes, $matches) === 1) {
            $consentValue = strtolower(trim($matches[1]));
        }
        $smsAllowed = $consentValue === null
            ? $patient?->sms_consent === true
            : in_array($consentValue, ['allowed', 'yes', 'true'], true) && $patient?->sms_consent === true;

        if (! $smsAllowed) {
            $declined++;

            continue;
        }

        if (! $patient || blank($recipient)) {
            $failed++;

            continue;
        }

        $message = match ($scope) {
            'upcoming' => 'Good day, '.$patient->full_name.'. This is a reminder that your next anti-rabies vaccination dose is scheduled on '.$schedule->scheduled_date->toDateString().'. Please do not miss your schedule.',
            'missed' => 'Good day, '.$patient->full_name.'. Our record shows that you missed your anti-rabies vaccination schedule on '.$schedule->scheduled_date->toDateString().'. Please contact or visit '.$facility.' as soon as possible.',
            default => 'Good day, '.$patient->full_name.'. This is a reminder that your anti-rabies vaccination dose is scheduled today at '.$facility.'. Please visit the center within working hours. Thank you.',
        };

        $reminderType = match ($scope) {
            'missed' => 'Missed Appointment Follow-up',
            'upcoming' => 'Upcoming Vaccination Reminder',
            default => 'Due Today Vaccination Reminder',
        };
        $scheduledDate = $schedule->scheduled_date->toDateString();
        $reminderKey = hash('sha256', implode('|', [
            $patient->id,
            $schedule->incident_id,
            $schedule->id,
            strtolower($reminderType),
            $scheduledDate,
        ]));

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
            $duplicates++;

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
            $duplicates++;

            continue;
        }

        $status = 'Pending';
        $responseText = 'SMS simulation mode is active. No real SMS was sent; the reminder is recorded for testing and review.';

        if ($smsServiceEnabled) {
            try {
                $response = Http::asForm()
                    ->withBasicAuth($sid, $token)
                    ->post('https://api.twilio.com/2010-04-01/Accounts/'.$sid.'/Messages.json', [
                        'From' => $from,
                        'To' => $recipient,
                        'Body' => $message,
                    ]);

                $status = $response->successful() ? 'Sent' : 'Failed';
                $responseText = $response->body();
            } catch (Throwable $exception) {
                $status = 'Failed';
                $responseText = $exception->getMessage();
            }
        }

        $notification->update([
            'status' => $status,
            'sent_at' => in_array($status, ['Sent', 'Delivered'], true) ? now() : null,
            'delivery_response' => $responseText,
        ]);

        if ($status === 'Sent') {
            $sent++;
        } elseif ($status === 'Failed') {
            $failed++;
        } else {
            $pending++;
        }
    }

    AuditLog::create([
        'action' => 'Send SMS',
        'action_type' => 'Send SMS',
        'module' => 'Notifications',
        'details' => 'SMS reminder batch completed. Sent: '.$sent.', pending: '.$pending.', failed: '.$failed.', consent unavailable: '.$declined.', duplicates skipped: '.$duplicates.'.',
        'description' => 'SMS reminder batch completed. Sent: '.$sent.', pending: '.$pending.', failed: '.$failed.', consent unavailable: '.$declined.', duplicates skipped: '.$duplicates.'.',
        'user_name' => 'System',
        'user_role' => 'System',
    ]);

    $this->info('SMS reminder batch completed. Sent: '.$sent.', pending: '.$pending.', failed: '.$failed.', consent unavailable: '.$declined.', duplicates skipped: '.$duplicates.'.');
})->purpose('Send or queue PEP SMS reminders');

Schedule::command('bitemap:mark-missed-schedules')->dailyAt('00:15');
Schedule::command('bitemap:send-sms-reminders --scope=today')->dailyAt('07:00');
Schedule::command('bitemap:send-sms-reminders --scope=upcoming')->dailyAt('07:30');
Schedule::command('bitemap:send-sms-reminders --scope=missed')->dailyAt('08:00');
