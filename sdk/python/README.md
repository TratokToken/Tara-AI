# tara-client (Python)

Tiny, well-documented client for the Tara API. One dependency (`requests`). Mirrors the Anthropic Messages shape for `/agent`.

## Install

From this repo (editable):

```bash
pip install -e ./sdk/python
```

(Or once published to PyPI: `pip install tara-client`.)

## Quickstart

```python
import os
from tara import TaraClient

client = TaraClient(api_key=os.environ["TARA_API_KEY"])

# Simple chat
print(client.chat("What is Tratok?"))

# Full agent call (Anthropic Messages shape)
response = client.agent(
    messages=[{"role": "user", "content": "Plan a 3-day trip to Dubai."}],
    system="Be concise. Use bullet points.",
    max_tokens=1024,
)
print(response.text)  # convenience: all text blocks concatenated

# Agent loop with tools
def get_weather(city: str) -> dict:
    return {"temp_c": 37, "condition": "sunny"}

final = client.run_agent_loop(
    user_message="What's the weather in Dubai?",
    tools=[{
        "name": "get_weather",
        "description": "Get current weather for a city.",
        "input_schema": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    }],
    tool_handlers={"get_weather": get_weather},
)
print(final)
```

## API

| Method | What |
|---|---|
| `TaraClient(api_key=None, base_url=None, timeout=60)` | Constructor. `api_key` defaults to `TARA_API_KEY` env var. |
| `client.chat(message, history=None, max_tokens=1024, temperature=0.7)` | Returns the reply string. |
| `client.chat_raw(...)` | Same but returns the full `{ok, reply, usage, ...}` dict. |
| `client.agent(messages, system=None, tools=None, tool_choice=None, max_tokens=1024, temperature=0.7)` | Returns an `AgentResponse` object with `.content`, `.stop_reason`, `.usage`, `.text`. |
| `client.run_agent_loop(user_message, tools, tool_handlers, system=None, max_turns=10)` | Runs the full loop until `end_turn`. Returns final text. |

## Errors

| Exception | Raised when |
|---|---|
| `TaraAuthError` | 401, 403 |
| `TaraRateLimitError` | 429 (has `.retry_after_seconds`) |
| `TaraValidationError` | 400, 422 |
| `TaraServerError` | 5xx |
| `TaraToolError` | Tool handler raised inside `run_agent_loop` and `raise_on_tool_error=True` |

All inherit `TaraError`.

## Notes

- The client retries 5xx and 429 with exponential backoff (max 5 attempts, jitter).
- `model` is **not** a parameter — it is server-managed.
- Streaming is not supported by the API. Don't expect a stream method.
- `base_url` is overridable for testing only; pointing at a non-Tara endpoint is unsupported.
