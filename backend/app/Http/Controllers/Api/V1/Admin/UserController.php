<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\Users\UserAccountService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * M12 User management (FR-USR-01, 05). Routes are guarded by users.* permissions.
 */
class UserController extends Controller
{
    public function __construct(private readonly UserAccountService $accounts) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', Rule::in(array_keys(config('rbac.roles')))],
            'status' => ['nullable', Rule::enum(UserStatus::class)],
        ]);

        $users = User::query()
            ->with('roles')
            ->search($filters['q'] ?? null)
            ->when($filters['role'] ?? null, fn ($q, $v) => $q->where('primary_role', $v))
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->latest('id')
            ->paginate(ApiResponse::pageSize($request));

        $counts = User::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return ApiResponse::paginated($users, UserResource::class, [
            'kpis' => [
                'totalUsers' => (int) $counts->sum(),
                'pendingApproval' => (int) ($counts['pending'] ?? 0),
                'blocked' => (int) ($counts['blocked'] ?? 0),
            ],
        ]);
    }

    public function show(User $user): UserResource
    {
        return new UserResource($user->load('roles'));
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = $this->accounts->createWithInvitation($request->validated(), $request->user());

        return (new UserResource($user->load('roles')))->response()->setStatusCode(201);
    }

    public function update(UpdateUserRequest $request, User $user): UserResource
    {
        $user = $this->accounts->update($user, $request->validated(), $request->user());

        return new UserResource($user->load('roles'));
    }

    public function block(Request $request, User $user): UserResource
    {
        $reason = $request->validate(['reason' => ['nullable', 'string', 'max:500']])['reason'] ?? null;

        return new UserResource($this->accounts->setStatus($user, UserStatus::Blocked, $request->user(), $reason)->load('roles'));
    }

    public function unblock(Request $request, User $user): UserResource
    {
        return new UserResource($this->accounts->setStatus($user, UserStatus::Active, $request->user())->load('roles'));
    }

    public function resendInvitation(User $user): JsonResponse
    {
        $this->accounts->sendInvitation($user);

        return ApiResponse::message('Invitation sent.');
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->accounts->delete($user, $request->user());

        return ApiResponse::message('User deleted.');
    }

    /** GET /admin/roles — role catalogue for selects. */
    public function roles(): JsonResponse
    {
        return response()->json([
            'data' => collect(config('rbac.roles'))->map(fn ($name, $code) => ['code' => $code, 'name' => $name])->values(),
        ]);
    }
}
