---
name: Bug report
about: Something is broken in the API, docs, examples, or SDKs
title: '[Bug] '
labels: bug
assignees: ''
---

## What surface is broken?

- [ ] The API itself (wrong status code, schema mismatch, etc.)
- [ ] Documentation in this repo
- [ ] An example
- [ ] An SDK (Python / JavaScript / PHP)
- [ ] The OpenAPI spec

## What happened?

A clear description of what went wrong.

## What did you expect?

What should have happened instead.

## Reproduction

Smallest possible repro. **Redact your API key** — use `tara_sk_xxx` as a placeholder.

```bash
# example
curl https://tara.tratok.com/api/v1/agent.php \
  -A "Mozilla/5.0" \
  -H "Authorization: Bearer tara_sk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hi"}]}'
```

## Response / error

```
[paste the response, including request_id if present]
```

## Environment

- Language and version: (e.g., Python 3.12, Node 20.10, PHP 8.3)
- SDK version (if applicable):
- OS:
- Time window (UTC) when the issue occurred — helps us cross-reference logs.

## Anything else?

Stack traces, screenshots, related issues, etc.
