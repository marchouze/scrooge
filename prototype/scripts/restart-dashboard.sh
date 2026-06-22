#!/usr/bin/env bash
# Kill whatever is serving the dashboard on $PORT, then restart it detached.
# Usage:  bash scripts/restart-dashboard.sh        (run from prototype/)
set -euo pipefail

PORT="${BANK_DASHBOARD_PORT:-3010}"
export BANK_EVENT_DB="${BANK_EVENT_DB:-$HOME/.local/share/bank/event.db}"
LOG="${BANK_DASHBOARD_LOG:-/tmp/bank-dashboard.log}"

# Resolve prototype/ (this script lives in prototype/scripts/) regardless of cwd.
PROTO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROTO_DIR"

echo "→ killing any listener on port $PORT ..."
PIDS="$(lsof -ti tcp:"$PORT" || true)"
if [ -n "$PIDS" ]; then
  # shellcheck disable=SC2086
  kill $PIDS 2>/dev/null || true
  sleep 1
  # escalate if still alive
  STILL="$(lsof -ti tcp:"$PORT" || true)"
  if [ -n "$STILL" ]; then
    # shellcheck disable=SC2086
    kill -9 $STILL 2>/dev/null || true
    sleep 1
  fi
  echo "  killed: $PIDS"
else
  echo "  nothing was listening on $PORT"
fi

echo "→ starting dashboard (store: $BANK_EVENT_DB) ..."
nohup bun run dashboard/server.ts > "$LOG" 2>&1 &
NEW_PID=$!
echo "  pid $NEW_PID  ·  logs: $LOG"

# wait until it answers (up to ~10s)
for _ in $(seq 1 20); do
  if curl -sf "http://localhost:$PORT/" >/dev/null 2>&1; then
    echo "✓ dashboard up on http://localhost:$PORT"
    exit 0
  fi
  sleep 0.5
done

echo "✗ dashboard did not respond on $PORT within 10s — tail of $LOG:"
tail -20 "$LOG"
exit 1
