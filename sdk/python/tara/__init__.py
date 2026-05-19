"""Tara Python client — see https://tara.tratok.com/api_docs.php."""

from .client import (
    AgentResponse,
    TaraClient,
)
from .errors import (
    TaraAuthError,
    TaraError,
    TaraRateLimitError,
    TaraServerError,
    TaraToolError,
    TaraValidationError,
)

__all__ = [
    "AgentResponse",
    "TaraAuthError",
    "TaraClient",
    "TaraError",
    "TaraRateLimitError",
    "TaraServerError",
    "TaraToolError",
    "TaraValidationError",
]

__version__ = "1.1.0"
