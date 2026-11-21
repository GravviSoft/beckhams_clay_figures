#!/usr/bin/env bash
# Production cron entry point for the example job. Cron calls this wrapper only.
set -Eeuo pipefail

JOB_NAME="example-job"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
LOG_DIR="$ROOT_DIR/scripts/logs"
LOCK_DIR="${TMPDIR:-/tmp}/becks-clay-figures-${JOB_NAME}.lock"
LOG_PATH="$LOG_DIR/${JOB_NAME}-$(date +%Y-%m).log"
mkdir -p "$LOG_DIR"
source "$ROOT_DIR/scripts/lib/safe_env.sh"
source "$ROOT_DIR/scripts/lib/automation_notifications.sh"

log() { printf '%s [%s] %s\n' "$(date -u +%FT%TZ)" "$JOB_NAME" "$*" >>"$LOG_PATH"; }

# Portable lock (macOS has no flock). A lock left by a process that no longer
# exists is reclaimed so a crash cannot silently skip every future run.
acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "$$" >"$LOCK_DIR/pid"
    return 0
  fi
  local holder
  holder="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  if [[ -n "$holder" ]] && kill -0 "$holder" 2>/dev/null; then
    return 1
  fi
  log "reclaiming stale lock from pid=${holder:-unknown}"
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR" 2>/dev/null && echo "$$" >"$LOCK_DIR/pid"
}

if ! acquire_lock; then
  log "skipped: previous run still active"
  exit 0
fi
trap 'rm -rf "$LOCK_DIR" 2>/dev/null || true' EXIT

stage="preflight"
if [[ ! -f "$ENV_FILE" ]]; then
  log "failed stage=$stage: missing $ENV_FILE"
  exit 2
fi

stage="build-and-run"
log "start stage=$stage"
set +e
"$ROOT_DIR/scripts/run_job.sh" "$JOB_NAME" >>"$LOG_PATH" 2>&1
exit_code=$?
set -e

if (( exit_code != 0 )); then
  log "failed stage=$stage exit=$exit_code"
  notify_automation_failure "$JOB_NAME" "$stage" "$exit_code" "$LOG_PATH" "$ENV_FILE" || log "failure notification could not be delivered"
else
  log "finished stage=$stage"
fi
exit "$exit_code"
