<?php

namespace App\Http\Resources;

/** Listing as seen by estate management in the approval queue. */
class AdminListingResource extends ListingResource
{
    protected string $context = 'admin';
}
