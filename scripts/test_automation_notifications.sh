#!/usr/bin/env bash
# Verifies the failure notification sends exactly one message containing the
# job context, and stays silent when no webhook is configured. Uses a fake curl;
# nothing leaves this machine.
set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/safe_env.sh"
source "$ROOT_DIR/scripts/lib/automation_notifications.sh"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
mkdir "$work_dir/bin"
cat >"$work_dir/bin/curl" <<'FAKE'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$CURL_CALLS"
FAKE
chmod +x "$work_dir/bin/curl"
export CURL_CALLS="$work_dir/calls"
export PATH="$work_dir/bin:$PATH"

printf 'AUTOMATION_FAILURE_DISCORD_WEBHOOK_URL=https://example.invalid/hook\n' >"$work_dir/with.env"
: >"$work_dir/without.env"
unset AUTOMATION_FAILURE_DISCORD_WEBHOOK_URL

notify_automation_failure "example-job" "build-and-run" "3" "/tmp/example.log" "$work_dir/with.env"
[[ "$(wc -l <"$CURL_CALLS" | tr -d ' ')" == "1" ]] || { echo "expected exactly one notification" >&2; exit 1; }
grep -q 'job=example-job' "$CURL_CALLS" && grep -q 'exit=3' "$CURL_CALLS" && grep -q 'https://example.invalid/hook' "$CURL_CALLS"

: >"$CURL_CALLS"
notify_automation_failure "example-job" "build-and-run" "3" "/tmp/example.log" "$work_dir/without.env"
[[ ! -s "$CURL_CALLS" ]] || { echo "expected no notification without a webhook" >&2; exit 1; }

echo "automation notification tests passed"
