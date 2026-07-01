<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['full_name', 'age', 'sex', 'address', 'barangay_id', 'contact_number', 'email'])]
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

    protected function casts(): array
    {
        return [
            'age' => 'integer',
        ];
    }
}
