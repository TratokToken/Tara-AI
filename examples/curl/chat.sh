#!/usr/bin/env bash
#
# Minimal Tara /chat call.
# Usage:
#   export TARA_API_KEY=tara_sk_...
#   ./chat.sh "What is Tratok?"
#
# Notes:
#   * -A "Mozilla/5.0" works around the host's WAF, which 406s default curl UAs.
#   * --fail-with-body prints the JSON error and exits non-zero on 4xx/5xx.

set -euo pipefail

: "${TARA_API_KEY:?Set TARA_API_KEY in your environment first}"

MESSAGE="${1:-Hello, Tara!}"

curl --fail-with-body \
  -sS \
  -A "Mozilla/5.0" \
  -H "Authorization: Bearer ${TARA_API_KEY}" \
  -H "Content-Type: application/json" \
  -X POST \
  https://tara.tratok.com/api/v1/chat.php \
  -d "$(cat <<JSON
{
  "message": "${MESSAGE//\"/\\\"}",
  "max_tokens": 512,
  "temperature": 0.7
}
JSON
)" | python -m json.tool 2>/dev/null || cat
