# Tool use (a.k.a. function calling)

Tools let Tara call into your code. The model can't actually run anything — it returns a *request* to call a function. You execute it, return the result, and the model continues with the new information.

This guide walks through the full lifecycle. Endpoint reference is in [agent-endpoint.md](agent-endpoint.md).

> Tool use is **only** on `/api/v1/agent`. `/api/v1/chat` has no tool surface.

---

## The mental model

```
You          Tara/API           Your tool
 |              |                   |
 |----req----->|                   |
 |   (msg + tools)                 |
 |              |                   |
 |<--res-------|                   |
 | stop_reason=tool_use            |
 | content=[..., tool_use{name,id,input}]
 |              |                   |
 |--------- run locally ---------->|
 |              |                   |
 |<------- result -----------------|
 |              |                   |
 |----req----->|                   |
 | (msg + assistant.last + tool_result)
 |              |                   |
 |<--res-------|                   |
 | stop_reason=end_turn            |
 | content=[text{...}]             |
```

It's a loop. The model can call multiple tools per turn, and across many turns, before it's satisfied.

## Defining a tool

```json
{
  "name": "get_weather",
  "description": "Get the current weather for a city. Returns temperature in °C and a one-word condition (sunny/cloudy/rainy/snowy).",
  "input_schema": {
    "type": "object",
    "properties": {
      "city": {
        "type": "string",
        "description": "City name in English, e.g. 'Dubai', 'New York'."
      },
      "units": {
        "type": "string",
        "enum": ["c", "f"],
        "default": "c"
      }
    },
    "required": ["city"]
  }
}
```

### Rules

- **`name`** must match `^[a-zA-Z0-9_-]{1,64}$`.
- **`description`** is what the model reads. Write it like the docstring of a function — clear, mentions edge cases, says what the tool returns.
- **`input_schema`** is JSON Schema. Stick to a Draft 7 subset: `type`, `properties`, `required`, `enum`, `default`, nested `object`/`array`. Avoid `$ref` and `oneOf` — the model handles them poorly.

## A complete request with tools

```jsonc
{
  "messages": [
    { "role": "user", "content": "What's the weather like in Dubai right now?" }
  ],
  "tools": [
    {
      "name": "get_weather",
      "description": "Get the current weather for a city. Returns temperature in °C and condition.",
      "input_schema": {
        "type": "object",
        "properties": {
          "city": { "type": "string" }
        },
        "required": ["city"]
      }
    }
  ],
  "max_tokens": 1024
}
```

## What Tara returns when she calls a tool

```jsonc
{
  "id": "msg_abc123",
  "role": "assistant",
  "content": [
    { "type": "text", "text": "Let me check the weather for you." },
    {
      "type": "tool_use",
      "id": "toolu_xyz789",
      "name": "get_weather",
      "input": { "city": "Dubai" }
    }
  ],
  "stop_reason": "tool_use",
  "usage": { "input_tokens": 124, "output_tokens": 38, "total_tokens": 162 }
}
```

Key things:

- `stop_reason` is `"tool_use"` (not `"end_turn"`). **You're not done — call again.**
- The `tool_use` block has an `id`. **Save it.** You need it in the response.
- `input` is the model's arguments, schema-validated against `input_schema`.
- There may be multiple `tool_use` blocks in one response (parallel tool calls).

## Returning a tool result

After running your tool locally, build the next request:

```jsonc
{
  "messages": [
    { "role": "user", "content": "What's the weather like in Dubai right now?" },

    // The assistant's previous response, verbatim.
    {
      "role": "assistant",
      "content": [
        { "type": "text", "text": "Let me check the weather for you." },
        {
          "type": "tool_use",
          "id": "toolu_xyz789",
          "name": "get_weather",
          "input": { "city": "Dubai" }
        }
      ]
    },

    // Your tool result. Role is "user" (not "tool" — this matches Anthropic).
    {
      "role": "user",
      "content": [
        {
          "type": "tool_result",
          "tool_use_id": "toolu_xyz789",
          "content": "{\"temp_c\": 37, \"condition\": \"sunny\"}"
        }
      ]
    }
  ],
  "tools": [/* same tools as before */],
  "max_tokens": 1024
}
```

### Tool result rules

- `role` is `"user"`. (Anthropic style — there is no `"tool"` role.)
- `tool_use_id` must match the `id` from the assistant's `tool_use` block.
- `content` is a **string** (your serialized result). JSON-encode complex data.
- Multiple results in one user message? Multiple `tool_result` blocks in the same `content` array — one per `tool_use_id`.
- `tool_result` can include an `is_error: true` flag to signal the tool failed.

```jsonc
{
  "type": "tool_result",
  "tool_use_id": "toolu_xyz789",
  "content": "Could not reach weather provider: timeout.",
  "is_error": true
}
```

## The agent loop in code

Python version (see [examples/python/agent_loop.py](../examples/python/agent_loop.py) for runnable code):

```python
def run_agent(user_message, tools, tool_handlers, max_turns=10):
    messages = [{"role": "user", "content": user_message}]

    for _ in range(max_turns):
        response = post_agent(messages=messages, tools=tools)

        # Always append the assistant turn to history
        messages.append({"role": "assistant", "content": response["content"]})

        # If the model is done, return its text
        if response["stop_reason"] == "end_turn":
            return "".join(
                block["text"] for block in response["content"]
                if block["type"] == "text"
            )

        # Otherwise execute any tool_use blocks and append the results
        if response["stop_reason"] == "tool_use":
            tool_results = []
            for block in response["content"]:
                if block["type"] != "tool_use":
                    continue
                try:
                    result = tool_handlers[block["name"]](**block["input"])
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block["id"],
                        "content": json.dumps(result),
                    })
                except Exception as e:
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block["id"],
                        "content": f"Tool error: {e}",
                        "is_error": True,
                    })
            messages.append({"role": "user", "content": tool_results})
            continue

        raise RuntimeError(f"Unexpected stop_reason: {response['stop_reason']}")

    raise RuntimeError("Agent loop exceeded max_turns")
```

## Forcing tool use

```jsonc
// Auto: model decides (default)
{ "tool_choice": { "type": "auto" } }

// Any: force the model to call SOME tool
{ "tool_choice": { "type": "any" } }

// None: prohibit tool calls (useful for asking for a final summary)
{ "tool_choice": { "type": "none" } }

// Tool: force a specific one
{ "tool_choice": { "type": "tool", "name": "get_weather" } }
```

## Multiple tools, parallel calls

The model can return multiple `tool_use` blocks in one turn. Run them in any order (in parallel, if you like) and return one `tool_result` per `tool_use_id`:

```jsonc
{
  "role": "assistant",
  "content": [
    { "type": "tool_use", "id": "toolu_1", "name": "get_weather", "input": { "city": "Dubai" } },
    { "type": "tool_use", "id": "toolu_2", "name": "get_weather", "input": { "city": "Abu Dhabi" } }
  ]
}
```

Your next message:

```jsonc
{
  "role": "user",
  "content": [
    { "type": "tool_result", "tool_use_id": "toolu_1", "content": "{\"temp_c\":37,\"condition\":\"sunny\"}" },
    { "type": "tool_result", "tool_use_id": "toolu_2", "content": "{\"temp_c\":39,\"condition\":\"sunny\"}" }
  ]
}
```

## Tips & gotchas

1. **Cap your loop.** Always `max_turns` (we recommend 10). A buggy tool can spiral.
2. **Validate inputs.** The schema is enforced loosely. Treat tool inputs as untrusted — validate before executing.
3. **Return strings, not objects.** `tool_result.content` must be a string. `json.dumps()` your structured data.
4. **Stick to one task per tool.** Tools that do many things confuse the model. Prefer many narrow tools over one wide one.
5. **Idempotency.** If your tool has side effects (sending email, charging a card), make sure repeated calls with the same args don't double-act. The model may retry on errors.
6. **Errors are normal.** Return `is_error: true` with a human-readable message. The model will adapt — often by trying with different arguments.
7. **Don't put secrets in `input_schema.description`.** It gets sent to the model and may surface in `tool_use.input`.

## See also

- [agent-endpoint.md](agent-endpoint.md) — full request/response reference
- [examples/python/agent_tools.py](../examples/python/agent_tools.py) — minimal single-tool example
- [examples/python/agent_loop.py](../examples/python/agent_loop.py) — full multi-turn loop
- [examples/typescript/agent.ts](../examples/typescript/agent.ts) — typed agent loop
