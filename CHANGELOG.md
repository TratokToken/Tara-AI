# Changelog

All notable changes to the Tara public API and to this documentation/SDK repo.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

This file tracks **two intermixed things**:

- `API:` — changes to the live API surface at `tara.tratok.com/api/v1/*`.
- `Repo:` — changes to docs, examples, or SDKs in this repository.

---

## [Unreleased]

### Repo
- Initial public release of the documentation, examples, and SDKs.

---

## [1.1.0] — 2026-05-18

### API
- **Added** `/api/v1/agent` — full Anthropic Messages surface (`system`, `messages[]`, `tools[]`, `tool_choice`, multi-block `content`, `tool_use` / `tool_result` round-trip).
- **Added** per-endpoint analytics: `tool_calls` and `endpoint` columns on usage rows.
- **Added** user self-service: password reset (`/forgot_password.php`, `/reset_password.php`) and account deletion (in `/account.php` danger zone, hard-deletes with FK cascade).
- **Added** branded HTML email templates via `tara_email_layout()` (signup ack, approval with key, rejection, password reset, password changed, account deletion).

### Fixed
- Server-side WAF false positives on `/api/v1/*`: `/api/.htaccess` removed to clear `SecRuleEngine not allowed here` 500. Disable now lives in the cPanel ModSecurity UI.

---

## [1.0.0] — 2026-04 (initial public preview)

### API
- **Added** `/api/v1/chat` — simple string-in/string-out chat endpoint.
- **Added** Bearer authentication with `tara_sk_*` keys, admin-approved accounts.
- **Added** per-account daily and per-minute rate limits.
- **Added** privacy-preserving analytics: hashed IPs, request metadata logged but never the message body.

### Server
- Audience routing for travel queries: guest → `tratok.net`, host → `hospitality.tratok.net`.

[Unreleased]: https://github.com/tratok/tara-api/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/tratok/tara-api/releases/tag/v1.1.0
[1.0.0]: https://github.com/tratok/tara-api/releases/tag/v1.0.0
