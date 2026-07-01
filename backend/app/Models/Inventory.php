<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['item_name', 'item_type', 'current_stock', 'unit', 'reorder_level', 'expiry_date', 'updated_by'])]
class Inventory extends Model
{
    use HasFactory;

    protected $table = 'inventory';

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(InventoryTransaction::class);
    }

    protected function casts(): array
    {
        return [
            'current_stock' => 'integer',
            'reorder_level' => 'integer',
            'expiry_date' => 'date',
        ];
    }
}
