<?php

namespace Tests;

use App\Models\Household;
use App\Models\Resident;
use App\Models\Unit;
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

    /** A resident account (head by default) living in a fresh household. */
    protected function resident(string $role = 'resident_head', ?Household $household = null): User
    {
        $user = $this->userWithRole($role);
        $household ??= Household::create(['unit_id' => Unit::factory()->create()->id, 'head_user_id' => $user->id]);
        Resident::create(['user_id' => $user->id, 'household_id' => $household->id, 'full_name' => $user->name, 'relationship' => $role === 'resident_head' ? 'primary_resident' : 'spouse', 'status' => 'active']);

        return $user;
    }
}
