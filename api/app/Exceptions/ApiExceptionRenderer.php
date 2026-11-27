<?php

namespace App\Exceptions;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

/**
 * Renders every API error as RFC 7807 problem+json (SRS Section 10.1):
 * { type, title, status, code, detail, errors[], traceId }.
 */
class ApiExceptionRenderer
{
    public static function render(Throwable $e, Request $request): JsonResponse
    {
        $traceId = $request->headers->get('X-Request-Id') ?: (string) Str::uuid();

        [$status, $code, $title, $detail, $errors] = match (true) {
            $e instanceof ValidationException => [
                422, 'VALIDATION_FAILED', 'Validation failed', 'One or more fields are invalid.',
                collect($e->errors())->flatMap(fn ($messages, $field) => collect($messages)
                    ->map(fn ($message) => ['field' => $field, 'message' => $message]))->values()->all(),
            ],
            $e instanceof BusinessRuleException => [$e->status, $e->errorCode, 'Request not allowed', $e->getMessage(), []],
            $e instanceof AuthenticationException => [401, 'UNAUTHENTICATED', 'Authentication required', 'Please sign in to continue.', []],
            $e instanceof AuthorizationException, $e instanceof AccessDeniedHttpException => [
                403, 'FORBIDDEN', 'Forbidden', 'You do not have permission to perform this action.', [],
            ],
            // Resources outside the caller's scope also return 404 so their existence does not leak.
            $e instanceof ModelNotFoundException, $e instanceof NotFoundHttpException => [404, 'NOT_FOUND', 'Not found', 'The requested resource was not found.', []],
            $e instanceof ThrottleRequestsException => [429, 'RATE_LIMITED', 'Too many requests', 'Too many requests. Please try again later.', []],
            $e instanceof HttpExceptionInterface => [$e->getStatusCode(), 'HTTP_'.$e->getStatusCode(), 'Request failed', $e->getMessage() ?: 'Request failed.', []],
            default => [500, 'SERVER_ERROR', 'Server error', config('app.debug') ? $e->getMessage() : 'An unexpected error occurred.', []],
        };

        if ($status >= 500) {
            report($e);
        }

        $headers = ['Content-Type' => 'application/problem+json'];
        if ($e instanceof HttpExceptionInterface) {
            $headers = array_merge($e->getHeaders(), $headers);
        }

        return new JsonResponse([
            'type' => 'about:blank',
            'title' => $title,
            'status' => $status,
            'code' => $code,
            'detail' => $detail,
            'errors' => $errors,
            'traceId' => $traceId,
        ], $status, $headers);
    }
}
