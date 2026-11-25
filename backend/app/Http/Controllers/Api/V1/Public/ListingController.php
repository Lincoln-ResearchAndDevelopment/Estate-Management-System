<?php

namespace App\Http\Controllers\Api\V1\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\ListingResource;
use App\Models\ListingEnquiry;
use App\Models\PropertyListing;
use App\Models\Sector;
use App\Notifications\NewListingEnquiry;
use App\Services\AuditLogger;
use App\Services\CaptchaVerifier;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * Public landing page API (FR-LIST-01–04, 18). Only approved, in-window listings are ever returned;
 * anything else is a 404.
 */
class ListingController extends Controller
{
    private const PUBLIC_RELATIONS = ['media', 'sector', 'street', 'unit', 'agent.agentProfile'];

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'type' => ['nullable', Rule::in(['rent', 'sale'])],
            'property_type' => ['nullable', Rule::in(array_keys(config('estate.listings.property_types')))],
            'bedrooms' => ['nullable', 'integer', 'min:0', 'max:20'],
            'min_price' => ['nullable', 'numeric', 'min:0'],
            'max_price' => ['nullable', 'numeric', 'min:0', 'gte:min_price'],
            'sector_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', Rule::in(['newest', 'price_asc', 'price_desc'])],
        ]);

        $listings = PropertyListing::query()
            ->publiclyVisible()
            ->with(self::PUBLIC_RELATIONS)
            ->filter(collect($filters)->except('sort')->all())
            ->sorted($filters['sort'] ?? null)
            ->paginate(ApiResponse::pageSize($request, 12));

        return ApiResponse::paginated($listings, ListingResource::class);
    }

    public function featured(): JsonResponse
    {
        $listings = PropertyListing::query()->publiclyVisible()->where('is_featured', true)
            ->with(self::PUBLIC_RELATIONS)->latest('approved_at')->limit(6)->get();

        return response()->json(['data' => ListingResource::collection($listings)->resolve()]);
    }

    public function show(string $slug): JsonResponse
    {
        $listing = PropertyListing::query()->publiclyVisible()->where('slug', $slug)
            ->with(self::PUBLIC_RELATIONS)->firstOrFail();

        $listing->increment('view_count');

        $similar = PropertyListing::query()->publiclyVisible()
            ->whereKeyNot($listing->id)
            ->where('listing_type', $listing->listing_type)
            ->where(fn ($q) => $q->where('property_type', $listing->property_type)->orWhere('sector_id', $listing->sector_id))
            ->with(self::PUBLIC_RELATIONS)->latest('approved_at')->limit(3)->get();

        return response()->json([
            'data' => (new ListingResource($listing))->resolve(),
            'similar' => ListingResource::collection($similar)->resolve(),
        ]);
    }

    /** POST /public/listings/{id}/enquiries — CAPTCHA + 5 per hour per IP (route throttle). */
    public function enquire(Request $request, int $id, CaptchaVerifier $captcha): JsonResponse
    {
        $listing = PropertyListing::query()->publiclyVisible()->with('agent')->findOrFail($id);

        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'phone' => ['required', 'string', 'regex:/^\+234\d{10}$/'],
            'email' => ['nullable', 'email', 'max:255'],
            'message' => ['required', 'string', 'min:10', 'max:1000'],
            'preferred_viewing_date' => ['nullable', 'date', 'after_or_equal:today'],
            'captcha_token' => ['nullable', 'string'],
        ], ['phone.regex' => 'Enter a Nigerian mobile number in the format +234XXXXXXXXXX.']);

        $captcha->verify($data['captcha_token'] ?? null, $request->ip());

        $enquiry = ListingEnquiry::create([
            'listing_id' => $listing->id,
            'user_id' => $request->user()?->id,
            'name' => $data['name'],
            'phone' => $data['phone'],
            'email' => $data['email'] ?? null,
            'message' => $data['message'],
            'preferred_viewing_date' => $data['preferred_viewing_date'] ?? null,
            'status' => 'new',
            'ip_hash' => hash('sha256', (string) $request->ip()),
        ]);

        $enquiry->setRelation('listing', $listing);
        $listing->agent?->notify(new NewListingEnquiry($enquiry));

        return ApiResponse::message('Your enquiry has been sent to the agent.', 201);
    }

    /** POST /public/listings/{id}/contact-reveal — returns the agent's phone and logs the reveal. */
    public function revealContact(Request $request, int $id, AuditLogger $audit): JsonResponse
    {
        $listing = PropertyListing::query()->publiclyVisible()->with('agent')->findOrFail($id);
        $audit->log('listing.contact_revealed', $listing);

        return response()->json(['data' => ['phone' => $listing->agent?->phone, 'email' => $listing->agent?->email]]);
    }

    /** GET /public/estate — estate information and filter options for the landing page. */
    public function estate(): JsonResponse
    {
        return response()->json(['data' => [
            'name' => config('estate.name'),
            'shortName' => config('estate.short_name'),
            'propertyTypes' => collect(config('estate.listings.property_types'))->map(fn ($label, $value) => compact('value', 'label'))->values(),
            'amenities' => config('estate.listings.amenities'),
            'sectors' => Sector::query()->orderBy('name')->get(['id', 'name']),
            'contact' => (function () {
                $s = \App\Http\Controllers\Api\V1\Admin\SettingsController::all();

                return ['address' => $s['estate_address'] ?? null, 'phone' => $s['estate_phone'] ?? null, 'email' => $s['estate_email'] ?? null, 'officeHours' => $s['office_hours'] ?? null, 'about' => $s['about'] ?? null];
            })(),
            'stats' => [
                'liveListings' => PropertyListing::query()->publiclyVisible()->count(),
                'forRent' => PropertyListing::query()->publiclyVisible()->where('listing_type', 'rent')->count(),
                'forSale' => PropertyListing::query()->publiclyVisible()->where('listing_type', 'sale')->count(),
            ],
        ]]);
    }

    public function sitemap(): Response
    {
        $base = config('estate.frontend_url');
        $urls = PropertyListing::query()->publiclyVisible()->orderByDesc('updated_at')->limit(5000)->get(['slug', 'updated_at'])
            ->map(fn ($l) => sprintf('<url><loc>%s/listings/%s</loc><lastmod>%s</lastmod></url>', e($base), e($l->slug), $l->updated_at->toDateString()))
            ->implode('');

        return response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'.$urls.'</urlset>', 200, ['Content-Type' => 'application/xml']);
    }
}
