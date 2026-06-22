// scripts/githooks/main-worktree-guard.test.ts
//
// Unit tests for the fail-closed main-worktree write guard decision
// function. Covers EVERY branch of `decideMainWorktreeWrite`:
//   - non-main worktree           → allow
//   - main + opt-in env set       → allow
//   - main + interactive TTY      → allow
//   - main + neither (fail-closed)→ deny
// plus path-normalisation edge cases.
//
// These tests NEVER touch the real main worktree, never shell out to git,
// and never mutate any repository — they exercise the pure function with
// hand-supplied inputs only.
//
// Authority:
//   - CLAUDE.md §"Dispatch discipline → Worktree isolation".
//   - Engineering Charter D-ENGINEERING-INTEGRITY-CHARTER command 2.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import { ALLOW_ENV_VAR, decideMainWorktreeWrite, denyMessage } from "./main-worktree-guard";

const MAIN = "/Users/marc/code/Bank";
const AGENT_WORKTREE = "/Users/marc/code/Bank/.claude/worktrees/agent-abc123";
const DASHBOARD_WORKTREE = "/Users/marc/code/Bank/.dashboard-live";

describe("decideMainWorktreeWrite — branch 1: non-main worktree always allowed", () => {
  test("dispatched agent worktree → allow (regardless of env/TTY)", () => {
    const d = decideMainWorktreeWrite({
      worktreeToplevel: AGENT_WORKTREE,
      canonicalMain: MAIN,
      allowEnvSet: false,
      isTty: false,
    });
    expect(d.allow).toBe(true);
    expect(d.reason).toContain("is not the canonical main worktree");
  });

  test(".dashboard-live worktree → allow (autopull fetch/reset unaffected)", () => {
    const d = decideMainWorktreeWrite({
      worktreeToplevel: DASHBOARD_WORKTREE,
      canonicalMain: MAIN,
      allowEnvSet: false,
      isTty: false,
    });
    expect(d.allow).toBe(true);
  });

  test("non-main worktree allowed even with env set and TTY (no false-deny path)", () => {
    const d = decideMainWorktreeWrite({
      worktreeToplevel: AGENT_WORKTREE,
      canonicalMain: MAIN,
      allowEnvSet: true,
      isTty: true,
    });
    expect(d.allow).toBe(true);
  });
});

describe("decideMainWorktreeWrite — branch 2: main + allowlist opt-in env", () => {
  test("launchd writer with BANK_ALLOW_MAIN_WORKTREE_WRITE=1 → allow", () => {
    const d = decideMainWorktreeWrite({
      worktreeToplevel: MAIN,
      canonicalMain: MAIN,
      allowEnvSet: true,
      isTty: false,
    });
    expect(d.allow).toBe(true);
    expect(d.reason).toContain(ALLOW_ENV_VAR);
  });
});

describe("decideMainWorktreeWrite — branch 3: main + interactive TTY (Marc)", () => {
  test("interactive shell in main → allow", () => {
    const d = decideMainWorktreeWrite({
      worktreeToplevel: MAIN,
      canonicalMain: MAIN,
      allowEnvSet: false,
      isTty: true,
    });
    expect(d.allow).toBe(true);
    expect(d.reason).toContain("interactive TTY");
  });
});

describe("decideMainWorktreeWrite — branch 4: main + neither → fail-closed DENY", () => {
  test("dispatched agent strayed into main, no env, no TTY → deny", () => {
    const d = decideMainWorktreeWrite({
      worktreeToplevel: MAIN,
      canonicalMain: MAIN,
      allowEnvSet: false,
      isTty: false,
    });
    expect(d.allow).toBe(false);
    // Loud message must name the worktree-isolation rule and the main path.
    expect(d.reason).toContain("Worktree isolation");
    expect(d.reason).toContain(MAIN);
    expect(d.reason).toContain(ALLOW_ENV_VAR);
  });
});

describe("decideMainWorktreeWrite — path normalisation", () => {
  test("trailing slash on toplevel matches main (still denied when neither)", () => {
    const d = decideMainWorktreeWrite({
      worktreeToplevel: `${MAIN}/`,
      canonicalMain: MAIN,
      allowEnvSet: false,
      isTty: false,
    });
    expect(d.allow).toBe(false);
  });

  test("trailing slash on canonicalMain matches toplevel (still denied when neither)", () => {
    const d = decideMainWorktreeWrite({
      worktreeToplevel: MAIN,
      canonicalMain: `${MAIN}/`,
      allowEnvSet: false,
      isTty: false,
    });
    expect(d.allow).toBe(false);
  });

  test("filesystem root '/' is not collapsed to empty (distinct from main)", () => {
    const d = decideMainWorktreeWrite({
      worktreeToplevel: "/",
      canonicalMain: MAIN,
      allowEnvSet: false,
      isTty: false,
    });
    // '/' ≠ main → branch 1 allow; proves normalisePath keeps root intact.
    expect(d.allow).toBe(true);
  });
});

describe("denyMessage", () => {
  test("includes canonical main path, isolation rule, and remediation", () => {
    const msg = denyMessage(MAIN);
    expect(msg).toContain(MAIN);
    expect(msg).toContain("Worktree isolation");
    expect(msg).toContain("dispatched");
    expect(msg).toContain("fail-closed");
  });
});
