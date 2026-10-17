<?php

namespace App\Support;

use App\Models\Setting;

/**
 * Resolves Twilio credentials.
 *
 * Environment variables (config/services.php) are the source of truth. Credentials saved
 * through the admin Settings screen are stored in plaintext in the `settings` table, so
 * they are only honoured where explicitly allowed: local/testing by default, or anywhere
 * SMS_ALLOW_DB_CREDENTIALS=true. In production the default is env-only.
 */
class SmsCredentials
{
    private const SETTING_KEYS = [
        'sid' => 'twilio_account_sid',
        'token' => 'twilio_auth_token',
        'from' => 'twilio_from_number',
    ];

    public static function databaseOverridesAllowed(): bool
    {
        $flag = config('services.sms.allow_database_credentials');

        return $flag === null
            ? app()->environment(['local', 'testing'])
            : filter_var($flag, FILTER_VALIDATE_BOOL);
    }

    /**
     * @return array{sid: mixed, token: mixed, from: mixed}
     */
    public static function resolve(): array
    {
        $stored = self::databaseOverridesAllowed()
            ? Setting::query()->whereIn('setting_key', array_values(self::SETTING_KEYS))->pluck('setting_value', 'setting_key')
            : collect();

        return [
            'sid' => $stored->get(self::SETTING_KEYS['sid']) ?: config('services.twilio.sid'),
            'token' => $stored->get(self::SETTING_KEYS['token']) ?: config('services.twilio.token'),
            'from' => $stored->get(self::SETTING_KEYS['from']) ?: config('services.twilio.from'),
        ];
    }
}
