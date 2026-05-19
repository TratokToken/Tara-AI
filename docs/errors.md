# Errors

Every error response from `/api/v1/*` has the same JSON shape:

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

Always include `request_id` if you file a bug — it's how we find your request in the logs.

---

## Status code reference

| Status | `error.type` | Meaning | Action |
|---|---|---|---|
| **400** | `invalid_request` | Request body malformed or schema-violating | Fix the request. See message. |
| **400** | `missing_field` | Required field is missing or empty | Add the field. |
| **401** | `missing_authorization` | No `Authorization` header | Add `Authorization: Bearer tara_sk_...`. |
| **401** | `invalid_authorization` | Header present but doesn't start with `Bearer ` | Fix format. |
| **401** | `invalid_key` | Key not found or revoked | Check key on `account.php`. |
| **403** | `account_pending` | Account not yet approved | Wait for the approval email. |
| **403** | `account_revoked` | Account suspended | Email support via `account.php`. |
| **403** | `forbidden` | Action not allowed for this key/account | See message. |
| **404** | `not_found` | Endpoint path wrong | Check URL — `/api/v1/chat.php` not `/api/v1/chat`. |
| **405** | `method_not_allowed` | GET on POST-only endpoint | Use POST. |
| **406** | `not_acceptable` | WAF blocked the request (likely UA) | Set a non-default `User-Agent`. |
| **413** | `payload_too_large` | Body exceeds 256 KB | Trim `history` / `messages`. |
| **422** | `validation_error` | Field type/value invalid | See message. |
| **429** | `rate_limit` | Per-minute, per-day, or concurrency limit | Honour `Retry-After`. See [rate-limits.md](rate-limits.md). |
| **500** | `internal_error` | Bug in the server | Retry once with exponential backoff. Report with `request_id`. |
| **502** | `upstream_error` | Upstream model returned an error | Retry with backoff. |
| **503** | `service_unavailable` | Server overloaded or in maintenance | Retry with backoff. |
| **504** | `upstream_timeout` | Upstream model took too long | Retry with backoff. |

---

## Detailed walkthroughs

### 401 Unauthorized

The three common shapes:

```json
{ "error": { "type": "missing_authorization", "message": "Authorization header required." } }
{ "error": { "type": "invalid_authorization", "message": "Authorization header must start with 'Bearer '." } }
{ "error": { "type": "invalid_key", "message": "API key not recognised or revoked." } }
```

#### `missing_authorization`

You either forgot the header or your HTTP client / proxy stripped it. Try:

```bash
curl -v https://tara.tratok.com/api/v1/chat.php \
  -H "Authorization: Bearer $TARA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"hi"}'
```

`-v` prints the request headers — confirm `Authorization` is actually being sent. Then hit `/authdiag.php?token=...` to confirm the server received it.

#### `invalid_authorization`

You probably wrote `Authorization: tara_sk_...` without the literal `Bearer ` prefix. The space matters.

#### `invalid_key`

- Was the key revoked? Check `account.php`.
- Did you copy a stray space? Whitespace breaks the match.
- Is the key from a deleted account? Reapproval needed.

### 403 Forbidden

```json
{ "error": { "type": "account_pending", "message": "Account not yet approved. We'll email you when it is." } }
```

Different from 401 — your key *is* valid, but your account isn't approved (or has been revoked). Check your inbox and `account.php`.

### 406 Not Acceptable

```json
{ "error": { "type": "not_acceptable", "message": "Request blocked by WAF." } }
```

Cause: the hosting WAF (ModSecurity) blocks the default `curl/7.x` user-agent. Fix:

```bash
curl -A "Mozilla/5.0" ...
```

Or in any language, set a `User-Agent` header. Python `requests` and Node `fetch` both ship with non-curl defaults so this is mostly a curl/wget problem.

> If 406s keep happening from a real client (browser, Postman, your own SDK), tell us — there may be another WAF rule biting us. Report includes the `request_id` and a sample of the request payload.

### 413 Payload Too Large

```json
{ "error": { "type": "payload_too_large", "message": "Request body exceeds 256 KB." } }
```

Causes:

- `history` got long. Trim to last ~40 turns.
- `tool_result` content is a giant JSON blob. Summarise it before returning.
- You're trying to upload an image. Images aren't supported yet.

### 422 Validation Error

The shape:

```json
{
  "error": {
    "type": "validation_error",
    "message": "Field 'messages[0].role' must be 'user' or 'assistant'.",
    "field": "messages[0].role"
  }
}
```

`field` (when present) points at the offending dotted path. Common cases:

- `messages[].role` set to `"system"` (use top-level `system` field)
- `messages[].content` is an empty string or empty array
- `tools[].input_schema` is not valid JSON Schema
- `tool_choice.type` is something other than `auto` / `any` / `none` / `tool`
- `temperature` outside [0.0, 1.0]
- `max_tokens` outside [1, 4096]

### 429 Rate Limit

See [rate-limits.md](rate-limits.md) — that doc covers it in detail.

### 500 / 502 / 503 / 504

5xx errors are server-side. **They're retryable with backoff.** Most clients should:

1. Retry once after ~1 second.
2. Retry again after ~2–4 seconds (with jitter).
3. If still failing, surface the error and include `request_id`.

If 5xx errors persist, check the [status page (planned)](https://tara.tratok.com/) or report with the `request_id` from the response.

---

## How to file a bug

Open an issue in this repository with:

1. **`request_id`** from the error response (or several).
2. The HTTP **status** and the **error.type** you got.
3. Minimal repro — preferably a curl one-liner with the key redacted.
4. Expected vs. actual behaviour.
5. Time window (UTC) — helps us cross-reference logs.

For security-relevant issues (auth bypass, data leakage, etc.) see [SECURITY.md](../SECURITY.md) — don't open public issues for those.

---

## See also

- [rate-limits.md](rate-limits.md) — 429s specifically
- [authentication.md](authentication.md) — 401s specifically
- [agent-endpoint.md](agent-endpoint.md) — full request schema
