"""TaraClient — Python client for tara.tratok.com/api/v1."""

from __future__ import annotations

import json
import os
import random
import time
from dataclasses import dataclass, field
from typing import Any, Callable

import requests

from .errors import (
    TaraAuthError,
    TaraError,
    TaraRateLimitError,
    TaraServerError,
    TaraToolError,
    TaraValidationError,
)

DEFAULT_BASE_URL = "https://tara.tratok.com/api/v1"
DEFAULT_TIMEOUT = 60


@dataclass
class AgentResponse:
    """A parsed `/agent` response.

    The `.text` property concatenates all top-level `text` blocks for convenience.
    For tool use, iterate `.content` and look for `type == "tool_use"`.
    """

    id: str
    role: str
    content: list[dict]
    stop_reason: str
    usage: dict
    raw: dict = field(repr=False)

    @property
    def text(self) -> str:
        return "".join(
            block.get("text", "")
            for block in self.content
            if block.get("type") == "text"
        )

    @property
    def tool_calls(self) -> list[dict]:
        return [b for b in self.content if b.get("type") == "tool_use"]


ToolHandler = Callable[..., Any]


class TaraClient:
    """Client for tara.tratok.com.

    Parameters
    ----------
    api_key:
        Your `tara_sk_...` key. Defaults to the `TARA_API_KEY` environment var.
    base_url:
        Override only for testing. Production should use the default.
    timeout:
        Per-request timeout in seconds.
    max_attempts:
        Total HTTP attempts including the first try, for 429 and 5xx.
    """

    def __init__(
        self,
        api_key: str | None = None,
        *,
        base_url: str | None = None,
        timeout: int = DEFAULT_TIMEOUT,
        max_attempts: int = 5,
        session: requests.Session | None = None,
    ) -> None:
        api_key = api_key or os.environ.get("TARA_API_KEY")
        if not api_key:
            raise TaraError(
                "No API key provided. Pass api_key= or set TARA_API_KEY in the environment."
            )
        self.api_key = api_key
        self.base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")
        self.timeout = timeout
        self.max_attempts = max_attempts
        self.session = session or requests.Session()

    # ---- public API --------------------------------------------------------

    def chat(
        self,
        message: str,
        *,
        history: list[dict] | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> str:
        """Send a single message to /chat and return the reply string."""
        return self.chat_raw(
            message=message,
            history=history,
            max_tokens=max_tokens,
            temperature=temperature,
        )["reply"]

    def chat_raw(
        self,
        message: str,
        *,
        history: list[dict] | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> dict:
        """Send a single message to /chat and return the full response dict."""
        body = {
            "message": message,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if history is not None:
            body["history"] = history
        return self._post("/chat.php", body)

    def agent(
        self,
        messages: list[dict],
        *,
        system: str | None = None,
        tools: list[dict] | None = None,
        tool_choice: dict | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> AgentResponse:
        """Single /agent call (no looping). Returns AgentResponse."""
        body: dict[str, Any] = {
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if system is not None:
            body["system"] = system
        if tools is not None:
            body["tools"] = tools
        if tool_choice is not None:
            body["tool_choice"] = tool_choice

        raw = self._post("/agent.php", body)
        return AgentResponse(
            id=raw["id"],
            role=raw["role"],
            content=raw["content"],
            stop_reason=raw["stop_reason"],
            usage=raw["usage"],
            raw=raw,
        )

    def run_agent_loop(
        self,
        user_message: str,
        *,
        tools: list[dict],
        tool_handlers: dict[str, ToolHandler],
        system: str | None = None,
        max_turns: int = 10,
        raise_on_tool_error: bool = False,
        on_turn: Callable[[int, AgentResponse], None] | None = None,
    ) -> str:
        """Run the full tool-use loop until the model returns end_turn.

        Returns the final text. Raises TaraError on protocol errors,
        or TaraToolError if a handler raises and raise_on_tool_error=True.
        """
        messages: list[dict] = [{"role": "user", "content": user_message}]

        for turn in range(max_turns):
            response = self.agent(
                messages=messages,
                system=system,
                tools=tools,
            )
            if on_turn:
                on_turn(turn, response)

            messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason in {"end_turn", "max_tokens"}:
                return response.text

            if response.stop_reason == "tool_use":
                tool_results = []
                for block in response.tool_calls:
                    handler = tool_handlers.get(block["name"])
                    if handler is None:
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block["id"],
                            "content": f"Unknown tool: {block['name']}",
                            "is_error": True,
                        })
                        continue
                    try:
                        result = handler(**block["input"])
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block["id"],
                            "content": json.dumps(result) if not isinstance(result, str) else result,
                        })
                    except Exception as e:  # noqa: BLE001
                        if raise_on_tool_error:
                            raise TaraToolError(f"Tool '{block['name']}' raised: {e}") from e
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block["id"],
                            "content": f"Tool error: {e}",
                            "is_error": True,
                        })
                messages.append({"role": "user", "content": tool_results})
                continue

            raise TaraError(
                f"Unexpected stop_reason: {response.stop_reason}",
                body=response.raw,
            )

        raise TaraError(f"Agent loop exceeded {max_turns} turns")

    # ---- internals ---------------------------------------------------------

    def _post(self, path: str, body: dict) -> dict:
        url = f"{self.base_url}{path}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": f"tara-client-python/1.1.0",
        }

        last_err: Exception | None = None
        for attempt in range(self.max_attempts):
            try:
                response = self.session.post(
                    url, headers=headers, json=body, timeout=self.timeout
                )
            except requests.RequestException as e:
                last_err = e
                self._sleep_backoff(attempt)
                continue

            # Retryable error classes
            if response.status_code == 429:
                retry_after = self._parse_retry_after(response)
                if attempt < self.max_attempts - 1:
                    time.sleep(retry_after + random.uniform(0, 0.5))
                    continue
                raise self._make_error(response, retry_after=retry_after)

            if 500 <= response.status_code < 600:
                if attempt < self.max_attempts - 1:
                    self._sleep_backoff(attempt)
                    continue
                raise self._make_error(response)

            if not response.ok:
                raise self._make_error(response)

            # Success
            try:
                return response.json()
            except ValueError as e:
                raise TaraError(
                    f"Non-JSON response from server: {e}",
                    status_code=response.status_code,
                    body=response.text,
                ) from e

        raise TaraError(
            f"Request failed after {self.max_attempts} attempts: {last_err}"
        )

    def _sleep_backoff(self, attempt: int) -> None:
        time.sleep((2**attempt) + random.uniform(0, 1))

    @staticmethod
    def _parse_retry_after(response: requests.Response) -> int:
        h = response.headers.get("Retry-After")
        if h and h.isdigit():
            return int(h)
        try:
            body = response.json()
            return int(body.get("error", {}).get("retry_after_seconds", 1))
        except Exception:  # noqa: BLE001
            return 1

    @staticmethod
    def _make_error(
        response: requests.Response, *, retry_after: int | None = None
    ) -> TaraError:
        try:
            body = response.json()
            err = body.get("error", {})
            etype = err.get("type")
            msg = err.get("message") or response.reason
            rid = err.get("request_id")
        except Exception:  # noqa: BLE001
            body = response.text
            etype = None
            msg = response.reason
            rid = None

        status = response.status_code
        common = {
            "status_code": status,
            "error_type": etype,
            "request_id": rid,
            "body": body,
        }

        if status in (401, 403):
            return TaraAuthError(msg, **common)
        if status in (400, 422):
            return TaraValidationError(msg, **common)
        if status == 429:
            return TaraRateLimitError(msg, retry_after_seconds=retry_after, **common)
        if 500 <= status < 600:
            return TaraServerError(msg, **common)
        return TaraError(msg, **common)
