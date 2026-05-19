# Security policy

## Reporting a vulnerability

If you find a security issue in the Tara service, the SDKs in this repo, or the documented behaviour:

**Don't open a public GitHub issue.**

Email **`platform@tratok.net`** with subject `Tara security report` and include:

1. A description of the issue.
2. Steps to reproduce (curl is fine).
3. Impact — what an attacker could do.
4. Any relevant `request_id`s.
5. Your contact for follow-up.

We'll acknowledge within **48 hours** and aim to triage within **5 business days**.

## In scope

- The API at `tara.tratok.com/api/v1/*` — auth bypass, privilege escalation, data leakage.
- The web UI at `tara.tratok.com` — XSS, CSRF, account takeover.
- The SDKs and example code in this repository — credential leakage, unsafe defaults.
- The OpenAPI spec — if it documents an unsafe pattern.

## Out of scope

- **Findings from automated scanners with no proof of impact.** Bring a working PoC.
- **Best-practice complaints with no exploit** (e.g., "you don't pin TLS"). Send a hardening suggestion instead.
- **DoS / volumetric attacks.** Rate limiting is a known mitigation.
- **Self-XSS in the chat UI.** It's anonymous, single-tab, no persistence — there's nothing to steal.

## Coordinated disclosure

We follow a standard 90-day disclosure window:

- Day 0: report received.
- Day 0–14: triage, ack with severity.
- Day 14–80: fix and deploy.
- Day 80–90: coordinate public disclosure with reporter.

Critical issues get faster turnaround.

## Bounties

No formal bounty programme yet. We do publicly credit reporters in the [CHANGELOG](CHANGELOG.md) and on `tara.tratok.com`. For high-impact reports we may send Tratok merchandise or platform credits.

---

Thanks for taking the time to report responsibly.
