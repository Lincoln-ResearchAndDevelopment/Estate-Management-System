<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Household;
use App\Models\Resident;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * M15 administration: estate profile settings (SCR-ADMIN-01) shown on the public site, plus the
 * resident directory for management (SCR-USR-04).
 */
class SettingsController extends Controller
{
    public const KEYS = ['estate_address', 'estate_phone', 'estate_email', 'office_hours', 'about', 'bank_name', 'account_name', 'account_number', 'gate_latitude', 'gate_longitude', 'gate_directions'];

    /** Current settings merged over defaults; cached for the public site. */
    public static function all(): array
    {
        return Cache::remember('estate.settings', 300, function () {
            $stored = DB::table('system_settings')->whereIn('key', self::KEYS)->pluck('value', 'key')
                ->map(fn ($v) => json_decode($v, true));

            $settings = collect(self::KEYS)->mapWithKeys(fn ($k) => [$k => $stored[$k] ?? null])->all();
            foreach (['bank_name', 'account_name', 'account_number'] as $key) {
                $settings[$key] ??= config('estate.finance.'.$key);
            }

            return $settings;
        });
    }

    public function show(): JsonResponse
    {
        return response()->json(['data' => self::all()]);
    }

    public function update(Request $request, AuditLogger $audit): JsonResponse
    {
        $data = $request->validate([
            'estate_address' => ['nullable', 'string', 'max:255'],
            'estate_phone' => ['nullable', 'string', 'max:40'],
            'estate_email' => ['nullable', 'email', 'max:255'],
            'office_hours' => ['nullable', 'string', 'max:120'],
            'about' => ['nullable', 'string', 'max:2000'],
            'bank_name' => ['nullable', 'string', 'max:80'],
            'account_name' => ['nullable', 'string', 'max:120'],
            'account_number' => ['nullable', 'regex:/^\d{10}$/'],
            // Main gate location for the resident "Direction" page (Share Gate Pin / Get Directions).
            'gate_latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:gate_longitude'],
            'gate_longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:gate_latitude'],
            'gate_directions' => ['nullable', 'string', 'max:500'],
        ], ['account_number.regex' => 'Enter the 10-digit NUBAN account number.']);

        $before = self::all();
        foreach ($data as $key => $value) {
            DB::table('system_settings')->updateOrInsert(['key' => $key], ['value' => json_encode($value), 'updated_by' => $request->user()->id, 'updated_at' => now(), 'created_at' => now()]);
        }
        Cache::forget('estate.settings');
        $audit->log('settings.updated', 'Settings', $before, $data);

        return response()->json(['data' => self::all()]);
    }

    /** GET /admin/residents — households with their members (residents.view). */
    public function residents(Request $request): JsonResponse
    {
        $q = $request->validate(['q' => ['nullable', 'string', 'max:60']])['q'] ?? null;

        $page = Household::query()->with(['unit.street', 'head', 'residents' => fn ($r) => $r->where('status', '!=', 'removed'), 'vehicles' => fn ($v) => $v->where('status', 'active')])
            ->when($q, fn ($w) => $w->where(fn ($x) => $x->whereHas('unit', fn ($u) => $u->where('unit_code', 'like', "%{$q}%"))
                ->orWhereHas('residents', fn ($r) => $r->where('full_name', 'like', "%{$q}%"))))
            ->orderBy('id')->paginate(ApiResponse::pageSize($request, 15));

        return ApiResponse::paginateMap($page, fn (Household $h) => [
            'id' => $h->id,
            'unit' => $h->unit?->unit_code,
            'street' => $h->unit?->street?->name,
            'head' => $h->head ? ['id' => $h->head->id, 'name' => $h->head->name, 'phone' => $h->head->phone, 'email' => $h->head->email] : null,
            'members' => $h->residents->map(fn (Resident $r) => ['id' => $r->id, 'fullName' => $r->full_name, 'relationship' => $r->relationship, 'phone' => $r->phone, 'status' => $r->status])->values(),
            'vehicles' => $h->vehicles->map(fn ($v) => Present::vehicle($v))->values(),
            'balance' => Present::money($h->balance()),
        ], ['total_residents' => Resident::where('status', 'active')->count()]);
    }
}
