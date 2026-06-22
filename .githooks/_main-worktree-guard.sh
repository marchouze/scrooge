#!/usr/bin/env bash
# .githooks/_main-worktree-guard.sh
#
# Shared fail-closed guard, sourced by pre-commit, pre-rebase, and pre-push.
# Aborts a mutating git operation when it targets the CANONICAL MAIN worktree
# (/Users/marc/code/Bank) unless the actor is an allowlisted legitimate
# writer (launchd job with BANK_ALLOW_MAIN_WORKTREE_WRITE=1) or Marc's
# interactive shell (TTY).
#
# The decision is made by the unit-tested pure function in
# prototype/scripts/githooks/main-worktree-guard.ts — this shell wrapper only
# locates `bun`, invokes the CLI, and propagates its exit code. All
# allow/deny logic and the loud deny message live in that TS module so they
# are testable.
#
# Authority:
#   - CLAUDE.md §"Dispatch discipline → Worktree isolation".
#   - Engineering Charter D-ENGINEERING-INTEGRITY-CHARTER command 2
#     (fail-closed by default).
#
# Author: Atlas (Core banking platform architect, engineering).

# Run the main-worktree write guard. Exits the calling hook non-zero on deny.
run_main_worktree_guard() {
  local toplevel guard_ts bun_bin

  toplevel="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  if [[ -z "${toplevel}" ]]; then
    # Cannot resolve the worktree — fail closed.
    echo "main-worktree-guard: cannot resolve worktree toplevel — aborting (fail-closed)." >&2
    exit 1
  fi

  guard_ts="${toplevel}/prototype/scripts/githooks/main-worktree-guard.ts"
  if [[ ! -f "${guard_ts}" ]]; then
    # Guard module missing in this worktree's checkout: do not silently pass.
    # (Older commits predating the guard won't have it; in that case there is
    # nothing to enforce, so allow. We distinguish by checking the prototype
    # dir exists at all — if it does but the guard is gone, fail closed.)
    if [[ -d "${toplevel}/prototype" ]]; then
      echo "main-worktree-guard: expected guard at ${guard_ts} but it is missing — aborting (fail-closed)." >&2
      exit 1
    fi
    return 0
  fi

  bun_bin="$(command -v bun || true)"
  if [[ -z "${bun_bin}" ]]; then
    echo "main-worktree-guard: 'bun' not found on PATH — aborting (fail-closed)." >&2
    echo "                     install bun, or run from a shell where bun is available." >&2
    exit 1
  fi

  if ! "${bun_bin}" run "${guard_ts}"; then
    # The TS CLI already printed the loud deny message to stderr.
    exit 1
  fi
}
