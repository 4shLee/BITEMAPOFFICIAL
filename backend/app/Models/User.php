<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'first_name', 'middle_name', 'last_name', 'suffix', 'email', 'password', 'role', 'phone', 'is_active', 'approval_status', 'last_login_at'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public static function normalizeNamePart(?string $value): ?string
    {
        $normalized = preg_replace('/\s+/u', ' ', trim((string) $value));

        return $normalized === '' ? null : $normalized;
    }

    public static function composeDisplayName(array $attributes): string
    {
        return implode(' ', array_filter([
            self::normalizeNamePart($attributes['first_name'] ?? null),
            self::normalizeNamePart($attributes['middle_name'] ?? null),
            self::normalizeNamePart($attributes['last_name'] ?? null),
            self::normalizeNamePart($attributes['suffix'] ?? null),
        ], fn (?string $part) => filled($part)));
    }

    public function displayName(): string
    {
        $structured = self::composeDisplayName($this->getAttributes());

        return $structured !== '' ? $structured : (self::normalizeNamePart($this->name) ?? 'Unknown User');
    }

    public function reportedIncidents(): HasMany
    {
        return $this->hasMany(Incident::class, 'reported_by');
    }

    public function confirmedWhoCategories(): HasMany
    {
        return $this->hasMany(Incident::class, 'who_category_confirmed_by');
    }

    public function administeredPepSchedules(): HasMany
    {
        return $this->hasMany(PepSchedule::class, 'administered_by');
    }

    public function inventoryUpdates(): HasMany
    {
        return $this->hasMany(Inventory::class, 'updated_by');
    }

    public function inventoryTransactions(): HasMany
    {
        return $this->hasMany(InventoryTransaction::class, 'created_by');
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class);
    }

    public function settingsUpdates(): HasMany
    {
        return $this->hasMany(Setting::class, 'updated_by');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
}
