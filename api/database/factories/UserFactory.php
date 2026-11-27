<?php

namespace Database\Factories;

use App\Enums\UserStatus;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<User> */
class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => '+234'.fake()->unique()->numerify('80########'),
            'password' => 'Secret#123',
            'status' => UserStatus::Active,
            'primary_role' => 'resident_head',
        ];
    }

    /** Assigns the role (roles must be seeded with RolePermissionSeeder first). */
    public function role(string $code): static
    {
        return $this->state(['primary_role' => $code])
            ->afterCreating(fn (User $user) => $user->roles()->sync(Role::where('code', $code)->pluck('id')));
    }

    public function status(UserStatus $status): static
    {
        return $this->state(['status' => $status]);
    }
}
