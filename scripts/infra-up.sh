#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if command -v podman >/dev/null 2>&1; then
  echo "[BuildSight] Starting infrastructure with Podman..."
  podman compose up -d
elif command -v docker >/dev/null 2>&1; then
  echo "[BuildSight] Starting infrastructure with Docker..."
  docker compose up -d
else
  echo "[FAIL] Neither Podman nor Docker was found."
  exit 1
fi
