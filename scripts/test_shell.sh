#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
find "$ROOT_DIR/scripts" -type f -name '*.sh' -print0 | xargs -0 -n1 bash -n

