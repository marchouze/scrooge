#!/usr/bin/env bash
# Kill the running dashboard server (port 3010) and restart it on main.

set -euo pipefail

REPO_ROOT="/Users/marc/code/Bank"
PORT="${BANK_DASHBOARD_PORT:-3010}"

# Kill anything on the port. lsof can return multiple PIDs (the server plus
# its bus-worker), one per line — passing that multi-line string to `kill` as
# a single argument fails ("arguments must be process or job IDs"), which is
# why the bounce used to leave a half-dead listener behind. Word-split the
# list, then force-kill any survivors.
PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
if [[ -n "$PIDS" ]]; then
  echo "Killing PID(s) on port $PORT: $(echo "$PIDS" | tr '\n' ' ')"
  # shellcheck disable=SC2086 # intentional word-splitting over the PID list
  kill $PIDS 2>/dev/null || true
  sleep 1
  SURVIVORS=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
  if [[ -n "$SURVIVORS" ]]; then
    # shellcheck disable=SC2086
    kill -9 $SURVIVORS 2>/dev/null || true
    sleep 1
  fi
fi

# Warn if not on main
BRANCH=$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null || echo "unknown")
if [[ "$BRANCH" != "main" ]]; then
  echo "WARNING: repo is on branch '$BRANCH', not 'main'" >&2
fi

echo "Starting dashboard on http://localhost:$PORT (branch: $BRANCH)"
cd "$REPO_ROOT/prototype"
exec env BANK_EVENT_DB="$HOME/.local/share/bank/event.db" bun run dashboard/server.ts
