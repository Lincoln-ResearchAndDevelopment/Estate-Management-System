<?php

namespace App\Http\Controllers\Api\V1\Staff;

use App\Enums\UserStatus;
use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Models\StaffProfile;
use App\Services\AuditLogger;
use App\Services\CodeGenerator;
use App\Services\Users\UserAccountService;
use App\Support\ApiResponse;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** M11 staff management (SCR-STAFF-01–06, WF-16). */
class StaffController extends Controller
{
    public function __construct(private readonly AuditLogger $audit, private readonly CodeGenerator $codes, private readonly UserAccountService $accounts) {}

    public function index(Request $request): JsonResponse
    {
        $f = $request->validate([
            'department' => ['nullable', Rule::in(StaffProfile::DEPARTMENTS)],
            'status' => ['nullable', Rule::in(['active', 'suspended', 'deactivated'])],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $page = StaffProfile::query()
            ->when($f['department'] ?? null, fn ($q, $v) => $q->where('department', $v))
            ->when($f['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($f['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w->where('full_name', 'like', "%{$v}%")->orWhere('staff_code', 'like', "%{$v}%")->orWhere('job_title', 'like', "%{$v}%")))
            ->orderBy('full_name')->paginate(ApiResponse::pageSize($request, 15));

        $byDept = StaffProfile::where('status', 'active')->selectRaw('department, count(*) as total')->groupBy('department')->pluck('total', 'department');

        return ApiResponse::paginateMap($page, fn ($s) => Present::staff($s), [
            'kpis' => [
                'total' => StaffProfile::count(),
                'active' => StaffProfile::where('status', 'active')->count(),
                'suspended' => StaffProfile::where('status', 'suspended')->count(),
                'byDepartment' => $byDept,
            ],
        ]);
    }

    public function show(StaffProfile $staff): JsonResponse
    {
        return response()->json(['data' => Present::staff($staff)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $createLogin = (bool) ($data['create_login'] ?? false);
        unset($data['create_login']);

        $staff = DB::transaction(function () use ($data, $createLogin, $request) {
            $staff = StaffProfile::create($data + ['staff_code' => $this->codes->next('staff_profiles', 'staff_code', 'STF', 3), 'status' => 'active']);

            if ($createLogin) {
                if (empty($data['email'])) {
                    throw new BusinessRuleException('An email address is needed to create a login.', 'VALIDATION_FAILED');
                }
                $role = $data['department'] === 'security' ? 'security_officer' : 'staff';
                $user = $this->accounts->createWithInvitation(['name' => $data['full_name'], 'email' => $data['email'], 'phone' => $data['phone'] ?? null, 'role' => $role], $request->user());
                $staff->update(['user_id' => $user->id]);
            }

            return $staff;
        });

        $this->audit->log('staff.created', $staff, after: $staff->toArray());

        return response()->json(['data' => Present::staff($staff)], 201);
    }

    public function update(Request $request, StaffProfile $staff): JsonResponse
    {
        $data = $this->validated($request, $staff);
        unset($data['create_login']);
        $before = $staff->toArray();
        $staff->update($data);
        $this->audit->log('staff.updated', $staff, $before, $staff->toArray());

        return response()->json(['data' => Present::staff($staff)]);
    }

    /** Suspend / deactivate / reactivate. Suspension and deactivation also block the linked login. */
    public function setStatus(Request $request, StaffProfile $staff): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['active', 'suspended', 'deactivated'])],
            'reason' => ['required_unless:status,active', 'nullable', 'string', 'min:5', 'max:500'],
        ]);

        $before = $staff->status;
        $staff->update(['status' => $data['status']]);
        if ($staff->user) {
            $this->accounts->setStatus($staff->user, $data['status'] === 'active' ? UserStatus::Active : UserStatus::Blocked, $request->user(), $data['reason'] ?? null);
        }
        $this->audit->log('staff.status_changed', $staff, ['status' => $before], $data);

        return response()->json(['data' => Present::staff($staff)]);
    }

    public function destroy(Request $request, StaffProfile $staff): JsonResponse
    {
        if ($staff->user) {
            $this->accounts->setStatus($staff->user, UserStatus::Inactive, $request->user(), 'Staff record removed');
        }
        $this->audit->log('staff.deleted', $staff, $staff->toArray());
        $staff->delete();

        return ApiResponse::message('Staff record removed.');
    }

    private function validated(Request $request, ?StaffProfile $staff = null): array
    {
        return $request->validate([
            'full_name' => ['required', 'string', 'min:2', 'max:120', "regex:/^[\pL\s\-'.]+$/u"],
            'phone' => ['nullable', 'regex:/^\+234\d{10}$/'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('staff_profiles', 'email')->ignore($staff?->id)],
            'job_title' => ['required', 'string', 'max:80'],
            'department' => ['required', Rule::in(StaffProfile::DEPARTMENTS)],
            'employment_type' => ['required', Rule::in(['full_time', 'part_time', 'contract'])],
            'hired_on' => ['nullable', 'date', 'before_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'create_login' => ['sometimes', 'boolean'],
        ], ['phone.regex' => 'Enter a Nigerian mobile number in the format +234XXXXXXXXXX.']);
    }
}
