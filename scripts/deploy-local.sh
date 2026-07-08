#!/usr/bin/env bash
set -euo pipefail

ALIAS="${1:-${EDGESPARK_ALIAS:-newapi}}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_SCRIPT="$ROOT_DIR/scripts/deploy-edgespark.sh"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1"
    exit 1
  }
}

require_cmd python3
require_cmd mktemp

CLOUD_CMD=""
if command -v bloome >/dev/null 2>&1; then
  CLOUD_CMD="bloome"
elif command -v bloome-cli >/dev/null 2>&1; then
  CLOUD_CMD="bloome-cli"
fi
: "${CLOUD_CMD:?cloud CLI not found}"

: "${EDGESPARK_SECRET_NAME:?Missing EDGESPARK_SECRET_NAME, for example EDGESPARK_API_KEY__GATEWAY_20260523__2ED11CE1}"
: "${RESON_LLM_API_KEY:?Missing RESON_LLM_API_KEY}"
: "${CLIENT_API_KEY:?Missing CLIENT_API_KEY; ask the user for this value, do not generate it locally}"

HOT_DEPLOY_ONLY="${HOT_DEPLOY_ONLY:-0}"
SKIP_PULL="${SKIP_PULL:-0}"
EDGESPARK_PROJECT_ENVIRONMENT="${EDGESPARK_PROJECT_ENVIRONMENT:-production}"

PROVIDER_KEY_FILE="$(mktemp "${TMPDIR:-/tmp}/newapi-provider-key.XXXXXX")"
CLIENT_KEY_FILE="$(mktemp "${TMPDIR:-/tmp}/newapi-client-key.XXXXXX")"

cleanup() {
  rm -f "$PROVIDER_KEY_FILE" "$CLIENT_KEY_FILE"
}
trap cleanup EXIT

printf "%s" "$RESON_LLM_API_KEY" >"$PROVIDER_KEY_FILE"
printf "%s" "$CLIENT_API_KEY" >"$CLIENT_KEY_FILE"
chmod 600 "$PROVIDER_KEY_FILE" "$CLIENT_KEY_FILE" 2>/dev/null || true

echo "==> Deploying $ALIAS through cloud secret call"
"$CLOUD_CMD" secret call "$EDGESPARK_SECRET_NAME" -- bash -c '
  set -euo pipefail
  ALIAS="$1"
  DEPLOY_SCRIPT="$2"
  SECRET_NAME="$3"
  PROVIDER_KEY_FILE="$4"
  CLIENT_KEY_FILE="$5"
  HOT_DEPLOY_ONLY_VALUE="$6"
  SKIP_PULL_VALUE="$7"
  PROJECT_ENV="$8"

  EDGESPARK_API_KEY_VALUE="$(printenv "$SECRET_NAME" || true)"
  if [[ -z "$EDGESPARK_API_KEY_VALUE" ]]; then
    echo "Missing injected EdgeSpark secret env: $SECRET_NAME"
    exit 1
  fi

  export EDGESPARK_API_KEY="$EDGESPARK_API_KEY_VALUE"
  export EDGESPARK_PROJECT_ENVIRONMENT="$PROJECT_ENV"
  export HOT_DEPLOY_ONLY="$HOT_DEPLOY_ONLY_VALUE"
  export SKIP_PULL="$SKIP_PULL_VALUE"
  export PROVIDER_API_KEY="$(cat "$PROVIDER_KEY_FILE")"
  export CLIENT_API_KEY="$(cat "$CLIENT_KEY_FILE")"
  bash "$DEPLOY_SCRIPT" "$ALIAS"
' _ "$ALIAS" "$DEPLOY_SCRIPT" "$EDGESPARK_SECRET_NAME" "$PROVIDER_KEY_FILE" "$CLIENT_KEY_FILE" "$HOT_DEPLOY_ONLY" "$SKIP_PULL" "$EDGESPARK_PROJECT_ENVIRONMENT"

if [[ -z "${BASE_URL:-}" ]]; then
  echo "==> Skipping post-deploy verification; set BASE_URL to enable it"
  exit 0
fi

require_cmd curl

echo "==> Post-deploy verification"
curl -fsS "$BASE_URL/health" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("status")=="ok", d; print("Health OK")'

curl -fsS -X POST "$BASE_URL/chat/completions" \
  -H "Authorization: Bearer $CLIENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"kimi-k2.6","messages":[{"role":"user","content":"Say hi"}],"max_tokens":8}' \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("choices"), d; print("Chat OK")'
