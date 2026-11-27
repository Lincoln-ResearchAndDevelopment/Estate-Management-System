<?php

return [
    // Generate absolute URLs from APP_URL (set when the API sits behind the web app's proxy).
    'force_app_url' => (bool) env('FORCE_APP_URL', false),

    // Process the queue from the scheduler (shared hosting without a long-running worker).
    'queue_via_scheduler' => (bool) env('QUEUE_VIA_SCHEDULER', false),

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
        // TOTP two-factor sign-in for these roles (FR-AUTH-12). Off by default outside production so
        // demo accounts can sign in; set MFA_ENFORCED=true to require it.
        'mfa_enforced' => (bool) env('MFA_ENFORCED', env('APP_ENV') === 'production'),
        'mfa_roles' => ['super_admin', 'estate_manager', 'finance_officer'],
    ],

    'finance' => [
        // Paystack secret key. When empty outside production, a built-in test checkout is used instead.
        'paystack_secret' => env('PAYSTACK_SECRET_KEY'),
        'paystack_url' => env('PAYSTACK_PAYMENT_URL', 'https://api.paystack.co'),
        'bank_name' => env('ESTATE_BANK_NAME'),
        'account_name' => env('ESTATE_ACCOUNT_NAME'),
        'account_number' => env('ESTATE_ACCOUNT_NUMBER'),
    ],

    'security' => [
        // Unacknowledged panic alerts escalate to EM/SA after this many seconds (WF-05).
        'escalate_after_seconds' => (int) env('ALERT_ESCALATE_SECONDS', 60),
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
