"""
Tara /agent with a single tool — shows the request shape but does NOT loop.

After running this you'll see a response with stop_reason="tool_use" and
a tool_use content block. To actually complete the round-trip and get
Tara's final answer, see agent_loop.py.

Usage:
    export TARA_API_KEY=tara_sk_...
    python agent_tools.py
"""

from __future__ import annotations

import json
import os

import requests

TARA_API_BASE = "https://tara.tratok.com/api/v1"


TOOLS = [
    {
        "name": "get_weather",
        "description": (
            "Get the current weather for a city. "
            "Returns temperature in celsius and a one-word condition "
            "(sunny/cloudy/rainy/snowy)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "City name in English, e.g. 'Dubai'.",
                },
            },
            "required": ["city"],
        },
    }
]


def call_agent_with_tools() -> dict:
    api_key = os.environ.get("TARA_API_KEY")
    if not api_key:
        raise SystemExit("Set TARA_API_KEY in your environment first.")

    response = requests.post(
        f"{TARA_API_BASE}/agent.php",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "messages": [
                {"role": "user", "content": "What is the weather like in Dubai right now?"}
            ],
            "tools": TOOLS,
            "max_tokens": 1024,
        },
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def main() -> None:
    result = call_agent_with_tools()
    print(json.dumps(result, indent=2))
    print()
    print(f"--- stop_reason={result['stop_reason']}")

    if result["stop_reason"] == "tool_use":
        print("→ Tara wants to call a tool. See agent_loop.py for the full round-trip.")


if __name__ == "__main__":
    main()
