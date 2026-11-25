<?php

namespace App\Providers;

use Dedoc\Scramble\Scramble;
use Dedoc\Scramble\Support\Generator\OpenApi;
use Dedoc\Scramble\Support\Generator\SecurityScheme;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        // Catch mass-assignment mistakes during development.
        Model::preventSilentlyDiscardingAttributes(! $this->app->isProduction());

        // Password reset and invitation e-mails link to the Next.js front end, not to Laravel.
        ResetPassword::createUrlUsing(function ($user, string $token) {
            return config('estate.frontend_url').'/reset-password?'.http_build_query([
                'token' => $token,
                'email' => $user->getEmailForPasswordReset(),
            ]);
        });

        $this->configureRateLimiting();
        $this->configureApiDocs();
    }

    private function configureRateLimiting(): void
    {
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(100)->by($request->user()?->id ?: $request->ip()));
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));
        RateLimiter::for('public-forms', fn (Request $request) => Limit::perHour(10)->by($request->ip()));
        RateLimiter::for('enquiries', fn (Request $request) => Limit::perHour((int) config('estate.listings.enquiries_per_hour_per_ip'))->by($request->ip()));
    }

    private function configureApiDocs(): void
    {
        if (! class_exists(Scramble::class)) {
            return;
        }

        // OpenAPI 3.1 document at /docs/api.json, UI at /docs/api (local and staging only by default).
        Scramble::configure()
            ->routes(fn ($route) => str_starts_with($route->uri, 'api/v1'))
            ->withDocumentTransformers(function (OpenApi $openApi) {
                $openApi->secure(SecurityScheme::apiKey('cookie', 'laravel_session'));
            });
    }
}
