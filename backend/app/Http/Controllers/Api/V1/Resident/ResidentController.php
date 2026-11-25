<?php

namespace App\Http\Controllers\Api\V1\Resident;

use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Bill;
use App\Models\EmergencyAlert;
use App\Models\Household;
use App\Models\Meeting;
use App\Models\Resident;
use App\Models\Vehicle;
use App\Models\VisitorPass;
use App\Services\AuditLogger;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * M03 resident profile, household and vehicles (FR-RES-01–08) and the resident dashboard (SCR-DASH-05).
 */
class ResidentController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        $household = $user->household();

        $openBills = $household ? Bill::query()->where('household_id', $household->id)->whereIn('status', Bill::OPEN)->orderBy('due_date')->get() : collect();

        return response()->json(['data' => [
            'unit' => $household?->unit?->unit_code,
            'balance' => Present::money($openBills->sum(fn (Bill $b) => $b->balance())),
            'overdueCount' => $openBills->where('status', 'overdue')->count(),
            'nextBill' => $openBills->first() ? Present::bill($openBills->first()) : null,
            'activePasses' => $household ? VisitorPass::query()->where('household_id', $household->id)->where('status', 'active')->where('valid_until', '>', now())->count() : 0,
            'activeAlert' => ($a = EmergencyAlert::query()->where('raised_by', $user->id)->whereIn('status', EmergencyAlert::ACTIVE)->latest()->first()) ? Present::alert($a) : null,
            'announcements' => Announcement::query()->whereIn('audience', ['all', 'residents'])
                ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
                ->orderByDesc('pinned')->latest('published_at')->limit(3)->get()
                ->map(fn ($n) => ['id' => $n->id, 'title' => $n->title, 'body' => $n->body, 'pinned' => $n->pinned, 'publishedAt' => $n->published_at?->toIso8601String()]),
            'nextMeeting' => ($m = Meeting::query()->where('status', 'scheduled')->where('starts_at', '>', now())->orderBy('starts_at')->first())
                ? ['id' => $m->id, 'title' => $m->title, 'location' => $m->location, 'startsAt' => $m->starts_at->toIso8601String()] : null,
        ]]);
    }

    public function profile(Request $request): JsonResponse
    {
        $user = $request->user();
        $resident = $user->resident()->first();
        $household = $resident ? Household::query()->with(['unit.street', 'unit.sector', 'residents.user', 'vehicles' => fn ($q) => $q->where('status', 'active')])->find($resident->household_id) : null;

        return response()->json(['data' => [
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'phone' => $user->phone],
            'relationship' => $resident?->relationship,
            'isHead' => $household && $household->head_user_id === $user->id,
            'unit' => $household?->unit ? ['code' => $household->unit->unit_code, 'street' => $household->unit->street?->name, 'sector' => $household->unit->sector?->name, 'type' => $household->unit->unit_type] : null,
            'members' => $household ? $household->residents->where('status', '!=', 'removed')->map(fn (Resident $r) => [
                'id' => $r->id, 'fullName' => $r->full_name, 'relationship' => $r->relationship, 'phone' => $r->phone,
                'status' => $r->status, 'hasLogin' => $r->user_id !== null, 'isMe' => $r->user_id === $user->id,
            ])->values() : [],
            'vehicles' => $household ? $household->vehicles->map(fn ($v) => Present::vehicle($v))->values() : [],
        ]]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:120', "regex:/^[\pL\s\-'.]+$/u"],
            'phone' => ['sometimes', 'nullable', 'regex:/^\+234\d{10}$/', Rule::unique('users', 'phone')->ignore($user->id)],
        ], ['phone.regex' => 'Enter a Nigerian mobile number in the format +234XXXXXXXXXX.']);

        $before = $user->only(['name', 'phone']);
        $user->update($data);
        $user->resident()->update(array_filter(['full_name' => $data['name'] ?? null, 'phone' => $data['phone'] ?? null]));
        $this->audit->log('profile.updated', $user, $before, $user->only(['name', 'phone']));

        return $this->profile($request);
    }

    public function addMember(Request $request): JsonResponse
    {
        $household = $this->headHousehold($request);
        $data = $request->validate([
            'full_name' => ['required', 'string', 'min:2', 'max:120', "regex:/^[\pL\s\-'.]+$/u"],
            'relationship' => ['required', Rule::in(['spouse', 'child', 'parent', 'relative', 'tenant', 'sub_tenant', 'domestic_staff'])],
            'phone' => ['nullable', 'regex:/^\+234\d{10}$/'],
        ]);

        $member = Resident::create($data + ['household_id' => $household->id, 'status' => 'active', 'moved_in_date' => now()->toDateString()]);
        $this->audit->log('household.member_added', $member, after: $data);

        return $this->profile($request)->setStatusCode(201);
    }

    public function removeMember(Request $request, Resident $member): JsonResponse
    {
        $household = $this->headHousehold($request);
        abort_unless($member->household_id === $household->id, 404);
        if ($member->user_id === $request->user()->id) {
            throw new BusinessRuleException('You cannot remove yourself from the household.', 'FORBIDDEN', 403);
        }

        $member->update(['status' => 'removed']);
        // A removed member who had a login loses access.
        $member->user?->forceFill(['status' => 'inactive'])->save();
        $this->audit->log('household.member_removed', $member);

        return $this->profile($request);
    }

    public function addVehicle(Request $request): JsonResponse
    {
        $household = $this->headHousehold($request);
        $request->merge(['plate_number' => strtoupper(str_replace(' ', '', (string) $request->input('plate_number')))]);
        $data = $request->validate([
            'plate_number' => ['required', 'string', 'regex:/^[A-Z0-9-]{5,12}$/', Rule::unique('vehicles', 'plate_number')],
            'make' => ['nullable', 'string', 'max:40'],
            'model' => ['nullable', 'string', 'max:40'],
            'colour' => ['nullable', 'string', 'max:30'],
        ], ['plate_number.unique' => 'This vehicle is already registered in the estate.', 'plate_number.regex' => 'Enter a valid plate number, e.g. ABC123XY.']);

        $vehicle = Vehicle::create($data + ['household_id' => $household->id, 'added_by' => $request->user()->id, 'status' => 'active']);
        $this->audit->log('vehicle.added', $vehicle, after: $data);

        return $this->profile($request)->setStatusCode(201);
    }

    public function removeVehicle(Request $request, Vehicle $vehicle): JsonResponse
    {
        $household = $this->headHousehold($request);
        abort_unless($vehicle->household_id === $household->id, 404);
        $vehicle->delete();
        $this->audit->log('vehicle.removed', $vehicle);

        return $this->profile($request);
    }

    /** Only the head of household manages members and vehicles (SRS 5.1 rule 3). */
    private function headHousehold(Request $request): Household
    {
        $household = $request->user()->household();
        if (! $household || $household->head_user_id !== $request->user()->id) {
            throw new BusinessRuleException('Only the head of household can manage members and vehicles.', 'FORBIDDEN', 403);
        }

        return $household;
    }
}
