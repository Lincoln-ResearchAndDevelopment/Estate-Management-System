<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** GET /admin/audit-logs (FR-ADMIN-04). */
class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'entity' => ['nullable', 'string', 'max:80'],
            'action' => ['nullable', 'string', 'max:80'],
            'actor_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $page = AuditLog::query()->with('actor:id,name')
            ->when($filters['entity'] ?? null, fn ($q, $v) => $q->where('entity_type', $v))
            ->when($filters['action'] ?? null, fn ($q, $v) => $q->where('action', 'like', "{$v}%"))
            ->when($filters['actor_id'] ?? null, fn ($q, $v) => $q->where('actor_user_id', $v))
            ->when($filters['from'] ?? null, fn ($q, $v) => $q->where('occurred_at', '>=', $v))
            ->when($filters['to'] ?? null, fn ($q, $v) => $q->where('occurred_at', '<', \Illuminate\Support\Carbon::parse($v)->addDay()))
            ->latest('occurred_at')->latest('id')
            ->paginate(max(1, min(100, (int) $request->query('pageSize', 20))));

        return response()->json([
            'data' => $page->getCollection()->map(fn (AuditLog $l) => [
                'id' => $l->id,
                'action' => $l->action,
                'entityType' => $l->entity_type,
                'entityId' => $l->entity_id,
                'actor' => $l->actor?->name ?? 'System',
                'actorRole' => $l->actor_role,
                'before' => $l->before,
                'after' => $l->after,
                'ipAddress' => $l->ip_address,
                'occurredAt' => $l->occurred_at?->toIso8601String(),
            ])->values(),
            'meta' => ['page' => $page->currentPage(), 'pageSize' => $page->perPage(), 'total' => $page->total(), 'totalPages' => $page->lastPage()],
        ]);
    }
}
