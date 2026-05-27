#!/usr/bin/env bash
# Purge duplicate InboundMessageReceived MT202 events (Pattern 2).
#
# For each tradeId, keeps only the earliest event (lowest sequence).
# Deletes all subsequent events for the same tradeId.
#
# Dry-run by default — pass --apply to commit the delete.
#
# Usage:
#   ./dedup-mt202-inbound.sh           # dry run
#   ./dedup-mt202-inbound.sh --apply   # stop server, delete, restart

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
DB="${BANK_EVENT_DB:-$HOME/.local/share/bank/event.db}"
PORT="${BANK_DASHBOARD_PORT:-3010}"
APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true

EXPECTED_ORIGINALS=290
EXPECTED_DUPLICATES=95775

# ── 1. Dry-run count ──────────────────────────────────────────────────────────

echo "==> Counting duplicates in $DB"

DUP_COUNT=$(sqlite3 "$DB" "
  SELECT COUNT(*) FROM events
  WHERE  type = 'InboundMessageReceived'
    AND  json_extract(payload, '$.messageStandard') = 'MT202'
    AND  sequence NOT IN (
        SELECT MIN(sequence)
        FROM   events
        WHERE  type = 'InboundMessageReceived'
          AND  json_extract(payload, '$.messageStandard') = 'MT202'
        GROUP  BY json_extract(payload, '$.tradeId')
    );")

ORIG_COUNT=$(sqlite3 "$DB" "
  SELECT COUNT(DISTINCT json_extract(payload, '$.tradeId'))
  FROM   events
  WHERE  type = 'InboundMessageReceived'
    AND  json_extract(payload, '$.messageStandard') = 'MT202';")

echo "    Originals (unique tradeIds): $ORIG_COUNT  (expected $EXPECTED_ORIGINALS)"
echo "    Duplicates to delete:        $DUP_COUNT   (expected $EXPECTED_DUPLICATES)"

if [[ "$DUP_COUNT" -eq 0 ]]; then
  echo "Nothing to do — no duplicates found."
  exit 0
fi

if [[ "$APPLY" == "false" ]]; then
  echo ""
  echo "Dry run complete. Pass --apply to stop the server, delete duplicates, and restart."
  exit 0
fi

# ── 2. Stop server ────────────────────────────────────────────────────────────

echo ""
echo "==> Stopping dashboard server on port $PORT"
PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
if [[ -n "$PIDS" ]]; then
  echo "    Killing PID(s): $PIDS"
  echo "$PIDS" | xargs kill
  # Wait for port to free
  for i in $(seq 1 10); do
    sleep 1
    STILL=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
    [[ -z "$STILL" ]] && break
    if [[ "$i" -eq 10 ]]; then
      echo "ERROR: port $PORT still in use after 10s — aborting" >&2
      exit 1
    fi
  done
  echo "    Server stopped."
else
  echo "    No process found on port $PORT — continuing."
fi

# ── 3. Backup ─────────────────────────────────────────────────────────────────

BACKUP="${DB}.bak-$(date +%Y%m%d-%H%M%S)"
echo ""
echo "==> Backing up to $BACKUP"
cp "$DB" "$BACKUP"
echo "    Backup written."

# ── 4. Delete duplicates ──────────────────────────────────────────────────────

echo ""
echo "==> Deleting $DUP_COUNT duplicate events"

sqlite3 "$DB" "
BEGIN;

DELETE FROM events
WHERE  type = 'InboundMessageReceived'
  AND  json_extract(payload, '$.messageStandard') = 'MT202'
  AND  sequence NOT IN (
      SELECT MIN(sequence)
      FROM   events
      WHERE  type = 'InboundMessageReceived'
        AND  json_extract(payload, '$.messageStandard') = 'MT202'
      GROUP  BY json_extract(payload, '$.tradeId')
  );

COMMIT;"

# Verify post-delete
POST_COUNT=$(sqlite3 "$DB" "
  SELECT COUNT(*) FROM events
  WHERE  type = 'InboundMessageReceived'
    AND  json_extract(payload, '$.messageStandard') = 'MT202';")

echo "    MT202 events remaining: $POST_COUNT (expected $EXPECTED_ORIGINALS)"

if [[ "$POST_COUNT" -ne "$EXPECTED_ORIGINALS" ]]; then
  echo "ERROR: post-delete count $POST_COUNT != expected $EXPECTED_ORIGINALS" >&2
  echo "       Restore from $BACKUP if needed." >&2
  exit 1
fi

# ── 5. WAL checkpoint ─────────────────────────────────────────────────────────

echo ""
echo "==> Running WAL checkpoint"
sqlite3 "$DB" "PRAGMA wal_checkpoint(TRUNCATE);"
echo "    Done."

# ── 6. Restart server ─────────────────────────────────────────────────────────

echo ""
echo "==> Restarting dashboard on http://localhost:$PORT"
BRANCH=$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null || echo "unknown")
if [[ "$BRANCH" != "main" ]]; then
  echo "    WARNING: repo is on branch '$BRANCH', not 'main'" >&2
fi

cd "$REPO_ROOT/prototype"
nohup env BANK_EVENT_DB="$DB" bun run dashboard/server.ts \
  > "$REPO_ROOT/prototype/dashboard.log" 2>&1 &
SERVER_PID=$!
echo "    Started PID $SERVER_PID — tailing log for 5s..."
sleep 5
tail -5 "$REPO_ROOT/prototype/dashboard.log" || true

echo ""
echo "==> Done. Deleted $DUP_COUNT duplicates. Backup at $BACKUP."
