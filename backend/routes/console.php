<?php

use App\Enums\ListingStatus;
use App\Models\PropertyListing;
use App\Services\Listings\ListingService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

/*
| Scheduled jobs. Run `php artisan schedule:work` locally, or a cron entry
| `* * * * * php artisan schedule:run` in production. Jobs are idempotent.
*/

Artisan::command('listings:expire', function (ListingService $listings) {
    $count = 0;
    PropertyListing::query()
        ->where('status', ListingStatus::Approved)
        ->whereNotNull('published_until')
        ->where('published_until', '<=', now())
        ->each(function (PropertyListing $listing) use ($listings, &$count) {
            $listings->expire($listing);
            $count++;
        });

    $this->info("Expired {$count} listing(s).");
})->purpose('Expire approved listings whose publish period has ended (SRS Q37)');

Schedule::command('listings:expire')->hourly()->withoutOverlapping();
Schedule::command('queue:prune-failed --hours=168')->daily();
Schedule::command('auth:clear-resets')->everyFifteenMinutes();
