<?php

declare(strict_types=1);

namespace Tratok\Tara;

class TaraError extends \RuntimeException
{
    public function __construct(
        string $message,
        public readonly ?int $statusCode = null,
        public readonly ?string $errorType = null,
        public readonly ?string $requestId = null,
        public readonly mixed $body = null,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    public function __toString(): string
    {
        $parts = [$this->getMessage()];
        if ($this->statusCode !== null) {
            $parts[] = "[HTTP {$this->statusCode}]";
        }
        if ($this->errorType !== null) {
            $parts[] = "[type={$this->errorType}]";
        }
        if ($this->requestId !== null) {
            $parts[] = "[request_id={$this->requestId}]";
        }
        return implode(' ', $parts);
    }
}

class TaraAuthError extends TaraError {}

class TaraValidationError extends TaraError {}

class TaraRateLimitError extends TaraError
{
    public function __construct(
        string $message,
        public readonly ?int $retryAfterSeconds = null,
        ?int $statusCode = null,
        ?string $errorType = null,
        ?string $requestId = null,
        mixed $body = null,
    ) {
        parent::__construct($message, $statusCode, $errorType, $requestId, $body);
    }
}

class TaraServerError extends TaraError {}

class TaraToolError extends TaraError {}
