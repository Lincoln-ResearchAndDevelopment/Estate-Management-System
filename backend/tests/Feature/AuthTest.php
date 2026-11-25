<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\User;
use Tests\TestCase;

/** AT-02 and FR-AUTH-01/07/12. */
class AuthTest extends TestCase
{
    private function login(array $credentials)
    {
        return $this->withHeader('Referer', 'http://localhost')->postJson('/api/v1/auth/login', $credentials);
    }

    public function test_active_user_signs_in_and_receives_permissions_and_portal(): void
    {
        $this->userWithRole('estate_manager', ['email' => 'em@example.com']);

        $this->login(['email' => 'em@example.com', 'password' => 'Secret#123'])
            ->assertOk()
            ->assertJsonPath('data.user.email', 'em@example.com')
            ->assertJsonPath('data.portal', '/admin')
            ->assertJsonFragment(['listings.approve']);
    }

    public function test_wrong_password_is_rejected_with_generic_message(): void
    {
        $this->userWithRole('agent', ['email' => 'a@example.com']);

        $this->login(['email' => 'a@example.com', 'password' => 'wrong'])
            ->assertStatus(401)
            ->assertJsonPath('code', 'INVALID_CREDENTIALS');
    }

    public function test_pending_and_blocked_accounts_get_explained_errors(): void
    {
        $this->userWithRole('agent', ['email' => 'p@example.com', 'status' => UserStatus::Pending]);
        $this->userWithRole('agent', ['email' => 'b@example.com', 'status' => UserStatus::Blocked]);

        $this->login(['email' => 'p@example.com', 'password' => 'Secret#123'])->assertStatus(403)->assertJsonPath('code', 'ACCOUNT_PENDING');
        $this->login(['email' => 'b@example.com', 'password' => 'Secret#123'])->assertStatus(403)->assertJsonPath('code', 'ACCOUNT_BLOCKED');
    }

    public function test_account_locks_after_five_failed_attempts(): void
    {
        $user = $this->userWithRole('agent', ['email' => 'lock@example.com']);

        for ($i = 0; $i < 5; $i++) {
            $this->login(['email' => 'lock@example.com', 'password' => 'wrong'])->assertStatus(401);
        }

        $this->login(['email' => 'lock@example.com', 'password' => 'Secret#123'])->assertStatus(423)->assertJsonPath('code', 'ACCOUNT_LOCKED');
        $this->assertNotNull($user->fresh()->locked_until);
    }

    public function test_session_endpoint_requires_authentication(): void
    {
        $this->getJson('/api/v1/auth/session')->assertStatus(401)->assertJsonPath('code', 'UNAUTHENTICATED');
    }

    public function test_blocked_user_with_live_session_is_refused(): void
    {
        $user = $this->signIn('agent');
        $user->forceFill(['status' => UserStatus::Blocked])->save();

        $this->getJson('/api/v1/auth/session')->assertStatus(403)->assertJsonPath('code', 'ACCOUNT_BLOCKED');
    }

    public function test_change_password_requires_current_password(): void
    {
        $this->signIn('agent');

        $this->postJson('/api/v1/auth/password/change', [
            'current_password' => 'nope', 'password' => 'NewPass#2026', 'password_confirmation' => 'NewPass#2026',
        ])->assertStatus(422)->assertJsonPath('errors.0.field', 'current_password');
    }

    public function test_forgot_password_does_not_reveal_whether_account_exists(): void
    {
        $this->postJson('/api/v1/auth/password/forgot', ['email' => 'nobody@example.com'])->assertOk();
        $this->assertSame(0, User::count());
    }
}
