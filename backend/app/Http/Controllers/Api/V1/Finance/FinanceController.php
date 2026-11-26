<?php

namespace App\Http\Controllers\Api\V1\Finance;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\Household;
use App\Models\Payment;
use App\Models\Service;
use App\Services\AuditLogger;
use App\Services\Finance\BillingService;
use App\Services\Finance\PaymentService;
use App\Support\ApiResponse;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** M05 finance administration (SCR-FIN-01–08, 13, 16). */
class FinanceController extends Controller
{
    public function __construct(
        private readonly BillingService $billing,
        private readonly PaymentService $payments,
        private readonly AuditLogger $audit,
    ) {}

    /** KPIs and a 6-month revenue series, computed from the ledger (FR-FIN-10). */
    public function overview(): JsonResponse
    {
        $monthStart = now()->startOfMonth();
        $revenueMonth = (float) Payment::where('status', 'success')->where('paid_at', '>=', $monthStart)->sum('amount');
        $billedMonth = (float) Bill::where('status', '!=', 'void')->where('created_at', '>=', $monthStart)->sum('amount');
        $outstanding = (float) Bill::whereIn('status', Bill::OPEN)->sum(DB::raw('amount - amount_paid'));
        $overdue = (float) Bill::where('status', 'overdue')->sum(DB::raw('amount - amount_paid'));

        $series = collect(range(5, 0))->map(function ($i) {
            $start = now()->startOfMonth()->subMonths($i);
            $end = $start->copy()->endOfMonth();

            return [
                'month' => $start->format('M Y'),
                'collected' => round((float) Payment::where('status', 'success')->whereBetween('paid_at', [$start, $end])->sum('amount'), 2),
                'billed' => round((float) Bill::where('status', '!=', 'void')->whereBetween('created_at', [$start, $end])->sum('amount'), 2),
            ];
        })->values();

        $byMethod = Payment::where('status', 'success')->where('paid_at', '>=', now()->subMonths(6))
            ->selectRaw('method, sum(amount) as total')->groupBy('method')->pluck('total', 'method');

        return response()->json(['data' => [
            'revenueThisMonth' => Present::money($revenueMonth),
            'billedThisMonth' => Present::money($billedMonth),
            'collectionRate' => $billedMonth > 0 ? round(min(100, $revenueMonth / $billedMonth * 100), 1) : null,
            'outstanding' => Present::money($outstanding),
            'overdue' => Present::money($overdue),
            'householdsOwing' => Bill::whereIn('status', Bill::OPEN)->distinct()->count('household_id'),
            'pendingVerification' => Payment::where('status', 'pending_verification')->count(),
            'series' => $series,
            'byMethod' => $byMethod->map(fn ($v) => round((float) $v, 2)),
            'recentPayments' => Payment::with(['user', 'household.unit'])->where('status', 'success')->latest('paid_at')->limit(6)->get()->map(fn ($p) => Present::payment($p)),
        ]]);
    }

    // ------------------------------------------------------------ services

    public function services(): JsonResponse
    {
        return response()->json(['data' => Service::query()->withCount('households')->orderBy('name')->get()->map(fn (Service $s) => $this->presentService($s))]);
    }

    public function storeService(Request $request): JsonResponse
    {
        $service = Service::create($this->validateService($request));
        $this->syncAssignments($request, $service);
        $this->audit->log('service.created', $service, after: $service->toArray());

        return response()->json(['data' => $this->presentService($service->loadCount('households'))], 201);
    }

    public function updateService(Request $request, Service $service): JsonResponse
    {
        $before = $service->toArray();
        $service->update($this->validateService($request, $service));
        $this->syncAssignments($request, $service);
        $this->audit->log('service.updated', $service, $before, $service->toArray());

        return response()->json(['data' => $this->presentService($service->loadCount('households'))]);
    }

    /** POST /finance/services/{id}/bill-now — bills the current period immediately (idempotent). */
    public function billNow(Request $request, Service $service): JsonResponse
    {
        $count = $service->frequency === 'one_off'
            ? $this->billing->issueManual($this->billing->householdsFor($service)->pluck('id')->all(), $service->name, (float) $service->amount, now()->addDays($service->due_days)->toDateString(), $request->user())
            : $this->billing->billService($service, now(), $request->user());

        return ApiResponse::message($count ? "{$count} bill(s) issued." : 'Every household already has a bill for this period.');
    }

    // ------------------------------------------------------------ bills

    public function bills(Request $request): JsonResponse
    {
        $f = $request->validate([
            'status' => ['nullable', Rule::in(['unpaid', 'part_paid', 'paid', 'overdue', 'void', 'open'])],
            'service_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:60'],
        ]);

        $page = Bill::query()->with(['service', 'household.unit'])
            ->when($f['status'] ?? null, fn ($q, $v) => $v === 'open' ? $q->whereIn('status', Bill::OPEN) : $q->where('status', $v))
            ->when($f['service_id'] ?? null, fn ($q, $v) => $q->where('service_id', $v))
            ->when($f['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w->where('reference', 'like', "%{$v}%")
                ->orWhereHas('household.unit', fn ($u) => $u->where('unit_code', 'like', "%{$v}%"))))
            ->latest('id')->paginate(ApiResponse::pageSize($request, 15));

        return ApiResponse::paginateMap($page, fn ($b) => Present::bill($b));
    }

    public function issueBills(Request $request): JsonResponse
    {
        $data = $request->validate([
            'household_ids' => ['required_without:all_households', 'array'],
            'household_ids.*' => ['integer', 'exists:households,id'],
            'all_households' => ['sometimes', 'boolean'],
            'description' => ['required', 'string', 'max:200'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:100000000'],
            'due_date' => ['required', 'date', 'after_or_equal:today'],
        ]);

        $ids = ($data['all_households'] ?? false)
            ? Household::query()->whereNotNull('head_user_id')->pluck('id')->all()
            : $data['household_ids'];

        $count = $this->billing->issueManual($ids, $data['description'], (float) $data['amount'], $data['due_date'], $request->user());

        return ApiResponse::message("{$count} bill(s) issued.", 201);
    }

    public function voidBill(Request $request, Bill $bill): JsonResponse
    {
        $reason = $request->validate(['reason' => ['required', 'string', 'min:10', 'max:500']])['reason'];

        return response()->json(['data' => Present::bill($this->billing->void($bill, $request->user(), $reason))]);
    }

    /** Households with an outstanding balance (SCR-FIN-06). */
    public function outstanding(Request $request): JsonResponse
    {
        $q = $request->validate(['q' => ['nullable', 'string', 'max:40']])['q'] ?? null;

        $page = Household::query()->with(['unit', 'head'])
            ->whereHas('bills', fn ($b) => $b->whereIn('status', Bill::OPEN))
            ->when($q, fn ($w) => $w->whereHas('unit', fn ($u) => $u->where('unit_code', 'like', "%{$q}%")))
            ->withSum(['bills as open_total' => fn ($b) => $b->whereIn('status', Bill::OPEN)], 'amount')
            ->withSum(['bills as open_paid' => fn ($b) => $b->whereIn('status', Bill::OPEN)], 'amount_paid')
            ->withCount(['bills as overdue_count' => fn ($b) => $b->where('status', 'overdue')])
            ->orderByDesc('open_total')->paginate(ApiResponse::pageSize($request, 15));

        return ApiResponse::paginateMap($page, fn (Household $h) => [
            'householdId' => $h->id,
            'unit' => $h->unit?->unit_code,
            'head' => $h->head?->name,
            'phone' => $h->head?->phone,
            'balance' => Present::money((float) $h->open_total - (float) $h->open_paid),
            'overdueCount' => (int) $h->overdue_count,
        ]);
    }

    /** Household lookup for issuing bills and recording payments. */
    public function households(Request $request): JsonResponse
    {
        $q = $request->validate(['q' => ['nullable', 'string', 'max:40']])['q'] ?? null;

        return response()->json(['data' => Household::query()->with(['unit', 'head'])->whereNotNull('head_user_id')
            ->when($q, fn ($w) => $w->where(fn ($x) => $x->whereHas('unit', fn ($u) => $u->where('unit_code', 'like', "%{$q}%"))
                ->orWhereHas('head', fn ($u) => $u->where('name', 'like', "%{$q}%"))))
            ->limit(20)->get()->map(fn (Household $h) => ['id' => $h->id, 'unit' => $h->unit?->unit_code, 'head' => $h->head?->name])]);
    }

    // ------------------------------------------------------------ payments

    public function paymentsIndex(Request $request): JsonResponse
    {
        $f = $request->validate([
            'status' => ['nullable', Rule::in(['pending', 'success', 'failed', 'pending_verification', 'rejected'])],
            'method' => ['nullable', Rule::in(['paystack', 'bank_transfer', 'cash', 'pos'])],
            'q' => ['nullable', 'string', 'max:60'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $page = Payment::query()->with(['user', 'household.unit', 'allocations.bill', 'verifier'])
            ->when($f['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($f['method'] ?? null, fn ($q, $v) => $q->where('method', $v))
            ->when($f['from'] ?? null, fn ($q, $v) => $q->where('created_at', '>=', $v))
            ->when($f['to'] ?? null, fn ($q, $v) => $q->where('created_at', '<', \Illuminate\Support\Carbon::parse($v)->addDay()))
            ->when($f['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w->where('reference', 'like', "%{$v}%")->orWhere('receipt_number', 'like', "%{$v}%")
                ->orWhereHas('household.unit', fn ($u) => $u->where('unit_code', 'like', "%{$v}%"))))
            ->latest('id')->paginate(ApiResponse::pageSize($request, 15));

        return ApiResponse::paginateMap($page, fn ($p) => Present::payment($p), [
            'pendingVerification' => Payment::where('status', 'pending_verification')->count(),
        ]);
    }

    public function proof(Payment $payment): StreamedResponse
    {
        abort_unless($payment->proof_path && Storage::disk('local')->exists($payment->proof_path), 404);

        return Storage::disk('local')->response($payment->proof_path, null, ['Cache-Control' => 'private, no-store']);
    }

    public function verifyPayment(Request $request, Payment $payment): JsonResponse
    {
        return response()->json(['data' => Present::payment($this->payments->verifyTransfer($payment, $request->user())->load(['user', 'household.unit', 'allocations.bill']))]);
    }

    public function rejectPayment(Request $request, Payment $payment): JsonResponse
    {
        $reason = $request->validate(['reason' => ['required', 'string', 'min:10', 'max:500']])['reason'];

        return response()->json(['data' => Present::payment($this->payments->rejectTransfer($payment, $request->user(), $reason)->load(['user', 'household.unit']))]);
    }

    public function recordPayment(Request $request): JsonResponse
    {
        $data = $request->validate([
            'household_id' => ['required', 'integer', 'exists:households,id'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:100000000'],
            'method' => ['required', Rule::in(['cash', 'pos', 'bank_transfer'])],
            'bill_ids' => ['nullable', 'array'],
            'bill_ids.*' => ['integer'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $payment = $this->payments->recordOffline($request->user(), Household::findOrFail($data['household_id']), (float) $data['amount'], $data['method'], $data['bill_ids'] ?? [], $data['note'] ?? null);

        return response()->json(['data' => Present::payment($payment->load(['user', 'household.unit', 'allocations.bill']))], 201);
    }

    // ------------------------------------------------------------ helpers

    private function validateService(Request $request, ?Service $service = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:30', 'alpha_dash', Rule::unique('services', 'code')->ignore($service?->id)],
            'description' => ['nullable', 'string', 'max:1000'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:100000000'],
            'frequency' => ['required', Rule::in(Service::FREQUENCIES)],
            'applies_to' => ['required', Rule::in(['all', 'selected'])],
            'auto_bill' => ['required', 'boolean'],
            'due_days' => ['required', 'integer', 'min:0', 'max:120'],
            'is_active' => ['required', 'boolean'],
        ]);
    }

    private function syncAssignments(Request $request, Service $service): void
    {
        if ($service->applies_to === 'selected') {
            $ids = $request->validate(['household_ids' => ['array'], 'household_ids.*' => ['integer', 'exists:households,id']])['household_ids'] ?? [];
            $service->households()->sync($ids);
        } else {
            $service->households()->detach();
        }
    }

    private function presentService(Service $s): array
    {
        return [
            'id' => $s->id, 'name' => $s->name, 'code' => $s->code, 'description' => $s->description,
            'amount' => Present::money($s->amount), 'frequency' => $s->frequency, 'appliesTo' => $s->applies_to,
            'autoBill' => $s->auto_bill, 'dueDays' => $s->due_days, 'isActive' => $s->is_active,
            'householdsCount' => $s->applies_to === 'selected' ? (int) ($s->households_count ?? 0) : null,
            'householdIds' => $s->applies_to === 'selected' ? $s->households()->pluck('households.id') : [],
        ];
    }
}
