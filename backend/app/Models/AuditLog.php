<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

#[Fillable([
    'user_id',
    'user_name',
    'user_role',
    'action',
    'action_type',
    'module',
    'record_id',
    'details',
    'description',
    'ip_address',
    'user_agent',
])]
class AuditLog extends Model
{
    use HasFactory;

    protected static function booted(): void
    {
        static::updating(function (): void {
            throw new LogicException('Audit logs are append-only and cannot be modified.');
        });

        static::deleting(function (): void {
            throw new LogicException('Audit logs are append-only and cannot be deleted.');
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
