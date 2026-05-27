#!/usr/bin/env bash
# Kill the running dashboard server (port 3010) and restart it on main.

set -euo pipefail

REPO_ROOT="/Users/marc/code/Bank"
PORT="${BANK_DASHBOARD_PORT:-3010}"

# Kill anything on the port
PID=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
if [[ -n "$PID" ]]; then
  echo "Killing PID $PID on port $PORT..."
  kill "$PID"
  sleep 1
fi

# Warn if not on main
BRANCH=$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null || echo "unknown")
if [[ "$BRANCH" != "main" ]]; then
  echo "WARNING: repo is on branch '$BRANCH', not 'main'" >&2
fi

echo "Starting dashboard on http://localhost:$PORT (branch: $BRANCH)"
cd "$REPO_ROOT/prototype"
exec env BANK_EVENT_DB="$HOME/.local/share/bank/event.db" bun run dashboard/server.ts
