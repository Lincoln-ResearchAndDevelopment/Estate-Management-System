<?php

namespace App\Http\Controllers\Api\V1\Resident;

use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Api\V1\Admin\SettingsController;
use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\Household;
use App\Models\Payment;
use App\Services\Finance\BillingService;
use App\Services\Finance\PaymentService;
use App\Support\ApiResponse;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Resident finance (SCR-FIN-09–14): bills, online payment, bank transfer, receipts. */
class ResidentFinanceController extends Controller
{
    public function __construct(private readonly PaymentService $payments) {}

    public function summary(Request $request): JsonResponse
    {
        $household = $this->household($request);
        $bills = Bill::query()->with('service')->where('household_id', $household->id)->latest('due_date')->limit(50)->get();
        $open = $bills->whereIn('status', Bill::OPEN);

        return response()->json(['data' => [
            'balance' => Present::money($open->sum(fn (Bill $b) => $b->balance())),
            'overdue' => Present::money($open->where('status', 'overdue')->sum(fn (Bill $b) => $b->balance())),
            'paidThisYear' => Present::money(Payment::query()->where('household_id', $household->id)->where('status', 'success')->whereYear('paid_at', now()->year)->sum('amount')),
            'bills' => $bills->map(fn ($b) => Present::bill($b))->values(),
            'testMode' => PaymentService::testMode(),
            'bankDetails' => array_filter([
                'bankName' => SettingsController::all()['bank_name'],
                'accountName' => SettingsController::all()['account_name'],
                'accountNumber' => SettingsController::all()['account_number'],
            ]) ?: null,
        ]]);
    }

    public function payments(Request $request): JsonResponse
    {
        $household = $this->household($request);
        $page = Payment::query()->with(['allocations.bill', 'user'])->where('household_id', $household->id)
            ->latest()->paginate(ApiResponse::pageSize($request));

        return ApiResponse::paginateMap($page, fn ($p) => Present::payment($p));
    }

    /**
     * POST /resident/bills/months — prepares bills for the months the resident picked (creating bills for
     * upcoming months that have not been raised yet) and returns them, ready to pay online or by transfer.
     */
    public function billMonths(Request $request, BillingService $billing): JsonResponse
    {
        $household = $this->household($request);
        $periods = $request->validate([
            'periods' => ['required', 'array', 'min:1', 'max:24'],
            'periods.*' => ['string', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
        ])['periods'];
        $bills = $billing->billMonths($household, $periods, $request->user());
        if ($bills->isEmpty()) {
            throw BusinessRuleException::invalidState('Nothing is owed for the months you selected.');
        }

        return response()->json(['data' => [
            'billIds' => $bills->pluck('id')->values(),
            'total' => Present::money($bills->sum(fn (Bill $b) => $b->balance())),
            'bills' => $bills->map(fn ($b) => Present::bill($b->load('service')))->values(),
        ]]);
    }

    public function initiate(Request $request): JsonResponse
    {
        $household = $this->household($request);
        $ids = $request->validate(['bill_ids' => ['required', 'array', 'min:1'], 'bill_ids.*' => ['integer']])['bill_ids'];
        $result = $this->payments->initiateOnline($request->user(), $household, $ids);

        return response()->json(['data' => [
            'reference' => $result['payment']->reference,
            'amount' => Present::money($result['payment']->amount),
            'authorizationUrl' => $result['authorizationUrl'],
        ]], 201);
    }

    /** GET /resident/payments/verify?reference= — called when Paystack redirects back. */
    public function verify(Request $request): JsonResponse
    {
        $reference = $request->validate(['reference' => ['required', 'string', 'max:60']])['reference'];
        $payment = $this->own($request, $reference);

        return response()->json(['data' => Present::payment($this->payments->verify($payment->reference)->load(['allocations.bill', 'user']))]);
    }

    /** POST /resident/payments/test-complete — built-in test checkout (only without Paystack keys, never in production). */
    public function completeTest(Request $request): JsonResponse
    {
        abort_unless(PaymentService::testMode(), 404);
        $data = $request->validate(['reference' => ['required', 'string'], 'outcome' => ['required', Rule::in(['success', 'failed'])]]);
        $payment = $this->own($request, $data['reference']);

        return response()->json(['data' => Present::payment($this->payments->verify($payment->reference, $data['outcome'] === 'success')->load(['allocations.bill', 'user']))]);
    }

    public function transfer(Request $request): JsonResponse
    {
        $household = $this->household($request);
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0', 'max:100000000'],
            'bill_ids' => ['required', 'array', 'min:1'],
            'bill_ids.*' => ['integer'],
            'proof' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:'.config('estate.uploads.document_max_kb')],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $payment = $this->payments->submitTransfer($request->user(), $household, (float) $data['amount'], $data['bill_ids'], $request->file('proof'), $data['note'] ?? null);

        return response()->json(['data' => Present::payment($payment), 'message' => 'Transfer submitted. Finance will verify it shortly.'], 201);
    }

    public function receipt(Request $request, Payment $payment): JsonResponse
    {
        abort_unless($payment->household_id === $this->household($request)->id && $payment->status === 'success', 404);

        return response()->json(['data' => Present::payment($payment->load(['allocations.bill', 'user', 'household.unit'])) + [
            'estate' => config('estate.name'),
            'verifyUrl' => config('estate.frontend_url').'/receipts/'.$payment->receipt_number,
        ]]);
    }

    private function household(Request $request): Household
    {
        $household = $request->user()->household();
        if (! $household) {
            throw new BusinessRuleException('Your account is not linked to a household yet.', 'NO_HOUSEHOLD', 404);
        }

        return $household;
    }

    private function own(Request $request, string $reference): Payment
    {
        return Payment::query()->where('reference', $reference)->where('household_id', $this->household($request)->id)->firstOrFail();
    }
}
