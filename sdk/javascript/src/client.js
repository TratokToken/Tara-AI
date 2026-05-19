// TaraClient — JavaScript client for tara.tratok.com/api/v1.

import {
  TaraAuthError,
  TaraError,
  TaraRateLimitError,
  TaraServerError,
  TaraToolError,
  TaraValidationError,
} from "./errors.js";

const DEFAULT_BASE_URL = "https://tara.tratok.com/api/v1";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 5;
const SDK_VERSION = "1.1.0";

export class TaraClient {
  constructor({
    apiKey,
    baseUrl,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    fetchImpl,
  } = {}) {
    apiKey = apiKey ?? (typeof process !== "undefined" ? process.env?.TARA_API_KEY : undefined);
    if (!apiKey) {
      throw new TaraError(
        "No API key. Pass { apiKey } or set TARA_API_KEY in the environment.",
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = timeoutMs;
    this.maxAttempts = maxAttempts;
    this.fetch = fetchImpl ?? globalThis.fetch;
    if (!this.fetch) {
      throw new TaraError("No fetch implementation available (Node 18+ or pass fetchImpl).");
    }
  }

  // ---- /chat -------------------------------------------------------------

  async chat({ message, history, maxTokens = 1024, temperature = 0.7 } = {}) {
    const result = await this.chatRaw({ message, history, maxTokens, temperature });
    return result.reply;
  }

  async chatRaw({ message, history, maxTokens = 1024, temperature = 0.7 } = {}) {
    const body = { message, max_tokens: maxTokens, temperature };
    if (history !== undefined) body.history = history;
    return this._post("/chat.php", body);
  }

  // ---- /agent ------------------------------------------------------------

  async agent({
    messages,
    system,
    tools,
    toolChoice,
    maxTokens = 1024,
    temperature = 0.7,
  } = {}) {
    const body = { messages, max_tokens: maxTokens, temperature };
    if (system !== undefined) body.system = system;
    if (tools !== undefined) body.tools = tools;
    if (toolChoice !== undefined) body.tool_choice = toolChoice;

    const raw = await this._post("/agent.php", body);

    // Convenience properties on the returned object.
    Object.defineProperty(raw, "text", {
      enumerable: false,
      get() {
        return (this.content ?? [])
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("");
      },
    });
    Object.defineProperty(raw, "toolCalls", {
      enumerable: false,
      get() {
        return (this.content ?? []).filter((b) => b.type === "tool_use");
      },
    });
    return raw;
  }

  // ---- agent loop --------------------------------------------------------

  async runAgentLoop({
    userMessage,
    tools,
    toolHandlers,
    system,
    maxTurns = 10,
    raiseOnToolError = false,
    onTurn,
  } = {}) {
    if (!tools || !toolHandlers) {
      throw new TaraError("runAgentLoop requires tools and toolHandlers.");
    }

    const messages = [{ role: "user", content: userMessage }];

    for (let turn = 0; turn < maxTurns; turn++) {
      const response = await this.agent({ messages, system, tools });
      if (onTurn) onTurn(turn, response);

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn" || response.stop_reason === "max_tokens") {
        return response.text;
      }

      if (response.stop_reason === "tool_use") {
        const toolResults = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          const handler = toolHandlers[block.name];
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
            const result = await handler(block.input);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: typeof result === "string" ? result : JSON.stringify(result),
            });
          } catch (e) {
            if (raiseOnToolError) {
              throw new TaraToolError(`Tool '${block.name}' raised: ${e.message}`);
            }
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `Tool error: ${e.message}`,
              is_error: true,
            });
          }
        }
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      throw new TaraError(`Unexpected stop_reason: ${response.stop_reason}`, {
        body: response,
      });
    }

    throw new TaraError(`Agent loop exceeded ${maxTurns} turns.`);
  }

  // ---- internals ---------------------------------------------------------

  async _post(path, body) {
    const url = `${this.baseUrl}${path}`;
    const payload = JSON.stringify(body);

    let lastErr = null;
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      let response;
      try {
        response = await this.fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "User-Agent": `tara-client-js/${SDK_VERSION}`,
          },
          body: payload,
          signal: controller.signal,
        });
      } catch (e) {
        clearTimeout(timer);
        lastErr = e;
        await this._sleepBackoff(attempt);
        continue;
      }
      clearTimeout(timer);

      if (response.status === 429) {
        const retryAfter = this._parseRetryAfter(response);
        if (attempt < this.maxAttempts - 1) {
          await sleep((retryAfter + Math.random() * 0.5) * 1000);
          continue;
        }
        throw await this._makeError(response, { retryAfterSeconds: retryAfter });
      }

      if (response.status >= 500 && response.status < 600) {
        if (attempt < this.maxAttempts - 1) {
          await this._sleepBackoff(attempt);
          continue;
        }
        throw await this._makeError(response);
      }

      if (!response.ok) {
        throw await this._makeError(response);
      }

      try {
        return await response.json();
      } catch (e) {
        throw new TaraError(`Non-JSON response: ${e.message}`, {
          statusCode: response.status,
        });
      }
    }

    throw new TaraError(`Request failed after ${this.maxAttempts} attempts: ${lastErr?.message ?? lastErr}`);
  }

  async _sleepBackoff(attempt) {
    await sleep((2 ** attempt + Math.random()) * 1000);
  }

  _parseRetryAfter(response) {
    const h = response.headers.get?.("Retry-After");
    if (h && /^\d+$/.test(h)) return parseInt(h, 10);
    return 1;
  }

  async _makeError(response, { retryAfterSeconds } = {}) {
    let body, errorType, message, requestId;
    try {
      body = await response.json();
      errorType = body?.error?.type;
      message = body?.error?.message ?? response.statusText;
      requestId = body?.error?.request_id;
    } catch {
      body = await response.text().catch(() => null);
      message = response.statusText;
    }

    const opts = {
      statusCode: response.status,
      errorType,
      requestId,
      body,
    };

    if ([401, 403].includes(response.status)) return new TaraAuthError(message, opts);
    if ([400, 422].includes(response.status)) return new TaraValidationError(message, opts);
    if (response.status === 429) return new TaraRateLimitError(message, { ...opts, retryAfterSeconds });
    if (response.status >= 500) return new TaraServerError(message, opts);
    return new TaraError(message, opts);
  }
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
