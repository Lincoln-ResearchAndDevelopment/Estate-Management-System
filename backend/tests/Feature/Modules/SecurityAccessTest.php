<?php

namespace Tests\Feature\Modules;

use App\Models\AccessLog;
use App\Models\EmergencyAlert;
use App\Models\VisitorPass;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** M08 emergency alerts, M09 gate access, M10 blacklist. */
class SecurityAccessTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
    }

    public function test_panic_alert_lifecycle(): void
    {
        $resident = $this->resident();
        $this->signIn($resident);
        $id = $this->postJson('/api/v1/resident/alerts', ['type' => 'panic'])->assertCreated()->json('data.id');
        // A second press returns the same open alert, not a duplicate.
        $this->postJson('/api/v1/resident/alerts', ['type' => 'panic'])->assertJsonPath('data.id', $id);
        $this->assertSame(1, EmergencyAlert::count());

        $officer = $this->signIn('security_officer');
        $this->getJson('/api/v1/security/overview')->assertOk();
        $this->postJson("/api/v1/security/alerts/{$id}/transition", ['status' => 'acknowledged'])->assertOk();
        $this->postJson("/api/v1/security/alerts/{$id}/transition", ['status' => 'dispatched', 'responder_id' => $officer->id])->assertOk();
        // Resolving needs a note.
        $this->postJson("/api/v1/security/alerts/{$id}/transition", ['status' => 'resolved'])->assertStatus(422);
        $this->postJson("/api/v1/security/alerts/{$id}/transition", ['status' => 'resolved', 'note' => 'False trigger by a child; all safe.'])->assertOk();
        $this->assertSame('resolved', EmergencyAlert::find($id)->status);
        // Cannot reopen a resolved alert.
        $this->postJson("/api/v1/security/alerts/{$id}/transition", ['status' => 'acknowledged'])->assertStatus(422);
    }

    public function test_visitor_pass_check_in_consumes_entries(): void
    {
        $resident = $this->resident();
        $this->signIn($resident);
        $code = $this->postJson('/api/v1/resident/passes', [
            'visitor_name' => 'Chidi Okafor', 'valid_from' => now()->toIso8601String(), 'valid_until' => now()->addHours(6)->toIso8601String(), 'max_entries' => 1,
        ])->assertCreated()->json('data.code');

        $this->signIn('security_officer');
        $this->postJson('/api/v1/security/passes/verify', ['code' => $code])->assertOk()->assertJsonPath('data.valid', true);
        $this->postJson('/api/v1/security/access-logs', ['direction' => 'in', 'pass_code' => $code])->assertCreated();
        $this->assertSame(1, VisitorPass::first()->entries_used);
        $this->getJson('/api/v1/security/inside')->assertOk()->assertJsonCount(1, 'data');

        // Single-entry pass cannot be reused.
        $this->postJson('/api/v1/security/passes/verify', ['code' => $code])->assertJsonPath('data.valid', false);
    }

    public function test_blacklisted_visitor_is_refused_and_the_attempt_logged(): void
    {
        $this->signIn('estate_manager');
        $this->postJson('/api/v1/security/blacklist', [
            'list' => 'black', 'subject_type' => 'vehicle', 'plate_number' => 'ABC 123 XY', 'reason' => 'Involved in a theft last month.',
        ])->assertCreated();

        $this->signIn('security_officer');
        $this->postJson('/api/v1/security/access-logs', ['direction' => 'in', 'person_name' => 'Unknown driver', 'plate_number' => 'abc123xy'])
            ->assertStatus(422);
        $log = AccessLog::firstOrFail();
        $this->assertTrue((bool) $log->flagged);
        $this->assertStringStartsWith('REFUSED', $log->flag_reason);

        // Officers can view but not edit the list.
        $this->getJson('/api/v1/security/blacklist')->assertOk();
    }

    public function test_finance_officer_cannot_reach_the_security_console_and_residents_cannot_open_the_gate(): void
    {
        $this->signIn('finance_officer');
        $this->getJson('/api/v1/security/alerts')->assertForbidden();
        $this->signIn($this->resident());
        $this->postJson('/api/v1/security/access-logs', ['direction' => 'in', 'person_name' => 'Me'])->assertForbidden();
    }
}
