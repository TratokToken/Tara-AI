# Authentication

Tara uses **Bearer tokens** in the `Authorization` header. There is no OAuth, no client_id/client_secret pair, and no JWT — just an API key.

## The header

```
Authorization: Bearer tara_sk_<32 hex chars>
```

Every request to `/api/v1/*` must include this header. Missing or malformed → `401 Unauthorized`.

## API key format

```
tara_sk_a1b2c3d4e5f6789012345678abcdef01
```

- Prefix `tara_sk_` is fixed. It's how you recognise Tara keys at a glance — and how secret scanners can flag them in your repos.
- The 32 hex characters are random.
- The full string is shown **once**, when the key is issued (on the approval email and the `account.php` page right after generation). The server stores only `SHA-256(key)`. **If you lose the plaintext, you have to rotate.**

## Where keys come from

Two places:

1. **Approval email.** When your account is approved, the mail contains your first key.
2. **Account dashboard.** `https://tara.tratok.com/account.php` lets you generate additional keys and revoke old ones.

You can have **multiple active keys per account**. Recommended:

| Use case | Why a separate key |
|---|---|
| Local dev | Easy to revoke without breaking prod |
| CI / staging | Separate quota / blast radius |
| Production | What ends up in your secrets store |
| Per-service in a microservices stack | Per-call attribution in usage logs |

Revoking a key is instant. Revoked keys come back as **`401 invalid_key`**.

## Examples

### curl

```bash
curl https://tara.tratok.com/api/v1/chat.php \
  -A "Mozilla/5.0" \
  -H "Authorization: Bearer $TARA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"hi"}'
```

### Python

```python
import os, requests

response = requests.post(
    "https://tara.tratok.com/api/v1/chat.php",
    headers={
        "Authorization": f"Bearer {os.environ['TARA_API_KEY']}",
        "Content-Type": "application/json",
    },
    json={"message": "hi"},
    timeout=60,
)
```

### Node.js (18+)

```javascript
const r = await fetch("https://tara.tratok.com/api/v1/chat.php", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.TARA_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ message: "hi" }),
});
```

### PHP

```php
$ch = curl_init("https://tara.tratok.com/api/v1/chat.php");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer " . getenv("TARA_API_KEY"),
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode(["message" => "hi"]),
]);
```

## Header gotchas (Apache strips Authorization by default)

The Tara server runs on shared cPanel hosting behind Apache. Apache historically strips the `Authorization` header before PHP sees it. The server is configured to **un-strip it** in three places:

1. `CGIPassAuth On` in root `.htaccess` (Apache ≥ 2.4.13).
2. A mod_rewrite forwarder that copies the header into `HTTP_AUTHORIZATION`.
3. The server-side bearer extractor checks **four** fallback locations:
   - `Authorization` request header
   - `HTTP_AUTHORIZATION` server var
   - `REDIRECT_HTTP_AUTHORIZATION` server var
   - PHP's `apache_request_headers()` (case-insensitive)

So from your side: **just send `Authorization: Bearer ...`** — it will arrive.

If you're behind a corporate proxy that strips `Authorization`, you'll see `401 missing_authorization`. The workaround on our side (planned) will be an `X-Tara-Key` header fallback. Until then, talk to your network team or use a different egress.

## Key rotation

Rotate when:

- A key was committed to a repo or pasted in a bug report (yes, even private repos).
- A team member leaves.
- You suspect a leak.
- It's been a long time and you're being responsible (every 90 days is a fine default).

Rotation procedure:

1. Generate a new key on `account.php`. Old key is still active.
2. Deploy the new key to your secrets store / env.
3. Watch your usage dashboard — once you see traffic flowing through the new key, revoke the old one.
4. Done.

If you must rotate immediately (active compromise), revoke first and accept ~seconds of 401s while you redeploy.

## What does the server know about you?

Per request, we log:

- The **hash** of your API key (so we can attribute usage to your account)
- Request method, path, status code, response time
- Input tokens, output tokens, tool-call count
- A **hashed** form of your IP (so we can rate-limit and detect abuse — never the plaintext IP)
- Timestamp

We never log:

- Your message content
- The model's reply
- Tool inputs or tool outputs
- Plaintext IPs

Account data (email, project name, use-case description) is kept while your account is active. Account deletion via `/account.php` hard-deletes everything — usage logs, sessions, keys included.

## What if my key gets `401`-ed?

1. Did you put `Bearer ` (with a space) before the key? Common typo: `Authorization: tara_sk_...` — that fails.
2. Was the key revoked? Check `account.php`.
3. Is your account still `approved`? Pending or revoked accounts get `403`, not `401`, but check anyway.
4. Are you sending an empty `Authorization:` header by accident (env var unset)? Print it locally to confirm.
5. If all of the above check out, hit the diag endpoint to see exactly what the server received:

```
https://tara.tratok.com/authdiag.php?token=<TARA_DIAG_TOKEN>
```

(Token is shared with you on request — ask via the contact link on your account page.)

## See also

- [errors.md](errors.md) — full status code reference
- [rate-limits.md](rate-limits.md) — what triggers 429
