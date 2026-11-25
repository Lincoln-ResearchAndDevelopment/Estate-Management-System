<?php

namespace App\Http\Controllers\Api\V1\Security;

use App\Http\Controllers\Controller;
use App\Models\AccessLog;
use App\Models\AwayNotice;
use App\Models\EmergencyAlert;
use App\Models\IncidentNote;
use App\Models\IncidentReport;
use App\Models\User;
use App\Models\VisitorPass;
use App\Services\AuditLogger;
use App\Services\CodeGenerator;
use App\Services\Security\AlertService;
use App\Support\ApiResponse;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * M08 security & emergency: resident panic, the security response console (SCR-SEC-01/02/05),
 * intelligence / incident reports (SCR-SEC-06–08) and the security HQ dashboard (SCR-DASH-04).
 */
class SecurityController extends Controller
{
    public function __construct(private readonly AlertService $alerts, private readonly AuditLogger $audit, private readonly CodeGenerator $codes) {}

    // ------------------------------------------------------------ residents

    public function raise(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(EmergencyAlert::TYPES)],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        $alert = $this->alerts->raise($request->user(), $data['type'], $data['lat'] ?? null, $data['lng'] ?? null, $data['description'] ?? null);

        return response()->json(['data' => Present::alert($alert->load(['raiser', 'unit', 'events.actor']))], 201);
    }

    public function myAlerts(Request $request): JsonResponse
    {
        $page = EmergencyAlert::query()->with(['unit', 'responder', 'events.actor'])->where('raised_by', $request->user()->id)
            ->latest()->paginate(ApiResponse::pageSize($request));

        return ApiResponse::paginateMap($page, fn ($a) => Present::alert($a));
    }

    public function cancel(Request $request, EmergencyAlert $alert): JsonResponse
    {
        abort_unless($alert->raised_by === $request->user()->id, 404);

        return response()->json(['data' => Present::alert($this->alerts->transition($alert, 'cancelled', $request->user(), 'Cancelled by resident')->load(['unit', 'events.actor']))]);
    }

    // ------------------------------------------------------------ security console

    public function overview(): JsonResponse
    {
        $today = now()->startOfDay();

        return response()->json(['data' => [
            'activeAlerts' => EmergencyAlert::with(['raiser', 'unit'])->whereIn('status', EmergencyAlert::ACTIVE)->latest()->get()->map(fn ($a) => Present::alert($a)),
            'kpis' => [
                'activeAlerts' => EmergencyAlert::whereIn('status', EmergencyAlert::ACTIVE)->count(),
                'alertsToday' => EmergencyAlert::where('created_at', '>=', $today)->count(),
                'visitorsInside' => VisitorPass::query()->inside()->count(),
                'entriesToday' => AccessLog::where('direction', 'in')->where('occurred_at', '>=', $today)->where(fn ($q) => $q->whereNull('flag_reason')->orWhere('flag_reason', 'not like', 'REFUSED%'))->count(),
                'refusedToday' => AccessLog::where('flag_reason', 'like', 'REFUSED%')->where('occurred_at', '>=', $today)->count(),
                'openIncidents' => IncidentReport::where('status', '!=', 'closed')->count(),
                'awayHouseholds' => AwayNotice::where('status', 'active')->whereDate('from_date', '<=', now())->whereDate('to_date', '>=', now())->count(),
            ],
            'recentAccess' => AccessLog::with(['household.unit', 'pass', 'officer'])->latest('occurred_at')->limit(8)->get()->map(fn ($l) => Present::accessLog($l)),
            'avgResponseMinutes' => $this->averageResponseMinutes(),
        ]]);
    }

    public function alerts(Request $request): JsonResponse
    {
        $f = $request->validate([
            'status' => ['nullable', Rule::in(['active', 'raised', 'acknowledged', 'dispatched', 'resolved', 'false_alarm', 'cancelled'])],
            'type' => ['nullable', Rule::in(EmergencyAlert::TYPES)],
        ]);

        $page = EmergencyAlert::query()->with(['raiser', 'unit', 'responder'])
            ->when($f['status'] ?? null, fn ($q, $v) => $v === 'active' ? $q->whereIn('status', EmergencyAlert::ACTIVE) : $q->where('status', $v))
            ->when($f['type'] ?? null, fn ($q, $v) => $q->where('type', $v))
            ->latest()->paginate(ApiResponse::pageSize($request, 15));

        return ApiResponse::paginateMap($page, fn ($a) => Present::alert($a));
    }

    public function showAlert(EmergencyAlert $alert): JsonResponse
    {
        return response()->json(['data' => Present::alert($alert->load(['raiser', 'unit', 'responder', 'events.actor']))]);
    }

    public function transitionAlert(Request $request, EmergencyAlert $alert): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['acknowledged', 'dispatched', 'resolved', 'false_alarm'])],
            'note' => ['nullable', 'string', 'max:1000'],
            'responder_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $alert = $this->alerts->transition($alert, $data['status'], $request->user(), $data['note'] ?? null, $data['responder_id'] ?? null);

        return response()->json(['data' => Present::alert($alert->load(['raiser', 'unit', 'responder', 'events.actor']))]);
    }

    /** Security officers available for dispatch. */
    public function officers(): JsonResponse
    {
        return response()->json(['data' => User::query()->where('status', 'active')
            ->whereHas('roles', fn ($q) => $q->where('code', 'security_officer'))->orderBy('name')->get(['id', 'name', 'phone'])]);
    }

    // ------------------------------------------------------------ incident / intelligence reports

    public function incidents(Request $request): JsonResponse
    {
        $f = $request->validate([
            'status' => ['nullable', Rule::in(['open', 'investigating', 'closed'])],
            'severity' => ['nullable', Rule::in(IncidentReport::SEVERITIES)],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $page = IncidentReport::query()->with(['reporter', 'assignee'])
            ->when($f['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($f['severity'] ?? null, fn ($q, $v) => $q->where('severity', $v))
            ->when($f['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w->where('title', 'like', "%{$v}%")->orWhere('reference', 'like', "%{$v}%")))
            ->orderByRaw("CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END")
            ->latest()->paginate(ApiResponse::pageSize($request, 15));

        return ApiResponse::paginateMap($page, fn ($r) => Present::incident($r), [
            'kpis' => [
                'open' => IncidentReport::where('status', 'open')->count(),
                'investigating' => IncidentReport::where('status', 'investigating')->count(),
                'critical' => IncidentReport::where('severity', 'critical')->where('status', '!=', 'closed')->count(),
                'closedThisMonth' => IncidentReport::where('status', 'closed')->where('closed_at', '>=', now()->startOfMonth())->count(),
            ],
        ]);
    }

    public function storeIncident(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'min:5', 'max:150'],
            'category' => ['required', Rule::in(IncidentReport::CATEGORIES)],
            'severity' => ['required', Rule::in(IncidentReport::SEVERITIES)],
            'location' => ['nullable', 'string', 'max:150'],
            'description' => ['required', 'string', 'min:10', 'max:5000'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $report = IncidentReport::create($data + [
            'reference' => $this->codes->next('incident_reports', 'reference', 'IR', 5),
            'reported_by' => $request->user()->id,
            'status' => 'open',
        ]);
        $this->audit->log('incident.created', $report, after: $data);

        return response()->json(['data' => Present::incident($report->load(['reporter', 'assignee', 'notes']))], 201);
    }

    public function showIncident(IncidentReport $incident): JsonResponse
    {
        return response()->json(['data' => Present::incident($incident->load(['reporter', 'assignee', 'notes.user']))]);
    }

    public function updateIncident(Request $request, IncidentReport $incident): JsonResponse
    {
        $data = $request->validate([
            'status' => ['sometimes', Rule::in(['open', 'investigating', 'closed'])],
            'severity' => ['sometimes', Rule::in(IncidentReport::SEVERITIES)],
            'assigned_to' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
        ]);

        $before = $incident->only(array_keys($data));
        if (($data['status'] ?? null) === 'closed' && $incident->status !== 'closed') {
            $data['closed_at'] = now();
        }
        $incident->update($data);
        $this->audit->log('incident.updated', $incident, $before, $data);

        return response()->json(['data' => Present::incident($incident->load(['reporter', 'assignee', 'notes.user']))]);
    }

    public function addNote(Request $request, IncidentReport $incident): JsonResponse
    {
        $body = $request->validate(['body' => ['required', 'string', 'min:2', 'max:2000']])['body'];
        IncidentNote::create(['incident_report_id' => $incident->id, 'user_id' => $request->user()->id, 'body' => $body]);

        return response()->json(['data' => Present::incident($incident->load(['reporter', 'assignee', 'notes.user']))], 201);
    }

    private function averageResponseMinutes(): ?float
    {
        $rows = EmergencyAlert::whereNotNull('acknowledged_at')->where('created_at', '>=', now()->subDays(30))->get(['created_at', 'acknowledged_at']);
        if ($rows->isEmpty()) {
            return null;
        }

        return round($rows->avg(fn ($a) => $a->created_at->diffInSeconds($a->acknowledged_at, true)) / 60, 1);
    }
}
