<?php

use App\Models\AuditLog;
use App\Models\PepSchedule;
use App\Services\Sms\VaccinationReminderService;
use App\Support\DefaultAdminAccount;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('bitemap:reset-admin', function () {
    if (! app()->environment(['local', 'testing'])) {
        $this->error('bitemap:reset-admin sets a well-known default password and only runs in local/testing environments.');
        $this->line('To create the first production administrator, run: php artisan bitemap:create-admin');

        return 1;
    }

    $user = DefaultAdminAccount::reset();

    $this->info('BITEMAP admin account is ready.');
    $this->line('Email: '.DefaultAdminAccount::EMAIL);
    $this->line('Password: '.DefaultAdminAccount::PASSWORD);
    $this->line('User ID: '.$user->id);
})->purpose('Reset the local BITEMAP admin account');

Artisan::command('bitemap:mark-missed-schedules', function () {
    $updated = PepSchedule::query()
        ->whereDate('scheduled_date', '<', today())
        ->whereNull('administered_date')
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

Artisan::command('bitemap:send-sms-reminders {--scope=today}', function (VaccinationReminderService $reminderService) {
    $scope = (string) $this->option('scope');
    $counts = $reminderService->dispatchScheduledReminders($scope);

    $summary = $counts['skipped_disabled']
        ? 'SMS reminder batch skipped because clinic SMS reminders are disabled in settings.'
        : 'SMS reminder batch completed. Sent: '.$counts['sent']
            .', pending: '.$counts['pending']
            .', failed: '.$counts['failed']
            .', consent unavailable: '.$counts['declined']
            .', duplicates skipped: '.$counts['duplicates'].'.';

    AuditLog::create([
        'action' => 'Send SMS',
        'action_type' => 'Send SMS',
        'module' => 'Notifications',
        'details' => $summary,
        'description' => $summary,
        'user_name' => 'System',
        'user_role' => 'System',
    ]);

    $this->info($summary);
})->purpose('Send or queue PEP SMS reminders');

Schedule::command('bitemap:mark-missed-schedules')->dailyAt('00:15');
Schedule::command('bitemap:send-sms-reminders --scope=today')->dailyAt('07:00');
Schedule::command('bitemap:send-sms-reminders --scope=upcoming')->dailyAt('07:30');
Schedule::command('bitemap:send-sms-reminders --scope=missed')->dailyAt('08:00');
