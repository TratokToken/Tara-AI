#!/usr/bin/env bash
#
# Tara /agent with a tool declaration.
# Demonstrates the first half of the agent loop — sending tools, getting back
# a tool_use block. Returning the tool_result requires a second call; this
# script doesn't loop, see examples/python/agent_loop.py for that.
#
# Usage:
#   export TARA_API_KEY=tara_sk_...
#   ./agent-tools.sh

set -euo pipefail

: "${TARA_API_KEY:?Set TARA_API_KEY in your environment first}"

curl --fail-with-body \
  -sS \
  -A "Mozilla/5.0" \
  -H "Authorization: Bearer ${TARA_API_KEY}" \
  -H "Content-Type: application/json" \
  -X POST \
  https://tara.tratok.com/api/v1/agent.php \
  -d '{
    "messages": [
      { "role": "user", "content": "What is the current weather in Dubai?" }
    ],
    "tools": [
      {
        "name": "get_weather",
        "description": "Get the current weather for a city. Returns temperature in celsius and a one-word condition.",
        "input_schema": {
          "type": "object",
          "properties": {
            "city": {
              "type": "string",
              "description": "City name in English, e.g. Dubai"
            }
          },
          "required": ["city"]
        }
      }
    ],
    "max_tokens": 1024
  }' | python -m json.tool 2>/dev/null || cat

# Expected: response contains stop_reason="tool_use" and a tool_use content
# block requesting get_weather(city="Dubai"). To complete the loop you'd post
# back the assistant message + a user message with a tool_result.
