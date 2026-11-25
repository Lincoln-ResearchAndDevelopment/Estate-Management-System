<?php

use App\Enums\ListingStatus;
use App\Models\PropertyListing;
use App\Models\VisitorPass;
use App\Services\Finance\BillingService;
use App\Services\Security\AlertService;
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

Artisan::command('finance:bill', function (BillingService $billing) {
    $issued = $billing->runAutoBilling();
    $overdue = $billing->markOverdue();
    $this->info("Issued {$issued} bill(s); marked {$overdue} overdue.");
})->purpose('Raise recurring service bills for the current period and flag overdue bills (FR-FIN)');

Artisan::command('alerts:escalate', function (AlertService $alerts) {
    $this->info('Escalated '.$alerts->escalateStale().' alert(s).');
})->purpose('Re-notify supervisors about emergency alerts nobody has acknowledged (FR-SEC)');

Artisan::command('access:expire', function () {
    $passes = VisitorPass::query()->where('status', 'active')->where('valid_until', '<=', now())->update(['status' => 'expired']);
    $this->info("Expired {$passes} pass(es).");
})->purpose('Expire visitor passes whose validity window has passed');

Schedule::command('finance:bill')->dailyAt('01:00')->withoutOverlapping();
Schedule::command('alerts:escalate')->everyMinute()->withoutOverlapping();
Schedule::command('access:expire')->everyFifteenMinutes();
Schedule::command('listings:expire')->hourly()->withoutOverlapping();
Schedule::command('queue:prune-failed --hours=168')->daily();
Schedule::command('auth:clear-resets')->everyFifteenMinutes();
