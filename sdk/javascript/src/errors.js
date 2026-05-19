// Error hierarchy for the Tara JS client.

export class TaraError extends Error {
  constructor(message, { statusCode, errorType, requestId, body } = {}) {
    super(message);
    this.name = "TaraError";
    this.statusCode = statusCode ?? null;
    this.errorType = errorType ?? null;
    this.requestId = requestId ?? null;
    this.body = body ?? null;
  }
}

export class TaraAuthError extends TaraError {
  constructor(message, opts) {
    super(message, opts);
    this.name = "TaraAuthError";
  }
}

export class TaraValidationError extends TaraError {
  constructor(message, opts) {
    super(message, opts);
    this.name = "TaraValidationError";
  }
}

export class TaraRateLimitError extends TaraError {
  constructor(message, { retryAfterSeconds, ...opts } = {}) {
    super(message, opts);
    this.name = "TaraRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds ?? null;
  }
}

export class TaraServerError extends TaraError {
  constructor(message, opts) {
    super(message, opts);
    this.name = "TaraServerError";
  }
}

export class TaraToolError extends TaraError {
  constructor(message, opts) {
    super(message, opts);
    this.name = "TaraToolError";
  }
}
