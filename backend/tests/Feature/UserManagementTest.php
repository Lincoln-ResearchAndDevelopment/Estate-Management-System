<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\AccountInvitation;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** FR-USR-01/05: accounts are created with an invitation, never a shared password. */
class UserManagementTest extends TestCase
{
    public function test_admin_creates_user_who_receives_set_password_invitation(): void
    {
        Notification::fake();
        $this->signIn('estate_manager');

        $this->postJson('/api/v1/admin/users', [
            'name' => 'Officer Musa', 'email' => 'MUSA@example.com', 'phone' => '+2348099999999', 'role' => 'security_officer',
        ])->assertCreated()->assertJsonPath('data.status', 'pending');

        $user = User::where('email', 'musa@example.com')->firstOrFail();
        $this->assertTrue($user->hasRole('security_officer'));
        $this->assertFalse(Hash::check('LincolnEstate2024!', $user->password));
        Notification::assertSentTo($user, AccountInvitation::class);
        $this->assertTrue(AuditLog::where('action', 'user.created')->exists());
    }

    public function test_blocking_a_user_revokes_access_and_cannot_target_self(): void
    {
        $admin = $this->signIn('estate_manager');
        $target = $this->userWithRole('resident_head');

        $this->postJson("/api/v1/admin/users/{$target->id}/block", ['reason' => 'Requested by household'])->assertOk()
            ->assertJsonPath('data.status', 'blocked');
        $this->postJson("/api/v1/admin/users/{$admin->id}/block")->assertForbidden();
    }

    public function test_user_list_supports_search_role_filter_and_kpis(): void
    {
        $this->signIn('estate_manager');
        $this->userWithRole('agent', ['name' => 'Chidi Agent']);
        $this->userWithRole('resident_head', ['name' => 'Ngozi Resident']);

        $this->getJson('/api/v1/admin/users?q=Chidi')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/admin/users?role=resident_head')->assertOk()->assertJsonPath('data.0.name', 'Ngozi Resident');
        $this->getJson('/api/v1/admin/users')->assertJsonPath('meta.kpis.totalUsers', 3);
    }

    public function test_validation_errors_use_problem_json_shape(): void
    {
        $this->signIn('estate_manager');

        $this->postJson('/api/v1/admin/users', ['email' => 'not-an-email'])
            ->assertStatus(422)
            ->assertHeader('Content-Type', 'application/problem+json')
            ->assertJsonStructure(['type', 'title', 'status', 'code', 'detail', 'errors' => [['field', 'message']], 'traceId']);
    }
}
