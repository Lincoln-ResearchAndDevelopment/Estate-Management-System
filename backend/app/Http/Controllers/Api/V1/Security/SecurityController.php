<?php

namespace App\Http\Controllers\Api\V1\Security;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\BlacklistEntry;
use App\Models\EstateAlert;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SecurityController extends Controller
{
    // ---------------- emergency ----------------
    public function emergency(): JsonResponse
    {
        $open = EstateAlert::with('sender')->where('status', 'open')->latest('id')->get();
        $history = EstateAlert::with('sender')->latest('id')->limit(50)->get();

        $active = $open->values()->map(fn (EstateAlert $a, int $i) => [
            'id' => (string) $a->id,
            'variant' => $i === 0 ? 'primary' : 'secondary',
            'severity' => $a->category === 'life_threat' ? 'CRITICAL' : 'SUSPICIOUS',
            'title' => $a->category === 'life_threat' ? 'Life Under Threat' : 'Intelligence Report',
            'location' => $a->location ?: 'Location not given',
            'section' => '',
            'detail' => $a->message,
            'resident' => $a->sender?->name ?? 'Unknown',
            'timeElapsed' => $a->created_at?->diffForHumans(null, true) ?? '',
            'dispatched' => 'Not assigned',
        ]);

        $rows = $history->map(fn (EstateAlert $a) => [
            'id' => (string) $a->id,
            'date' => $a->created_at?->format('M d, Y'),
            'time' => $a->created_at?->format('h:i A'),
            'alertType' => $a->category === 'life_threat' ? 'Life Threat' : 'Intelligence',
            'resident' => $a->sender?->name ?? 'Unknown',
            'location' => $a->location ?: '-',
            'status' => $a->status === 'resolved' ? 'Resolved' : 'Pending',
        ]);

        return response()->json(['data' => [
            'active' => $active,
            'history' => $rows,
            'total' => EstateAlert::count(),
            'contacts' => config('estate.emergency_contacts', []),
        ]]);
    }

    /** Guard-filed report from the "Report an incident" panel. */
    public function reportIncident(Request $r): JsonResponse
    {
        $d = $r->validate([
            'category' => 'required|in:life_threat,intelligence',
            'message' => 'required|string|max:255',
            'location' => 'nullable|string|max:255',
        ]);
        $me = $r->user();
        $alert = EstateAlert::create($d + ['sender_id' => $me->id]);
        foreach (User::whereIn('role', ['super_admin', 'admin', 'manager', 'security'])->where('id', '!=', $me->id)->pluck('id') as $uid) {
            AppNotification::create([
                'user_id' => $uid, 'type' => 'alert', 'title' => $me->name.' sent you an alert',
                'body' => $alert->message, 'data' => ['alert_id' => $alert->id, 'category' => $alert->category],
            ]);
        }
        return response()->json(['data' => ['id' => $alert->id]], 201);
    }

    // ---------------- blacklist / watchlist ----------------
    private function entryOut(BlacklistEntry $e): array
    {
        return [
            'id' => (string) $e->id,
            'name' => $e->name,
            'entityId' => $e->entity_ref ? 'ID: '.$e->entity_ref : '',
            'entityType' => $e->entity_type,
            'reason' => $e->reason,
            'reasonDetail' => $e->details ?? '',
            'riskLevel' => $e->risk_level,
            'status' => $e->status,
            'lastAttemptedDate' => $e->last_attempt_at?->format('M d, Y') ?? '—',
            'lastAttemptedTime' => $e->last_attempt_at?->format('H:i') ?? '—',
            'lastAttemptedLocation' => $e->last_attempt_location ?? '—',
        ];
    }

    public function blacklist(): JsonResponse
    {
        $black = BlacklistEntry::where('list_type', 'blacklist')->latest('id')->get();
        $watch = BlacklistEntry::where('list_type', 'watchlist')->latest('id')->get();

        return response()->json(['data' => [
            'entries' => $black->map(fn ($e) => $this->entryOut($e))->values(),
            'watchlist' => $watch->map(fn ($e) => $this->entryOut($e))->values(),
            'stats' => [
                'totalBlacklisted' => $black->where('status', '!=', 'CLEARED')->count(),
                'highRiskAlerts' => $black->whereIn('risk_level', ['HIGH', 'EXTREME'])->where('status', '!=', 'CLEARED')->count(),
                'watchlistEntries' => $watch->count(),
                'clearedRemoved' => $black->where('status', 'CLEARED')->count(),
            ],
        ]]);
    }

    public function addEntry(Request $r): JsonResponse
    {
        $d = $r->validate([
            'name' => 'required|string|max:255',
            'entity_ref' => 'nullable|string|max:120',
            'reason' => 'required|string|max:255',
            'details' => 'nullable|string|max:2000',
            'risk_level' => ['required', Rule::in(['LOW', 'MEDIUM', 'ELEVATED', 'HIGH', 'EXTREME'])],
            'list_type' => ['nullable', Rule::in(['blacklist', 'watchlist'])],
            'entity_type' => ['nullable', Rule::in(['person', 'organisation', 'network', 'vehicle'])],
            'notify_officers' => 'nullable|boolean',
        ]);
        $entry = BlacklistEntry::create([
            'name' => $d['name'], 'entity_ref' => $d['entity_ref'] ?? null, 'reason' => $d['reason'],
            'details' => $d['details'] ?? null, 'risk_level' => $d['risk_level'],
            'list_type' => $d['list_type'] ?? 'blacklist', 'entity_type' => $d['entity_type'] ?? 'person',
            'status' => ($d['list_type'] ?? 'blacklist') === 'watchlist' ? 'UNDER_OBSERVATION' : 'RESTRICTED',
            'added_by' => $r->user()->id,
        ]);

        if ($r->boolean('notify_officers')) {
            foreach (User::where('role', 'security')->where('id', '!=', $r->user()->id)->pluck('id') as $uid) {
                AppNotification::create([
                    'user_id' => $uid, 'type' => 'system', 'title' => $entry->name.' added to the '.$entry->list_type,
                    'body' => $entry->reason, 'data' => ['blacklist_id' => $entry->id],
                ]);
            }
        }
        return response()->json(['data' => $this->entryOut($entry)], 201);
    }

    public function updateEntry(Request $r, int $id): JsonResponse
    {
        $d = $r->validate([
            'status' => ['sometimes', Rule::in(['RESTRICTED', 'UNDER_OBSERVATION', 'UNDER_REVIEW', 'CLEARED'])],
            'risk_level' => ['sometimes', Rule::in(['LOW', 'MEDIUM', 'ELEVATED', 'HIGH', 'EXTREME'])],
            'last_attempt_at' => 'sometimes|nullable|date',
            'last_attempt_location' => 'sometimes|nullable|string|max:255',
        ]);
        $entry = BlacklistEntry::findOrFail($id);
        $entry->update($d);
        return response()->json(['data' => $this->entryOut($entry)]);
    }
}
