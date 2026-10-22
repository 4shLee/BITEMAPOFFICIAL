<?php

namespace App\Support;

use Closure;
use Illuminate\Validation\Rules\Password;

class PasswordPolicy
{
    public const MIN_LENGTH = 8;

    /**
     * Default Laravel Password rule instance matching the policy.
     */
    public static function defaultRule(): Password
    {
        return Password::min(self::MIN_LENGTH)
            ->letters()
            ->mixedCase()
            ->numbers()
            ->symbols();
    }

    /**
     * Validation rules for account creation and password changes.
     *
     * Requires:
     * - Minimum 8 characters
     * - At least one uppercase letter (A-Z)
     * - At least one lowercase letter (a-z)
     * - At least one number (0-9)
     * - At least one special character (e.g., @, #, !, $)
     *
     * @return array<int, mixed>
     */
    public static function rules(bool $required = true): array
    {
        return [
            $required ? 'required' : 'nullable',
            'string',
            'min:'.self::MIN_LENGTH,
            function (string $attribute, mixed $value, Closure $fail): void {
                if (! is_string($value) || $value === '') {
                    return;
                }

                if (! preg_match('/[A-Z]/', $value)) {
                    $fail('The '.$attribute.' field must contain at least one uppercase letter (A–Z).');
                }

                if (! preg_match('/[a-z]/', $value)) {
                    $fail('The '.$attribute.' field must contain at least one lowercase letter (a–z).');
                }

                if (! preg_match('/[0-9]/', $value)) {
                    $fail('The '.$attribute.' field must contain at least one number (0–9).');
                }

                if (! preg_match('/[^A-Za-z0-9\s]/', $value)) {
                    $fail('The '.$attribute.' field must contain at least one special character (e.g., @, #, !, $).');
                }
            },
        ];
    }
}
