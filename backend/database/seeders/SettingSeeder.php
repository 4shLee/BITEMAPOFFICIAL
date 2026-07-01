<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            'organization_name' => 'BITEMAP - Digos City Health Office',
            'clinic_name' => 'Digos City Health Office',
            'clinic_address' => 'Digos City, Davao del Sur',
            'contact_number' => '(082) 553-1234',
            'system_timezone' => 'Asia/Manila',
            'sms_reminders_enabled' => 'true',
            'email_reminders_enabled' => 'false',
            'reminder_days_before' => '1',
            'low_stock_alert_enabled' => 'true',
            'low_stock_threshold' => '20',
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
