// Minimal Tara /chat call. No deps — uses Node 18+ native fetch.
//
// Usage:
//   export TARA_API_KEY=tara_sk_...
//   node chat_basic.mjs "What is Tratok?"

const TARA_API_BASE = "https://tara.tratok.com/api/v1";

async function chat(message) {
  const apiKey = process.env.TARA_API_KEY;
  if (!apiKey) {
    console.error("Set TARA_API_KEY in your environment first.");
    process.exit(1);
  }

  const response = await fetch(`${TARA_API_BASE}/chat.php`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      max_tokens: 512,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json();
}

const userInput = process.argv.slice(2).join(" ") || "What is Tratok in one sentence?";
const result = await chat(userInput);

if (!result.ok) {
  console.error(`Error: ${result.error?.message ?? "unknown"}`);
  process.exit(1);
}

console.log(result.reply);
console.log();
console.log(`--- tokens: ${result.usage.total_tokens}`);
