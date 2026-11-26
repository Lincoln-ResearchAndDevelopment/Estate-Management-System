<?php

namespace App\Services\Users;

use App\Enums\UserStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Role;
use App\Models\User;
use App\Notifications\AccountInvitation;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

/**
 * Account lifecycle used by admins: create with a set-password invitation (never a shared default
 * password), change roles, block/unblock, deactivate and soft delete.
 */
class UserAccountService
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  array{name:string,email:string,phone?:?string,role:string}  $data
     */
    public function createWithInvitation(array $data, User $actor): User
    {
        $this->guardRoleAssignment($data['role'], $actor);

        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => strtolower($data['email']),
                'phone' => $data['phone'] ?? null,
                // Random, never disclosed; the invitee sets their own password from the e-mailed link.
                'password' => Str::password(32),
                'status' => UserStatus::Pending,
                'primary_role' => $data['role'],
            ]);
            $this->syncRoles($user, [$data['role']]);

            return $user;
        });

        $this->sendInvitation($user);
        $this->audit->log('user.created', $user, after: $user->only(['name', 'email', 'phone', 'primary_role', 'status']), actor: $actor);

        return $user;
    }

    public function sendInvitation(User $user): void
    {
        $token = Password::broker()->createToken($user);
        $user->notify(new AccountInvitation($token));
    }

    public function update(User $user, array $data, User $actor): User
    {
        $before = $user->only(['name', 'phone', 'primary_role']);

        if (isset($data['role']) && $data['role'] !== $user->primary_role) {
            $this->guardRoleAssignment($data['role'], $actor);
            $this->guardNotSelf($user, $actor, 'change your own role');
            $user->primary_role = $data['role'];
            $this->syncRoles($user, [$data['role']]);
        }

        $user->fill(array_intersect_key($data, array_flip(['name', 'phone'])))->save();

        $this->audit->log('user.updated', $user, $before, $user->only(['name', 'phone', 'primary_role']), $actor);

        return $user;
    }

    public function setStatus(User $user, UserStatus $status, User $actor, ?string $reason = null): User
    {
        $this->guardNotSelf($user, $actor, 'change your own account status');

        if ($user->isSuperAdmin() && ! $actor->isSuperAdmin()) {
            throw new BusinessRuleException('Only a Super Administrator can change another Super Administrator.', 'FORBIDDEN', 403);
        }

        $before = $user->status->value;
        $user->forceFill(['status' => $status])->save();

        // Blocking or deactivating ends every session and API token immediately.
        if ($status !== UserStatus::Active) {
            DB::table('sessions')->where('user_id', $user->id)->delete();
            $user->tokens()->delete();
        }

        $this->audit->log('user.status_changed', $user, ['status' => $before], ['status' => $status->value, 'reason' => $reason], $actor);

        return $user;
    }

    public function delete(User $user, User $actor): void
    {
        $this->guardNotSelf($user, $actor, 'delete your own account');
        $this->setStatus($user, UserStatus::Inactive, $actor, 'Deleted');
        $user->delete();
        $this->audit->log('user.deleted', $user, actor: $actor);
    }

    /** @param list<string> $codes */
    public function syncRoles(User $user, array $codes): void
    {
        $user->roles()->sync(Role::query()->whereIn('code', $codes)->pluck('id'));
        $user->flushPermissionCache();
    }

    private function guardRoleAssignment(string $role, User $actor): void
    {
        if (! array_key_exists($role, config('rbac.roles'))) {
            throw new BusinessRuleException('Unknown role.', 'VALIDATION_FAILED', 422);
        }

        if ($role === 'super_admin' && ! $actor->isSuperAdmin()) {
            throw new BusinessRuleException('Only a Super Administrator can grant the Super Administrator role.', 'FORBIDDEN', 403);
        }
    }

    private function guardNotSelf(User $user, User $actor, string $what): void
    {
        if ($user->is($actor)) {
            throw new BusinessRuleException("You cannot {$what}.", 'FORBIDDEN', 403);
        }
    }
}
