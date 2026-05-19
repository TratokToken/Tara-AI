# SDKs

Lightweight client libraries for the Tara API. Each one wraps the two endpoints (`/chat` and `/agent`) plus an agent-loop helper.

| Path | Install | Import |
|---|---|---|
| [`python/`](python/) | `pip install -e ./sdk/python` | `from tara import TaraClient` |
| [`javascript/`](javascript/) | `npm install ./sdk/javascript` | `import { TaraClient } from "tara-client"` |
| [`php/`](php/) | `composer require tratok/tara-client` (when published — for now, vendor manually) | `use Tratok\Tara\TaraClient;` |

All three follow the same shape:

```python
client = TaraClient(api_key="tara_sk_...")  # or read from env
reply  = client.chat("Hello!")
agent  = client.agent(messages=[...], tools=[...])
final  = client.run_agent_loop(user_message="...", tools=[...], tool_handlers={...})
```

Zero runtime dependencies. The Python client uses `requests` (already a near-universal install); the JS client uses native `fetch`; the PHP client uses curl.
