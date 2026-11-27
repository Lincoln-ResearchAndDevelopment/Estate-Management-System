<?php

namespace App\Models;

use App\Enums\UserStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Collection;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'name', 'email', 'phone', 'password', 'status', 'primary_role', 'avatar_path', 'must_change_password',
    ];

    protected $hidden = ['password', 'remember_token', 'mfa_secret', 'mfa_recovery_codes'];

    /** @var Collection<int, string>|null */
    private ?Collection $permissionCache = null;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'locked_until' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'must_change_password' => 'boolean',
            'mfa_secret' => 'encrypted',
            'mfa_recovery_codes' => 'encrypted:array',
            'mfa_enabled_at' => 'datetime',
            'status' => UserStatus::class,
        ];
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }

    public function agentProfile(): HasOne
    {
        return $this->hasOne(AgentProfile::class);
    }

    public function resident(): HasOne
    {
        return $this->hasOne(Resident::class);
    }

    public function store(): HasOne
    {
        return $this->hasOne(Store::class, 'owner_user_id');
    }

    /** The household the user belongs to (residents only), or null. */
    public function household(): ?Household
    {
        return $this->resident()->with('household.unit')->first()?->household;
    }

    public function mfaEnabled(): bool
    {
        return $this->mfa_enabled_at !== null;
    }

    public function mfaRequired(): bool
    {
        return (bool) config('estate.auth.mfa_enforced')
            && in_array($this->primary_role, config('estate.auth.mfa_roles'), true);
    }

    public function hasRole(string ...$codes): bool
    {
        return $this->roles->pluck('code')->intersect($codes)->isNotEmpty();
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole('super_admin');
    }

    /**
     * Permission codes granted through all of the user's roles. "*" means every permission.
     *
     * @return Collection<int, string>
     */
    public function permissionCodes(): Collection
    {
        if ($this->permissionCache !== null) {
            return $this->permissionCache;
        }

        $this->loadMissing('roles.permissions');

        if ($this->isSuperAdmin()) {
            return $this->permissionCache = Permission::query()->pluck('code')->sort()->values();
        }

        return $this->permissionCache = $this->roles
            ->flatMap(fn (Role $role) => $role->permissions->pluck('code'))
            ->unique()->sort()->values();
    }

    public function hasPermission(string $code): bool
    {
        return $this->isSuperAdmin() || $this->permissionCodes()->contains($code);
    }

    public function flushPermissionCache(): void
    {
        $this->permissionCache = null;
        $this->unsetRelation('roles');
    }

    public function isActive(): bool
    {
        return $this->status === UserStatus::Active;
    }

    public function isLocked(): bool
    {
        return $this->locked_until !== null && $this->locked_until->isFuture();
    }

    public function portalPath(): string
    {
        return config('rbac.portals.'.$this->primary_role, '/');
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (! $term) {
            return $query;
        }

        return $query->where(fn (Builder $q) => $q
            ->where('name', 'like', "%{$term}%")
            ->orWhere('email', 'like', "%{$term}%")
            ->orWhere('phone', 'like', "%{$term}%"));
    }
}
