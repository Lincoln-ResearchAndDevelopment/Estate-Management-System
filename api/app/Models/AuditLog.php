<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * Append-only: updates and deletes are refused at model level.
 */
class AuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'actor_user_id', 'actor_role', 'action', 'entity_type', 'entity_id', 'before', 'after',
        'ip_address', 'user_agent', 'occurred_at',
    ];

    protected function casts(): array
    {
        return ['before' => 'array', 'after' => 'array', 'occurred_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Audit logs are append-only.'));
        static::deleting(fn () => throw new LogicException('Audit logs are append-only.'));
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
