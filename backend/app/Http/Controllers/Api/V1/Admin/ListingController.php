<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ListingStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Listings\ListingRequest;
use App\Http\Resources\AdminListingResource;
use App\Models\ListingMedia;
use App\Models\PropertyListing;
use App\Services\Listings\ListingService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Listing approval queue and review (SCR-LIST-08/09, FR-LIST-11–16).
 */
class ListingController extends Controller
{
    private const RELATIONS = ['media', 'sector', 'street', 'unit', 'agent.agentProfile'];

    public function __construct(private readonly ListingService $listings) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(array_map(fn ($s) => $s->value, ListingStatus::cases()))],
            'type' => ['nullable', Rule::in(['rent', 'sale'])],
            'property_type' => ['nullable', 'string'],
            'agent_id' => ['nullable', 'integer'],
            'sector_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $query = PropertyListing::query();
        if (($filters['status'] ?? null) === ListingStatus::Deleted->value) {
            $query->onlyTrashed();
        }

        $listings = $query->with(self::RELATIONS)->withCount('enquiries')->filter($filters)
            ->orderByRaw("case when status = 'pending_approval' then 0 else 1 end")
            ->orderByDesc('submitted_at')->orderByDesc('id')
            ->paginate(ApiResponse::pageSize($request));

        $counts = PropertyListing::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return ApiResponse::paginated($listings, AdminListingResource::class, [
            'kpis' => [
                'pending' => (int) ($counts['pending_approval'] ?? 0),
                'live' => (int) ($counts['approved'] ?? 0),
                'withdrawn' => (int) ($counts['approval_withdrawn'] ?? 0),
                'rejected' => (int) ($counts['rejected'] ?? 0),
                'deletedLast30Days' => PropertyListing::onlyTrashed()->where('deleted_at', '>=', now()->subDays(30))->count(),
            ],
        ]);
    }

    public function show(int $id): AdminListingResource
    {
        $listing = PropertyListing::withTrashed()->with([...self::RELATIONS, 'history.actor'])->withCount('enquiries')->findOrFail($id);

        return new AdminListingResource($listing);
    }

    /** Streams the private owner-authorisation document to reviewers. */
    public function ownerAuthorisation(int $id): StreamedResponse
    {
        $listing = PropertyListing::withTrashed()->findOrFail($id);
        abort_unless($listing->owner_auth_path && Storage::disk('local')->exists($listing->owner_auth_path), 404);

        return Storage::disk('local')->response($listing->owner_auth_path, null, ['Cache-Control' => 'private, no-store']);
    }

    public function update(ListingRequest $request, int $id): AdminListingResource
    {
        $listing = PropertyListing::findOrFail($id);

        // Optimistic lock: the reviewer must be looking at the latest version (SCR-LIST-09).
        if ($request->filled('version') && (int) $request->input('version') !== $listing->version) {
            abort(409, 'This listing was updated by the agent. Reload to review the latest version.');
        }

        $listing = $this->listings->update($listing, $request->user(), $request->listingData(), $request->file('owner_authorisation'), asAdmin: true);

        return $this->fresh($listing->id);
    }

    public function approve(Request $request, int $id): AdminListingResource
    {
        $listing = PropertyListing::findOrFail($id);
        if ($request->filled('version') && (int) $request->input('version') !== $listing->version) {
            abort(409, 'This listing was updated by the agent. Reload to review the latest version.');
        }

        $this->listings->approve($listing, $request->user());

        return $this->fresh($id);
    }

    public function reject(Request $request, int $id): AdminListingResource
    {
        $this->listings->reject(PropertyListing::findOrFail($id), $request->user(), $this->reason($request));

        return $this->fresh($id);
    }

    public function withdraw(Request $request, int $id): AdminListingResource
    {
        $this->listings->withdraw(PropertyListing::findOrFail($id), $request->user(), $this->reason($request));

        return $this->fresh($id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $this->listings->delete(PropertyListing::findOrFail($id), $request->user(), $this->reason($request), byAdmin: true);

        return ApiResponse::message('Listing deleted. A Super Administrator can restore it within 30 days.');
    }

    public function restore(Request $request, int $id): AdminListingResource
    {
        $this->listings->restore(PropertyListing::onlyTrashed()->findOrFail($id), $request->user());

        return $this->fresh($id);
    }

    public function feature(Request $request, int $id): AdminListingResource
    {
        $featured = $request->validate(['featured' => ['required', 'boolean']])['featured'];
        $this->listings->setFeatured(PropertyListing::findOrFail($id), $request->user(), $featured);

        return $this->fresh($id);
    }

    public function uploadPhotos(Request $request, int $id): AdminListingResource
    {
        $kb = config('estate.uploads.image_max_kb');
        $request->validate(['photos' => ['required', 'array', 'min:1'], 'photos.*' => ['image', 'mimes:jpg,jpeg,png,webp', "max:{$kb}"]]);
        $this->listings->addPhotos(PropertyListing::findOrFail($id), $request->user(), $request->file('photos'), asAdmin: true);

        return $this->fresh($id);
    }

    public function deletePhoto(Request $request, int $id, ListingMedia $media): AdminListingResource
    {
        $this->listings->removePhoto(PropertyListing::findOrFail($id), $request->user(), $media, asAdmin: true);

        return $this->fresh($id);
    }

    /** GET /admin/listings/options — reject reasons, property types and amenities for admin forms. */
    public function options(): JsonResponse
    {
        return response()->json(['data' => [
            'rejectReasons' => config('estate.listings.reject_reasons'),
            'propertyTypes' => collect(config('estate.listings.property_types'))->map(fn ($label, $value) => compact('value', 'label'))->values(),
            'amenities' => config('estate.listings.amenities'),
        ]]);
    }

    private function reason(Request $request): string
    {
        return $request->validate(['reason' => ['required', 'string', 'min:10', 'max:500']])['reason'];
    }

    private function fresh(int $id): AdminListingResource
    {
        return new AdminListingResource(
            PropertyListing::withTrashed()->with([...self::RELATIONS, 'history.actor'])->withCount('enquiries')->findOrFail($id)
        );
    }
}
