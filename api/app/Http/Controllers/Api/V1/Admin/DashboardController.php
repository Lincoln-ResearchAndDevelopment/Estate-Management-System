<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\AccessRequest;
use App\Models\AgentProfile;
use App\Models\AuditLog;
use App\Models\PropertyListing;
use App\Models\Resident;
use App\Models\Unit;
use Illuminate\Http\JsonResponse;

/**
 * GET /admin/dashboard — KPIs computed live from the database (FR-DASH-01, FR-DASH-07).
 * Finance KPIs (monthly revenue) are added when M05 Finance is built.
 */
class DashboardController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $totalUnits = Unit::count();
        $occupied = Unit::where('occupancy_status', 'occupied')->count();
        $residentsThisMonth = Resident::where('status', 'active')->where('created_at', '>=', now()->startOfMonth())->count();

        return response()->json(['data' => [
            'kpis' => [
                'totalResidents' => ['value' => Resident::where('status', 'active')->count(), 'delta' => $residentsThisMonth, 'deltaLabel' => 'this month', 'link' => '/admin/users?role=resident_head'],
                'occupiedUnits' => ['value' => $occupied, 'percent' => $totalUnits ? round($occupied / $totalUnits * 100, 1) : 0, 'total' => $totalUnits, 'link' => '/admin/estate'],
                'pendingAccessRequests' => ['value' => AccessRequest::where('status', 'pending')->count(), 'link' => '/admin/access-requests?status=pending'],
                'pendingListings' => ['value' => PropertyListing::where('status', 'pending_approval')->count(), 'link' => '/admin/listings?status=pending_approval'],
                'liveListings' => ['value' => PropertyListing::publiclyVisible()->count(), 'link' => '/admin/listings?status=approved'],
                'pendingAgents' => ['value' => AgentProfile::where('status', 'pending')->count(), 'link' => '/admin/agents?status=pending'],
                'blockedAccounts' => ['value' => \App\Models\User::where('status', UserStatus::Blocked)->count(), 'link' => '/admin/users?status=blocked'],
            ],
            'recentActivity' => AuditLog::query()->with('actor:id,name')->latest('occurred_at')->limit(8)->get()
                ->map(fn (AuditLog $log) => [
                    'id' => $log->id,
                    'action' => $log->action,
                    'entityType' => $log->entity_type,
                    'actor' => $log->actor?->name ?? 'System',
                    'occurredAt' => $log->occurred_at?->toIso8601String(),
                ]),
            'generatedAt' => now()->toIso8601String(),
        ]]);
    }
}
