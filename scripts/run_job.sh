#!/usr/bin/env bash
# Build and run one allowlisted job service through Docker Compose.
# Local:      ./scripts/run_job.sh example-job [command...]
# Dev stack:  JOB_COMPOSE_FILE=docker-compose.dev.yml ./scripts/run_job.sh example-job
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALLOWED_JOBS="example-job"

if [[ $# -lt 1 ]]; then
  echo "Usage: ./scripts/run_job.sh <${ALLOWED_JOBS// /|}> [command...]" >&2
  exit 2
fi

job="$1"
shift

case " $ALLOWED_JOBS " in
  *" $job "*) ;;
  *) echo "Unknown job: $job (allowed: $ALLOWED_JOBS)" >&2; exit 2 ;;
esac

[[ -f "$ROOT_DIR/.env" ]] || { echo "Missing $ROOT_DIR/.env" >&2; exit 2; }
cd "$ROOT_DIR"
# The service's `env_file: .env` supplies its environment; `run` has no --env-file flag.
docker compose -f "${JOB_COMPOSE_FILE:-docker-compose.yml}" --profile jobs run --build --rm "$job" "$@"
