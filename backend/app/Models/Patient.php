<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'first_name',
    'middle_name',
    'last_name',
    'suffix',
    'full_name',
    'age',
    'sex',
    'address',
    'address_line',
    'residence_barangay',
    'city_municipality',
    'province',
    'barangay_id',
    'contact_number',
    'email',
    'sms_consent',
])]
class Patient extends Model
{
    use HasFactory;

    public function barangay(): BelongsTo
    {
        return $this->belongsTo(Barangay::class);
    }

    public function incidents(): HasMany
    {
        return $this->hasMany(Incident::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public static function normalizeText(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = preg_replace('/\s+/u', ' ', trim($value));

        return $normalized === '' ? null : $normalized;
    }

    public static function composeFullName(array $attributes): ?string
    {
        $parts = array_filter([
            self::normalizeText($attributes['first_name'] ?? null),
            self::normalizeText($attributes['middle_name'] ?? null),
            self::normalizeText($attributes['last_name'] ?? null),
            self::normalizeText($attributes['suffix'] ?? null),
        ]);

        return $parts === [] ? null : implode(' ', $parts);
    }

    public static function composeAddress(array $attributes): ?string
    {
        $parts = array_filter([
            self::normalizeText($attributes['address_line'] ?? null),
            self::normalizeText($attributes['residence_barangay'] ?? null),
            self::normalizeText($attributes['city_municipality'] ?? null),
            self::normalizeText($attributes['province'] ?? null),
        ]);

        return $parts === [] ? null : implode(', ', $parts);
    }

    public function displayName(): string
    {
        if (blank($this->first_name) || blank($this->last_name)) {
            return (string) $this->full_name;
        }

        $middleInitial = filled($this->middle_name)
            ? mb_substr((string) self::normalizeText($this->middle_name), 0, 1).'.'
            : null;

        return implode(' ', array_filter([
            $this->first_name,
            $middleInitial,
            $this->last_name,
            $this->suffix,
        ]));
    }

    protected static function booted(): void
    {
        static::saving(function (Patient $patient): void {
            foreach ([
                'first_name', 'middle_name', 'last_name', 'suffix', 'address_line',
                'residence_barangay', 'city_municipality', 'province', 'contact_number',
            ] as $field) {
                $patient->{$field} = self::normalizeText($patient->{$field});
            }

            $fullName = self::composeFullName($patient->getAttributes());
            if ($fullName !== null && filled($patient->first_name) && filled($patient->last_name)) {
                $patient->full_name = $fullName;
            }

            $address = self::composeAddress($patient->getAttributes());
            if ($address !== null && filled($patient->address_line) && filled($patient->residence_barangay)
                && filled($patient->city_municipality) && filled($patient->province)) {
                $patient->address = $address;
            }

            $patient->sms_consent = $patient->sms_consent === true;
        });
    }

    protected function casts(): array
    {
        return [
            'age' => 'integer',
            'sms_consent' => 'boolean',
        ];
    }
}
