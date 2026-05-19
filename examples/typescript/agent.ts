/**
 * Tara /agent loop in TypeScript. No runtime deps — uses Node 18+ native fetch.
 *
 * Run:
 *   npm install
 *   export TARA_API_KEY=tara_sk_...
 *   npm run agent -- "What's the weather in Dubai?"
 */

const TARA_API_BASE = "https://tara.tratok.com/api/v1";
const MAX_TURNS = 10;

// ---------- Types matching the Tara /agent shape ----------

type Role = "user" | "assistant";

interface TextBlock {
  type: "text";
  text: string;
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

interface Message {
  role: Role;
  content: string | ContentBlock[];
}

interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface AgentResponse {
  id: string;
  role: "assistant";
  content: ContentBlock[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

type ToolHandler = (input: Record<string, unknown>) => unknown | Promise<unknown>;

// ---------- Tools ----------

const tools: ToolDef[] = [
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

const handlers: Record<string, ToolHandler> = {
  get_weather: ({ city }) => {
    const data: Record<string, { temp_c: number; condition: string }> = {
      Dubai: { temp_c: 37, condition: "sunny" },
      "Abu Dhabi": { temp_c: 39, condition: "sunny" },
      London: { temp_c: 18, condition: "cloudy" },
    };
    return data[String(city)] ?? { temp_c: 22, condition: "unknown" };
  },

  get_currency_rate: ({ base, quote }) => {
    const rates: Record<string, number> = {
      "USD/AED": 3.67,
      "AED/USD": 0.272,
      "USD/EUR": 0.92,
    };
    const k = `${String(base).toUpperCase()}/${String(quote).toUpperCase()}`;
    return rates[k] ? { base, quote, rate: rates[k] } : { error: `No rate for ${k}` };
  },
};

// ---------- HTTP ----------

async function postAgent(messages: Message[]): Promise<AgentResponse> {
  const apiKey = process.env.TARA_API_KEY;
  if (!apiKey) throw new Error("Set TARA_API_KEY first.");

  const body = JSON.stringify({
    messages,
    tools,
    max_tokens: 1024,
    temperature: 0.7,
  });

  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(`${TARA_API_BASE}/agent.php`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (r.status === 429 || r.status >= 500) {
      const wait = parseInt(r.headers.get("Retry-After") ?? "0", 10) || 2 ** attempt;
      await new Promise((res) => setTimeout(res, (wait + Math.random()) * 1000));
      continue;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    return (await r.json()) as AgentResponse;
  }
  throw new Error("Tara /agent failed after 5 attempts");
}

// ---------- The loop ----------

async function runAgent(userMessage: string): Promise<string> {
  const messages: Message[] = [{ role: "user", content: userMessage }];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    console.log(`\n--- turn ${turn + 1} ---`);
    const response = await postAgent(messages);

    messages.push({ role: "assistant", content: response.content });

    for (const block of response.content) {
      if (block.type === "text") {
        console.log(`[text] ${block.text}`);
      } else if (block.type === "tool_use") {
        console.log(`[tool_use] ${block.name}(${JSON.stringify(block.input)})`);
      }
    }

    if (response.stop_reason === "end_turn" || response.stop_reason === "max_tokens") {
      return response.content
        .filter((b): b is TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
    }

    if (response.stop_reason === "tool_use") {
      const results: ToolResultBlock[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const handler = handlers[block.name];
        if (!handler) {
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Unknown tool: ${block.name}`,
            is_error: true,
          });
          continue;
        }
        try {
          const result = await handler(block.input);
          console.log(`[tool_result] ${block.name} -> ${JSON.stringify(result)}`);
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        } catch (e) {
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Tool raised: ${(e as Error).message}`,
            is_error: true,
          });
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }

    throw new Error(`Unexpected stop_reason: ${response.stop_reason}`);
  }

  throw new Error(`Agent loop exceeded ${MAX_TURNS} turns`);
}

const userInput =
  process.argv.slice(2).join(" ") ||
  "What's the weather in Dubai? Convert 100 USD to AED while you're at it.";

const final = await runAgent(userInput);
console.log("\n=== final answer ===");
console.log(final);
