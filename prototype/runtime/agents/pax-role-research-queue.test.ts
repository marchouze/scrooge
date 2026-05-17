// runtime/agents/pax-role-research-queue.test.ts
//
// Regression test for the ghost-pending hire-brief bug.
//
// Background: PAX's findPendingHireBriefs used to list any brief whose
// frontmatter still said `decision-required: true` and whose card was still
// in `Owner Inbox/` (not yet archived to `actioned/`). When the CEO decision
// landed in the window between PAX starting and the auto-archive handler
// firing, PAX surfaced ghost-pending briefs to Scrooge → Marc, who was then
// asked to re-decide things already decided. Multiple sessions hit this.
//
// Permanent fix: PAX cross-checks the event store. Any decision-id with a
// resolved `CeoDecision` event (action ∈ {approve, reject, defer, modify})
// is excluded — Principle 1, event store wins over markdown frontmatter.
//
// Author: Scrooge (Chief of Staff)

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { __testing } from "./pax-role-research-queue";

const { findPendingHireBriefs } = __testing;

function makeRepoRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "pax-queue-test-"));
  mkdirSync(join(root, "archive", "owner-inbox"), { recursive: true });
  return root;
}

function writeBrief(
  root: string,
  filename: string,
  args: { decisionId: string; title: string },
): void {
  const content = [
    "---",
    "decision-required: true",
    `decision-id: ${args.decisionId}`,
    `title: ${args.title}`,
    "---",
    "",
    `# ${args.title}`,
    "",
    "Body.",
  ].join("\n");
  writeFileSync(join(root, "archive", "owner-inbox", filename), content, "utf8");
}

describe("pax:role-research-queue — findPendingHireBriefs", () => {
  it("lists hire briefs whose decision-id has no resolved CeoDecision event", () => {
    const root = makeRepoRoot();
    writeBrief(root, "2026-05-10_pax_role-brief_human-cro.md", {
      decisionId: "D-HIRE-HUMAN-CRO",
      title: "PAX role-brief — Human CRO",
    });

    const briefs = findPendingHireBriefs(root, new Set<string>());

    expect(briefs.length).toBe(1);
    expect(briefs[0]?.decisionId).toBe("D-HIRE-HUMAN-CRO");
  });

  it("excludes briefs whose decision-id has a resolved CeoDecision event", () => {
    const root = makeRepoRoot();
    writeBrief(root, "2026-05-10_pax_role-brief_human-cro.md", {
      decisionId: "D-HIRE-HUMAN-CRO",
      title: "PAX role-brief — Human CRO",
    });
    writeBrief(root, "2026-05-10_pax_role-brief_ned-2.md", {
      decisionId: "D-HIRE-NED-2",
      title: "PAX role-brief — NED #2",
    });

    // Simulate event store: D-HIRE-HUMAN-CRO has been decided, D-HIRE-NED-2
    // has not. Even though both markdown cards still sit in Owner Inbox/
    // with `decision-required: true` (auto-archive hasn't fired yet), only
    // the genuinely-pending one should surface.
    const briefs = findPendingHireBriefs(root, new Set(["D-HIRE-HUMAN-CRO"]));

    expect(briefs.length).toBe(1);
    expect(briefs[0]?.decisionId).toBe("D-HIRE-NED-2");
  });

  it("excludes all briefs when every decision-id is resolved", () => {
    const root = makeRepoRoot();
    writeBrief(root, "2026-05-10_pax_role-brief_human-cro.md", {
      decisionId: "D-HIRE-HUMAN-CRO",
      title: "PAX role-brief — Human CRO",
    });
    writeBrief(root, "2026-05-10_pax_role-brief_ned-2.md", {
      decisionId: "D-HIRE-NED-2",
      title: "PAX role-brief — NED #2",
    });

    const briefs = findPendingHireBriefs(root, new Set(["D-HIRE-HUMAN-CRO", "D-HIRE-NED-2"]));

    expect(briefs.length).toBe(0);
  });

  it("ignores files whose body mentions `decision-required: true` in prose", () => {
    // Reproduces the false-positive that misled the explore agent: PAX's own
    // queue snapshot has `decision-required: false` in frontmatter but quotes
    // the literal string "decision-required: true" in its narrative body
    // (describing how the queue filter works). It must NOT match.
    const root = makeRepoRoot();
    const content = [
      "---",
      "agent: PAX",
      "decision-required: false",
      "---",
      "",
      "# PAX queue snapshot",
      "",
      "_Source: filtered to `decision-required: true` ..._",
    ].join("\n");
    writeFileSync(
      join(root, "archive", "owner-inbox", "2026-05-15_pax_role-research-queue.md"),
      content,
      "utf8",
    );

    const briefs = findPendingHireBriefs(root, new Set<string>());

    expect(briefs.length).toBe(0);
  });
});
