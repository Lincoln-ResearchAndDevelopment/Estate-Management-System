<?php

namespace App\Http\Controllers\Api\V1\Estate;

use App\Http\Controllers\Controller;
use App\Http\Resources\UnitResource;
use App\Models\Sector;
use App\Models\Street;
use App\Models\Unit;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * M04 Property & unit registry: sectors, streets and units (FR-PROP-01/02).
 */
class EstateController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function sectors(): JsonResponse
    {
        return response()->json(['data' => Sector::query()->withCount(['streets', 'units'])->orderBy('name')->get()
            ->map(fn (Sector $s) => ['id' => $s->id, 'name' => $s->name, 'code' => $s->code, 'streetsCount' => $s->streets_count, 'unitsCount' => $s->units_count])]);
    }

    public function storeSector(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', 'unique:sectors,name'],
            'code' => ['required', 'string', 'max:20', 'alpha_dash', 'unique:sectors,code'],
        ]);
        $sector = Sector::create($data);
        $this->audit->log('sector.created', $sector, after: $data);

        return response()->json(['data' => $sector], 201);
    }

    public function streets(Request $request): JsonResponse
    {
        $sectorId = $request->validate(['sector_id' => ['nullable', 'integer']])['sector_id'] ?? null;

        return response()->json(['data' => Street::query()
            ->when($sectorId, fn ($q) => $q->where('sector_id', $sectorId))
            ->orderBy('name')->get(['id', 'sector_id', 'name'])
            ->map(fn (Street $s) => ['id' => $s->id, 'sectorId' => $s->sector_id, 'name' => $s->name])]);
    }

    public function storeStreet(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sector_id' => ['required', 'integer', 'exists:sectors,id'],
            'name' => ['required', 'string', 'max:120', Rule::unique('streets')->where('sector_id', $request->input('sector_id'))],
        ]);
        $street = Street::create($data);
        $this->audit->log('street.created', $street, after: $data);

        return response()->json(['data' => ['id' => $street->id, 'sectorId' => $street->sector_id, 'name' => $street->name]], 201);
    }

    public function units(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'sector_id' => ['nullable', 'integer'],
            'street_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(Unit::OCCUPANCY)],
            'q' => ['nullable', 'string', 'max:40'],
        ]);

        $units = Unit::query()->with(['sector', 'street'])->filter($filters)->orderBy('unit_code')
            ->paginate(ApiResponse::pageSize($request, 20));

        return ApiResponse::paginated($units, UnitResource::class, [
            'kpis' => [
                'totalUnits' => Unit::count(),
                'vacant' => Unit::where('occupancy_status', 'vacant')->count(),
                'occupied' => Unit::where('occupancy_status', 'occupied')->count(),
            ],
        ]);
    }

    public function storeUnit(Request $request): JsonResponse
    {
        $data = $this->validateUnit($request);
        $unit = Unit::create($data);
        $this->audit->log('unit.created', $unit, after: $data);

        return (new UnitResource($unit->load(['sector', 'street'])))->response()->setStatusCode(201);
    }

    public function updateUnit(Request $request, Unit $unit): UnitResource
    {
        $data = $this->validateUnit($request, $unit);
        $before = $unit->only(array_keys($data));
        $unit->update($data);
        $this->audit->log('unit.updated', $unit, $before, $data);

        return new UnitResource($unit->load(['sector', 'street']));
    }

    /** GET /public/units/lookup?q= — registration autocomplete; returns code and street only. */
    public function lookup(Request $request): JsonResponse
    {
        $q = $request->validate(['q' => ['required', 'string', 'min:2', 'max:40']])['q'];

        return response()->json(['data' => Unit::query()->with('street:id,name')
            ->where('unit_code', 'like', "%{$q}%")->orderBy('unit_code')->limit(10)->get()
            ->map(fn (Unit $u) => ['id' => $u->id, 'code' => $u->unit_code, 'street' => $u->street?->name])]);
    }

    private function validateUnit(Request $request, ?Unit $unit = null): array
    {
        return $request->validate([
            'unit_code' => ['required', 'string', 'max:40', Rule::unique('units', 'unit_code')->ignore($unit?->id)],
            'sector_id' => ['required', 'integer', 'exists:sectors,id'],
            'street_id' => ['required', 'integer', Rule::exists('streets', 'id')->where('sector_id', $request->input('sector_id'))],
            'unit_type' => ['required', 'string', 'max:40'],
            'rooms' => ['nullable', 'integer', 'min:0', 'max:50'],
            'occupancy_status' => ['required', Rule::in(Unit::OCCUPANCY)],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
        ]);
    }
}
