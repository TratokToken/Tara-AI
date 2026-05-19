# Getting started

Five minutes from zero to a working API call.

## 1. Create an account

Go to **<https://tara.tratok.com/register.php>** and submit:

- Email address (must be reachable — that's where your approval mail goes)
- Project name (one line — "what are you building?")
- Use-case description (a paragraph is fine)

Accounts start in `pending` status. **Approval is manual** but usually fast (hours, not days). You'll get an email when your account flips to `approved` — that mail contains your first API key.

> If you don't see the approval mail within 24 hours, check your spam folder. The sender is `platform@tratok.net`.

## 2. Find your API key

Already approved? Your key lives on **<https://tara.tratok.com/account.php>**.

Keys look like:

```
tara_sk_<32 hex chars>
```

You can have **multiple keys per account** — useful for separating dev / staging / prod. Revoking a key is instant; revoked keys come back as `401`.

> Treat keys like passwords. Don't commit them, don't paste them into bug reports, and rotate them if exposed.

## 3. Set the key in your environment

```bash
# macOS / Linux
export TARA_API_KEY=tara_sk_demo_REPLACE_ME

# Windows PowerShell
$env:TARA_API_KEY = "tara_sk_demo_REPLACE_ME"

# Windows CMD
set TARA_API_KEY=tara_sk_demo_REPLACE_ME
```

For Python projects use a `.env` file (and don't commit it):

```bash
# .env
TARA_API_KEY=tara_sk_demo_REPLACE_ME
```

## 4. Make your first request

The simplest possible call — the `/chat` endpoint:

```bash
curl https://tara.tratok.com/api/v1/chat.php \
  -A "Mozilla/5.0" \
  -H "Authorization: Bearer $TARA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello, Tara!"}'
```

You should get back something like:

```json
{
  "ok": true,
  "reply": "Hi! I'm Tara, an AI assistant made by Tratok...",
  "usage": {
    "input_tokens": 11,
    "output_tokens": 24,
    "total_tokens": 35
  }
}
```

> ⚠️ **About `-A "Mozilla/5.0"`:** The host's WAF currently blocks the default `curl/7.x` user-agent (returns HTTP 406). The Mozilla UA flag is a temporary workaround. Most language HTTP clients (Python `requests`, Node `fetch`, PHP curl) set a non-curl UA by default and work fine.

## 5. Try the agent endpoint

For anything beyond simple chat — multi-turn conversations, tool use, function calling — use `/api/v1/agent`:

```bash
curl https://tara.tratok.com/api/v1/agent.php \
  -A "Mozilla/5.0" \
  -H "Authorization: Bearer $TARA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Suggest 3 things to do in Dubai in May."}
    ],
    "max_tokens": 512
  }'
```

→ Full reference: [docs/agent-endpoint.md](agent-endpoint.md)

## 6. Pick a language

| Language | Start here |
|---|---|
| Python | [examples/python/chat_basic.py](../examples/python/chat_basic.py) |
| Node.js | [examples/javascript/chat_basic.mjs](../examples/javascript/chat_basic.mjs) |
| TypeScript | [examples/typescript/agent.ts](../examples/typescript/agent.ts) |
| PHP | [examples/php/chat_basic.php](../examples/php/chat_basic.php) |
| Other | [openapi/tara-api.yaml](../openapi/tara-api.yaml) → use `openapi-generator` |

Or grab a lightweight SDK:

| | Install | Import |
|---|---|---|
| Python | `pip install -e ./sdk/python` | `from tara import TaraClient` |
| JS | `npm install ./sdk/javascript` | `import { TaraClient } from 'tara-client'` |
| PHP | `composer require tratok/tara-client` (when published) | `use Tratok\Tara\TaraClient;` |

## Where to go next

- [Authentication](authentication.md) — Bearer tokens, header fallbacks, key rotation
- [/chat endpoint](chat-endpoint.md) — full reference, request/response schema
- [/agent endpoint](agent-endpoint.md) — Anthropic-shape Messages API
- [Tool use](tool-use.md) — function calling, agent loops
- [Rate limits](rate-limits.md) — quotas, 429 handling
- [Errors](errors.md) — every status code and what to do about it
- [Migrating from Anthropic](migrating-from-anthropic.md) — porting Claude code
- [FAQ](faq.md)
