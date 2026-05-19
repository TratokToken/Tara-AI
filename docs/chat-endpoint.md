# `/api/v1/chat` — simple chat endpoint

The minimal viable Tara endpoint. **String in, string out.** No content blocks, no tools, no streaming, no Anthropic-shape baggage.

Use this for:

- Quick scripts and CLI tools
- Embedded chat in apps where you don't need function calling
- Anywhere you just want "ask a question, get an answer"

For tool use, multi-block content, or anything Anthropic-API-shaped, use [`/api/v1/agent`](agent-endpoint.md) instead.

---

## Endpoint

```
POST https://tara.tratok.com/api/v1/chat.php
```

## Headers

| Header | Required | Notes |
|---|---|---|
| `Authorization` | yes | `Bearer tara_sk_...` |
| `Content-Type` | yes | `application/json` |
| `User-Agent` | recommended | Any non-default UA. See [errors.md](errors.md#406-not-acceptable). |

## Request body

```jsonc
{
  // The user's message. Required, non-empty, ≤ 16,000 characters.
  "message": "What is Tratok?",

  // Optional: prior turns in this conversation.
  // Newest message goes in `message` above — NOT in `history`.
  "history": [
    { "role": "user",      "content": "I'm going to Dubai." },
    { "role": "assistant", "content": "Great! When?" }
  ],

  // Optional: limit reply length. Default 1024. Max 4096.
  "max_tokens": 1024,

  // Optional: sampling temperature. 0.0–1.0. Default 0.7.
  "temperature": 0.7
}
```

### Field reference

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `message` | string | ✅ | — | User input. UTF-8. Trimmed server-side. |
| `history` | array | ❌ | `[]` | Up to 40 prior turns. Order: oldest → newest. |
| `history[].role` | `"user"` / `"assistant"` | ✅ | — | No `system` role here — see `/agent` for that. |
| `history[].content` | string | ✅ | — | Plain text only. |
| `max_tokens` | int | ❌ | 1024 | 1–4096. |
| `temperature` | float | ❌ | 0.7 | 0.0 (deterministic) – 1.0 (creative). |

> The server prepends Tratok's system prompt automatically. You can't set `system` here — it's hard-coded. Use `/agent` if you need custom system instructions.

## Response — success (200)

```json
{
  "ok": true,
  "reply": "Tara is Tratok's free AI assistant, focused on travel and hospitality...",
  "usage": {
    "input_tokens": 42,
    "output_tokens": 87,
    "total_tokens": 129
  },
  "request_id": "req_a1b2c3d4e5f6"
}
```

| Field | Type | Notes |
|---|---|---|
| `ok` | bool | Always `true` on 2xx. |
| `reply` | string | The model's response. |
| `usage.input_tokens` | int | Including your `history` and the server-side system prompt. |
| `usage.output_tokens` | int | The reply only. |
| `usage.total_tokens` | int | Sum. What counts against your quota. |
| `request_id` | string | Echo it back if you need to file a bug. |

## Response — error (4xx, 5xx)

```json
{
  "ok": false,
  "error": {
    "type": "rate_limit",
    "message": "Daily token quota exceeded. Resets at 00:00 UTC.",
    "request_id": "req_a1b2c3d4e5f6"
  }
}
```

Full taxonomy in [errors.md](errors.md).

## Streaming

**Not supported.** The endpoint is atomic — request goes in, full response comes back. The web UI at `tara.tratok.com` does pseudo-streaming by chunking the final response on the client side; that's a UX trick and not exposed in the API.

If you want a "typing" effect in your own UI:

1. Get the full response from the API.
2. Split on whitespace.
3. Append words to the DOM on a `setTimeout` loop with ~30 ms between them.

See [examples/javascript/chat_pseudostream.html](../examples/javascript/) for a working snippet.

## Multi-turn conversations

The endpoint is **stateless**. Each request stands alone. To maintain context across turns, send prior turns in `history`:

```python
history = []

def turn(user_message):
    response = chat(message=user_message, history=history)
    history.append({"role": "user", "content": user_message})
    history.append({"role": "assistant", "content": response["reply"]})
    return response["reply"]

print(turn("I'm planning a trip to Dubai."))
print(turn("What's the weather like in May?"))   # remembers Dubai
print(turn("Suggest a 3-day itinerary."))         # remembers May, Dubai
```

Cap `history` at ~40 turns. Beyond that you're burning tokens on irrelevant context. Truncate from the front (drop oldest), not the back (which is the most relevant).

→ Full example: [examples/python/chat_conversation.py](../examples/python/chat_conversation.py)

## Travel and hospitality routing

- Guest / traveller queries get directed toward `https://tratok.net`.
- Host / property-owner queries get directed toward `https://hospitality.tratok.net`.
- Ambiguous queries: Tara asks who you are.

## Limits

| Limit | Default | Override |
|---|---|---|
| `message` length | 16,000 chars | — |
| `history` entries | 40 | — |
| Total input tokens per request | ~32,000 (model context) | — |
| `max_tokens` | 4096 | — |
| Requests per minute | 30 | Email support |
| Requests per day | 1,000 | Email support |
| Tokens per day | 200,000 | Email support |

See [rate-limits.md](rate-limits.md).

## Try it

```bash
curl https://tara.tratok.com/api/v1/chat.php \
  -A "Mozilla/5.0" \
  -H "Authorization: Bearer $TARA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Suggest one thing to do in Dubai in May.",
    "max_tokens": 256,
    "temperature": 0.7
  }'
```

→ More examples: [examples/curl/chat.sh](../examples/curl/chat.sh), [examples/python/chat_basic.py](../examples/python/chat_basic.py)
