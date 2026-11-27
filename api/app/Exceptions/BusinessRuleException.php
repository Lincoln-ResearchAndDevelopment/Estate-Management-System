<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * A request that is valid in shape but breaks a business rule or an allowed status transition.
 * Codes follow SRS Section 10.1 (e.g. INVALID_STATE, ACCOUNT_PENDING, DUPLICATE).
 */
class BusinessRuleException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode = 'BUSINESS_RULE',
        public readonly int $status = 422,
    ) {
        parent::__construct($message);
    }

    public static function invalidState(string $message): self
    {
        return new self($message, 'INVALID_STATE', 409);
    }

    public static function duplicate(string $message): self
    {
        return new self($message, 'DUPLICATE', 409);
    }
}
