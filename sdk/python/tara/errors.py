"""Exception hierarchy for the Tara client."""

from __future__ import annotations

from typing import Any


class TaraError(Exception):
    """Base class for all Tara client errors."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        error_type: str | None = None,
        request_id: str | None = None,
        body: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_type = error_type
        self.request_id = request_id
        self.body = body

    def __str__(self) -> str:
        parts = [self.message]
        if self.status_code is not None:
            parts.append(f"[HTTP {self.status_code}]")
        if self.error_type:
            parts.append(f"[type={self.error_type}]")
        if self.request_id:
            parts.append(f"[request_id={self.request_id}]")
        return " ".join(parts)


class TaraAuthError(TaraError):
    """401 / 403 — bad key, missing header, pending or revoked account."""


class TaraValidationError(TaraError):
    """400 / 422 — request body invalid."""


class TaraRateLimitError(TaraError):
    """429 — quota exceeded. `retry_after_seconds` may be set."""

    def __init__(
        self,
        message: str,
        *,
        retry_after_seconds: int | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(message, **kwargs)
        self.retry_after_seconds = retry_after_seconds


class TaraServerError(TaraError):
    """5xx — server-side problem. Retryable."""


class TaraToolError(TaraError):
    """A tool handler raised inside run_agent_loop and the loop was set to surface it."""
