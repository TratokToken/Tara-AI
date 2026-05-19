// Full Tara agent loop in Node.js. No deps.
//
// Usage:
//   export TARA_API_KEY=tara_sk_...
//   node agent_loop.mjs "What's the weather in Dubai? And convert 100 USD to AED."

const TARA_API_BASE = "https://tara.tratok.com/api/v1";
const MAX_TURNS = 10;

// ---------- tool implementations ----------

function getWeather({ city }) {
  const data = {
    Dubai: { temp_c: 37, condition: "sunny" },
    "Abu Dhabi": { temp_c: 39, condition: "sunny" },
    London: { temp_c: 18, condition: "cloudy" },
  };
  return data[city] ?? { temp_c: 22, condition: "unknown", note: `no data for ${city}` };
}

function getCurrencyRate({ base, quote }) {
  const rates = {
    "USD/AED": 3.67,
    "AED/USD": 0.272,
    "USD/EUR": 0.92,
  };
  const k = `${base.toUpperCase()}/${quote.toUpperCase()}`;
  const rate = rates[k];
  if (!rate) return { error: `No rate for ${k}` };
  return { base: base.toUpperCase(), quote: quote.toUpperCase(), rate };
}

const tools = [
  {
    name: "get_weather",
    description: "Get current weather for a city. Returns temp_c and condition.",
    input_schema: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
    },
  },
  {
    name: "get_currency_rate",
    description: "Get the current exchange rate between two ISO-4217 currency codes.",
    input_schema: {
      type: "object",
      properties: {
        base: { type: "string" },
        quote: { type: "string" },
      },
      required: ["base", "quote"],
    },
  },
];

const handlers = {
  get_weather: getWeather,
  get_currency_rate: getCurrencyRate,
};

// ---------- HTTP call with simple retry ----------

async function postAgent({ messages, tools, maxAttempts = 5 }) {
  const apiKey = process.env.TARA_API_KEY;
  if (!apiKey) {
    console.error("Set TARA_API_KEY first.");
    process.exit(1);
  }
  const body = JSON.stringify({
    messages,
    tools,
    max_tokens: 1024,
    temperature: 0.7,
  });

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const r = await fetch(`${TARA_API_BASE}/agent.php`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (r.status === 429) {
      const retryAfter = parseInt(r.headers.get("Retry-After") ?? "1", 10);
      await sleep((retryAfter + Math.random() * 0.5) * 1000);
      continue;
    }
    if (r.status >= 500) {
      await sleep((2 ** attempt + Math.random()) * 1000);
      continue;
    }
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    }
    return r.json();
  }
  throw new Error(`Tara /agent failed after ${maxAttempts} attempts`);
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ---------- the loop ----------

async function runAgent(userMessage) {
  const messages = [{ role: "user", content: userMessage }];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    console.log(`\n--- turn ${turn + 1} ---`);
    const response = await postAgent({ messages, tools });

    messages.push({ role: "assistant", content: response.content });

    for (const block of response.content) {
      if (block.type === "text") {
        console.log(`[text] ${block.text}`);
      } else if (block.type === "tool_use") {
        console.log(`[tool_use] ${block.name}(${JSON.stringify(block.input)})`);
      }
    }

    if (response.stop_reason === "end_turn") {
      return response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
    }

    if (response.stop_reason === "tool_use") {
      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const handler = handlers[block.name];
        if (!handler) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Unknown tool: ${block.name}`,
            is_error: true,
          });
          continue;
        }
        try {
          const result = handler(block.input);
          console.log(`[tool_result] ${block.name} -> ${JSON.stringify(result)}`);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        } catch (e) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Tool raised: ${e.message}`,
            is_error: true,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    if (response.stop_reason === "max_tokens") {
      return response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
    }

    throw new Error(`Unexpected stop_reason: ${response.stop_reason}`);
  }

  throw new Error(`Agent loop exceeded ${MAX_TURNS} turns`);
}

const userInput =
  process.argv.slice(2).join(" ") ||
  "What's the weather in Dubai and Abu Dhabi? Also convert 100 USD to AED.";

const final = await runAgent(userInput);
console.log("\n=== final answer ===");
console.log(final);
