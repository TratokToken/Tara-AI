# `/api/v1/agent` — Anthropic Messages-shape endpoint

The full-featured Tara endpoint. Anthropic-compatible request and response shape, with tool use, multi-block content, and multi-turn round-trips.

Use this when you need:

- **Function calling** (a.k.a. tool use)
- **Custom system prompts**
- **Multi-block responses** — text + tool_use blocks interleaved
- **Tight control** over message structure for an agent loop

For simple "ask a question, get a string" use cases, [`/chat`](chat-endpoint.md) is lighter.

---

## Endpoint

```
POST https://tara.tratok.com/api/v1/agent.php
```

## Headers

| Header | Required | Notes |
|---|---|---|
| `Authorization` | yes | `Bearer tara_sk_...` |
| `Content-Type` | yes | `application/json` |
| `User-Agent` | recommended | See [errors.md](errors.md#406-not-acceptable). |

## Request body

```jsonc
{
  // Required. Conversation history, oldest first.
  "messages": [
    { "role": "user", "content": "What can you do?" }
  ],

  // Optional. Additional system instructions for this conversation.
  "system": "Always respond in formal English.",

  // Optional. Maximum tokens in the assistant's reply.
  // Default 1024. Max 4096.
  "max_tokens": 1024,

  // Optional. 0.0 = deterministic, 1.0 = creative. Default 0.7.
  "temperature": 0.7,

  // Optional. See "Tool use" below.
  "tools": [],

  // Optional. "auto" (default), "any", "none", or a specific tool name.
  "tool_choice": { "type": "auto" }
}
```

### Field reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `messages` | array | ✅ | Conversation turns. See message schema below. |
| `system` | string | ❌ | Additional system instructions. |
| `max_tokens` | int | ❌ | 1–4096. Default 1024. |
| `temperature` | float | ❌ | 0.0–1.0. Default 0.7. |
| `tools` | array | ❌ | Tools available to the model. |
| `tool_choice` | object | ❌ | How aggressively to use tools. |
| `model` | string | ❌ | **Ignored.** Always server-managed. |

### Message schema

A message is a `role` plus `content`. Content can be a string (shorthand) or an array of typed blocks (full form).

```jsonc
// Shorthand: string content
{ "role": "user", "content": "Hello." }

// Equivalent full form
{ "role": "user", "content": [{ "type": "text", "text": "Hello." }] }

// Assistant response with both text and a tool call
{
  "role": "assistant",
  "content": [
    { "type": "text", "text": "Let me check that for you." },
    {
      "type": "tool_use",
      "id": "toolu_abc123",
      "name": "get_weather",
      "input": { "city": "Dubai" }
    }
  ]
}

// User message returning a tool result
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_abc123",
      "content": "{\"temp_c\": 37, \"condition\": \"sunny\"}"
    }
  ]
}
```

| Role | Where it goes | Notes |
|---|---|---|
| `user` | Anywhere | Includes `tool_result` blocks. |
| `assistant` | Anywhere except first turn | The model's previous output. Can contain `text` and `tool_use` blocks. |
| `system` | **❌ NOT IN `messages`** | Top-level `system` field only. |

> The `system` role inside `messages[]` is rejected with `400 invalid_request`. Use the top-level `system` field — this matches Anthropic's API, not OpenAI's.

### Content block types

| Type | Source | Fields |
|---|---|---|
| `text` | user, assistant | `text` (string) |
| `tool_use` | assistant only | `id`, `name`, `input` (object) |
| `tool_result` | user only | `tool_use_id`, `content` (string or array of text blocks) |
| `image` | user (planned) | Not yet supported |

## Tool use

Tools let the model call functions you define. The model can't execute code — it returns a request to call a tool, you run it, you return the result, the model continues.

### Defining tools

```jsonc
{
  "tools": [
    {
      "name": "get_weather",
      "description": "Get current weather for a city. Use for any weather question.",
      "input_schema": {
        "type": "object",
        "properties": {
          "city": { "type": "string", "description": "City name, e.g. 'Dubai'" },
          "units": { "type": "string", "enum": ["c", "f"], "default": "c" }
        },
        "required": ["city"]
      }
    }
  ]
}
```

`input_schema` is a JSON Schema (Draft 7-ish subset). The model uses `description` heavily — invest in clear descriptions.

### `tool_choice`

| Value | Behaviour |
|---|---|
| `{"type": "auto"}` | Default. Model decides whether to call a tool. |
| `{"type": "any"}` | Force a tool call (model picks which). |
| `{"type": "none"}` | Prohibit tool calls. |
| `{"type": "tool", "name": "get_weather"}` | Force a specific tool. |

### The agent loop

Tool use is a back-and-forth:

```
1. You POST: messages=[user: "What's the weather in Dubai?"], tools=[...]
2. Tara replies: stop_reason="tool_use", content=[..., tool_use(get_weather, {city: "Dubai"})]
3. You execute get_weather("Dubai") locally → "37°C sunny"
4. You POST: messages=[..., assistant: <step 2>, user: [tool_result(toolu_..., "37°C sunny")]]
5. Tara replies: stop_reason="end_turn", content=[text: "It's 37°C and sunny..."]
```

→ Full implementation: [examples/python/agent_loop.py](../examples/python/agent_loop.py), [tool-use.md](tool-use.md)

## Response — success (200)

```jsonc
{
  "id": "msg_a1b2c3d4e5f6",
  "type": "message",
  "role": "assistant",
  "content": [
    { "type": "text", "text": "Let me check the weather for you." },
    {
      "type": "tool_use",
      "id": "toolu_xyz789",
      "name": "get_weather",
      "input": { "city": "Dubai" }
    }
  ],
  "stop_reason": "tool_use",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 124,
    "output_tokens": 38,
    "total_tokens": 162
  }
}
```

### `stop_reason` values

| Value | Meaning | What you do |
|---|---|---|
| `end_turn` | Model finished naturally | Done. Show the text to the user. |
| `tool_use` | Model wants to call tool(s) | Execute them, append `tool_result`, call again. |
| `max_tokens` | Hit `max_tokens` limit | Either accept, or call again with the partial response in `messages` and ask for more. |
| `stop_sequence` | Hit a stop sequence (not yet supported) | — |

### `content[]` is always an array

Even for plain text responses. Iterate.

```python
for block in response["content"]:
    if block["type"] == "text":
        print(block["text"])
    elif block["type"] == "tool_use":
        result = run_tool(block["name"], block["input"])
        ...
```

## Response — error (4xx, 5xx)

Same shape as `/chat`:

```json
{
  "ok": false,
  "error": {
    "type": "invalid_request",
    "message": "Field 'messages' must be a non-empty array.",
    "request_id": "req_a1b2c3d4e5f6"
  }
}
```

Full taxonomy in [errors.md](errors.md).

## Streaming

**Not supported.** Always atomic. Setting `stream: true` is ignored.

## Differences from Anthropic's Messages API

| | Anthropic | Tara |
|---|---|---|
| `model` field | required | ignored (server-managed) |
| `stream: true` | supported | ignored (always atomic) |
| Auth | `x-api-key` | `Authorization: Bearer` |
| Base URL | `api.anthropic.com/v1/messages` | `tara.tratok.com/api/v1/agent.php` |

→ Porting guide: [migrating-from-anthropic.md](migrating-from-anthropic.md)

## Try it

```bash
curl https://tara.tratok.com/api/v1/agent.php \
  -A "Mozilla/5.0" \
  -H "Authorization: Bearer $TARA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is the capital of the UAE?"}
    ],
    "max_tokens": 256
  }'
```

→ More: [examples/curl/agent.sh](../examples/curl/agent.sh), [examples/python/agent_loop.py](../examples/python/agent_loop.py)
