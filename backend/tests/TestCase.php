<?php

namespace Tests;

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Sanctum\Sanctum;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    protected function userWithRole(string $role, array $attributes = []): User
    {
        return User::factory()->role($role)->create($attributes);
    }

    protected function signIn(string|User $roleOrUser): User
    {
        $user = $roleOrUser instanceof User ? $roleOrUser : $this->userWithRole($roleOrUser);
        Sanctum::actingAs($user);

        return $user;
    }
}
