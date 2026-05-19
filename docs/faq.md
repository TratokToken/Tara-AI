# FAQ

## General

### What is Tara?

Tara is Tratok's free, privacy-first AI assistant. Two surfaces: a no-signup web chat at <https://tara.tratok.com>, and a Bearer-authenticated developer API at `tara.tratok.com/api/v1/*` (this is what these docs cover).

### Is it really free?

Yes — during the public preview. Each account has [quotas](rate-limits.md) (default 1,000 requests / 200K tokens per day). Need more? Ask via the contact link on your account page.

### What model does it use?

Tara is "Tara made by Tratok." The model is server-managed and we don't disclose it via the API.

### Why is it free?

Tara is offered as a free service to support the Tratok travel and hospitality ecosystem.

---

## Getting access

### How long does account approval take?

Hours, usually. Manual review by a human. The bottleneck is timezone, not volume.

### Can I resubmit if I'm rejected?

Yes. Common rejection reasons:

- Throwaway email address — use a work or persistent personal email.
- Use-case description was empty or "test." Give us a sentence about what you're building.
- Suspected duplicate account.

Fix the issue and re-register.

### Can I get multiple API keys?

Yes — generate as many as you want from `account.php`. They share your account's quota. Useful for separating dev / staging / prod.

### How do I delete my account?

Go to `account.php` → "Danger zone" → delete. This is a **hard delete with FK cascade**: keys, usage logs, sessions all go. No undo.

---

## Endpoints

### What's the difference between `/chat` and `/agent`?

| | `/chat` | `/agent` |
|---|---|---|
| Request | `{"message": "..."}` | Anthropic Messages shape |
| Response | `{"reply": "..."}` | `{"content": [...]}` |
| Tool use | ❌ | ✅ |
| Custom system prompt | ❌ | ✅ (appended) |
| Multi-block content | ❌ | ✅ |

`/chat` for simple use cases, `/agent` for everything else. They share a quota.

### Can I stream responses?

**No.** Both endpoints are atomic. The web UI fakes streaming on the client side. See [chat-endpoint.md#streaming](chat-endpoint.md#streaming).

### Why isn't streaming supported?

The upstream model returns an empty body when we ask for streaming, so we send `stream: false` upstream and pseudo-stream on our own front-end where needed. The API surface stays simple — atomic in, atomic out.

### Can I send images?

Not yet. Vision is on the planned list.

### Can I upload files?

No file API. Workarounds:

- Extract text and pass it in `messages` (cap at ~30K input tokens).
- Compute the answer on your side and put the result in `messages`.

---

## Tool use

### Can the model call any function I define?

The model can call **tools you declare in `tools[]`**. It can't reach into your codebase or your filesystem. You execute the call locally with the args the model provides and return a result.

### Can multiple tools fire in parallel?

Yes — one response can contain multiple `tool_use` blocks. Run them however you like, return one `tool_result` per `tool_use_id` in your next message. See [tool-use.md](tool-use.md).

### What's the max number of tools I can declare?

Soft limit: ~20. Beyond that the model gets confused. Prefer fewer, well-named tools.

### Can tools be async / long-running?

The API call to Tara is synchronous. If your tool is slow, your client just blocks longer. Recommended max per tool: 30 s. If a tool takes longer, return a "started" status and have the model poll or check back next turn.

---

## Errors

### I'm getting 406 from curl.

Add `-A "Mozilla/5.0"`. See [errors.md#406-not-acceptable](errors.md#406-not-acceptable). The host's WAF blocks the default curl UA.

### I'm getting 401 even though my key is correct.

Most common: missing the literal `Bearer ` prefix (with the space):

```
Authorization: Bearer tara_sk_...    ✅
Authorization: tara_sk_...           ❌  → 401 invalid_authorization
```

If that's not it, hit `/authdiag.php?token=...` to confirm the server is seeing your header.

### I'm getting 403 account_pending — but it's been a while.

Check your spam folder for the approval email. If it's been over 24 hours, re-register or email support via the contact link on `register.php`.

### How do I retry on 5xx?

Exponential backoff with jitter, max 5 attempts. See [errors.md#500-502-503-504](errors.md#500--502--503--504).

---

## Customisation

### Can I customise Tara's persona for my app?

You can add to the system prompt via the top-level `system` field on `/agent`:

```jsonc
{
  "system": "You are 'Aria', a luxury yacht concierge in Dubai. Speak formally.",
  "messages": [...]
}
```

---

## Privacy & data

### Does Tara store my users' messages?

**No.** The API logs request metadata only — timestamp, hashed API key, token counts, status code. Never message content or model output.

### Does Tara log my API key in plaintext?

No. The server stores `SHA-256(key)`. On every request the incoming key is hashed and compared.

### Where is the data hosted?

UAE-based cPanel shared hosting as of this writing. Confirm with us if you're building something regulated and need data residency guarantees.

### Is this GDPR/CCPA compliant?

Reasonable best-effort. We don't store user-identifying content. Account data (your email, project name) is hard-deletable from `account.php`. For specific compliance questions, email support.

---

## Pricing & roadmap

### Will it stay free?

Public preview is free. Long-term we may introduce paid tiers for higher quotas, but the free tier is intended to remain. We'll announce changes well in advance via the email on your account.

### What's on the roadmap?

Visible items:

- Vision (image input)
- Optional streaming (when upstream supports it)
- `X-Tara-Key` header fallback for environments that strip `Authorization`
- A rate-limit dashboard for high-volume customers
- Tool-call analytics per account

Subscribe to the [CHANGELOG](../CHANGELOG.md) (or watch this repo) for updates.

---

## Misc

### Can I self-host Tara?

No — the server code is closed-source. Tara is offered as a hosted service only. This repo licenses the docs, examples, and clients.

### Can I use the SDKs against my own model?

You can technically point them at any compatible endpoint (the Python and JS clients accept a `base_url`). They're written generically; we make no promises that pointing them elsewhere will keep working.

### Where do I report bugs?

- **API bug** (wrong status code, schema mismatch, etc.): open an issue here with the `request_id`.
- **Docs / SDK bug**: open an issue here.
- **Security issue**: see [SECURITY.md](../SECURITY.md) — don't open a public issue.

### How do I contribute?

See [CONTRIBUTING.md](../CONTRIBUTING.md).
