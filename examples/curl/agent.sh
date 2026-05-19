#!/usr/bin/env bash
#
# Minimal Tara /agent call (Anthropic Messages shape, no tools).
# Usage:
#   export TARA_API_KEY=tara_sk_...
#   ./agent.sh "Suggest 3 things to do in Dubai in May."

set -euo pipefail

: "${TARA_API_KEY:?Set TARA_API_KEY in your environment first}"

USER_MESSAGE="${1:-Suggest 3 things to do in Dubai in May.}"

curl --fail-with-body \
  -sS \
  -A "Mozilla/5.0" \
  -H "Authorization: Bearer ${TARA_API_KEY}" \
  -H "Content-Type: application/json" \
  -X POST \
  https://tara.tratok.com/api/v1/agent.php \
  -d "$(cat <<JSON
{
  "messages": [
    { "role": "user", "content": "${USER_MESSAGE//\"/\\\"}" }
  ],
  "max_tokens": 1024,
  "temperature": 0.7,
  "system": "Be concise. Use bullet points."
}
JSON
)" | python -m json.tool 2>/dev/null || cat
