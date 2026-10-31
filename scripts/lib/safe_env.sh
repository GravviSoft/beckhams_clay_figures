#!/usr/bin/env bash

safe_env_read() {
  local env_file="$1" key="$2" line value
  case "$key" in
    AUTOMATION_FAILURE_DISCORD_WEBHOOK_URL) ;;
    *) echo "Refusing non-allowlisted environment key: $key" >&2; return 2 ;;
  esac
  [[ -f "$env_file" ]] || return 1
  line="$(grep -E "^[[:space:]]*${key}=" "$env_file" | tail -n 1)" || true
  [[ -n "$line" ]] || return 1
  value="${line#*=}"
  value="${value%$'\r'}"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then value="${value:1:${#value}-2}"; fi
  if [[ "$value" == \'*\' && "$value" == *\' ]]; then value="${value:1:${#value}-2}"; fi
  printf '%s' "$value"
}

