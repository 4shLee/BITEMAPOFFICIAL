<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'population', 'latitude', 'longitude'])]
class Barangay extends Model
{
    use HasFactory;

    public function patients(): HasMany
    {
        return $this->hasMany(Patient::class);
    }

    public function incidents(): HasMany
    {
        return $this->hasMany(Incident::class);
    }

    protected function casts(): array
    {
        return [
            'population' => 'integer',
            'latitude' => 'decimal:8',
            'longitude' => 'decimal:8',
        ];
    }
}
