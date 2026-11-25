<?php

namespace App\Services\Auth;

use App\Enums\UserStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

/**
 * Email + password sign-in with account-state checks and lockout (FR-AUTH-01, 07, 12; WF-02).
 */
class AuthService
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function login(Request $request, string $email, string $password, bool $remember): User
    {
        /** @var User|null $user */
        $user = User::query()->where('email', strtolower(trim($email)))->first();

        if ($user?->isLocked()) {
            throw new BusinessRuleException(
                'Too many failed attempts. Try again in '.max(1, (int) ceil(now()->diffInMinutes($user->locked_until, true))).' minutes.',
                'ACCOUNT_LOCKED',
                423,
            );
        }

        if (! $user || ! Hash::check($password, $user->password)) {
            if ($user) {
                $this->recordFailure($user);
            }
            throw new BusinessRuleException('Incorrect email or password.', 'INVALID_CREDENTIALS', 401);
        }

        if ($user->status !== UserStatus::Active) {
            throw new BusinessRuleException(
                $user->status->loginError(),
                'ACCOUNT_'.strtoupper($user->status->value),
                403,
            );
        }

        return $user->mfaEnabled() ? $user : $this->completeLogin($request, $user, $remember);
    }

    /** Starts the session after password (and, when enabled, two-factor) checks pass. */
    public function completeLogin(Request $request, User $user, bool $remember): User
    {
        Auth::guard('web')->login($user, $remember);

        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        $user->forceFill([
            'failed_login_count' => 0,
            'locked_until' => null,
            'last_login_at' => now(),
        ])->save();

        $this->audit->log('auth.login', $user, actor: $user);

        return $user;
    }

    /** Short-lived signed challenge so the second step needs no half-open session. */
    public function mfaChallenge(User $user, bool $remember): string
    {
        return \Illuminate\Support\Facades\Crypt::encryptString(json_encode(['uid' => $user->id, 'remember' => $remember, 'exp' => now()->addMinutes(5)->timestamp]));
    }

    /** @return array{0: User, 1: bool} */
    public function resolveChallenge(string $challenge): array
    {
        try {
            $data = json_decode(\Illuminate\Support\Facades\Crypt::decryptString($challenge), true, flags: JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            throw new BusinessRuleException('Your sign-in session expired. Sign in again.', 'MFA_CHALLENGE_INVALID', 401);
        }
        if (($data['exp'] ?? 0) < now()->timestamp) {
            throw new BusinessRuleException('Your sign-in session expired. Sign in again.', 'MFA_CHALLENGE_EXPIRED', 401);
        }

        return [User::findOrFail($data['uid']), (bool) ($data['remember'] ?? false)];
    }

    public function logout(Request $request): void
    {
        $user = $request->user();

        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        if ($user) {
            $this->audit->log('auth.logout', $user, actor: $user);
        }
    }

    private function recordFailure(User $user): void
    {
        $max = (int) config('estate.auth.max_failed_attempts');
        $count = $user->failed_login_count + 1;

        $user->forceFill([
            'failed_login_count' => $count,
            'locked_until' => $count >= $max ? now()->addMinutes((int) config('estate.auth.lockout_minutes')) : null,
        ])->save();

        $this->audit->log($count >= $max ? 'auth.locked' : 'auth.failed', $user, actor: $user);
    }
}
