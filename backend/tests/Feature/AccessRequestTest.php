<?php

namespace Tests\Feature;

use App\Models\AccessRequest;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** AT-01 and WF-01: resident registration → approval → sign-in. */
class AccessRequestTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Notification::fake();
    }

    private function submit(array $overrides = [])
    {
        $unit = Unit::factory()->create(['unit_code' => 'A-101']);

        return $this->post('/api/v1/auth/access-requests', array_merge([
            'full_name' => 'Amina Bello',
            'email' => 'amina@example.com',
            'phone' => '+2348012345678',
            'relationship' => 'primary_resident',
            'unit_id' => $unit->id,
            'national_id' => '12345678901',
            'password' => 'Resident#2026',
            'password_confirmation' => 'Resident#2026',
            'declaration_inside_estate' => '1',
            'declaration_info_correct' => '1',
            'declaration_agree_rules' => '1',
            'profile_photo' => UploadedFile::fake()->image('me.jpg'),
            'face_capture' => UploadedFile::fake()->image('face.jpg'),
        ], $overrides), ['Accept' => 'application/json']);
    }

    public function test_applicant_submits_and_estate_manager_approves(): void
    {
        $this->submit()->assertCreated()->assertJsonPath('data.status', 'pending');

        $request = AccessRequest::firstOrFail();
        $this->assertNotSame('12345678901', $request->getRawOriginal('nin_encrypted'), 'NIN must be encrypted at rest');

        $this->signIn('estate_manager');
        $this->getJson('/api/v1/admin/access-requests?status=pending')->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.nationalIdMasked', '•••••••8901');
        $this->postJson("/api/v1/admin/access-requests/{$request->id}/approve")->assertOk()->assertJsonPath('data.status', 'approved');

        $user = User::where('email', 'amina@example.com')->firstOrFail();
        $this->assertSame('resident_head', $user->primary_role);
        $this->assertTrue($user->isActive());
        $this->assertSame('occupied', Unit::first()->occupancy_status);
    }

    public function test_rejection_requires_reason_and_cannot_be_decided_twice(): void
    {
        $this->submit()->assertCreated();
        $request = AccessRequest::firstOrFail();
        $this->signIn('estate_manager');

        $this->postJson("/api/v1/admin/access-requests/{$request->id}/reject", ['reason' => 'short'])->assertStatus(422);
        $this->postJson("/api/v1/admin/access-requests/{$request->id}/reject", ['reason' => 'House number does not match records.'])->assertOk();
        $this->postJson("/api/v1/admin/access-requests/{$request->id}/approve")->assertStatus(409)->assertJsonPath('code', 'INVALID_STATE');
    }

    public function test_duplicate_open_request_is_blocked(): void
    {
        $this->submit()->assertCreated();

        $this->post('/api/v1/auth/access-requests', [
            'full_name' => 'Amina Bello', 'email' => 'amina@example.com', 'phone' => '+2348012345678',
            'relationship' => 'primary_resident', 'unit_id' => Unit::first()->id, 'national_id' => '12345678901',
            'password' => 'Resident#2026', 'password_confirmation' => 'Resident#2026',
            'declaration_inside_estate' => '1', 'declaration_info_correct' => '1', 'declaration_agree_rules' => '1',
            'profile_photo' => UploadedFile::fake()->image('me.jpg'), 'face_capture' => UploadedFile::fake()->image('face.jpg'),
        ], ['Accept' => 'application/json'])->assertStatus(409)->assertJsonPath('code', 'DUPLICATE');
    }

    public function test_invalid_fields_return_field_errors(): void
    {
        $this->submit(['phone' => '0801', 'national_id' => '123', 'declaration_agree_rules' => '0'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_FAILED');
    }

    public function test_security_officer_can_view_but_not_decide(): void
    {
        $this->submit()->assertCreated();
        $this->signIn('security_officer');

        $this->getJson('/api/v1/admin/access-requests')->assertOk();
        $this->postJson('/api/v1/admin/access-requests/'.AccessRequest::first()->id.'/approve')->assertForbidden();
    }
}
