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
    'incident_date',
    'incident_time',
    'animal_type',
    'animal_description',
    'bite_site',
    'who_category',
    'location_lat',
    'location_lng',
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
            'location_lat' => 'decimal:8',
            'location_lng' => 'decimal:8',
        ];
    }
}
