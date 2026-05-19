// Minimal Tara /agent call. No deps — Node 18+ native fetch.
//
// Usage:
//   export TARA_API_KEY=tara_sk_...
//   node agent_basic.mjs "Suggest 3 things to do in Dubai in May."

const TARA_API_BASE = "https://tara.tratok.com/api/v1";

async function agent({ messages, system, max_tokens = 1024 }) {
  const apiKey = process.env.TARA_API_KEY;
  if (!apiKey) {
    console.error("Set TARA_API_KEY in your environment first.");
    process.exit(1);
  }

  const body = { messages, max_tokens };
  if (system) body.system = system;

  const response = await fetch(`${TARA_API_BASE}/agent.php`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json();
}

function extractText(response) {
  return (response.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

const userInput =
  process.argv.slice(2).join(" ") || "Suggest 3 things to do in Dubai in May.";

const result = await agent({
  messages: [{ role: "user", content: userInput }],
  system: "Be concise. Use bullet points.",
  max_tokens: 512,
});

console.log(extractText(result));
console.log();
console.log(
  `--- stop_reason=${result.stop_reason}, tokens=${result.usage.total_tokens}`,
);
