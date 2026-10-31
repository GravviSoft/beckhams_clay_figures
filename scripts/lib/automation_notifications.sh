#!/usr/bin/env bash

notify_automation_failure() {
  local job="$1" stage="$2" exit_code="$3" log_path="$4" env_file="$5"
  local webhook payload
  webhook="${AUTOMATION_FAILURE_DISCORD_WEBHOOK_URL:-}"
  if [[ -z "$webhook" ]]; then webhook="$(safe_env_read "$env_file" AUTOMATION_FAILURE_DISCORD_WEBHOOK_URL 2>/dev/null || true)"; fi
  [[ -n "$webhook" ]] || return 0
  payload="$(printf '{"content":"Automation failed: job=%s host=%s stage=%s exit=%s time=%s log=%s"}' "$job" "$(hostname)" "$stage" "$exit_code" "$(date -u +%FT%TZ)" "$log_path")"
  curl --fail --silent --show-error --max-time 10 -H 'Content-Type: application/json' -d "$payload" "$webhook" >/dev/null
}

