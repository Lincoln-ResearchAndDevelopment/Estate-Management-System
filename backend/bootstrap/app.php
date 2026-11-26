<?php

use App\Exceptions\ApiExceptionRenderer;
use App\Http\Middleware\EnsureAccountIsActive;
use App\Http\Middleware\RequirePermission;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sanctum SPA cookie authentication for the Next.js front end (same parent domain).
        $middleware->statefulApi();
        // Behind the Next.js proxy / a load balancer, trust X-Forwarded-* so rate limits see the real client IP.
        // Only set TRUSTED_PROXIES when the API is not reachable directly from the internet.
        if ($proxies = env('TRUSTED_PROXIES')) {
            $middleware->trustProxies(at: $proxies === '*' ? '*' : array_map('trim', explode(',', $proxies)));
        }
        $middleware->append(SecurityHeaders::class);

        $middleware->alias([
            'permission' => RequirePermission::class,
            'active' => EnsureAccountIsActive::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson()
        );

        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return ApiExceptionRenderer::render($e, $request);
            }

            return null;
        });
    })->create();
