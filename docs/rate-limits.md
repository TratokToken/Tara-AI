# Rate limits

Tara is free during preview but not unlimited. Limits exist per account, not per key — multiple keys on one account share the same buckets.

## Default quotas

| Bucket | Default | Resets |
|---|---|---|
| Requests per minute | **30** | Rolling 60 s window |
| Requests per day | **1,000** | 00:00 UTC |
| Input + output tokens per day | **200,000** | 00:00 UTC |
| Concurrent in-flight requests | **5** | Immediate (on response) |

Limits apply across `/chat` and `/agent` combined. There is no separate quota per endpoint.

> Need more? See [Asking for a higher quota](#asking-for-a-higher-quota).

## 429 response shape

When you trip a limit, the server responds with HTTP `429 Too Many Requests`:

```json
{
  "ok": false,
  "error": {
    "type": "rate_limit",
    "message": "Daily token quota exceeded. Resets at 2026-05-19T00:00:00Z.",
    "retry_after_seconds": 28765,
    "request_id": "req_a1b2c3d4e5f6"
  }
}
```

Plus headers:

| Header | Meaning |
|---|---|
| `Retry-After` | Seconds to wait before retrying (same as `retry_after_seconds`). |
| `X-RateLimit-Limit-Requests` | Your per-minute request cap. |
| `X-RateLimit-Remaining-Requests` | Requests left in the current minute. |
| `X-RateLimit-Reset-Requests` | Seconds until the per-minute bucket refills. |
| `X-RateLimit-Limit-Tokens` | Your daily token cap. |
| `X-RateLimit-Remaining-Tokens` | Tokens left today. |
| `X-RateLimit-Reset-Tokens` | Seconds until the daily bucket resets (i.e., until 00:00 UTC). |

Check the headers on **every** response, not just on 429s — they're how you avoid 429s.

## Backoff strategy

The recommended pattern:

```python
import time

def call_with_backoff(fn, max_attempts=5, base_delay=1.0):
    for attempt in range(max_attempts):
        try:
            return fn()
        except TaraRateLimitError as e:
            if attempt == max_attempts - 1:
                raise
            wait = e.retry_after_seconds or (base_delay * (2 ** attempt))
            # add jitter to avoid thundering herd
            wait += random.uniform(0, wait * 0.1)
            time.sleep(wait)
```

Rules of thumb:

1. **Respect `Retry-After`.** It's the truth.
2. **Exponential backoff with jitter** if `Retry-After` is missing.
3. **Cap retries at 5.** Beyond that, surface to the user.
4. **Don't retry 4xx errors other than 429.** A `400 invalid_request` won't fix itself.

## How tokens are counted

Tokens are counted server-side using the upstream tokenizer. As a rough heuristic:

- **1 token ≈ 4 characters of English** (less for code, more for compressed text)
- **A typical chat turn**: 50–200 input tokens, 100–500 output tokens
- **An agent turn with tools**: 200–500 input tokens, 50–200 output tokens (the tool result text dominates the next input)

Your `usage` field in every successful response is authoritative:

```json
"usage": {
  "input_tokens": 124,
  "output_tokens": 38,
  "total_tokens": 162
}
```

`total_tokens` is what counts against your daily limit.

## Avoiding 429s

### Right-size `max_tokens`

`max_tokens` reserves budget against your daily token quota whether you use it or not? **No** — only actual generated tokens count. But generous `max_tokens` can let one runaway response burn 4× more than you needed. Set it to what you actually need.

### Trim `history` and `messages`

Every prior turn is re-sent on every call. A 20-turn conversation costs ~3,000 input tokens per request even if the user just said "ok." Drop irrelevant context.

### Use `/chat` instead of `/agent` where you can

`/agent` has slightly more overhead per call due to tool-schema parsing. If you don't need tools, `/chat` is cheaper.

### Batch when interactive timing isn't critical

Background tasks that are not user-facing should not poll Tara every second. Batch jobs hourly or daily.

## Concurrency

The 5-concurrent-request limit is to keep one account from monopolising upstream capacity. If you go over, you get:

```
429 Too Many Requests
{ "error": { "type": "rate_limit", "message": "Too many concurrent requests (5 in flight)." } }
```

Solution: use a semaphore client-side to cap parallel calls at 5.

## Per-IP limits (anonymous chat UI)

The web UI at `tara.tratok.com` is anonymous (no API key) and is rate-limited by **hashed IP** instead. Those limits don't affect API users. If you're an API user hitting the UI from your own browser, you're on the IP bucket there — separate from your API account quota.

## Asking for a higher quota

Email the address on your `account.php` page or open the contact form there. Include:

1. Your account email.
2. The current bucket you're hitting (requests/min, requests/day, tokens/day).
3. Expected steady-state and peak load.
4. What you're building.

Approval is manual but reasonable. We don't ask for payment — just enough information to size the increase appropriately.

## See also

- [errors.md](errors.md) — full status code reference
- [authentication.md](authentication.md) — keys and accounts
