# Contributing

Thanks for your interest. This repo is the **public face of the Tara API** — the docs you'd want when integrating, plus working examples and small SDKs. The Tara server itself is closed-source, so contributions here focus on three things:

1. **Documentation** — clarity fixes, missing edge cases, broken links, typos.
2. **Examples** — new languages, frameworks, or real-world use cases.
3. **SDKs** — bug fixes, new language ports, better error messages.

If you find a bug in the **API itself** (wrong status code, schema mismatch, etc.), please open an issue here — we'll route it to the server team.

---

## Ground rules

- **Don't paste API keys** into issues, PRs, or examples. Use `tara_sk_xxx...` as a placeholder.
- **Don't add tracking, telemetry, or unsolicited dependencies** to examples or SDKs. Keep them minimal — `requests` for Python, `fetch` for JS, curl for PHP. Anyone reading should be able to audit the code in 60 seconds.
- **MIT license** for everything you contribute. By submitting, you agree to license your contribution under [LICENSE](LICENSE).

---

## Workflow

```bash
# 1. Fork and clone
git clone https://github.com/<you>/tara-api.git
cd tara-api

# 2. Create a branch
git checkout -b docs/fix-rate-limit-headers

# 3. Make your changes

# 4. If you changed an example, run it
export TARA_API_KEY=tara_sk_...
python examples/python/chat_basic.py

# 5. Commit and push
git commit -m "docs: clarify 429 response shape"
git push origin docs/fix-rate-limit-headers

# 6. Open a PR
```

---

## Style

### Docs (`docs/*.md`)

- Lead with the answer. Reference material first, prose second.
- Show request and response side-by-side in code blocks.
- Curl examples should include the `-A "Mozilla/5.0"` workaround until the WAF issue is permanently fixed.
- Use the same fictional key `tara_sk_demo_REPLACE_ME` in all examples.

### Code

- Python: PEP 8, type hints on public methods, `requests` stdlib + nothing else.
- JavaScript: ESM, native `fetch`, no transpilation needed.
- PHP: PSR-12, curl + json_encode/decode, PHP 8.0+.
- All examples should run end-to-end with only an env var set: `TARA_API_KEY=tara_sk_...`.

### Commits

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `docs:` documentation only
- `feat:` new example, new SDK feature
- `fix:` bug in an example or SDK
- `chore:` repo hygiene
- `refactor:` no behaviour change

---

## What we won't merge

- PRs that re-license code under something other than MIT.
- Examples that hard-code API keys.
- SDKs that pull in heavy frameworks (Axios is fine, an ORM is not).

---

## Questions

Open a [Discussion](../../discussions) or, for sensitive issues, see [SECURITY.md](SECURITY.md).
