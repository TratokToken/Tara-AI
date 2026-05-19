"""
Full Tara agent loop with tools.

This is the canonical pattern: declare tools, run a loop that alternates
between calling /agent and executing tool requests locally, terminating when
the model returns stop_reason="end_turn".

Usage:
    export TARA_API_KEY=tara_sk_...
    python agent_loop.py "What's the weather like in Dubai and Abu Dhabi?"
"""

from __future__ import annotations

import json
import os
import random
import sys
import time
from typing import Any, Callable

import requests

TARA_API_BASE = "https://tara.tratok.com/api/v1"
MAX_TURNS = 10  # safety cap


# ---------------------------------------------------------------------------
# Tool implementations — replace these with real ones in your app.
# ---------------------------------------------------------------------------

def tool_get_weather(city: str) -> dict[str, Any]:
    # Pretend weather. In a real app this would hit a weather API.
    fake = {
        "Dubai":     {"temp_c": 37, "condition": "sunny"},
        "Abu Dhabi": {"temp_c": 39, "condition": "sunny"},
        "London":    {"temp_c": 18, "condition": "cloudy"},
    }
    return fake.get(city, {"temp_c": 22, "condition": "unknown", "note": f"no data for {city}"})


def tool_get_currency_rate(base: str, quote: str) -> dict[str, Any]:
    # Pretend FX. In a real app this would hit an FX API.
    rates = {("USD", "AED"): 3.67, ("AED", "USD"): 0.272, ("USD", "EUR"): 0.92}
    rate = rates.get((base.upper(), quote.upper()))
    if rate is None:
        return {"error": f"No rate for {base}/{quote}"}
    return {"base": base.upper(), "quote": quote.upper(), "rate": rate}


TOOLS = [
    {
        "name": "get_weather",
        "description": "Get current weather for a city. Returns temp_c and condition.",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "City name in English."}
            },
            "required": ["city"],
        },
    },
    {
        "name": "get_currency_rate",
        "description": "Get the current exchange rate between two currency codes (ISO 4217).",
        "input_schema": {
            "type": "object",
            "properties": {
                "base": {"type": "string", "description": "Base currency, e.g. 'USD'"},
                "quote": {"type": "string", "description": "Quote currency, e.g. 'AED'"},
            },
            "required": ["base", "quote"],
        },
    },
]

TOOL_HANDLERS: dict[str, Callable[..., Any]] = {
    "get_weather": tool_get_weather,
    "get_currency_rate": tool_get_currency_rate,
}


# ---------------------------------------------------------------------------
# Tara client
# ---------------------------------------------------------------------------

def post_agent(messages: list[dict], tools: list[dict], max_attempts: int = 5) -> dict:
    api_key = os.environ.get("TARA_API_KEY")
    if not api_key:
        raise SystemExit("Set TARA_API_KEY in your environment first.")

    body = {
        "messages": messages,
        "tools": tools,
        "max_tokens": 1024,
        "temperature": 0.7,
    }

    last_err: Exception | None = None
    for attempt in range(max_attempts):
        try:
            r = requests.post(
                f"{TARA_API_BASE}/agent.php",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
                timeout=60,
            )
            if r.status_code == 429:
                retry_after = int(r.headers.get("Retry-After", "1"))
                time.sleep(retry_after + random.uniform(0, 0.5))
                continue
            if 500 <= r.status_code < 600:
                wait = (2 ** attempt) + random.uniform(0, 1)
                time.sleep(wait)
                continue
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            last_err = e
            time.sleep((2 ** attempt) + random.uniform(0, 1))

    raise RuntimeError(f"Tara /agent call failed after {max_attempts} attempts: {last_err}")


# ---------------------------------------------------------------------------
# The loop
# ---------------------------------------------------------------------------

def run_agent(user_message: str) -> str:
    messages: list[dict] = [{"role": "user", "content": user_message}]

    for turn in range(MAX_TURNS):
        print(f"\n--- turn {turn + 1} ---")
        response = post_agent(messages=messages, tools=TOOLS)

        # Always append the assistant turn to history
        messages.append({"role": "assistant", "content": response["content"]})

        # Log what the model emitted
        for block in response["content"]:
            if block["type"] == "text":
                print(f"[text] {block['text']}")
            elif block["type"] == "tool_use":
                print(f"[tool_use] {block['name']}({json.dumps(block['input'])})")

        stop = response["stop_reason"]
        if stop == "end_turn":
            return "".join(b.get("text", "") for b in response["content"] if b["type"] == "text")

        if stop == "tool_use":
            tool_results = []
            for block in response["content"]:
                if block["type"] != "tool_use":
                    continue
                handler = TOOL_HANDLERS.get(block["name"])
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
                    print(f"[tool_result] {block['name']} -> {result}")
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block["id"],
                        "content": json.dumps(result),
                    })
                except Exception as e:
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block["id"],
                        "content": f"Tool raised: {e}",
                        "is_error": True,
                    })
            messages.append({"role": "user", "content": tool_results})
            continue

        if stop == "max_tokens":
            # The model hit its output cap. Could ask for more, but we stop.
            return "".join(b.get("text", "") for b in response["content"] if b["type"] == "text")

        raise RuntimeError(f"Unexpected stop_reason: {stop}")

    raise RuntimeError(f"Agent loop exceeded {MAX_TURNS} turns")


def main() -> None:
    user_message = (
        " ".join(sys.argv[1:])
        or "What's the weather like in Dubai and Abu Dhabi right now? "
        "Convert 100 USD to AED while you're at it."
    )
    final = run_agent(user_message)
    print("\n=== final answer ===")
    print(final)


if __name__ == "__main__":
    main()
