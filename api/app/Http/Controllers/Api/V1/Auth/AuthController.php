<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\SessionResource;
use App\Services\AuditLogger;
use App\Services\Auth\AuthService;
use App\Services\Auth\TotpService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly AuthService $auth) {}

    /** POST /auth/login — Sanctum SPA cookie session. Call GET /sanctum/csrf-cookie first. */
    public function login(LoginRequest $request): SessionResource|JsonResponse
    {
        $remember = (bool) $request->validated('remember', false);
        $user = $this->auth->login($request, $request->validated('email'), $request->validated('password'), $remember);

        if ($user->mfaEnabled()) {
            // Password correct; the second factor is still needed (FR-AUTH-12).
            return response()->json(['data' => ['mfaRequired' => true, 'challenge' => $this->auth->mfaChallenge($user, $remember)]]);
        }

        return new SessionResource($user);
    }

    /** POST /auth/mfa/challenge — completes sign-in with an authenticator or recovery code. */
    public function mfaChallenge(Request $request, TotpService $totp, AuditLogger $audit): SessionResource
    {
        $data = $request->validate(['challenge' => ['required', 'string'], 'code' => ['required', 'string', 'max:20']]);
        [$user, $remember] = $this->auth->resolveChallenge($data['challenge']);

        $code = strtoupper(trim($data['code']));
        $recovery = (array) $user->mfa_recovery_codes;
        $valid = $totp->verify((string) $user->mfa_secret, $code);

        if (! $valid && in_array($code, $recovery, true)) {
            $valid = true;
            $user->forceFill(['mfa_recovery_codes' => array_values(array_diff($recovery, [$code]))])->save();
            $audit->log('auth.mfa_recovery_used', $user, actor: $user);
        }

        if (! $valid) {
            $audit->log('auth.mfa_failed', $user, actor: $user);
            throw ValidationException::withMessages(['code' => 'That code is not valid. Check your authenticator app and try again.']);
        }

        return new SessionResource($this->auth->completeLogin($request, $user, $remember));
    }

    /** POST /auth/mfa/setup — creates a new (not yet active) secret for the authenticator app. */
    public function mfaSetup(Request $request, TotpService $totp): JsonResponse
    {
        $user = $request->user();
        if ($user->mfaEnabled()) {
            throw new BusinessRuleException('Two-factor sign-in is already on.', 'INVALID_STATE', 409);
        }

        $secret = $totp->generateSecret();
        $user->forceFill(['mfa_secret' => $secret])->save();

        return response()->json(['data' => [
            'secret' => trim(chunk_split($secret, 4, ' ')),
            'otpauthUrl' => $totp->otpauthUrl($secret, $user->email, config('estate.short_name')),
        ]]);
    }

    /** POST /auth/mfa/enable — confirms the first code, turns MFA on and returns one-time recovery codes. */
    public function mfaEnable(Request $request, TotpService $totp, AuditLogger $audit): JsonResponse
    {
        $code = $request->validate(['code' => ['required', 'string', 'max:10']])['code'];
        $user = $request->user();

        if (! $user->mfa_secret || ! $totp->verify((string) $user->mfa_secret, $code)) {
            throw ValidationException::withMessages(['code' => 'That code is not valid. Check the time on your phone and try again.']);
        }

        $codes = $totp->recoveryCodes();
        $user->forceFill(['mfa_enabled_at' => now(), 'mfa_recovery_codes' => $codes])->save();
        $audit->log('auth.mfa_enabled', $user);

        return response()->json(['data' => ['recoveryCodes' => $codes]]);
    }

    public function mfaDisable(Request $request, AuditLogger $audit): JsonResponse
    {
        $password = $request->validate(['password' => ['required', 'string']])['password'];
        $user = $request->user();

        if ($user->mfaRequired()) {
            throw new BusinessRuleException('Two-factor sign-in is required for your role and cannot be turned off.', 'FORBIDDEN', 403);
        }
        if (! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages(['password' => 'The password is incorrect.']);
        }

        $user->forceFill(['mfa_enabled_at' => null, 'mfa_secret' => null, 'mfa_recovery_codes' => null])->save();
        $audit->log('auth.mfa_disabled', $user);

        return ApiResponse::message('Two-factor sign-in turned off.');
    }

    /** GET /auth/session — current user, roles, permissions and portal. */
    public function session(Request $request): SessionResource
    {
        return new SessionResource($request->user());
    }

    public function logout(Request $request): JsonResponse
    {
        $this->auth->logout($request);

        return ApiResponse::message('Signed out.');
    }

    public function changePassword(ChangePasswordRequest $request, AuditLogger $audit): JsonResponse
    {
        $user = $request->user();

        if (! Hash::check($request->validated('current_password'), $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'The current password is incorrect.']);
        }

        $user->forceFill([
            'password' => $request->validated('password'),
            'must_change_password' => false,
        ])->save();

        $audit->log('auth.password_changed', $user);

        return ApiResponse::message('Password changed.');
    }
}
