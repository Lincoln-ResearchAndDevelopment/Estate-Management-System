<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AccessRequestResource;
use App\Models\AccessRequest;
use App\Services\Users\AccessRequestService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** M12 approval queue for resident access requests (FR-USR-02, WF-01). */
class AccessRequestController extends Controller
{
    public function __construct(private readonly AccessRequestService $service) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['pending', 'info_requested', 'approved', 'rejected', 'expired'])],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $items = AccessRequest::query()
            ->with(['unit.street', 'reviewer'])
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($filters['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w
                ->where('full_name', 'like', "%{$v}%")->orWhere('email', 'like', "%{$v}%")->orWhere('reference', 'like', "%{$v}%")))
            ->orderByRaw("case when status = 'pending' then 0 when status = 'info_requested' then 1 else 2 end")
            ->latest('id')
            ->paginate(ApiResponse::pageSize($request));

        return ApiResponse::paginated($items, AccessRequestResource::class, [
            'pendingCount' => AccessRequest::where('status', 'pending')->count(),
        ]);
    }

    public function show(AccessRequest $accessRequest): AccessRequestResource
    {
        return new AccessRequestResource($accessRequest->load(['unit.street', 'reviewer']));
    }

    /** Streams the applicant's private profile picture (if they supplied one) to reviewers only. */
    public function file(AccessRequest $accessRequest, string $kind): StreamedResponse
    {
        abort_unless($kind === 'photo', 404);
        $path = $accessRequest->profile_photo_path;
        abort_unless($path && Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path, null, ['Cache-Control' => 'private, no-store']);
    }

    public function approve(Request $request, AccessRequest $accessRequest): AccessRequestResource
    {
        return new AccessRequestResource($this->service->approve($accessRequest, $request->user())->load(['unit.street', 'reviewer']));
    }

    public function reject(Request $request, AccessRequest $accessRequest): AccessRequestResource
    {
        $reason = $request->validate(['reason' => ['required', 'string', 'min:10', 'max:500']])['reason'];

        return new AccessRequestResource($this->service->reject($accessRequest, $request->user(), $reason)->load(['unit.street', 'reviewer']));
    }

    public function requestInfo(Request $request, AccessRequest $accessRequest): AccessRequestResource
    {
        $reason = $request->validate(['reason' => ['required', 'string', 'min:10', 'max:500']])['reason'];

        return new AccessRequestResource($this->service->requestInfo($accessRequest, $request->user(), $reason)->load(['unit.street', 'reviewer']));
    }
}
