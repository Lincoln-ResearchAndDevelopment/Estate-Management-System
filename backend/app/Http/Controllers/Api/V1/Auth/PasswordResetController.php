<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

/**
 * Forgot / reset password (FR-AUTH-03) and first-time password setup from invitation links.
 * Reset links expire after 60 minutes (config auth.passwords.users.expire).
 */
class PasswordResetController extends Controller
{
    public function forgot(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        Password::sendResetLink(['email' => strtolower($request->string('email'))]);

        // Same answer whether or not the address exists, so accounts cannot be enumerated.
        return ApiResponse::message('If an account exists for that email, a reset link has been sent.');
    }

    public function reset(Request $request, AuditLogger $audit): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)->mixedCase()->numbers()->symbols()],
        ]);

        $status = Password::reset(
            ['email' => strtolower($data['email']), 'token' => $data['token'], 'password' => $data['password'], 'password_confirmation' => $request->input('password_confirmation')],
            function (User $user, string $password) use ($audit) {
                $user->forceFill([
                    'password' => $password,
                    'must_change_password' => false,
                    'failed_login_count' => 0,
                    'locked_until' => null,
                ]);
                // An invited account becomes active the first time its password is set.
                if ($user->status === UserStatus::Pending && ! $user->agentProfile()->exists()) {
                    $user->status = UserStatus::Active;
                }
                $user->save();
                $audit->log('auth.password_reset', $user, actor: $user);
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['token' => 'This link is invalid or has expired. Request a new one.']);
        }

        return ApiResponse::message('Password updated. You can now sign in.');
    }
}
