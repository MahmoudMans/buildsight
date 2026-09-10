#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if command -v podman >/dev/null 2>&1; then
  ENGINE="podman"
elif command -v docker >/dev/null 2>&1; then
  ENGINE="docker"
else
  echo "[FAIL] Docker or Podman is required for the configured Ollama service."
  exit 1
fi

echo
echo "========================================================================"
echo " BUILDSIGHT — LOCAL AI MODEL INSTALLATION"
echo "========================================================================"
echo

"${ENGINE}" compose up -d ollama

echo
echo "Pulling local chat model: qwen3:4b"
"${ENGINE}" compose exec ollama \
  ollama pull qwen3:4b

echo
echo "Pulling local embedding model: qwen3-embedding:0.6b"
"${ENGINE}" compose exec ollama \
  ollama pull qwen3-embedding:0.6b

echo
echo "[PASS] BUILDSIGHT_LOCAL_AI_MODELS_INSTALLED"
echo
