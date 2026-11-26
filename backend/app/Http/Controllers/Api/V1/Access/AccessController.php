<?php

namespace App\Http\Controllers\Api\V1\Access;

use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Models\AccessLog;
use App\Models\AwayNotice;
use App\Models\BlacklistEntry;
use App\Models\Household;
use App\Models\VisitorPass;
use App\Services\AuditLogger;
use App\Services\Security\AccessService;
use App\Support\ApiResponse;
use App\Support\Present;
use App\Support\QrPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * M09 access control (visitor passes, gate check-in/out, away notices) and M10 blacklist & watchlist.
 */
class AccessController extends Controller
{
    public function __construct(private readonly AccessService $access, private readonly AuditLogger $audit) {}

    // ------------------------------------------------------------ resident: passes & away notices

    public function myPasses(Request $request): JsonResponse
    {
        $household = $this->household($request);
        $status = $request->validate(['status' => ['nullable', Rule::in(['active', 'used', 'expired', 'cancelled'])]])['status'] ?? null;

        VisitorPass::query()->where('household_id', $household->id)->where('status', 'active')->where('valid_until', '<', now())->update(['status' => 'expired']);

        $page = VisitorPass::query()->with('creator')->where('household_id', $household->id)
            ->when($status, fn ($q, $v) => $q->where('status', $v))
            ->latest()->paginate(ApiResponse::pageSize($request));

        return ApiResponse::paginateMap($page, fn ($p) => Present::pass($p));
    }

    public function createPass(Request $request): JsonResponse
    {
        $household = $this->household($request);
        $data = $request->validate([
            'visitor_name' => ['required', 'string', 'min:2', 'max:120'],
            'visitor_phone' => ['nullable', 'regex:/^\+234\d{10}$/'],
            'purpose' => ['nullable', 'string', 'max:150'],
            'vehicle_plate' => ['nullable', 'string', 'max:20'],
            'valid_from' => ['required', 'date', 'after_or_equal:'.now()->subMinutes(5)->toDateTimeString()],
            'valid_until' => ['required', 'date', 'after:valid_from', 'before_or_equal:'.now()->addDays(30)->toDateTimeString()],
            'max_entries' => ['nullable', 'integer', 'min:1', 'max:20'],
        ], ['visitor_phone.regex' => 'Enter a Nigerian mobile number in the format +234XXXXXXXXXX.', 'valid_until.before_or_equal' => 'A pass can be valid for at most 30 days.']);

        $pass = $this->access->createPass($request->user(), $household, $data);

        return response()->json(['data' => Present::pass($pass->load('creator'))], 201);
    }

    public function cancelPass(Request $request, VisitorPass $pass): JsonResponse
    {
        abort_unless($pass->household_id === $this->household($request)->id, 404);

        return response()->json(['data' => Present::pass($this->access->cancelPass($pass, $request->user()))]);
    }

    /** Household check-in / check-out history (SCR-ACC-07). */
    public function myActivity(Request $request): JsonResponse
    {
        $household = $this->household($request);
        $page = AccessLog::query()->with(['pass', 'household.unit'])->where('household_id', $household->id)
            ->latest('occurred_at')->paginate(ApiResponse::pageSize($request, 15));

        return ApiResponse::paginateMap($page, fn ($l) => Present::accessLog($l));
    }

    public function myAway(Request $request): JsonResponse
    {
        $household = $this->household($request);

        return response()->json(['data' => AwayNotice::query()->where('household_id', $household->id)->latest()->limit(20)->get()->map(fn ($n) => $this->presentAway($n))]);
    }

    public function createAway(Request $request): JsonResponse
    {
        $household = $this->household($request);
        $data = $request->validate([
            'from_date' => ['required', 'date', 'after_or_equal:today'],
            'to_date' => ['required', 'date', 'after_or_equal:from_date', 'before_or_equal:'.now()->addYear()->toDateString()],
            'note' => ['nullable', 'string', 'max:500'],
            'emergency_contact' => ['nullable', 'string', 'max:120'],
        ]);

        $notice = AwayNotice::create($data + ['household_id' => $household->id, 'created_by' => $request->user()->id, 'status' => 'active']);
        $this->audit->log('away.created', $notice, after: $data);

        return response()->json(['data' => $this->presentAway($notice)], 201);
    }

    public function cancelAway(Request $request, AwayNotice $notice): JsonResponse
    {
        abort_unless($notice->household_id === $this->household($request)->id, 404);
        $notice->update(['status' => 'cancelled']);

        return response()->json(['data' => $this->presentAway($notice)]);
    }

    // ------------------------------------------------------------ gate (security officers)

    /**
     * Gate check of a scanned QR code or a typed 6-character visitor code. Resident estate passes return
     * the resident and their dues clearance; visitor passes return validity and blacklist screening.
     */
    /** GET /public/passes/{token} — what a visitor sees when they open the link the resident shared. */
    public function publicPass(string $token): JsonResponse
    {
        abort_unless(preg_match('/^[A-Za-z0-9]{40}$/', $token) === 1, 404);
        $pass = VisitorPass::query()->with(['household.unit', 'creator'])->where('qr_token', $token)->firstOrFail();
        $data = Present::pass($pass);

        // Only what the visitor needs at the gate; no resident phone numbers or entry history.
        return response()->json(['data' => [
            'visitorName' => $data['visitorName'],
            'code' => $data['code'],
            'qrPayload' => $data['qrPayload'],
            'validFrom' => $data['validFrom'],
            'validUntil' => $data['validUntil'],
            'status' => $data['status'],
            'entriesLeft' => max(0, $pass->max_entries - $pass->entries_used),
            'host' => $pass->creator ? strtok($pass->creator->name, ' ') : null,
            'unit' => $data['unit'],
            'estate' => config('estate.name'),
        ]]);
    }

    public function verifyPass(Request $request): JsonResponse
    {
        $code = $request->validate(['code' => ['required', 'string', 'max:200']])['code'];

        if (QrPayload::parse($code)['type'] === 'resident') {
            $result = $this->access->verifyResident(QrPayload::parse($code)['value']);
            $resident = $result['resident'];

            return response()->json(['data' => [
                'kind' => 'resident',
                'valid' => true,
                'resident' => [
                    'name' => $resident->full_name,
                    'relationship' => $resident->relationship,
                    'phone' => $resident->phone ?? $resident->user?->phone,
                    'householdId' => $resident->household_id,
                    'unit' => $resident->household?->unit?->unit_code,
                    'street' => $resident->household?->unit?->street?->name,
                ],
                'cleared' => $result['clearance']['cleared'],
                'outstanding' => Present::money($result['clearance']['outstanding']),
            ]]);
        }

        $result = $this->access->verifyCode($code);

        return response()->json(['data' => [
            'kind' => 'visitor',
            'valid' => $result['valid'],
            'reason' => $result['reason'],
            'pass' => Present::pass($result['pass']),
            'watchlist' => $result['match'] ? Present::blacklist($result['match']) : null,
        ]]);
    }

    public function record(Request $request): JsonResponse
    {
        $data = $request->validate([
            'direction' => ['required', Rule::in(['in', 'out'])],
            'pass_code' => ['nullable', 'string', 'max:200'],
            'subject_type' => ['nullable', Rule::in(['visitor', 'resident', 'staff', 'vehicle', 'contractor'])],
            'person_name' => ['required_without:pass_code', 'nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:20'],
            'plate_number' => ['nullable', 'string', 'max:20'],
            'household_id' => ['nullable', 'integer', 'exists:households,id'],
            'gate' => ['nullable', 'string', 'max:40'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $log = $this->access->record($request->user(), $data);

        return response()->json(['data' => Present::accessLog($log->load(['household.unit', 'pass', 'officer']))], 201);
    }

    public function logs(Request $request): JsonResponse
    {
        $f = $request->validate([
            'direction' => ['nullable', Rule::in(['in', 'out'])],
            'flagged' => ['nullable', 'boolean'],
            'q' => ['nullable', 'string', 'max:60'],
            'date' => ['nullable', 'date'],
        ]);

        $page = AccessLog::query()->with(['household.unit', 'pass', 'officer'])
            ->when($f['direction'] ?? null, fn ($q, $v) => $q->where('direction', $v))
            ->when(isset($f['flagged']) && $f['flagged'], fn ($q) => $q->where('flagged', true))
            ->when($f['date'] ?? null, fn ($q, $v) => $q->whereDate('occurred_at', $v))
            ->when($f['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w->where('person_name', 'like', "%{$v}%")->orWhere('plate_number', 'like', "%{$v}%")))
            ->latest('occurred_at')->latest('id')->paginate(ApiResponse::pageSize($request, 20));

        return ApiResponse::paginateMap($page, fn ($l) => Present::accessLog($l), [
            'kpis' => [
                'entriesToday' => AccessLog::where('direction', 'in')->whereDate('occurred_at', now())->count(),
                'exitsToday' => AccessLog::where('direction', 'out')->whereDate('occurred_at', now())->count(),
                'visitorsInside' => VisitorPass::query()->inside()->count(),
                'flaggedToday' => AccessLog::where('flagged', true)->whereDate('occurred_at', now())->count(),
            ],
        ]);
    }

    public function inside(): JsonResponse
    {
        return response()->json(['data' => VisitorPass::query()->inside()->with(['household.unit', 'creator'])->latest('updated_at')->get()->map(fn ($p) => Present::pass($p))]);
    }

    public function awayNotices(): JsonResponse
    {
        return response()->json(['data' => AwayNotice::query()->with(['household.unit', 'creator'])->where('status', 'active')
            ->whereDate('to_date', '>=', now())->orderBy('from_date')->get()->map(fn ($n) => $this->presentAway($n) + [
                'unit' => $n->household?->unit?->unit_code,
                'resident' => $n->creator?->name,
            ])]);
    }

    // ------------------------------------------------------------ blacklist & watchlist

    public function blacklist(Request $request): JsonResponse
    {
        $f = $request->validate([
            'list' => ['nullable', Rule::in(['black', 'watch'])],
            'status' => ['nullable', Rule::in(['active', 'cleared'])],
            'q' => ['nullable', 'string', 'max:60'],
        ]);

        $page = BlacklistEntry::query()->with('addedBy')
            ->when($f['list'] ?? null, fn ($q, $v) => $q->where('list', $v))
            ->where('status', $f['status'] ?? 'active')
            ->when($f['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w->where('full_name', 'like', "%{$v}%")->orWhere('plate_number', 'like', "%{$v}%")->orWhere('phone', 'like', "%{$v}%")))
            ->latest()->paginate(ApiResponse::pageSize($request, 15));

        return ApiResponse::paginateMap($page, fn ($b) => Present::blacklist($b), [
            'counts' => [
                'black' => BlacklistEntry::where('list', 'black')->where('status', 'active')->count(),
                'watch' => BlacklistEntry::where('list', 'watch')->where('status', 'active')->count(),
                'attemptsThisMonth' => AccessLog::where('flag_reason', 'like', 'REFUSED: Blacklisted%')->where('occurred_at', '>=', now()->startOfMonth())->count(),
            ],
        ]);
    }

    public function addBlacklist(Request $request): JsonResponse
    {
        if ($request->filled('plate_number')) {
            $request->merge(['plate_number' => strtoupper(str_replace(' ', '', (string) $request->input('plate_number')))]);
        }
        $data = $request->validate([
            'list' => ['required', Rule::in(['black', 'watch'])],
            'subject_type' => ['required', Rule::in(['person', 'vehicle'])],
            'full_name' => ['required_if:subject_type,person', 'nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'regex:/^\+234\d{10}$/'],
            'plate_number' => ['required_if:subject_type,vehicle', 'nullable', 'string', 'max:20'],
            'reason' => ['required', 'string', 'min:10', 'max:1000'],
        ]);

        $entry = BlacklistEntry::create($data + ['status' => 'active', 'added_by' => $request->user()->id]);
        $this->audit->log('blacklist.added', $entry, after: $data);

        return response()->json(['data' => Present::blacklist($entry->load('addedBy'))], 201);
    }

    public function clearBlacklist(Request $request, BlacklistEntry $entry): JsonResponse
    {
        $reason = $request->validate(['reason' => ['required', 'string', 'min:10', 'max:500']])['reason'];
        if ($entry->status !== 'active') {
            throw BusinessRuleException::invalidState('This entry is already cleared.');
        }

        $entry->update(['status' => 'cleared', 'cleared_by' => $request->user()->id, 'cleared_at' => now(), 'cleared_reason' => $reason]);
        $this->audit->log('blacklist.cleared', $entry, null, ['reason' => $reason]);

        return response()->json(['data' => Present::blacklist($entry->load('addedBy'))]);
    }

    private function household(Request $request): Household
    {
        $household = $request->user()->household();
        if (! $household) {
            throw new BusinessRuleException('Your account is not linked to a household yet.', 'NO_HOUSEHOLD', 404);
        }

        return $household;
    }

    private function presentAway(AwayNotice $n): array
    {
        return [
            'id' => $n->id, 'fromDate' => $n->from_date?->toDateString(), 'toDate' => $n->to_date?->toDateString(),
            'note' => $n->note, 'emergencyContact' => $n->emergency_contact,
            'status' => $n->status === 'active' && $n->to_date?->lt(now()->startOfDay()) ? 'ended' : $n->status,
            'createdAt' => $n->created_at?->toIso8601String(),
        ];
    }
}
