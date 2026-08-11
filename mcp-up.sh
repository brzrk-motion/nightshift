#!/usr/bin/env bash
# Starts every Nightshift MCP server. See ./mcp-up.mjs for the options.
set -euo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$root"

if ! command -v node >/dev/null 2>&1; then
  echo "mcp-up: node is not on PATH (Node 22+ required)." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "mcp-up: installing dependencies…" >&2
  if command -v pnpm >/dev/null 2>&1; then
    pnpm install
  else
    echo "mcp-up: pnpm is not on PATH. Install it, then run 'pnpm install'." >&2
    exit 1
  fi
fi

exec node ./mcp-up.mjs "$@"
