#!/usr/bin/env bash
# Launch the Scrooge bank operations dashboard.
# Serves on http://localhost:3010 (override with BANK_DASHBOARD_PORT).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
PROTOTYPE="$REPO_ROOT/prototype"

# Warn if the main worktree is on a non-main branch (stale-server risk).
BRANCH=$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null || echo "unknown")
if [[ "$BRANCH" != "main" ]]; then
  echo "WARNING: repo is on branch '$BRANCH', not 'main' — dashboard may serve stale code" >&2
fi

PORT="${BANK_DASHBOARD_PORT:-3010}"
echo "Starting dashboard on http://localhost:$PORT (branch: $BRANCH)"

cd "$PROTOTYPE"
exec bun run dashboard
