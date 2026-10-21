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

    /**
     * Resolve the active SMS provider name (normalized to lowercase).
     *
     * Environment config (`SMS_PROVIDER` / `services.sms.provider`) takes precedence when explicitly
     * set to a non-default provider; otherwise falls back to the `sms_provider` DB setting in
     * local/testing (or when database overrides are allowed).
     */
    public static function resolveProviderName(): string
    {
        $envProvider = trim((string) config('services.sms.provider', 'Twilio'));
        if ($envProvider !== '' && strtolower($envProvider) !== 'twilio') {
            return strtolower($envProvider);
        }

        if (self::databaseOverridesAllowed()) {
            $dbProvider = trim((string) Setting::query()->where('setting_key', 'sms_provider')->value('setting_value'));
            if ($dbProvider !== '') {
                return strtolower($dbProvider);
            }
        }

        return strtolower($envProvider !== '' ? $envProvider : 'twilio');
    }

    /**
     * Resolve PhilSMS API v3 credentials from environment variables.
     *
     * @return array{token: ?string, sender_id: ?string, endpoint: string}
     */
    public static function resolvePhilSms(): array
    {
        $senderId = config('services.philsms.sender_id');
        if (blank($senderId) && self::databaseOverridesAllowed()) {
            $senderId = Setting::query()->where('setting_key', 'sms_sender_id')->value('setting_value');
        }

        return [
            'token' => config('services.philsms.token') ? (string) config('services.philsms.token') : null,
            'sender_id' => ! blank($senderId) ? (string) $senderId : 'PhilSMS',
            'endpoint' => (string) config('services.philsms.endpoint', 'https://app.philsms.com/api/v3/sms/send'),
        ];
    }

    /**
     * Resolve Semaphore API v4 credentials from environment variables.
     *
     * @return array{api_key: ?string, sender_name: ?string, endpoint: string}
     */
    public static function resolveSemaphore(): array
    {
        $senderName = config('services.semaphore.sender_name');
        if (blank($senderName) && self::databaseOverridesAllowed()) {
            $senderName = Setting::query()->where('setting_key', 'sms_sender_id')->value('setting_value');
        }

        return [
            'api_key' => config('services.semaphore.api_key') ? (string) config('services.semaphore.api_key') : null,
            'sender_name' => ! blank($senderName) ? (string) $senderName : null,
            'endpoint' => (string) config('services.semaphore.endpoint', 'https://api.semaphore.co/api/v4/messages'),
        ];
    }

    /**
     * Determine whether the currently selected provider has the required credentials configured.
     */
    public static function isConfiguredFor(?string $provider = null): bool
    {
        $resolvedProvider = strtolower(trim($provider ?? self::resolveProviderName()));

        return match ($resolvedProvider) {
            'mock', 'test', 'simulation' => true,
            'philsms' => ! blank(self::resolvePhilSms()['token']) && ! blank(self::resolvePhilSms()['sender_id']),
            'semaphore' => ! blank(self::resolveSemaphore()['api_key']),
            'twilio' => (function (): bool {
                $twilio = self::resolve();

                return ! blank($twilio['sid']) && ! blank($twilio['token']) && ! blank($twilio['from']);
            })(),
            default => false,
        };
    }
}
