<?php

namespace Tests\Feature\Modules;

use App\Services\Auth\TotpService;
use Tests\TestCase;

/** FR-AUTH-12: TOTP two-factor sign-in. */
class MfaTest extends TestCase
{
    public function test_enrol_then_sign_in_with_code_and_recovery_code(): void
    {
        $totp = app(TotpService::class);
        $user = $this->userWithRole('finance_officer', ['email' => 'fo@example.com']);
        $this->signIn($user);

        $this->postJson('/api/v1/auth/mfa/setup')->assertOk()->assertJsonStructure(['data' => ['secret', 'otpauthUrl']]);
        $secret = (string) $user->fresh()->mfa_secret;
        $this->postJson('/api/v1/auth/mfa/enable', ['code' => '000000'])->assertStatus(422);
        $codes = $this->postJson('/api/v1/auth/mfa/enable', ['code' => $totp->code($secret, intdiv(time(), 30))])->assertOk()->json('data.recoveryCodes');
        $this->assertNotEmpty($codes);

        $this->app['auth']->forgetGuards();

        $challenge = $this->withHeader('Referer', 'http://localhost')
            ->postJson('/api/v1/auth/login', ['email' => 'fo@example.com', 'password' => 'Secret#123'])
            ->assertOk()->assertJsonPath('data.mfaRequired', true)->json('data.challenge');

        $this->postJson('/api/v1/auth/mfa/challenge', ['challenge' => $challenge, 'code' => '123456'])->assertStatus(422);
        $this->withHeader('Referer', 'http://localhost')
            ->postJson('/api/v1/auth/mfa/challenge', ['challenge' => $challenge, 'code' => $codes[0]])
            ->assertOk()->assertJsonPath('data.user.email', 'fo@example.com');

        // A recovery code works only once.
        $this->assertNotContains($codes[0], (array) $user->fresh()->mfa_recovery_codes);
    }

    public function test_tampered_challenge_is_rejected(): void
    {
        $this->postJson('/api/v1/auth/mfa/challenge', ['challenge' => 'not-a-real-challenge', 'code' => '123456'])->assertStatus(401);
    }
}
