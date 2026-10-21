<?php

namespace App\Support;

class PhoneNumber
{
    /**
     * Convert a Philippine mobile number to the E.164 format Twilio requires.
     *
     * 09XXXXXXXXX -> +639XXXXXXXXX, 639XXXXXXXXX -> +639XXXXXXXXX, +639XXXXXXXXX unchanged.
     * Anything else is returned untouched so the gateway reports the real problem.
     */
    public static function toE164(string $number): string
    {
        $number = trim($number);

        if (preg_match('/^09\d{9}$/', $number) === 1) {
            return '+63'.substr($number, 1);
        }

        if (preg_match('/^639\d{9}$/', $number) === 1) {
            return '+'.$number;
        }

        return $number;
    }

    /**
     * Convert a Philippine mobile number to the 639XXXXXXXXX format PhilSMS / Semaphore use.
     */
    public static function toPhilSms(string $number): string
    {
        $e164 = self::toE164($number);

        if (preg_match('/^\+639\d{9}$/', $e164) === 1) {
            return substr($e164, 1);
        }

        return trim($number);
    }

    /**
     * Determine whether the string is a structurally valid Philippine mobile number.
     */
    public static function isValidPhilippineMobile(?string $number): bool
    {
        if ($number === null || trim($number) === '') {
            return false;
        }

        return preg_match('/^(09|\+639|639)\d{9}$/', trim($number)) === 1;
    }

    /**
     * Detect synthetic/seeded demo numbers (e.g. 09000000000..09000000999 from DemoDataSeeder)
     * so live SMS providers can never accidentally send to seeded patient records.
     */
    public static function isDemoOrReservedNumber(?string $number): bool
    {
        if (! self::isValidPhilippineMobile($number)) {
            return false;
        }

        $e164 = self::toE164((string) $number);

        return preg_match('/^\+639000000\d{3}$/', $e164) === 1;
    }

    /**
     * Mask a phone number for safe non-PII logging (e.g. +63917****567).
     */
    public static function mask(?string $number): string
    {
        $trimmed = trim((string) $number);
        if ($trimmed === '') {
            return '[missing]';
        }

        $length = strlen($trimmed);
        if ($length <= 6) {
            return str_repeat('*', $length);
        }

        return substr($trimmed, 0, $length - 7).'****'.substr($trimmed, -3);
    }
}
