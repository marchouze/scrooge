// platform/recon/agent-snapshot-staleness.test.ts
//
// Tests for the snapshot-staleness recon. Validates that snapshot files
// listing already-resolved decision-ids are flagged, and that clean cases
// pass.

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { run } from "./agent-snapshot-staleness";

function makeInboxDir(): string {
  const root = mkdtempSync(join(tmpdir(), "snapshot-staleness-test-"));
  const inbox = join(root, "Owner Inbox");
  mkdirSync(inbox, { recursive: true });
  return inbox;
}

function writeFile(dir: string, name: string, body: string): void {
  writeFileSync(join(dir, name), body, "utf8");
}

const PAX_LIKE_SNAPSHOT = [
  "---",
  "agent: PAX",
  "trigger: role-research-queue",
  "decision-required: false",
  "---",
  "",
  "# PAX queue snapshot",
  "",
  "## Pending hire-related decision briefs (Owner Inbox)",
  "",
  "| File | Date | decision-id | Title |",
  "|---|---|---|---|",
  "| `Owner Inbox/2026-05-10_pax_role-brief_human-cro.md` | 2026-05-10 | D-HIRE-HUMAN-CRO | Human CRO |",
  "| `Owner Inbox/2026-05-10_pax_role-brief_ned-2.md` | 2026-05-10 | D-HIRE-NED-2 | NED #2 |",
  "",
  "End.",
].join("\n");

describe("recon:agent-snapshot-staleness", () => {
  it("flags snapshot rows referencing already-resolved decision-ids", () => {
    const inbox = makeInboxDir();
    writeFile(inbox, "2026-05-15_pax_role-research-queue.md", PAX_LIKE_SNAPSHOT);

    const result = run({
      ownerInboxDir: inbox,
      resolvedIds: new Set(["D-HIRE-HUMAN-CRO"]),
    });

    expect(result.ok).toBe(false);
    const failures = result.violations.filter((v) => v.severity === "fail");
    expect(failures.length).toBe(1);
    expect(failures[0]?.message).toContain("D-HIRE-HUMAN-CRO");
  });

  it("passes when every referenced decision-id is still pending", () => {
    const inbox = makeInboxDir();
    writeFile(inbox, "2026-05-15_pax_role-research-queue.md", PAX_LIKE_SNAPSHOT);

    const result = run({
      ownerInboxDir: inbox,
      resolvedIds: new Set(["D-SOMETHING-ELSE"]),
    });

    expect(result.ok).toBe(true);
    expect(result.violations.filter((v) => v.severity === "fail").length).toBe(0);
  });

  it("ignores decision briefs themselves (decision-required: true)", () => {
    // A decision brief is the source of a pending decision, not a snapshot.
    // The pairing recon handles those; we must not double-fire.
    const inbox = makeInboxDir();
    const brief = [
      "---",
      "decision-required: true",
      "decision-id: D-HIRE-HUMAN-CRO",
      "title: Human CRO brief",
      "---",
      "",
      "# Brief",
      "",
      "| Header | decision-id |",
      "|---|---|",
      "| row | D-HIRE-HUMAN-CRO |",
    ].join("\n");
    writeFile(inbox, "2026-05-10_pax_role-brief_human-cro.md", brief);

    const result = run({
      ownerInboxDir: inbox,
      resolvedIds: new Set(["D-HIRE-HUMAN-CRO"]),
    });

    expect(result.ok).toBe(true);
    expect(result.violations.filter((v) => v.severity === "fail").length).toBe(0);
  });

  it("ignores decision-id mentions outside `decision-id`-headed tables", () => {
    const inbox = makeInboxDir();
    const narrative = [
      "---",
      "agent: Owen",
      "decision-required: false",
      "---",
      "",
      "# Owen narrative",
      "",
      "The decision D-HIRE-HUMAN-CRO landed last week — see the actioned/ archive.",
      "",
      "| Topic | Status |",
      "|---|---|",
      "| CRO hire | approved (D-HIRE-HUMAN-CRO) |",
    ].join("\n");
    writeFile(inbox, "2026-05-16_owen_narrative.md", narrative);

    const result = run({
      ownerInboxDir: inbox,
      resolvedIds: new Set(["D-HIRE-HUMAN-CRO"]),
    });

    expect(result.ok).toBe(true);
    expect(result.violations.filter((v) => v.severity === "fail").length).toBe(0);
  });

  it("ignores CEO decision records (trigger: ceo-decision-record)", () => {
    // CEO decision records contain `Sub | Decision-id | Action` tables that
    // document which decisions were resolved in a single CEO action. They
    // are the markdown mirror of CeoDecision events, not stale projections
    // of pending state. Must not flag.
    const inbox = makeInboxDir();
    const record = [
      "---",
      "agent: Scrooge",
      "trigger: ceo-decision-record",
      "decision-required: false",
      "---",
      "",
      "# CEO decision record: D-HIRE-SIX-SEATS-PACK",
      "",
      "## Sub-decisions resolved",
      "",
      "| Sub | Decision-id | Action |",
      "|---|---|---|",
      "| A | D-HIRE-HUMAN-CRO | approve |",
      "| B | D-HIRE-NED-2 | approve |",
    ].join("\n");
    writeFile(inbox, "2026-05-10_scrooge_ceo-decision-record_d-hire-six-seats-pack.md", record);

    const result = run({
      ownerInboxDir: inbox,
      resolvedIds: new Set(["D-HIRE-HUMAN-CRO", "D-HIRE-NED-2"]),
    });

    expect(result.ok).toBe(true);
    expect(result.violations.filter((v) => v.severity === "fail").length).toBe(0);
  });

  it("reports clean-bench INFO when resolvedIds is empty", () => {
    const inbox = makeInboxDir();
    writeFile(inbox, "2026-05-15_pax_role-research-queue.md", PAX_LIKE_SNAPSHOT);

    const result = run({
      ownerInboxDir: inbox,
      resolvedIds: new Set<string>(),
    });

    expect(result.ok).toBe(true);
    expect(result.violations.some((v) => v.severity === "info")).toBe(true);
    expect(result.violations.filter((v) => v.severity === "fail").length).toBe(0);
  });
});
