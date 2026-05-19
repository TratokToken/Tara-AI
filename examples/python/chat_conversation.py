"""
Multi-turn conversation with /chat, maintaining history client-side.

The endpoint is stateless — to give Tara memory across turns, you pass
prior turns in `history`. This script wraps that in a REPL.

Usage:
    export TARA_API_KEY=tara_sk_...
    python chat_conversation.py
"""

from __future__ import annotations

import os
import sys

import requests

TARA_API_BASE = "https://tara.tratok.com/api/v1"
MAX_HISTORY_TURNS = 40  # drop oldest beyond this


def chat(message: str, history: list[dict]) -> dict:
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
            "history": history,
            "max_tokens": 1024,
            "temperature": 0.7,
        },
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def main() -> None:
    history: list[dict] = []
    print("Tara chat. Type 'exit' to quit, 'reset' to clear history.\n")

    while True:
        try:
            user = input("you> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not user:
            continue
        if user.lower() in {"exit", "quit"}:
            break
        if user.lower() == "reset":
            history = []
            print("(history cleared)")
            continue

        try:
            result = chat(user, history)
        except requests.HTTPError as e:
            print(f"HTTP error: {e}", file=sys.stderr)
            try:
                print(e.response.json(), file=sys.stderr)
            except Exception:
                print(e.response.text, file=sys.stderr)
            continue

        if not result.get("ok"):
            print(f"API error: {result.get('error', {}).get('message', 'unknown')}")
            continue

        reply = result["reply"]
        print(f"tara> {reply}\n")

        history.append({"role": "user", "content": user})
        history.append({"role": "assistant", "content": reply})

        # Trim oldest if we go over MAX_HISTORY_TURNS pairs
        if len(history) > MAX_HISTORY_TURNS * 2:
            history = history[-MAX_HISTORY_TURNS * 2 :]


if __name__ == "__main__":
    main()
