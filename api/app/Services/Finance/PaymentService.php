<?php

namespace App\Services\Finance;

use App\Exceptions\BusinessRuleException;
use App\Models\Bill;
use App\Models\Household;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\User;
use App\Notifications\GenericNotification;
use App\Services\AuditLogger;
use App\Services\CodeGenerator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

/**
 * WF-03 online payment and WF-04 manual payment. A payment is only ever applied to bills once
 * (idempotent on reference), and the amount confirmed by Paystack is what gets allocated.
 */
class PaymentService
{
    public function __construct(private readonly CodeGenerator $codes, private readonly AuditLogger $audit) {}

    public static function testMode(): bool
    {
        return ! config('estate.finance.paystack_secret') && ! app()->isProduction();
    }

    /**
     * Starts an online payment for the selected open bills.
     *
     * @param  list<int>  $billIds
     * @return array{payment: Payment, authorizationUrl: string}
     */
    public function initiateOnline(User $user, Household $household, array $billIds): array
    {
        $bills = $this->openBills($household, $billIds);
        $amount = round($bills->sum(fn (Bill $b) => $b->balance()), 2);

        $payment = Payment::create([
            'reference' => 'PAHE-PAY-'.strtoupper(Str::random(12)),
            'household_id' => $household->id,
            'user_id' => $user->id,
            'amount' => $amount,
            'method' => 'paystack',
            'status' => 'pending',
            'gateway_payload' => ['bill_ids' => $bills->pluck('id')->all()],
        ]);

        $callback = config('estate.frontend_url').'/resident/finance/verify?reference='.$payment->reference;

        if (self::testMode()) {
            // Built-in test checkout for demos and staging without Paystack keys.
            $url = config('estate.frontend_url').'/resident/finance/test-checkout?reference='.$payment->reference;
        } else {
            $response = Http::withToken(config('estate.finance.paystack_secret'))->timeout(15)
                ->post(config('estate.finance.paystack_url').'/transaction/initialize', [
                    'email' => $user->email,
                    'amount' => (int) round($amount * 100), // kobo
                    'reference' => $payment->reference,
                    'callback_url' => $callback,
                    'metadata' => ['household_id' => $household->id, 'bill_ids' => $bills->pluck('id')->all()],
                ]);

            if (! $response->ok() || ! $response->json('status')) {
                $payment->update(['status' => 'failed', 'note' => 'Gateway initialisation failed']);
                throw new BusinessRuleException('The payment gateway is unavailable. Please try again shortly.', 'GATEWAY_ERROR', 502);
            }
            $url = $response->json('data.authorization_url');
        }

        return ['payment' => $payment, 'authorizationUrl' => $url];
    }

    /** Confirms a payment with Paystack (or the test checkout) and applies it. Safe to call repeatedly. */
    public function verify(string $reference, ?bool $testOutcome = null): Payment
    {
        $payment = Payment::query()->where('reference', $reference)->firstOrFail();

        if ($payment->status !== 'pending') {
            return $payment;
        }

        if (self::testMode()) {
            if ($testOutcome === null) {
                return $payment;
            }
            $ok = $testOutcome;
            $paidAmount = (float) $payment->amount;
            $gatewayRef = 'TEST-'.$payment->reference;
        } else {
            $response = Http::withToken(config('estate.finance.paystack_secret'))->timeout(15)
                ->get(config('estate.finance.paystack_url').'/transaction/verify/'.urlencode($reference));
            $ok = $response->ok() && $response->json('data.status') === 'success';
            $paidAmount = ((int) $response->json('data.amount', 0)) / 100;
            $gatewayRef = (string) $response->json('data.id');
        }

        if (! $ok) {
            $payment->update(['status' => 'failed']);

            return $payment;
        }

        return $this->apply($payment, $paidAmount, $gatewayRef);
    }

    /** Paystack webhook (charge.success). The signature is HMAC-SHA512 of the raw body with the secret key. */
    public function handleWebhook(string $rawBody, ?string $signature): void
    {
        $secret = (string) config('estate.finance.paystack_secret');
        if (! $secret || ! $signature || ! hash_equals(hash_hmac('sha512', $rawBody, $secret), $signature)) {
            throw new BusinessRuleException('Invalid signature.', 'INVALID_SIGNATURE', 401);
        }

        $event = json_decode($rawBody, true);
        if (($event['event'] ?? null) === 'charge.success' && isset($event['data']['reference'])) {
            $payment = Payment::query()->where('reference', $event['data']['reference'])->first();
            if ($payment && $payment->status === 'pending') {
                $this->apply($payment, ((int) $event['data']['amount']) / 100, (string) ($event['data']['id'] ?? ''));
            }
        }
    }

    /** Bank transfer reported by a resident with proof; waits for finance verification. */
    public function submitTransfer(User $user, Household $household, float $amount, array $billIds, UploadedFile $proof, ?string $note): Payment
    {
        $bills = $this->openBills($household, $billIds);

        $payment = Payment::create([
            'reference' => 'PAHE-TRF-'.strtoupper(Str::random(10)),
            'household_id' => $household->id,
            'user_id' => $user->id,
            'amount' => $amount,
            'method' => 'bank_transfer',
            'status' => 'pending_verification',
            'proof_path' => $proof->store('payments/proofs', 'local'),
            'note' => $note,
            'gateway_payload' => ['bill_ids' => $bills->pluck('id')->all()],
            'paid_at' => now(),
        ]);

        $finance = User::query()->where('status', 'active')
            ->whereHas('roles', fn ($q) => $q->whereIn('code', ['finance_officer', 'super_admin']))->get();
        Notification::send($finance, new GenericNotification('Transfer awaiting verification', $household->unit?->unit_code.' reported ₦'.number_format($amount, 2), '/admin/finance/payments?status=pending_verification', 'finance'));
        $this->audit->log('payment.transfer_submitted', $payment, after: ['amount' => $amount], actor: $user);

        return $payment;
    }

    public function verifyTransfer(Payment $payment, User $actor): Payment
    {
        if ($payment->status !== 'pending_verification') {
            throw BusinessRuleException::invalidState('Only payments awaiting verification can be verified.');
        }
        $payment->update(['verified_by' => $actor->id, 'verified_at' => now()]);

        return $this->apply($payment, (float) $payment->amount, null, $actor);
    }

    public function rejectTransfer(Payment $payment, User $actor, string $reason): Payment
    {
        if ($payment->status !== 'pending_verification') {
            throw BusinessRuleException::invalidState('Only payments awaiting verification can be rejected.');
        }
        $payment->update(['status' => 'rejected', 'rejection_reason' => $reason, 'verified_by' => $actor->id, 'verified_at' => now()]);
        $this->notifyPayer($payment, 'Payment not verified', 'Reason: '.$reason);
        $this->audit->log('payment.rejected', $payment, null, ['reason' => $reason], $actor);

        return $payment;
    }

    /** Cash / POS payment recorded by a finance officer at the estate office. */
    public function recordOffline(User $actor, Household $household, float $amount, string $method, array $billIds, ?string $note): Payment
    {
        $this->openBills($household, $billIds, allowEmpty: true);

        $payment = Payment::create([
            'reference' => 'PAHE-'.strtoupper($method).'-'.strtoupper(Str::random(10)),
            'household_id' => $household->id,
            'user_id' => $household->head_user_id,
            'amount' => $amount,
            'method' => $method,
            'status' => 'pending',
            'note' => $note,
            'gateway_payload' => ['bill_ids' => $billIds],
            'verified_by' => $actor->id,
            'verified_at' => now(),
        ]);

        return $this->apply($payment, $amount, null, $actor);
    }

    /** Allocates a confirmed amount to the chosen bills first, then the oldest open bills. */
    private function apply(Payment $payment, float $amount, ?string $gatewayRef, ?User $actor = null): Payment
    {
        $applied = false;
        DB::transaction(function () use ($payment, $amount, $gatewayRef, &$applied) {
            $payment = Payment::query()->lockForUpdate()->findOrFail($payment->id);
            if (! in_array($payment->status, ['pending', 'pending_verification'], true)) {
                return; // already applied by a concurrent webhook / verify call
            }
            $applied = true;

            $chosen = (array) ($payment->gateway_payload['bill_ids'] ?? []);
            $bills = Bill::query()->where('household_id', $payment->household_id)->whereIn('status', Bill::OPEN)
                ->orderByRaw('CASE WHEN id IN ('.(implode(',', array_map('intval', $chosen)) ?: '0').') THEN 0 ELSE 1 END')
                ->orderBy('due_date')->lockForUpdate()->get();

            $remaining = $amount;
            foreach ($bills as $bill) {
                if ($remaining <= 0) {
                    break;
                }
                $portion = min($remaining, $bill->balance());
                if ($portion <= 0) {
                    continue;
                }
                PaymentAllocation::create(['payment_id' => $payment->id, 'bill_id' => $bill->id, 'amount' => $portion]);
                $bill->amount_paid = round((float) $bill->amount_paid + $portion, 2);
                BillingService::refreshStatus($bill);
                $remaining = round($remaining - $portion, 2);
            }

            $payment->forceFill([
                'status' => 'success',
                'amount' => $amount,
                'gateway_reference' => $gatewayRef ?? $payment->gateway_reference,
                'receipt_number' => $this->codes->next('payments', 'receipt_number', 'RCT', 5),
                'paid_at' => $payment->paid_at ?? now(),
                'note' => $remaining > 0 ? trim(($payment->note ? $payment->note.' ' : '').'Unallocated credit: ₦'.number_format($remaining, 2)) : $payment->note,
            ])->save();
        });

        $payment->refresh();
        if (! $applied) {
            return $payment;
        }
        $this->notifyPayer($payment, 'Payment received', 'Receipt '.$payment->receipt_number.' for ₦'.number_format((float) $payment->amount, 2));
        $this->audit->log('payment.success', $payment, null, ['amount' => (float) $payment->amount, 'method' => $payment->method], $actor);

        return $payment;
    }

    /** @return \Illuminate\Support\Collection<int, Bill> */
    private function openBills(Household $household, array $billIds, bool $allowEmpty = false)
    {
        $bills = Bill::query()->where('household_id', $household->id)->whereIn('status', Bill::OPEN)
            ->when($billIds, fn ($q) => $q->whereIn('id', $billIds))->get();

        if ($bills->isEmpty() && ! $allowEmpty) {
            throw new BusinessRuleException('There are no unpaid bills to pay.', 'NOTHING_TO_PAY');
        }

        return $bills;
    }

    private function notifyPayer(Payment $payment, string $title, string $body): void
    {
        $users = User::query()->whereHas('resident', fn ($q) => $q->where('household_id', $payment->household_id))->get();
        Notification::send($users, new GenericNotification($title, $body, '/resident/finance', 'finance', email: true));
    }
}
