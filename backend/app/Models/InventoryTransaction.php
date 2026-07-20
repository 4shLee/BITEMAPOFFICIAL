<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['inventory_id', 'inventory_batch_id', 'pep_schedule_id', 'transaction_type', 'quantity', 'transaction_date', 'notes', 'created_by'])]
class InventoryTransaction extends Model
{
    use HasFactory;

    public function inventory(): BelongsTo
    {
        return $this->belongsTo(Inventory::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(InventoryBatch::class, 'inventory_batch_id');
    }

    public function pepSchedule(): BelongsTo
    {
        return $this->belongsTo(PepSchedule::class);
    }

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'transaction_date' => 'date',
        ];
    }
}
