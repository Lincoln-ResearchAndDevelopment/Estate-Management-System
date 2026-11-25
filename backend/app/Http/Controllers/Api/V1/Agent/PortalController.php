<?php

namespace App\Http\Controllers\Api\V1\Agent;

use App\Enums\ListingStatus;
use App\Http\Controllers\Controller;
use App\Models\ListingEnquiry;
use App\Models\ListingStatusHistory;
use App\Models\PropertyListing;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Agent dashboard (SCR-LIST-04), enquiries (SCR-LIST-07) and profile. */
class PortalController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        $agentId = $request->user()->id;
        $counts = PropertyListing::query()->where('agent_user_id', $agentId)
            ->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $listingIds = PropertyListing::withTrashed()->where('agent_user_id', $agentId)->pluck('id');

        $decisions = ListingStatusHistory::query()
            ->whereIn('listing_id', $listingIds)
            ->whereIn('to_status', ['approved', 'rejected', 'approval_withdrawn', 'deleted'])
            ->where(fn ($q) => $q->whereNull('actor_user_id')->orWhere('actor_user_id', '!=', $agentId))
            ->with('actor:id,name')->latest('occurred_at')->limit(5)->get()
            ->map(fn ($h) => [
                'listingId' => $h->listing_id,
                'listingTitle' => PropertyListing::withTrashed()->whereKey($h->listing_id)->value('title'),
                'decision' => $h->to_status,
                'reason' => $h->reason,
                'occurredAt' => $h->occurred_at?->toIso8601String(),
            ]);

        $enquiries = ListingEnquiry::query()->whereIn('listing_id', $listingIds)->with('listing:id,title')
            ->latest()->limit(5)->get();

        return response()->json(['data' => [
            'kpis' => [
                'live' => (int) ($counts[ListingStatus::Approved->value] ?? 0),
                'pending' => (int) ($counts[ListingStatus::PendingApproval->value] ?? 0),
                'rejectedOrWithdrawn' => (int) (($counts['rejected'] ?? 0) + ($counts['approval_withdrawn'] ?? 0)),
                'drafts' => (int) ($counts['draft'] ?? 0),
                'newEnquiries' => ListingEnquiry::whereIn('listing_id', $listingIds)->where('status', 'new')->count(),
                'totalViews' => (int) PropertyListing::where('agent_user_id', $agentId)->sum('view_count'),
            ],
            'recentDecisions' => $decisions,
            'latestEnquiries' => $enquiries->map(fn ($e) => $this->enquiry($e)),
        ]]);
    }

    public function enquiries(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(ListingEnquiry::STATUSES)],
            'listing_id' => ['nullable', 'integer'],
        ]);

        $listingIds = PropertyListing::withTrashed()->where('agent_user_id', $request->user()->id)->pluck('id');

        $page = ListingEnquiry::query()->whereIn('listing_id', $listingIds)->with('listing:id,title,slug')
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($filters['listing_id'] ?? null, fn ($q, $v) => $q->where('listing_id', $v))
            ->latest()->paginate(ApiResponse::pageSize($request));

        $page->setCollection($page->getCollection()->map(fn ($e) => $this->enquiry($e)));

        return response()->json([
            'data' => $page->items(),
            'meta' => ['page' => $page->currentPage(), 'pageSize' => $page->perPage(), 'total' => $page->total(), 'totalPages' => $page->lastPage()],
        ]);
    }

    public function updateEnquiry(Request $request, int $id): JsonResponse
    {
        $listingIds = PropertyListing::withTrashed()->where('agent_user_id', $request->user()->id)->pluck('id');
        $enquiry = ListingEnquiry::query()->whereIn('listing_id', $listingIds)->with('listing:id,title,slug')->findOrFail($id);

        $enquiry->update($request->validate([
            'status' => ['sometimes', Rule::in(ListingEnquiry::STATUSES)],
            'agent_note' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]));

        return response()->json(['data' => $this->enquiry($enquiry)]);
    }

    public function profile(Request $request): JsonResponse
    {
        $user = $request->user()->load('agentProfile');

        return response()->json(['data' => [
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'agencyName' => $user->agentProfile?->agency_name,
            'agencyRegNo' => $user->agentProfile?->agency_reg_no,
            'bio' => $user->agentProfile?->bio,
            'status' => $user->agentProfile?->status,
            'verified' => (bool) $user->agentProfile?->verified,
        ]]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'agency_name' => ['nullable', 'string', 'max:120'],
            'agency_reg_no' => ['nullable', 'string', 'max:60'],
            'bio' => ['nullable', 'string', 'max:1000'],
        ]);

        $request->user()->agentProfile()->update($data);

        return $this->profile($request);
    }

    private function enquiry(ListingEnquiry $e): array
    {
        return [
            'id' => $e->id,
            'listing' => $e->listing ? ['id' => $e->listing->id, 'title' => $e->listing->title, 'slug' => $e->listing->slug] : null,
            'name' => $e->name,
            'phone' => $e->phone,
            'email' => $e->email,
            'message' => $e->message,
            'preferredViewingDate' => $e->preferred_viewing_date?->toDateString(),
            'status' => $e->status,
            'agentNote' => $e->agent_note,
            'createdAt' => $e->created_at?->toIso8601String(),
        ];
    }
}
