<?php

namespace App\Http\Resources;

/** Listing as seen by the agent who owns it. */
class OwnerListingResource extends ListingResource
{
    protected string $context = 'owner';
}
