<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'patient_id',
    'incident_id',
    'pep_schedule_id',
    'notification_type',
    'reminder_type',
    'scheduled_date',
    'reminder_key',
    'recipient',
    'message',
    'status',
    'sent_at',
    'delivery_response',
])]
class Notification extends Model
{
    use HasFactory;

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }

    public function pepSchedule(): BelongsTo
    {
        return $this->belongsTo(PepSchedule::class);
    }

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'scheduled_date' => 'date',
        ];
    }
}
