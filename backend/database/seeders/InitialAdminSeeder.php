<?php

namespace Database\Seeders;

use App\Enums\UserStatus;
use App\Models\User;
use App\Services\Users\UserAccountService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Production bootstrap: creates the first Super Administrator from INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_NAME
 * and e-mails them a set-password link. No password is ever hard-coded.
 */
class InitialAdminSeeder extends Seeder
{
    public function run(UserAccountService $accounts): void
    {
        $email = env('INITIAL_ADMIN_EMAIL');

        if (! $email || User::where('email', strtolower($email))->exists()) {
            $this->command?->warn('INITIAL_ADMIN_EMAIL not set or already exists; no admin created.');

            return;
        }

        $user = User::create([
            'name' => env('INITIAL_ADMIN_NAME', 'Super Administrator'),
            'email' => strtolower($email),
            'password' => Str::password(32),
            'status' => UserStatus::Pending,
            'primary_role' => 'super_admin',
        ]);
        $accounts->syncRoles($user, ['super_admin']);
        $accounts->sendInvitation($user);

        $this->command?->info("Invitation sent to {$email}.");
    }
}
