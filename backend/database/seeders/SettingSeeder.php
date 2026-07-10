<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            'organization_name' => 'BITEMAP Animal Bite Center',
            'clinic_name' => 'Animal Bite Center',
            'clinic_address' => '',
            'contact_email' => '',
            'contact_number' => '',
            'system_timezone' => 'Asia/Manila',
            'system_language' => 'en',
            'sms_reminders_enabled' => 'true',
            'sms_provider' => 'Twilio',
            'sms_sender_id' => '',
            'reminder_days_before' => '1',
            'retry_failed_sms_enabled' => 'true',
            'max_sms_retry_attempts' => '3',
            'low_stock_alert_enabled' => 'true',
            'expiring_batch_alert_enabled' => 'true',
            'security_alerts_enabled' => 'true',
            'low_stock_threshold' => '20',
            'strong_passwords_required' => 'true',
            'session_timeout_minutes' => '30',
            'max_failed_login_attempts' => '5',
            'account_lock_minutes' => '15',
            'force_password_change_approved_users' => 'true',
            'map_default_center' => '6.7494,125.3569',
        ];

        foreach ($settings as $key => $value) {
            Setting::updateOrCreate(
                ['setting_key' => $key],
                ['setting_value' => $value]
            );
        }
    }
}
