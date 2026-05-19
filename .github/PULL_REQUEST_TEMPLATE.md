## Summary

<!-- 1–3 lines describing what this PR does and why. -->

## Type of change

- [ ] Documentation fix or addition
- [ ] New example
- [ ] SDK bug fix
- [ ] SDK feature
- [ ] OpenAPI spec correction
- [ ] CI / repo hygiene
- [ ] Something else

## Checklist

- [ ] I've read [CONTRIBUTING.md](../CONTRIBUTING.md).
- [ ] No API keys, secrets, or production hostnames in any diff.
- [ ] If I touched an example, it runs end-to-end with only `TARA_API_KEY` set.
- [ ] If I touched an SDK, the existing examples still work against it.
- [ ] If I touched docs, links resolve and code blocks are valid.
- [ ] Commit messages follow Conventional Commits (`docs:`, `feat:`, `fix:`, etc.).

## How to verify

<!-- Concrete steps a reviewer can run -->

```
# example
cd examples/python
pip install -r requirements.txt
python chat_basic.py "Hello"
```

## Related issues

<!-- Closes #123, refs #456 -->
