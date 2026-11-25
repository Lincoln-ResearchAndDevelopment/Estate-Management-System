<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\SessionResource;
use App\Services\AuditLogger;
use App\Services\Auth\AuthService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly AuthService $auth) {}

    /** POST /auth/login — Sanctum SPA cookie session. Call GET /sanctum/csrf-cookie first. */
    public function login(LoginRequest $request): SessionResource
    {
        $user = $this->auth->login(
            $request,
            $request->validated('email'),
            $request->validated('password'),
            (bool) $request->validated('remember', false),
        );

        return new SessionResource($user);
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
