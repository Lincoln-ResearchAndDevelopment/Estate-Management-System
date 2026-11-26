<?php

namespace Tests\Feature\Modules;

use App\Models\Bill;
use App\Models\IncidentReport;
use App\Models\Service;
use App\Models\VisitorPass;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** QR visitor passes, resident estate pass clearance, paying by month, panic resolution and resident reports. */
class ResidentQrAndMonthsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        Storage::fake('local');
        config(['estate.finance.paystack_secret' => null]);
    }

    private function monthlyService(float $amount = 20000): Service
    {
        return Service::create(['name' => 'Service charge', 'code' => 'SVC', 'amount' => $amount, 'frequency' => 'monthly', 'applies_to' => 'all', 'auto_bill' => true, 'due_days' => 14, 'is_active' => true]);
    }

    public function test_visitor_pass_has_a_qr_code_the_gate_can_scan_and_a_share_link(): void
    {
        $this->signIn($this->resident());
        $pass = $this->postJson('/api/v1/resident/passes', [
            'visitor_name' => 'Ngozi Eze', 'valid_from' => now()->toIso8601String(), 'valid_until' => now()->addHours(4)->toIso8601String(),
        ])->assertCreated()->json('data');
        $this->assertMatchesRegularExpression('/^PAHE-V:[A-Za-z0-9]{40}$/', $pass['qrPayload']);
        $token = substr($pass['qrPayload'], 7);

        // The visitor opens the shared link without signing in and sees their QR, but no resident details.
        $this->app['auth']->forgetGuards();
        $public = $this->getJson("/api/v1/public/passes/{$token}")->assertOk()->json('data');
        $this->assertSame('Ngozi Eze', $public['visitorName']);
        $this->assertArrayNotHasKey('visitorPhone', $public);
        $this->getJson('/api/v1/public/passes/'.str_repeat('x', 40))->assertNotFound();

        $this->signIn('security_officer');
        $this->postJson('/api/v1/security/passes/verify', ['code' => $pass['qrPayload']])
            ->assertOk()->assertJsonPath('data.kind', 'visitor')->assertJsonPath('data.valid', true);
        // Scanning the share link itself also works.
        $this->postJson('/api/v1/security/passes/verify', ['code' => $pass['shareUrl']])->assertJsonPath('data.valid', true);
        $this->postJson('/api/v1/security/access-logs', ['direction' => 'in', 'pass_code' => $pass['qrPayload']])->assertCreated();
        $this->assertSame(1, VisitorPass::first()->entries_used);
    }

    public function test_resident_pass_is_not_cleared_until_finance_confirms_payment(): void
    {
        $this->monthlyService();
        $resident = $this->resident();
        $this->signIn('finance_officer');
        $this->postJson('/api/v1/finance/services/'.Service::first()->id.'/bill-now')->assertOk();
        $bill = Bill::firstOrFail();
        $this->assertNotNull($bill->period_start);

        $this->signIn($resident);
        $pass = $this->getJson('/api/v1/resident/pass')->assertOk()->assertJsonPath('data.cleared', false)->json('data');
        $this->assertMatchesRegularExpression('/^PAHE-R:[A-Za-z0-9]{40}$/', $pass['qrPayload']);

        $this->signIn('security_officer');
        $this->postJson('/api/v1/security/passes/verify', ['code' => $pass['qrPayload']])
            ->assertOk()->assertJsonPath('data.kind', 'resident')->assertJsonPath('data.cleared', false)
            ->assertJsonPath('data.outstanding.amount', '20000.00');

        // Resident pays by transfer; still not cleared until finance approves it.
        $this->signIn($resident);
        $this->post('/api/v1/resident/payments/transfer', ['amount' => 20000, 'bill_ids' => [$bill->id], 'proof' => UploadedFile::fake()->create('p.pdf', 20, 'application/pdf')], ['Accept' => 'application/json'])->assertCreated();
        $this->getJson('/api/v1/resident/pass')->assertJsonPath('data.cleared', false);

        $this->signIn('finance_officer');
        $payment = \App\Models\Payment::where('status', 'pending_verification')->firstOrFail();
        $this->postJson("/api/v1/finance/payments/{$payment->id}/verify")->assertOk();

        $this->signIn($resident);
        $this->getJson('/api/v1/resident/pass')->assertJsonPath('data.cleared', true);
        $this->signIn('security_officer');
        $this->postJson('/api/v1/security/passes/verify', ['code' => $pass['qrPayload']])->assertJsonPath('data.cleared', true);
    }

    public function test_resident_picks_months_to_pay_including_months_ahead(): void
    {
        $this->monthlyService(15000);
        $resident = $this->resident();
        $this->signIn($resident);

        $months = $this->getJson('/api/v1/resident/months')->assertOk()->json('data');
        $this->assertSame('15000.00', $months['monthlyTotal']['amount']);
        $this->assertCount(12, $months['months']);
        $this->assertSame('not_billed', $months['months'][0]['status']);

        $next = now()->startOfMonth()->addMonth()->format('Y-m');
        $after = now()->startOfMonth()->addMonths(2)->format('Y-m');
        $res = $this->postJson('/api/v1/resident/bills/months', ['periods' => [$next, $after]])->assertOk()->json('data');
        $this->assertCount(2, $res['billIds']);
        $this->assertSame('30000.00', $res['total']['amount']);
        // Asking again returns the same bills instead of duplicating them.
        $this->postJson('/api/v1/resident/bills/months', ['periods' => [$next]])->assertOk()->assertJsonCount(1, 'data.billIds');
        $this->assertSame(2, Bill::count());

        // Unpaid bills for months that have not started do not block clearance.
        $this->getJson('/api/v1/resident/pass')->assertJsonPath('data.cleared', true);

        // Pay them through the test checkout.
        $ref = $this->postJson('/api/v1/resident/payments/initialize', ['bill_ids' => $res['billIds']])->assertCreated()->json('data.reference');
        $this->postJson('/api/v1/resident/payments/test-complete', ['reference' => $ref, 'outcome' => 'success'])->assertOk();
        $this->assertSame(2, Bill::where('status', 'paid')->count());
        $this->getJson('/api/v1/resident/months')->assertJsonPath('data.months.1.status', 'paid');

        $this->postJson('/api/v1/resident/bills/months', ['periods' => [now()->addMonths(14)->format('Y-m')]])->assertStatus(409);
    }

    public function test_dashboard_shows_the_monthly_charge_set_by_finance(): void
    {
        $service = $this->monthlyService(25000);
        $this->signIn('finance_officer');
        $this->putJson("/api/v1/finance/services/{$service->id}", [
            'name' => 'Service charge', 'code' => 'SVC', 'amount' => 30000, 'frequency' => 'monthly', 'applies_to' => 'all', 'auto_bill' => true, 'due_days' => 14, 'is_active' => true,
        ])->assertOk();

        $this->signIn($this->resident());
        $this->getJson('/api/v1/resident/dashboard')->assertOk()->assertJsonPath('data.monthlyTotal.amount', '30000.00');
    }

    public function test_only_the_security_team_can_resolve_a_panic_alert(): void
    {
        $this->signIn($this->resident());
        $id = $this->postJson('/api/v1/resident/alerts', ['type' => 'panic'])->assertCreated()->json('data.id');

        foreach (['estate_manager', 'super_admin'] as $role) {
            $this->signIn($role);
            $this->getJson('/api/v1/security/alerts')->assertOk(); // management can watch
            $this->postJson("/api/v1/security/alerts/{$id}/transition", ['status' => 'acknowledged'])->assertForbidden();
        }

        $this->signIn('security_officer');
        $this->postJson("/api/v1/security/alerts/{$id}/transition", ['status' => 'acknowledged'])->assertOk();
        $this->postJson("/api/v1/security/alerts/{$id}/transition", ['status' => 'resolved', 'note' => 'Officer attended; resident safe.'])->assertOk();
    }

    public function test_resident_report_reaches_the_security_team(): void
    {
        $resident = $this->resident();
        $this->signIn($resident);
        $this->postJson('/api/v1/resident/reports', ['title' => 'Strangers loitering', 'category' => 'suspicious_activity', 'description' => 'Two men checking car doors on my street.'])
            ->assertCreated()->assertJsonPath('data.status', 'open');
        $this->getJson('/api/v1/resident/reports')->assertOk()->assertJsonCount(1, 'data');

        $this->signIn('security_officer');
        $this->getJson('/api/v1/security/incidents')->assertOk()->assertJsonPath('data.0.title', 'Strangers loitering');
        $this->assertSame($resident->id, IncidentReport::first()->reported_by);
    }
}
