<?php

namespace Tests\Feature\Modules;

use App\Models\Bill;
use App\Models\Payment;
use App\Models\Service;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** M05: billing, online payment (test checkout), bank transfer verification, webhook signature. */
class FinanceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        Storage::fake('local');
        config(['estate.finance.paystack_secret' => null]);
    }

    private function serviceWithBills(): array
    {
        $resident = $this->resident();
        $this->signIn('finance_officer');
        $this->postJson('/api/v1/finance/services', [
            'name' => 'Service charge', 'code' => 'SVC', 'amount' => 20000, 'frequency' => 'monthly',
            'applies_to' => 'all', 'auto_bill' => true, 'due_days' => 14, 'is_active' => true,
        ])->assertCreated();
        $service = Service::where('code', 'SVC')->firstOrFail();
        $this->postJson("/api/v1/finance/services/{$service->id}/bill-now")->assertOk();
        // Billing twice in one period must not duplicate.
        $this->postJson("/api/v1/finance/services/{$service->id}/bill-now")->assertOk();

        $bills = Bill::where('household_id', $resident->household()->id)->get();
        $this->assertCount(1, $bills);

        return [$resident, $bills->first()];
    }

    public function test_test_mode_checkout_pays_the_bill_and_issues_a_receipt(): void
    {
        [$resident, $bill] = $this->serviceWithBills();
        $this->signIn($resident);

        $this->getJson('/api/v1/resident/finance')->assertOk()
            ->assertJsonPath('data.balance.amount', '20000.00')
            ->assertJsonPath('data.testMode', true);

        $ref = $this->postJson('/api/v1/resident/payments/initialize', ['bill_ids' => [$bill->id]])
            ->assertCreated()->json('data.reference');

        $this->postJson('/api/v1/resident/payments/test-complete', ['reference' => $ref, 'outcome' => 'success'])->assertOk();
        // Completing again is harmless (idempotent).
        $this->postJson('/api/v1/resident/payments/test-complete', ['reference' => $ref, 'outcome' => 'success'])->assertOk();

        $this->assertSame('paid', $bill->fresh()->status);
        $payment = Payment::where('reference', $ref)->firstOrFail();
        $this->assertSame('success', $payment->status);
        $this->assertNotNull($payment->receipt_number);
        $this->assertSame(1, $payment->allocations()->count());

        $this->getJson("/api/v1/public/receipts/{$payment->receipt_number}")->assertOk();
        $this->getJson('/api/v1/public/receipts/PAHE-RCT-0000-0000')->assertNotFound();
    }

    public function test_bank_transfer_needs_finance_verification(): void
    {
        [$resident, $bill] = $this->serviceWithBills();
        $this->signIn($resident);

        $this->post('/api/v1/resident/payments/transfer', [
            'amount' => 20000, 'bill_ids' => [$bill->id], 'proof' => UploadedFile::fake()->create('proof.pdf', 50, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $payment = Payment::where('method', 'bank_transfer')->firstOrFail();
        $this->assertSame('pending_verification', $payment->status);
        $this->assertSame('unpaid', $bill->fresh()->status);

        // A resident cannot verify their own transfer.
        $this->postJson("/api/v1/finance/payments/{$payment->id}/verify")->assertForbidden();

        $this->signIn('finance_officer');
        $this->postJson("/api/v1/finance/payments/{$payment->id}/verify")->assertOk();
        $this->assertSame('paid', $bill->fresh()->status);
        $this->assertSame('success', $payment->fresh()->status);
    }

    public function test_webhook_rejects_bad_signatures_and_applies_good_ones(): void
    {
        [$resident, $bill] = $this->serviceWithBills();
        config(['estate.finance.paystack_secret' => 'sk_test_unit']);
        $payment = Payment::create([
            'reference' => 'PAHE-PSK-TEST1', 'household_id' => $resident->household()->id, 'user_id' => $resident->id,
            'amount' => 20000, 'method' => 'paystack', 'status' => 'pending', 'gateway_payload' => ['bill_ids' => [$bill->id]],
        ]);
        $body = json_encode(['event' => 'charge.success', 'data' => ['reference' => 'PAHE-PSK-TEST1', 'amount' => 2000000, 'id' => 99]]);

        $this->call('POST', '/api/v1/webhooks/paystack', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_X_PAYSTACK_SIGNATURE' => 'forged', 'HTTP_ACCEPT' => 'application/json'], $body)
            ->assertStatus(401);
        $this->assertSame('pending', $payment->fresh()->status);

        $this->call('POST', '/api/v1/webhooks/paystack', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_X_PAYSTACK_SIGNATURE' => hash_hmac('sha512', $body, 'sk_test_unit'), 'HTTP_ACCEPT' => 'application/json'], $body)
            ->assertOk();
        $this->assertSame('success', $payment->fresh()->status);
        $this->assertSame('paid', $bill->fresh()->status);
    }

    public function test_finance_officer_records_offline_payment_and_voids_bills(): void
    {
        [$resident, $bill] = $this->serviceWithBills();

        $this->postJson('/api/v1/finance/payments/record', [
            'household_id' => $resident->household()->id, 'amount' => 5000, 'method' => 'cash', 'bill_ids' => [$bill->id],
        ])->assertCreated();
        $this->assertSame('part_paid', $bill->fresh()->status);

        $this->getJson('/api/v1/finance/overview')->assertOk();
        $this->getJson('/api/v1/finance/outstanding')->assertOk();

        $manual = $this->postJson('/api/v1/finance/bills', [
            'household_ids' => [$resident->household()->id], 'description' => 'Gate remote replacement', 'amount' => 3000, 'due_date' => now()->addWeek()->toDateString(),
        ])->assertCreated();
        $other = Bill::whereNull('service_id')->firstOrFail();
        $this->postJson("/api/v1/finance/bills/{$other->id}/void", ['reason' => 'Raised against the wrong unit'])->assertOk();
        $this->assertSame('void', $other->fresh()->status);
    }
}
