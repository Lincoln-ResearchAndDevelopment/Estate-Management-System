<?php

namespace Tests\Feature;

use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** AT-21: every role gets 403 on admin endpoints outside its permissions. */
class AuthorizationMatrixTest extends TestCase
{
    public static function deniedRoles(): array
    {
        return [
            'finance officer' => ['finance_officer'],
            'security officer' => ['security_officer'],
            'resident head' => ['resident_head'],
            'resident member' => ['resident_member'],
            'store owner' => ['store_owner'],
            'staff' => ['staff'],
            'agent' => ['agent'],
        ];
    }

    #[DataProvider('deniedRoles')]
    public function test_non_admin_roles_cannot_use_listing_approvals(string $role): void
    {
        $this->signIn($role);

        $this->getJson('/api/v1/admin/listings')->assertForbidden();
        $this->postJson('/api/v1/admin/listings/1/approve')->assertForbidden();
        $this->getJson('/api/v1/admin/dashboard')->assertForbidden();
    }

    public function test_only_agents_reach_the_agent_portal(): void
    {
        $this->signIn('resident_head');
        $this->getJson('/api/v1/agent/listings')->assertForbidden();
    }

    public function test_estate_manager_can_manage_users_but_not_grant_super_admin(): void
    {
        $this->signIn('estate_manager');

        $this->getJson('/api/v1/admin/users')->assertOk();
        $this->postJson('/api/v1/admin/users', [
            'name' => 'New Admin', 'email' => 'new@example.com', 'role' => 'super_admin',
        ])->assertForbidden();
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/v1/admin/users')->assertUnauthorized();
        $this->getJson('/api/v1/agent/dashboard')->assertUnauthorized();
    }
}
