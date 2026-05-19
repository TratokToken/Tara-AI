# tara-client (JavaScript / Node)

Zero-dependency client for the Tara API. Uses native `fetch` (Node 18+, all modern browsers).

## Install

From this repo:

```bash
npm install ./sdk/javascript
```

Or when published:

```bash
npm install tara-client
```

## Quickstart

```javascript
import { TaraClient } from "tara-client";

const client = new TaraClient({ apiKey: process.env.TARA_API_KEY });

// Simple chat
const reply = await client.chat({ message: "What is Tratok?" });
console.log(reply);

// /agent
const response = await client.agent({
  messages: [{ role: "user", content: "Plan a 3-day trip to Dubai." }],
  system: "Be concise. Use bullet points.",
  maxTokens: 1024,
});
console.log(response.text); // convenience: joined text blocks

// Full agent loop with tools
const final = await client.runAgentLoop({
  userMessage: "What's the weather in Dubai?",
  tools: [
    {
      name: "get_weather",
      description: "Get current weather for a city.",
      input_schema: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
    },
  ],
  toolHandlers: {
    get_weather: ({ city }) => ({ temp_c: 37, condition: "sunny" }),
  },
});
console.log(final);
```

## API

| Method | What |
|---|---|
| `new TaraClient({ apiKey, baseUrl?, timeoutMs?, maxAttempts? })` | Constructor. `apiKey` defaults to `process.env.TARA_API_KEY`. |
| `client.chat({ message, history?, maxTokens?, temperature? })` | Returns reply string. |
| `client.chatRaw({ ... })` | Same but returns the full response object. |
| `client.agent({ messages, system?, tools?, toolChoice?, maxTokens?, temperature? })` | Returns `{ id, role, content, stop_reason, usage, text, toolCalls }`. |
| `client.runAgentLoop({ userMessage, tools, toolHandlers, system?, maxTurns?, onTurn? })` | Runs the loop. Returns final text. |

## Errors

Errors are thrown as instances of `TaraError` (or its subclasses). Useful properties: `.statusCode`, `.errorType`, `.requestId`, `.body`.

| Subclass | When |
|---|---|
| `TaraAuthError` | 401 / 403 |
| `TaraRateLimitError` | 429 (with `.retryAfterSeconds`) |
| `TaraValidationError` | 400 / 422 |
| `TaraServerError` | 5xx |

Auto-retries `429` and `5xx` with exponential backoff.

## Browser use

This package works in browsers too, but **don't ship your API key to a browser**. Build a server-side proxy that injects the key on the way out.
