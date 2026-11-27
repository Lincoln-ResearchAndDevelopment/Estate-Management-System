<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * One listing shape for three audiences. Public output never includes the owner authorisation
 * document, history, decision reasons or the agent's contact details.
 *
 * @mixin \App\Models\PropertyListing
 */
class ListingResource extends JsonResource
{
    /** public | owner | admin — set by the OwnerListingResource / AdminListingResource subclasses. */
    protected string $context = 'public';

    public function toArray(Request $request): array
    {
        $private = $this->context !== 'public';
        $showUnit = $private || $this->show_unit_number;

        $photos = $this->relationLoaded('media')
            ? $this->media->where('media_type', 'photo')->values()
            : collect();

        return [
            'id' => $this->id,
            'code' => $this->listing_code,
            'slug' => $this->slug,
            'title' => $this->title,
            'listingType' => $this->listing_type,
            'propertyType' => $this->property_type,
            'propertyTypeLabel' => config('estate.listings.property_types.'.$this->property_type, $this->property_type),
            'description' => $this->description,
            'price' => ['amount' => (string) $this->price_ngn, 'currency' => 'NGN'],
            'pricePeriod' => $this->price_period,
            'negotiable' => $this->negotiable,
            'serviceCharge' => $this->price($this->service_charge_ngn),
            'cautionFee' => $this->price($this->caution_fee_ngn),
            'agencyFee' => $this->price($this->agency_fee_ngn),
            'bedrooms' => $this->bedrooms,
            'bathrooms' => $this->bathrooms,
            'toilets' => $this->toilets,
            'sizeSqm' => $this->size_sqm !== null ? (float) $this->size_sqm : null,
            'furnishing' => $this->furnishing,
            'availableFrom' => $this->available_from?->toDateString(),
            'amenities' => $this->amenities ?? [],
            'videoUrl' => $this->video_url,
            'sector' => $this->whenLoaded('sector', fn () => ['id' => $this->sector->id, 'name' => $this->sector->name]),
            'street' => $this->whenLoaded('street', fn () => ['id' => $this->street->id, 'name' => $this->street->name]),
            'unit' => $this->when($showUnit && $this->relationLoaded('unit') && $this->unit, fn () => [
                'id' => $this->unit->id,
                'code' => $this->unit->unit_code,
                'occupancyStatus' => $private ? $this->unit->occupancy_status : null,
            ]),
            'showUnitNumber' => $this->show_unit_number,
            'coverUrl' => $photos->firstWhere('is_cover', true)?->url() ?? $photos->first()?->url(),
            'photos' => $photos->map(fn ($m) => ['id' => $m->id, 'url' => $m->url(), 'isCover' => $m->is_cover])->values(),
            'isFeatured' => $this->is_featured,
            'approvedAt' => $this->approved_at?->toIso8601String(),
            'agent' => $this->whenLoaded('agent', fn () => [
                'id' => $this->agent->id,
                'name' => $this->agent->name,
                'avatarUrl' => $this->agent->avatar_path ? Storage::disk('public')->url($this->agent->avatar_path) : null,
                'agencyName' => $this->agent->relationLoaded('agentProfile') ? $this->agent->agentProfile?->agency_name : null,
                'verified' => $this->agent->relationLoaded('agentProfile') ? (bool) $this->agent->agentProfile?->verified : false,
                'email' => $this->when($private, $this->agent->email),
                'phone' => $this->when($private, $this->agent->phone),
            ]),

            // Owner and admin only.
            $this->mergeWhen($private, fn () => [
                'status' => $this->status->value,
                'statusLabel' => $this->status->label(),
                'submittedAt' => $this->submitted_at?->toIso8601String(),
                'publishedUntil' => $this->published_until?->toIso8601String(),
                'lastDecisionReason' => $this->last_decision_reason,
                'hasOwnerAuthorisation' => (bool) $this->owner_auth_path,
                'viewCount' => $this->view_count,
                'version' => $this->version,
                'enquiriesCount' => $this->whenCounted('enquiries'),
                'updatedAt' => $this->updated_at?->toIso8601String(),
                'deletedAt' => $this->deleted_at?->toIso8601String(),
                'history' => $this->whenLoaded('history', fn () => $this->history->map(fn ($h) => [
                    'id' => $h->id,
                    'from' => $h->from_status,
                    'to' => $h->to_status,
                    'actor' => $h->relationLoaded('actor') ? $h->actor?->name : null,
                    'reason' => $h->reason,
                    'changedFields' => $h->changed_fields,
                    'occurredAt' => $h->occurred_at?->toIso8601String(),
                ])->values()),
            ]),
        ];
    }

    private function price($value): ?array
    {
        return $value === null ? null : ['amount' => (string) $value, 'currency' => 'NGN'];
    }
}
