# Examples

Runnable code, one folder per language. Every example assumes `TARA_API_KEY` is set:

```bash
export TARA_API_KEY=tara_sk_demo_REPLACE_ME
```

| Folder | What's inside |
|---|---|
| [`curl/`](curl/) | Bash + curl one-liners. `chat.sh`, `agent.sh`, `agent-tools.sh`. |
| [`python/`](python/) | `requests`-based. Basic chat, multi-turn, agent, agent + tools, full agent loop. |
| [`javascript/`](javascript/) | Node 18+ with native `fetch`. ESM. |
| [`typescript/`](typescript/) | Typed agent loop with tools. |
| [`php/`](php/) | curl-based, PHP 8+. |

If you want a ready-made client instead of bare HTTP, see [`../sdk/`](../sdk/).
