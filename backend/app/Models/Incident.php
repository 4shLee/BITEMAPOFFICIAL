<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'patient_id',
    'barangay_id',
    'location_scope',
    'incident_date',
    'incident_time',
    'animal_type',
    'animal_description',
    'bite_site',
    'exposure_contact_types',
    'exposure_skin_condition',
    'exposure_bleeding_present',
    'exposure_transdermal',
    'exposure_saliva_contact_site',
    'exposure_direct_bat_contact',
    'who_category',
    'suggested_who_category',
    'who_category_suggestion_reason',
    'who_category_override_reason',
    'who_category_confirmed_by',
    'who_category_confirmed_at',
    'location_lat',
    'location_lng',
    'incident_city_municipality',
    'incident_province',
    'incident_specific_location',
    'status',
    'reported_by',
    'notes',
])]
class Incident extends Model
{
    use HasFactory;

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function barangay(): BelongsTo
    {
        return $this->belongsTo(Barangay::class);
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function whoCategoryConfirmer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'who_category_confirmed_by');
    }

    public function pepSchedules(): HasMany
    {
        return $this->hasMany(PepSchedule::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    protected function casts(): array
    {
        return [
            'incident_date' => 'date',
            'exposure_contact_types' => 'array',
            'exposure_bleeding_present' => 'boolean',
            'exposure_transdermal' => 'boolean',
            'exposure_direct_bat_contact' => 'boolean',
            'who_category_confirmed_at' => 'datetime',
            'location_lat' => 'decimal:8',
            'location_lng' => 'decimal:8',
        ];
    }
}
