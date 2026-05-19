"""
Minimal Tara /chat example.

Usage:
    export TARA_API_KEY=tara_sk_...
    pip install -r requirements.txt
    python chat_basic.py
"""

from __future__ import annotations

import os
import sys

import requests

TARA_API_BASE = "https://tara.tratok.com/api/v1"


def chat(message: str) -> dict:
    api_key = os.environ.get("TARA_API_KEY")
    if not api_key:
        raise SystemExit("Set TARA_API_KEY in your environment first.")

    response = requests.post(
        f"{TARA_API_BASE}/chat.php",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "message": message,
            "max_tokens": 512,
            "temperature": 0.7,
        },
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def main() -> None:
    user_input = " ".join(sys.argv[1:]) or "What is Tratok in one sentence?"
    result = chat(user_input)

    if not result.get("ok"):
        print(f"Error: {result.get('error', {}).get('message', 'unknown')}")
        sys.exit(1)

    print(result["reply"])
    print()
    print(f"--- tokens: {result['usage']['total_tokens']}")


if __name__ == "__main__":
    main()
