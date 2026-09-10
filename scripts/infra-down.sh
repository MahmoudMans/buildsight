#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if command -v podman >/dev/null 2>&1; then
  podman compose down
elif command -v docker >/dev/null 2>&1; then
  docker compose down
else
  echo "[FAIL] Neither Podman nor Docker was found."
  exit 1
fi
