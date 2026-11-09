<?php

namespace App\Support;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\PersonalAccessToken;

class AuthSessionSecurity
{
    public const DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS = 5;

    public const DEFAULT_ACCOUNT_LOCK_MINUTES = 15;

    public const DEFAULT_SESSION_TIMEOUT_MINUTES = 30;

    public const DEFAULT_ABSOLUTE_EXPIRATION_MINUTES = 720;

    /**
     * Endpoints that are inherently passive (session verification, background
     * badge summaries, or session termination) and must never extend idle timeout.
     */
    private const PASSIVE_ENDPOINT_PATTERNS = [
        'api/auth/session',
        'api/auth/signout',
        'api/notifications/summary',
    ];

    public static function maxFailedLoginAttempts(): int
    {
        $raw = self::settingValue('max_failed_login_attempts', self::DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS);
        $value = is_numeric($raw) ? (int) $raw : self::DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS;

        return max(1, min(20, $value));
    }

    public static function accountLockMinutes(): int
    {
        $raw = self::settingValue('account_lock_minutes', self::DEFAULT_ACCOUNT_LOCK_MINUTES);
        $value = is_numeric($raw) ? (int) $raw : self::DEFAULT_ACCOUNT_LOCK_MINUTES;

        return max(1, min(1440, $value));
    }

    public static function sessionTimeoutMinutes(): int
    {
        $raw = self::settingValue('session_timeout_minutes', self::DEFAULT_SESSION_TIMEOUT_MINUTES);
        $value = is_numeric($raw) ? (int) $raw : self::DEFAULT_SESSION_TIMEOUT_MINUTES;

        return max(5, min(480, $value));
    }

    public static function absoluteExpirationMinutes(): int
    {
        $configured = config('sanctum.expiration');
        $value = is_numeric($configured) && (int) $configured > 0
            ? (int) $configured
            : self::DEFAULT_ABSOLUTE_EXPIRATION_MINUTES;

        return max(self::sessionTimeoutMinutes(), $value);
    }

    public static function nextTokenExpiration(?Carbon $createdAt = null, ?Carbon $activityAt = null): Carbon
    {
        $now = $activityAt ? $activityAt->copy() : now();
        $idleExpiry = $now->copy()->addMinutes(self::sessionTimeoutMinutes());
        $absoluteExpiry = ($createdAt ? $createdAt->copy() : $now->copy())
            ->addMinutes(self::absoluteExpirationMinutes());

        return ($idleExpiry->lte($absoluteExpiry) ? $idleExpiry : $absoluteExpiry)->startOfSecond();
    }

    public static function hasReachedAbsoluteExpiration(PersonalAccessToken $accessToken): bool
    {
        if (! $accessToken->created_at) {
            return false;
        }

        return $accessToken->created_at->lte(now()->subMinutes(self::absoluteExpirationMinutes()));
    }

    public static function hasExceededIdleTimeout(PersonalAccessToken $accessToken): bool
    {
        $lastActivity = $accessToken->last_used_at ?? $accessToken->created_at;
        if (! $lastActivity) {
            return false;
        }

        return $lastActivity->lte(now()->subMinutes(self::sessionTimeoutMinutes()));
    }

    public static function isGenuineUserActivityRequest(?Request $request): bool
    {
        if (! $request) {
            return false;
        }

        foreach (['X-Background-Poll', 'X-Session-Check', 'X-Passive-Request'] as $header) {
            $value = strtolower(trim((string) $request->header($header, '')));
            if (in_array($value, ['1', 'true', 'yes'], true)) {
                return false;
            }
        }

        foreach (self::PASSIVE_ENDPOINT_PATTERNS as $pattern) {
            if ($request->is($pattern)) {
                return false;
            }
        }

        return true;
    }

    public static function recordGenuineActivity(PersonalAccessToken $accessToken, ?Carbon $activityAt = null): Carbon
    {
        $now = $activityAt ? $activityAt->copy() : now();
        $nextExpiry = self::nextTokenExpiration($accessToken->created_at ?? $now, $now);

        $accessToken->forceFill([
            'last_used_at' => $now,
            'expires_at' => $nextExpiry,
        ])->save();

        return $nextExpiry;
    }

    public static function approvalStatus(User $user): string
    {
        try {
            if (Schema::hasColumn('users', 'approval_status')) {
                return (string) ($user->approval_status ?? 'approved');
            }
        } catch (\Throwable) {
            // Fall through to is_active check if schema inspection is unavailable.
        }

        return $user->is_active ? 'approved' : 'pending';
    }

    public static function isUserActiveAndApproved(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        return (bool) $user->is_active && self::approvalStatus($user) === 'approved';
    }

    private static function settingValue(string $key, mixed $default): mixed
    {
        try {
            if (! Schema::hasTable('settings')) {
                return $default;
            }

            $value = Setting::query()->where('setting_key', $key)->value('setting_value');

            return ($value === null || trim((string) $value) === '') ? $default : $value;
        } catch (\Throwable) {
            return $default;
        }
    }
}
