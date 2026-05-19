// Tara /agent with a tool declaration (one round, no loop).
// See agent_loop.mjs for the full back-and-forth.

const TARA_API_BASE = "https://tara.tratok.com/api/v1";

const tools = [
  {
    name: "get_weather",
    description:
      "Get the current weather for a city. Returns temperature in celsius and a one-word condition.",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name in English." },
      },
      required: ["city"],
    },
  },
];

async function main() {
  const apiKey = process.env.TARA_API_KEY;
  if (!apiKey) {
    console.error("Set TARA_API_KEY in your environment first.");
    process.exit(1);
  }

  const r = await fetch(`${TARA_API_BASE}/agent.php`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: "What's the weather like in Dubai?" }],
      tools,
      max_tokens: 1024,
    }),
  });

  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  const result = await r.json();
  console.log(JSON.stringify(result, null, 2));
  console.log(`\n--- stop_reason=${result.stop_reason}`);
}

await main();
