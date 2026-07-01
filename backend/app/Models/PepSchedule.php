<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'incident_id',
    'dose_day',
    'scheduled_date',
    'administered_date',
    'vaccine_type',
    'vaccine_lot_number',
    'administered_by',
    'status',
    'notes',
])]
class PepSchedule extends Model
{
    use HasFactory;

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }

    public function administrator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'administered_by');
    }

    protected function casts(): array
    {
        return [
            'dose_day' => 'integer',
            'scheduled_date' => 'date',
            'administered_date' => 'date',
        ];
    }
}
