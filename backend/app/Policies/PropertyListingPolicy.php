<?php

namespace App\Policies;

use App\Models\PropertyListing;
use App\Models\User;

/**
 * Row-level scope for listings: agents act only on their own listings (SRS 5.5 rule 1).
 * Admin actions are guarded by permission middleware on the admin routes.
 */
class PropertyListingPolicy
{
    public function manageOwn(User $user, PropertyListing $listing): bool
    {
        return $user->hasPermission('listings.manage_own') && $listing->isOwnedBy($user);
    }
}
