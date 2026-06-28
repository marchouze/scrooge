#!/usr/bin/env bash
set -euo pipefail

# prune-worktrees.sh — safely remove stale agent worktrees under .claude/worktrees/
#
# Abandoned/crashed dispatch runs leave their isolated worktree behind, each
# carrying a full node_modules + checkout (~280-520 MB). Left unchecked these
# accumulate (495 of them, ~150 GB, on 2026-06-28). This reclaims them safely.
#
# Two classes are removed:
#   * UNLOCKED worktrees older than AGE_DAYS         (default 2)  — finished runs
#   * LOCKED   worktrees older than LOCKED_AGE_DAYS  (default 14) — dead locks
#     from crashed runs (no real run holds a lock for two weeks)
#
# SAFETY — this script NEVER removes:
#   * locked worktrees younger than LOCKED_AGE_DAYS (a genuinely active run)
#   * unlocked worktrees younger than AGE_DAYS      (a run not yet locked)
#   * the main worktree, .scheduler-live, .dashboard-live
#     (they live at the repo root, not under .claude/worktrees/, so the
#      path scope below excludes them by construction)
#
# Usage:
#   ./prune-worktrees.sh                  # default thresholds
#   ./prune-worktrees.sh --dry-run        # show what would be removed, delete nothing
#   AGE_DAYS=7 ./prune-worktrees.sh       # unlocked-age threshold (days)
#   LOCKED_AGE_DAYS=30 ./prune-worktrees.sh   # locked-age threshold (days)

cd "$(git rev-parse --show-toplevel)"

AGE_DAYS="${AGE_DAYS:-2}"
LOCKED_AGE_DAYS="${LOCKED_AGE_DAYS:-14}"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

WT_DIR=".claude/worktrees"
[ -d "$WT_DIR" ] || { echo "No $WT_DIR present — nothing to do."; exit 0; }

# Locked worktree basenames = runs that hold a lock.
KEEP="$(mktemp)"
trap 'rm -f "$KEEP"' EXIT
git worktree list --porcelain \
  | awk '/^worktree /{p=$2} /^locked/{print p}' \
  | sed 's#.*/##' | sort -u > "$KEEP"

older_than() { [ -n "$(find "$1" -maxdepth 0 -mtime +"$2" 2>/dev/null)" ]; }

removed=0; removed_locked=0; kept_locked=0; kept_fresh=0
for d in "$WT_DIR"/*/; do
  [ -d "$d" ] || continue
  d="${d%/}"
  b="$(basename "$d")"

  if grep -qxF "$b" "$KEEP"; then
    # locked: remove only if it's a stale (dead) lock
    if older_than "$d" "$LOCKED_AGE_DAYS"; then
      if [ "$DRY_RUN" = "1" ]; then
        echo "would remove (stale lock): $d"
      else
        git worktree unlock "$d" >/dev/null 2>&1 || true
        rm -rf "$d"
      fi
      removed_locked=$((removed_locked+1))
    else
      kept_locked=$((kept_locked+1))
    fi
    continue
  fi

  # unlocked: remove if older than AGE_DAYS, else it may be an in-flight run
  if older_than "$d" "$AGE_DAYS"; then
    if [ "$DRY_RUN" = "1" ]; then
      echo "would remove: $d"
    else
      rm -rf "$d"
    fi
    removed=$((removed+1))
  else
    kept_fresh=$((kept_fresh+1))
  fi
done

if [ "$DRY_RUN" = "1" ]; then
  echo "[dry-run] would remove $removed unlocked + $removed_locked stale-locked; keep $kept_locked active-locked + $kept_fresh fresh."
else
  git worktree prune
  echo "Pruned $removed unlocked + $removed_locked stale-locked worktree(s); kept $kept_locked active-locked + $kept_fresh fresh."
fi
