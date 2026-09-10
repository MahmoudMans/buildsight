#!/usr/bin/env bash
set -euo pipefail

echo
echo "========================================================================"
echo " BUILDSIGHT — OLLAMA STATUS"
echo "========================================================================"
echo

if ! command -v curl >/dev/null 2>&1; then
  echo "[FAIL] curl is required."
  exit 1
fi

if ! curl \
  --fail \
  --silent \
  --show-error \
  http://localhost:11434/api/tags; then

  echo
  echo "[FAIL] Ollama is not reachable on localhost:11434"
  exit 1
fi

echo
echo
echo "[PASS] OLLAMA_REACHABLE"
