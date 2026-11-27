<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;

/**
 * Writes the audit trail for create/update/delete, approvals, logins and security actions (NFR-AUD-01).
 * Sensitive attributes are never written.
 */
class AuditLogger
{
    private const REDACT = ['password', 'password_hash', 'remember_token', 'nin_encrypted', 'nin_hash', 'token'];

    public function log(string $action, Model|string $entity, ?array $before = null, ?array $after = null, ?User $actor = null): AuditLog
    {
        $request = request();
        $actor ??= $request?->user();

        return AuditLog::create([
            'actor_user_id' => $actor?->id,
            'actor_role' => $actor?->primary_role,
            'action' => $action,
            'entity_type' => is_string($entity) ? $entity : class_basename($entity),
            'entity_id' => $entity instanceof Model ? $entity->getKey() : null,
            'before' => $before ? Arr::except($before, self::REDACT) : null,
            'after' => $after ? Arr::except($after, self::REDACT) : null,
            'ip_address' => $request?->ip(),
            'user_agent' => substr((string) $request?->userAgent(), 0, 255) ?: null,
            'occurred_at' => now(),
        ]);
    }
}
