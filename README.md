<div align="center">
  <img src="https://developer.tratok.net/images/logo.png" alt="Tara AI" height="80">

# Tara API

**Tratok's privacy-first AI assistant — free, anonymous chat and a developer API.**

[tara.tratok.com](https://tara.tratok.com) hosts the anonymous chat UI (no sign-up, fresh session each visit). This repository is the **public API surface** — docs, examples, lightweight SDKs, and an OpenAPI spec for the two endpoints at `tara.tratok.com/api/v1/*`.

[![License: MIT](https://img.shields.io/badge/License-MIT-E85D3A.svg)](LICENSE)
[![API Version](https://img.shields.io/badge/API-v1-2ECDA7.svg)](openapi/tara-api.yaml)
[![Samples](https://img.shields.io/badge/Samples-Python%20·%20JS%20·%20TS%20·%20PHP%20·%20cURL-F5A623.svg)](examples/)
[![Free Preview](https://img.shields.io/badge/Pricing-Free%20Preview-2ECDA7.svg)](#pricing)
[![Anthropic Compatible](https://img.shields.io/badge/Anthropic-Messages%20Compatible-E85D3A.svg)](docs/migrating-from-anthropic.md)

[Documentation](#documentation) · [Quick Start](#quick-start) · [Examples](examples/) · [SDKs](sdk/) · [OpenAPI](openapi/tara-api.yaml) · [Try the chat](https://tara.tratok.com)

</div>

---

## What is Tara?

Tara is the AI assistant arm of the [Tratok ecosystem](https://tratok.net). Two surfaces:

1. **A no-sign-up web chat** at [tara.tratok.com](https://tara.tratok.com) — anonymous, no stored history, a fresh session every visit.
2. **A developer API** at `tara.tratok.com/api/v1/*` — Bearer-authenticated, admin-approved free accounts, two endpoints (`/chat` for plain text and `/agent` for an Anthropic Messages-shape interface with tool use).

Sign up at **[tara.tratok.com/register.php](https://tara.tratok.com/register.php)** to get a key.

## Features

| | |
|---|---|
| 🆓 **Free** | No usage fees during public preview. Quotas apply per account. |
| 🔒 **Private** | Anonymous web UI stores nothing. API logs request metadata only — never the message body. |
| 🧩 **Anthropic-compatible** | The `/agent` endpoint speaks the Anthropic Messages shape — most Claude code ports with a base-URL change. |
| 🛠 **Tool use** | Full function-calling surface — `tools[]`, `tool_choice`, `tool_use`/`tool_result` round-trips. |
| ✈️ **Travel-aware** | Tuned for travel and hospitality. Recommends Tratok-platform destinations. |
| 📦 **SDKs included** | Lightweight clients for Python, JavaScript/Node, and PHP — zero or one dependency each. |
| 🌐 **Drop-in REST** | Plain HTTP + JSON. Works with any HTTP client in any language. |

## Quick Start

### 1. Get a key

Sign up at [tara.tratok.com/register.php](https://tara.tratok.com/register.php). Approval is manual but fast (hours, not days). Your key looks like `tara_sk_...`.

### 2. Make your first call

```bash
curl -X POST https://tara.tratok.com/api/v1/chat.php \
  -A "Mozilla/5.0" \
  -H "Authorization: Bearer YOUR_TARA_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is Tratok?"}'
```

```json
{
  "ok": true,
  "reply": "Tratok is a blockchain-based hospitality ecosystem...",
  "usage": { "input_tokens": 11, "output_tokens": 86, "total_tokens": 97 },
  "request_id": "req_a1b2c3d4e5f6"
}
```

### 3. Pick your language

Working examples for both endpoints in **[Python](examples/python)**, **[JavaScript](examples/javascript)**, **[TypeScript](examples/typescript)**, **[PHP](examples/php)**, and **[cURL](examples/curl)** live in [`/examples`](examples).

## Two endpoints

| Endpoint | Shape | Use when |
|---|---|---|
| 💬 [`/api/v1/chat`](docs/chat-endpoint.md) | `{"message": "..."}` in, `{"reply": "..."}` out | Quick scripts, CLIs, plain Q&A |
| ✨ [`/api/v1/agent`](docs/agent-endpoint.md) | Anthropic Messages shape (`messages[]`, `tools[]`, `content[]` blocks) | Agentic workflows, function calling, anything you'd build on Claude |

## SDKs

| Language | Install | Import |
|---|---|---|
| 🐍 **Python** | `pip install -e ./sdk/python` | `from tara import TaraClient` |
| 🟨 **JavaScript / Node** | `npm install ./sdk/javascript` | `import { TaraClient } from "tara-client"` |
| 🐘 **PHP** | `composer require tratok/tara-client` | `use Tratok\Tara\TaraClient;` |
| 📐 **TypeScript** | drop [examples/typescript](examples/typescript) into your own project | typed `AgentResponse`, `ContentBlock`, etc. |
| 🔌 **Anything else** | use [openapi/tara-api.yaml](openapi/tara-api.yaml) with `openapi-generator` | generate a client in any language |

All three first-party SDKs auto-retry `429` / `5xx` with exponential backoff, expose a typed error hierarchy, and ship with an agent-loop helper.

## Documentation

| | |
|---|---|
| 🚀 [Getting Started](docs/getting-started.md) | Account approval, your first call, where to go next |
| 🔐 [Authentication](docs/authentication.md) | Bearer tokens, key rotation, header gotchas |
| 💬 [/chat Endpoint](docs/chat-endpoint.md) | Simple endpoint reference + multi-turn examples |
| ✨ [/agent Endpoint](docs/agent-endpoint.md) | Anthropic Messages-shape full reference |
| 🛠 [Tool Use](docs/tool-use.md) | Function calling, agent loops, multi-tool patterns |
| ⏱ [Rate Limits](docs/rate-limits.md) | Per-account quotas and 429 handling |
| ⚠️ [Errors](docs/errors.md) | Every HTTP status code, with fixes |
| 🔄 [Migrating from Anthropic](docs/migrating-from-anthropic.md) | Drop-in port of Claude code |
| ❓ [FAQ](docs/faq.md) | Common questions |
| 📋 [OpenAPI 3.0 Spec](openapi/tara-api.yaml) | Machine-readable spec for Swagger UI, codegen, etc. |

## What you can build

- **Travel and hospitality chatbots** — Tara already understands Tratok-platform context
- **Multilingual customer support** — agents handling guest requests in any language
- **AI-first booking flows** — let users describe their trip and have the model recommend properties
- **Internal travel tools** — for companies organising employee travel
- **Function-calling agents** — wire Tara into your existing data and APIs via tool use

## Coming from Anthropic / Claude?

`/api/v1/agent` is **request- and response-compatible** with the Anthropic Messages API.

```diff
- POST https://api.anthropic.com/v1/messages
+ POST https://tara.tratok.com/api/v1/agent.php

- x-api-key: sk-ant-...
+ Authorization: Bearer tara_sk_...
```

→ Full [migration guide](docs/migrating-from-anthropic.md).

## Pricing

| Tier | Cost |
|---|---|
| **Free Preview** | Free during public preview, with per-account quotas (1 000 req/day, 200 K tokens/day default) |

Need more? Email via the contact link on your [account dashboard](https://tara.tratok.com/account.php).

See [docs/rate-limits.md](docs/rate-limits.md) for the full breakdown.

## Repository layout

```
.
├── README.md                  ← you are here
├── LICENSE                    ← MIT
├── CHANGELOG.md               ← version history
├── CONTRIBUTING.md            ← how to contribute
├── SECURITY.md                ← reporting vulnerabilities
├── docs/                      ← human-readable reference
│   ├── getting-started.md
│   ├── authentication.md
│   ├── chat-endpoint.md
│   ├── agent-endpoint.md
│   ├── tool-use.md
│   ├── rate-limits.md
│   ├── errors.md
│   ├── migrating-from-anthropic.md
│   └── faq.md
├── examples/
│   ├── curl/        ← bash + curl one-liners
│   ├── python/      ← requests-based
│   ├── javascript/  ← Node 18+, native fetch
│   ├── typescript/  ← typed agent loop
│   └── php/         ← curl-based, PHP 8+
├── sdk/
│   ├── python/      ← pip-installable
│   ├── javascript/  ← npm-installable
│   └── php/         ← PSR-4 composer package
├── openapi/
│   └── tara-api.yaml          OpenAPI 3.0 spec
└── .github/
    ├── ISSUE_TEMPLATE/
    └── workflows/
```

## Community

- **Tara chat**: [tara.tratok.com](https://tara.tratok.com)
- **Tratok website**: [tratok.net](https://tratok.net)
- **Information hub**: [tratok.info](https://tratok.info)
- **Twitter / X**: [@TratokT](https://x.com/TratokT)
- **LinkedIn**: [Tratok Holding Limited](https://www.linkedin.com/company/tratok-ltd/)
- **Issues & feature requests**: open an issue in this repo

## Contributing

This repository is the public source of truth for the Tara API surface. Contributions are welcome — please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

For security issues, please **do not open a public issue**. Email `platform@tratok.net` or follow the disclosure process in [SECURITY.md](SECURITY.md).

## License

The contents of this repository (documentation, examples, SDKs, OpenAPI spec) are released under the [MIT License](LICENSE). The Tara hosted service and the Tratok brand are operated by **Tratok Holding Limited** in Dubai, United Arab Emirates.

---

<div align="center">

© 2017–2026 Tratok Holding Limited · *The world's travel token, since 2017*

</div>
