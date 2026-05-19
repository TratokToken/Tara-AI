"""
Minimal Tara /agent example — Anthropic Messages shape, no tools.

Usage:
    export TARA_API_KEY=tara_sk_...
    python agent_basic.py
"""

from __future__ import annotations

import os
import sys

import requests

TARA_API_BASE = "https://tara.tratok.com/api/v1"


def agent(messages: list[dict], system: str | None = None, max_tokens: int = 1024) -> dict:
    api_key = os.environ.get("TARA_API_KEY")
    if not api_key:
        raise SystemExit("Set TARA_API_KEY in your environment first.")

    body: dict = {"messages": messages, "max_tokens": max_tokens}
    if system:
        body["system"] = system

    response = requests.post(
        f"{TARA_API_BASE}/agent.php",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def extract_text(response: dict) -> str:
    """Concatenate all text blocks from an /agent response."""
    return "".join(
        block.get("text", "")
        for block in response.get("content", [])
        if block.get("type") == "text"
    )


def main() -> None:
    user_input = " ".join(sys.argv[1:]) or "Suggest 3 things to do in Dubai in May."

    result = agent(
        messages=[{"role": "user", "content": user_input}],
        system="Be concise. Use bullet points.",
        max_tokens=512,
    )

    print(extract_text(result))
    print()
    print(f"--- stop_reason={result['stop_reason']}, tokens={result['usage']['total_tokens']}")


if __name__ == "__main__":
    main()
