<?php

namespace App\Services;

use App\Exceptions\BusinessRuleException;
use Illuminate\Support\Facades\Http;

/**
 * Verifies Cloudflare Turnstile tokens on public forms. Skipped when no secret is configured
 * (local development and automated tests).
 */
class CaptchaVerifier
{
    public function verify(?string $token, ?string $ip = null): void
    {
        $secret = config('estate.captcha_secret');

        if (! $secret) {
            return;
        }

        if (! $token) {
            throw new BusinessRuleException('Please complete the CAPTCHA.', 'CAPTCHA_REQUIRED');
        }

        $response = Http::asForm()->timeout(5)->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
            'secret' => $secret,
            'response' => $token,
            'remoteip' => $ip,
        ]);

        if (! $response->ok() || ! $response->json('success')) {
            throw new BusinessRuleException('CAPTCHA verification failed. Please try again.', 'CAPTCHA_FAILED');
        }
    }
}
