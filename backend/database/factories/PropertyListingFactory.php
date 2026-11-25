<?php

namespace Database\Factories;

use App\Enums\ListingStatus;
use App\Models\PropertyListing;
use App\Models\Street;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<PropertyListing> */
class PropertyListingFactory extends Factory
{
    protected $model = PropertyListing::class;

    public function definition(): array
    {
        $title = 'Test listing '.fake()->unique()->words(4, true);

        return [
            'listing_code' => 'PAHE-L-'.now()->year.'-'.fake()->unique()->numerify('####'),
            'slug' => Str::slug($title),
            'agent_user_id' => User::factory()->role('agent'),
            'listing_type' => 'rent',
            'property_type' => 'flat',
            'title' => $title,
            'description' => str_repeat('A spacious home in a secure estate. ', 3),
            // street_id must come before sector_id: the sector is derived from the created street.
            'street_id' => Street::factory(),
            'sector_id' => fn (array $a) => Street::find($a['street_id'])?->sector_id,
            'bedrooms' => 3,
            'bathrooms' => 2,
            'price_ngn' => 2500000,
            'price_period' => 'year',
            'available_from' => now()->addWeek()->toDateString(),
            'owner_auth_path' => 'listings/test/auth.pdf',
            'status' => ListingStatus::Draft,
        ];
    }

    public function status(ListingStatus $status): static
    {
        return $this->state(fn () => [
            'status' => $status,
            'submitted_at' => $status === ListingStatus::Draft ? null : now(),
            'approved_at' => $status === ListingStatus::Approved ? now() : null,
            'published_until' => $status === ListingStatus::Approved ? now()->addDays(90) : null,
        ]);
    }
}
