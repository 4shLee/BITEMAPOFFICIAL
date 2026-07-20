<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'incident_id',
    'dose_day',
    'scheduled_date',
    'administered_date',
    'administration_route',
    'vaccine_type',
    'vaccine_lot_number',
    'inventory_batch_id',
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

    public function inventoryTransaction(): HasOne
    {
        return $this->hasOne(InventoryTransaction::class);
    }

    public function inventoryBatch(): BelongsTo
    {
        return $this->belongsTo(InventoryBatch::class);
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
