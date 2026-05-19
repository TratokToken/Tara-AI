# Migrating from Anthropic Messages API

`/api/v1/agent` is **request- and response-compatible** with Anthropic's Messages API. If you have working Claude code, porting to Tara is mostly a base-URL and auth-header change.

This guide covers what stays the same, what changes, and the gotchas.

---

## TL;DR diff

```diff
- POST https://api.anthropic.com/v1/messages
+ POST https://tara.tratok.com/api/v1/agent.php

- x-api-key: sk-ant-...
- anthropic-version: 2023-06-01
+ Authorization: Bearer tara_sk_...

  Content-Type: application/json

  {
-   "model": "claude-3-5-sonnet-20241022",
+   "model": "tara",                    // ignored, but you can leave it
    "messages": [...],
    "max_tokens": 1024,
    "tools": [...]
  }
```

That's it for the happy path. Streaming and a couple of edge cases differ — see below.

---

## What stays the same

- **Request shape.** `messages[]`, `system` top-level, `tools[]`, `tool_choice`, `max_tokens`, `temperature`.
- **Response shape.** `content[]` array of `text` and `tool_use` blocks. `stop_reason`. `usage.{input_tokens,output_tokens}`.
- **Tool use protocol.** `assistant.content[].type == "tool_use"` → run tool → next `user.content[].type == "tool_result"` with matching `tool_use_id`.
- **Roles.** Only `"user"` and `"assistant"` in `messages[]`. System is top-level. No `"tool"` role — tool results live inside a user message.
- **Content blocks.** Same `type` enum (`text`, `tool_use`, `tool_result`).

---

## What changes

### 1. Authentication

| | Anthropic | Tara |
|---|---|---|
| Header | `x-api-key: sk-ant-...` | `Authorization: Bearer tara_sk_...` |
| Versioning header | `anthropic-version: 2023-06-01` | not needed |

Tara accepts `Bearer` only. If you forget the `Bearer ` prefix you'll get `401 invalid_authorization`.

### 2. Base URL

```diff
- https://api.anthropic.com/v1/messages
+ https://tara.tratok.com/api/v1/agent.php
```

The `.php` is real — it's the cPanel hosting. Don't strip it.

### 3. The `model` field is ignored

You can pass `"model": "claude-3-5-sonnet-20241022"` and it won't error — Tara just ignores it. The model is **server-managed**.

Don't depend on a specific model identifier showing up in the response.

### 4. No streaming

Anthropic supports `stream: true` with SSE. **Tara does not.** Setting `stream: true` is ignored — you always get the atomic JSON response.

The web UI at `tara.tratok.com` does pseudo-streaming on the client side. If you want a typing effect:

```javascript
// After getting the full response
const text = response.content.find(b => b.type === "text").text;
const words = text.split(/(\s+)/);

let i = 0;
const interval = setInterval(() => {
  if (i >= words.length) { clearInterval(interval); return; }
  appendToUI(words[i++]);
}, 30);
```

### 5. No prompt caching, no batch API, no Files API

Anthropic offers prompt caching, batch processing, and file uploads. **Tara has none of these.** Each request is independent and stateless.

If you depend on Anthropic's prompt caching for cost reduction, you'll need a different cost strategy on Tara. (Tara is free, so the cost concern is usually moot.)

### 6. Rate limits

Anthropic has per-tier RPM/TPM limits. Tara has [its own quotas](rate-limits.md):

- 30 req/min, 1000 req/day, 200K tokens/day default

The 429 response shape is similar — both have `Retry-After` headers.

---

## Porting an Anthropic Python script

Before:

```python
import anthropic

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    system="You are a helpful assistant.",
    messages=[
        {"role": "user", "content": "Hello"}
    ],
    tools=[{
        "name": "get_weather",
        "description": "Get weather for a city",
        "input_schema": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    }],
)

print(response.content[0].text)
```

After (using bare `requests`):

```python
import os, requests

response = requests.post(
    "https://tara.tratok.com/api/v1/agent.php",
    headers={
        "Authorization": f"Bearer {os.environ['TARA_API_KEY']}",
        "Content-Type": "application/json",
    },
    json={
        "max_tokens": 1024,
        "system": "You are a helpful assistant.",
        "messages": [
            {"role": "user", "content": "Hello"}
        ],
        "tools": [{
            "name": "get_weather",
            "description": "Get weather for a city",
            "input_schema": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
        }],
    },
    timeout=60,
).json()

print(response["content"][0]["text"])
```

Or using the Tara SDK in this repo:

```python
from tara import TaraClient

client = TaraClient()  # reads TARA_API_KEY from env

response = client.agent(
    messages=[{"role": "user", "content": "Hello"}],
    system="You are a helpful assistant.",
    max_tokens=1024,
    tools=[...],
)

print(response.text)
```

---

## Porting an agent loop

Anthropic-style agent loops port directly. The structure:

```python
messages = [{"role": "user", "content": "..."}]

while True:
    response = call_api(messages=messages, tools=tools)
    messages.append({"role": "assistant", "content": response["content"]})

    if response["stop_reason"] == "end_turn":
        break

    if response["stop_reason"] == "tool_use":
        tool_results = []
        for block in response["content"]:
            if block["type"] == "tool_use":
                result = run_tool(block["name"], block["input"])
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block["id"],
                    "content": json.dumps(result),
                })
        messages.append({"role": "user", "content": tool_results})
```

…works identically against Tara with just the URL and auth header swap. → See [examples/python/agent_loop.py](../examples/python/agent_loop.py).

---

## Using the Anthropic SDK against Tara

You can point the official `anthropic` Python SDK at Tara by setting the base URL. **But there's a catch:** the SDK sends `x-api-key`, and Tara expects `Authorization: Bearer`. You'll need a custom HTTP client.

We recommend the **bare `requests` route** (above) or the Tara SDK in this repo over hacking the Anthropic SDK. It's less surface area and less to break.

If you really want to:

```python
import httpx, anthropic

client = anthropic.Anthropic(
    base_url="https://tara.tratok.com/api/v1/agent.php",  # NOTE: not /v1/messages
    api_key="placeholder",
    auth_token=os.environ["TARA_API_KEY"],
    http_client=httpx.Client(headers={
        "Authorization": f"Bearer {os.environ['TARA_API_KEY']}",
    }),
)
```

This is brittle (the Anthropic SDK could change its auth-header logic) — your mileage may vary.

---

## Differences cheat sheet

| Feature | Anthropic | Tara |
|---|---|---|
| Endpoint | `/v1/messages` | `/api/v1/agent.php` |
| Auth | `x-api-key` | `Authorization: Bearer` |
| Versioning header | `anthropic-version` | none |
| `model` field | required, picks model | ignored (server-managed) |
| `system` field | yours | yours |
| `messages[]` | user/assistant | user/assistant (same) |
| Content blocks | text, tool_use, tool_result, image, document | text, tool_use, tool_result |
| Streaming | `stream: true` works | ignored, always atomic |
| Prompt caching | yes (`cache_control`) | no |
| Batch API | yes | no |
| Files API | yes | no |
| Vision | yes | no |
| Pricing | paid | free with quotas |

---

## See also

- [agent-endpoint.md](agent-endpoint.md) — full request/response reference
- [tool-use.md](tool-use.md) — function calling guide
