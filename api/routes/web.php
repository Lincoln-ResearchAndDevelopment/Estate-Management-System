<?php

use Illuminate\Support\Facades\Route;

// The API serves no HTML pages; the Next.js app is the user interface.
Route::get('/', fn () => response()->json([
    'name' => config('app.name'),
    'api' => url('/api/v1'),
    'docs' => app()->isProduction() ? null : url('/docs/api'),
]));
