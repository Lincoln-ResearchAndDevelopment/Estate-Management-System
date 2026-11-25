<?php

return [
    'name' => env('ESTATE_NAME', 'Post Army Housing Estates'),
    'short_name' => env('ESTATE_SHORT_NAME', 'PAHE'),
    'code_prefix' => env('ESTATE_CODE_PREFIX', 'PAHE'),
    'timezone' => 'Africa/Lagos',
    'currency' => 'NGN',

    // Base URL of the Next.js front end, used in e-mailed links (password set/reset, listing links).
    'frontend_url' => rtrim(env('FRONTEND_URL', 'http://localhost:3000'), '/'),

    'auth' => [
        'max_failed_attempts' => (int) env('AUTH_MAX_FAILED_ATTEMPTS', 5),
        'lockout_minutes' => (int) env('AUTH_LOCKOUT_MINUTES', 15),
        'invite_expiry_hours' => 72,
    ],

    'listings' => [
        'min_photos' => (int) env('LISTING_MIN_PHOTOS', 3),
        'max_photos' => (int) env('LISTING_MAX_PHOTOS', 20),
        'publish_days' => (int) env('LISTING_PUBLISH_DAYS', 90),
        'restore_window_days' => 30,
        'enquiries_per_hour_per_ip' => 5,
        'property_types' => [
            'detached_duplex' => 'Detached duplex',
            'semi_detached_duplex' => 'Semi-detached duplex',
            'terrace' => 'Terrace',
            'bungalow' => 'Bungalow',
            'flat' => 'Flat / Apartment',
            'maisonette' => 'Maisonette',
            'land' => 'Land / Plot',
            'commercial' => 'Commercial',
        ],
        'amenities' => [
            'Borehole', 'Prepaid meter', 'Parking', 'BQ', 'POP ceiling', 'Fitted kitchen',
            'Wardrobes', 'Generator house', '24h security', 'Swimming pool', 'Gym', 'Garden',
        ],
        'reject_reasons' => [
            'Incomplete details', 'Poor photos', 'Unverified ownership', 'Duplicate',
            'Property no longer available', 'Policy violation', 'Other',
        ],
    ],

    'uploads' => [
        'image_max_kb' => 5120,
        'document_max_kb' => 10240,
    ],

    // Cloudflare Turnstile secret. When empty (local development) CAPTCHA verification is skipped.
    'captcha_secret' => env('TURNSTILE_SECRET_KEY'),
];
