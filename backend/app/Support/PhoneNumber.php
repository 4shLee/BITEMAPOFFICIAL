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
}
