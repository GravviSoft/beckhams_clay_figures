#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/safe_env.sh"
test_file="$(mktemp)"
trap 'rm -f "$test_file"' EXIT
printf '%s\n' 'AUTOMATION_FAILURE_DISCORD_WEBHOOK_URL=https://example.invalid/hook' 'UNSAFE=value' > "$test_file"
[[ "$(safe_env_read "$test_file" AUTOMATION_FAILURE_DISCORD_WEBHOOK_URL)" == "https://example.invalid/hook" ]]
! safe_env_read "$test_file" UNSAFE >/dev/null 2>&1

