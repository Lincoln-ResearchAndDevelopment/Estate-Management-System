<?php

namespace App\Http\Controllers\Api\V1\Agent;

use App\Enums\ListingStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Listings\ListingRequest;
use App\Http\Resources\OwnerListingResource;
use App\Models\ListingMedia;
use App\Models\PropertyListing;
use App\Services\Listings\ListingService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Agent portal: own listings only. Listings of other agents return 404 (no existence leak).
 */
class ListingController extends Controller
{
    public function __construct(private readonly ListingService $listings) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(array_map(fn ($s) => $s->value, ListingStatus::cases()))],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $query = PropertyListing::query()->where('agent_user_id', $request->user()->id);

        if (($filters['status'] ?? null) === ListingStatus::Deleted->value) {
            $query->onlyTrashed();
        }

        $listings = $query->with(['media', 'sector', 'street'])->withCount('enquiries')
            ->filter($filters)->latest('updated_at')->paginate(ApiResponse::pageSize($request));

        $counts = PropertyListing::query()->where('agent_user_id', $request->user()->id)
            ->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return ApiResponse::paginated($listings, OwnerListingResource::class, ['statusCounts' => $counts]);
    }

    public function show(Request $request, int $id): OwnerListingResource
    {
        return new OwnerListingResource($this->own($request, $id)->load(['media', 'sector', 'street', 'unit', 'history.actor'])->loadCount('enquiries'));
    }

    public function store(ListingRequest $request): JsonResponse
    {
        $listing = $this->listings->create(
            $request->user(),
            $request->listingData(),
            false,
            $request->file('owner_authorisation'),
        );

        return (new OwnerListingResource($listing->load(['media', 'sector', 'street'])))->response()->setStatusCode(201);
    }

    public function update(ListingRequest $request, int $id): OwnerListingResource
    {
        $listing = $this->listings->update($this->own($request, $id), $request->user(), $request->listingData(), $request->file('owner_authorisation'));

        if ($request->boolean('submit') && $listing->status->canSubmit()) {
            $listing = $this->listings->submit($listing, $request->user());
        }

        return new OwnerListingResource($listing->load(['media', 'sector', 'street', 'history.actor']));
    }

    public function submit(Request $request, int $id): OwnerListingResource
    {
        $request->validate(['declaration' => ['accepted']], ['declaration.accepted' => 'Confirm that you are authorised to market this property.']);

        return new OwnerListingResource($this->listings->submit($this->own($request, $id), $request->user())->load(['media', 'sector', 'street']));
    }

    public function markClosed(Request $request, int $id): OwnerListingResource
    {
        return new OwnerListingResource($this->listings->markClosed($this->own($request, $id), $request->user())->load(['media', 'sector', 'street']));
    }

    public function renew(Request $request, int $id): OwnerListingResource
    {
        return new OwnerListingResource($this->listings->renew($this->own($request, $id), $request->user())->load(['media', 'sector', 'street']));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $this->listings->delete($this->own($request, $id), $request->user(), null, byAdmin: false);

        return ApiResponse::message('Listing deleted.');
    }

    public function history(Request $request, int $id): JsonResponse
    {
        $listing = $this->own($request, $id, withTrashed: true)->load('history.actor');

        return response()->json(['data' => (new OwnerListingResource($listing))->resolve()['history'] ?? []]);
    }

    public function uploadPhotos(Request $request, int $id): OwnerListingResource
    {
        $kb = config('estate.uploads.image_max_kb');
        $request->validate([
            'photos' => ['required', 'array', 'min:1', 'max:'.config('estate.listings.max_photos')],
            'photos.*' => ['image', 'mimes:jpg,jpeg,png,webp', "max:{$kb}"],
        ]);

        return new OwnerListingResource($this->listings->addPhotos($this->own($request, $id), $request->user(), $request->file('photos'))->load(['sector', 'street']));
    }

    public function deletePhoto(Request $request, int $id, ListingMedia $media): OwnerListingResource
    {
        return new OwnerListingResource($this->listings->removePhoto($this->own($request, $id), $request->user(), $media)->load(['sector', 'street']));
    }

    public function reorderPhotos(Request $request, int $id): OwnerListingResource
    {
        $order = $request->validate(['order' => ['required', 'array', 'min:1'], 'order.*' => ['integer']])['order'];

        return new OwnerListingResource($this->listings->reorderPhotos($this->own($request, $id), $request->user(), $order)->load(['sector', 'street']));
    }

    private function own(Request $request, int $id, bool $withTrashed = false): PropertyListing
    {
        return PropertyListing::query()
            ->when($withTrashed, fn ($q) => $q->withTrashed())
            ->where('agent_user_id', $request->user()->id)
            ->findOrFail($id);
    }
}
