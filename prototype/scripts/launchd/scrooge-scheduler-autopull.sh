#!/usr/bin/env bash
# scrooge-scheduler-autopull.sh
# ============================================================================
# Keeps the live scheduler worktree (`.scheduler-live`) pinned to origin/main so
# the launchd scheduler-tick job always runs the latest merged code. Whenever new
# code lands (a merge from ANY worktree), this hard-resets the live worktree to
# origin/main. The scheduler-tick job is interval-driven (StartInterval=60), so
# the next tick automatically picks up the refreshed checkout — no process kick
# is required (unlike the dashboard, which is a long-lived KeepAlive server and
# DOES need a kickstart to reload).
#
# This REPLACES the old in-process self-update that lived inside
# `scripts/scheduler-tick.ts`: the tick used to `git fetch origin main` +
# `git rebase origin/main` + `git pull --rebase` as a side-effect of committing
# derived archive renders to main. That accumulated render-commits that conflicted
# on rebase → the rebase wedged → the fleet ran STALE code. Pulling the update out
# of the tick process and into a dedicated autopull mirror (exactly as the
# dashboard does with `.dashboard-live` + `com.scrooge.dashboard-autopull`)
# removes that failure mode entirely. The live worktree is serve-only and never
# hand-edited, so `reset --hard` destroys nothing.
#
# Invoked every 30s by `com.scrooge.scheduler-autopull`. The scheduler PROCESS
# is owned by `com.scrooge.scheduler-tick` (StartInterval=60); this script only
# updates the code on disk.
#
# Authority: D-SCHEDULER-DEPLOY-DECOUPLE (CEO-approved 2026-06-22);
#   Principles/1-events-are-truth.md; D-ENGINEERING-INTEGRITY-CHARTER.
# Author: Atlas (Core banking platform architect, engineering).
#
# Path resolution: the live worktree path is sourced from the SCHEDULER_LIVE_DIR
# environment variable (set in the launchd plist <EnvironmentVariables> block by
# install.sh, derived from the dashboard-live sibling convention), falling back
# to the canonical `/Users/marc/code/Bank/.scheduler-live` default. No brittle
# hardcoded literal where a derivation exists (Engineering Charter command 4).
set -uo pipefail

LIVE_DIR="${SCHEDULER_LIVE_DIR:-/Users/marc/code/Bank/.scheduler-live}"

# Fetch quietly; tolerate transient network failures (exit 0 — try again next tick).
git -C "$LIVE_DIR" fetch -q origin main 2>/dev/null || exit 0

LOCAL="$(git -C "$LIVE_DIR" rev-parse HEAD 2>/dev/null || true)"
REMOTE="$(git -C "$LIVE_DIR" rev-parse origin/main 2>/dev/null || true)"

if [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
  echo "[scheduler-autopull $(date -u +%FT%TZ)] origin/main advanced $LOCAL -> $REMOTE; updating live worktree"
  git -C "$LIVE_DIR" reset --hard origin/main -q
fi
