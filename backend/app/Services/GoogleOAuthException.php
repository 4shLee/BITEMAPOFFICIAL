<?php

namespace App\Services;

use RuntimeException;

class GoogleOAuthException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $httpStatus = 401,
    ) {
        parent::__construct($message);
    }
}
