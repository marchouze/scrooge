// scripts/scheduler-tick-deploy-decouple.test.ts
//
// Regression guard for D-SCHEDULER-DEPLOY-DECOUPLE (CEO-approved 2026-06-22).
//
// The scheduler tick MUST NOT mutate git or write derived renders to the main
// worktree any more:
//   - it no longer self-updates its code in-process (no `git fetch origin main`,
//     `git rebase origin/main`, or `git pull --rebase`); code freshness is owned
//     by the dedicated `com.scrooge.scheduler-autopull` job pinning the clean
//     `.scheduler-live` worktree to origin/main; and
//   - it no longer git-commits event-derived `archive/owner-inbox/*.md` renders
//     (a Principle 1 violation — markdown is a render of events, never canonical).
//
// scheduler-tick.ts is a long-running side-effecting script that drives the real
// runtime against a populated event store, so this guard asserts the load-bearing
// behavioural guarantee at the source level: the removed git-mutation surface must
// stay removed. A future edit that re-introduces any of these patterns fails here
// loudly, naming the decision.
//
// Authority: D-SCHEDULER-DEPLOY-DECOUPLE; Principles/1-events-are-truth.md;
//   D-ENGINEERING-INTEGRITY-CHARTER.
// Author: Atlas (Core banking platform architect, engineering).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

const SCHEDULER_TICK_SRC = readFileSync(resolve(import.meta.dir, "scheduler-tick.ts"), "utf8");

// Drop `//`-prefixed line comments so the documentation that EXPLAINS what was
// removed (which legitimately names these git commands) does not trip the guard.
// We only want to catch executable re-introductions.
function stripLineComments(src: string): string {
  return src
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trimStart();
      return trimmed.startsWith("//") ? "" : line;
    })
    .join("\n");
}

const CODE = stripLineComments(SCHEDULER_TICK_SRC);

describe("scheduler-tick deploy decouple (D-SCHEDULER-DEPLOY-DECOUPLE)", () => {
  test("does not import execSync / spawnSync (no git subprocess surface)", () => {
    expect(CODE).not.toMatch(
      /import\s+\{[^}]*\bexecSync\b[^}]*\}\s+from\s+["']node:child_process["']/,
    );
    expect(CODE).not.toMatch(
      /import\s+\{[^}]*\bspawnSync\b[^}]*\}\s+from\s+["']node:child_process["']/,
    );
    expect(CODE).not.toContain('from "node:child_process"');
  });

  test("does not run an in-process git self-update", () => {
    expect(CODE).not.toContain("git -C");
    expect(CODE).not.toContain("fetch origin main");
    expect(CODE).not.toContain("rebase origin/main");
    expect(CODE).not.toContain("pull --rebase");
  });

  test("does not git-commit or push derived archive renders", () => {
    expect(CODE).not.toMatch(/git[^"'`\n]*commit/);
    expect(CODE).not.toMatch(/git[^"'`\n]*push/);
    expect(CODE).not.toMatch(/git[^"'`\n]*\badd\b/);
  });

  test("does not reference the archive/owner-inbox git path in executable code", () => {
    // The renders are written by the authoring path (record-deliverable.ts) to
    // disk / the document store; the scheduler tick must not touch that git path.
    expect(CODE).not.toContain("archive/owner-inbox");
  });
});
