<?php

namespace App\Http\Middleware;

use App\Exceptions\BusinessRuleException;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ends the session of a signed-in user whose account was blocked, deactivated or deleted after sign-in.
 */
class EnsureAccountIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->isActive()) {
            if ($request->hasSession()) {
                Auth::guard('web')->logout();
                $request->session()->invalidate();
            }

            throw new BusinessRuleException(
                $user->status->loginError() ?? 'Your account is not active.',
                $user->status->value === 'blocked' ? 'ACCOUNT_BLOCKED' : 'ACCOUNT_INACTIVE',
                403,
            );
        }

        return $next($request);
    }
}
