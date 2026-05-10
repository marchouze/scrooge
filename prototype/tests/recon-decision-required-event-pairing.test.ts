// tests/recon-decision-required-event-pairing.test.ts
//
// Unit tests for the F-033 decision-required → CeoDecision pairing recon.
//
// The recon closes the bug class fixed in PR #197: a record's events go
// missing because the backfill dedups on bare decisionId instead of the
// (decisionId, asOf) tuple, so the second on-disk record (supersession)
// emits no event. The dashboard projection's latest-wins-by-asOf rule
// then cannot order superseded records.
//
// - Smoke: live corpus + populated store passes.
// - Catches (a): record exists but no event in store (P1).
// - Catches (b): D-BANK-NAME-SELECTION-style multi-record case — one
//   record at asOf=T1 has an event, the supersession at asOf=T2 has none.
//   P0 finding.
//
// Author: Vera (Internal audit engineer, third-line)

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { run } from "../platform/recon/decision-required-event-pairing";

function freshOwnerInbox(): string {
  return mkdtempSync(join(tmpdir(), "bank-recon-decision-pairing-"));
}

function writeRecord(
  dir: string,
  filename: string,
  decisionId: string,
  asOf: string,
  action = "approve",
): void {
  const content = `---
agent: Scrooge
trigger: ceo-decision-record
asOf: ${asOf}
decision-required: false
---

# Scrooge — CEO decision record: ${decisionId}

- **Decision ID:** \`${decisionId}\`
- **Title:** Test record
- **Action:** ${action}
- **Outcome:** approved.
- **Actor:** marc@tgv.co.za
`;
  writeFileSync(join(dir, filename), content);
}

describe("decision-required → CeoDecision pairing recon (F-033)", () => {
  it("emits info-only on a fresh runner (empty store)", () => {
    const dir = freshOwnerInbox();
    writeRecord(
      dir,
      "2026-05-09_scrooge_ceo-decision-record_d-test-fresh.md",
      "D-TEST-FRESH",
      "2026-05-09T10:00:00.000Z",
    );
    const r = run({
      ownerInboxDir: dir,
      events: [],
      forceEmptyStore: true,
    });
    expect(r.pipeline).toBe("decision-required-event-pairing");
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("info");
    expect(r.violations[0]?.subject).toBe("decision-required-event-pairing:store-empty");
  });

  it("(a) catches P1 — record exists but no event in store", () => {
    const dir = freshOwnerInbox();
    writeRecord(
      dir,
      "2026-05-09_scrooge_ceo-decision-record_d-test-no-event.md",
      "D-TEST-NO-EVENT",
      "2026-05-09T10:00:00.000Z",
    );
    // Populate the store with an *unrelated* CeoDecision so the
    // forceEmptyStore branch doesn't fire.
    const r = run({
      ownerInboxDir: dir,
      events: [{ decisionId: "D-OTHER", asOf: "2026-05-01T00:00:00.000Z" }],
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "decision:D-TEST-NO-EVENT" &&
          v.message.includes("no `CeoDecision` event"),
      ),
    ).toBe(true);
  });

  it("(b) catches P0 — D-BANK-NAME-SELECTION-style multi-record supersession " +
    "where the second record has no event (PR #197 bug class)", () => {
    const dir = freshOwnerInbox();
    // Two records on disk for the same decisionId — the realistic
    // supersession scenario.
    writeRecord(
      dir,
      "2026-05-07_scrooge_ceo-decision-record_d-bank-name-selection.md",
      "D-BANK-NAME-SELECTION",
      "2026-05-07T13:34:39.660Z",
      "request-revision",
    );
    writeRecord(
      dir,
      "2026-05-09_scrooge_ceo-decision-record_d-bank-name-hoz.md",
      "D-BANK-NAME-SELECTION",
      "2026-05-09T07:00:00.000Z",
      "approve",
    );
    // Only the *first* record has its event in the store — the
    // supersession lost its event (the bug). The recon must catch
    // the missing (decisionId, asOf=2026-05-09) tuple.
    const r = run({
      ownerInboxDir: dir,
      events: [{ decisionId: "D-BANK-NAME-SELECTION", asOf: "2026-05-07T13:34:39.660Z" }],
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "decision:D-BANK-NAME-SELECTION@2026-05-09T07:00:00.000Z" &&
          v.message.includes("PR #197"),
      ),
    ).toBe(true);
    // And the recon must NOT report the first record as missing —
    // its event is present.
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "decision:D-BANK-NAME-SELECTION@2026-05-07T13:34:39.660Z",
      ),
    ).toBe(false);
  });

  it("(b) passes when all supersession records have matching events", () => {
    const dir = freshOwnerInbox();
    writeRecord(
      dir,
      "2026-05-07_scrooge_ceo-decision-record_d-mr-multi.md",
      "D-MR-MULTI",
      "2026-05-07T10:00:00.000Z",
    );
    writeRecord(
      dir,
      "2026-05-09_scrooge_ceo-decision-record_d-mr-multi-v2.md",
      "D-MR-MULTI",
      "2026-05-09T10:00:00.000Z",
    );
    const r = run({
      ownerInboxDir: dir,
      events: [
        { decisionId: "D-MR-MULTI", asOf: "2026-05-07T10:00:00.000Z" },
        { decisionId: "D-MR-MULTI", asOf: "2026-05-09T10:00:00.000Z" },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
  });

  it("supports the actioned/ subdirectory (records may move post-decision)", () => {
    const dir = freshOwnerInbox();
    const actionedDir = join(dir, "actioned");
    mkdirSync(actionedDir);
    writeRecord(
      actionedDir,
      "2026-05-08_scrooge_ceo-decision-record_d-archived.md",
      "D-ARCHIVED",
      "2026-05-08T10:00:00.000Z",
    );
    const r = run({
      ownerInboxDir: dir,
      events: [{ decisionId: "D-ARCHIVED", asOf: "2026-05-08T10:00:00.000Z" }],
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
  });
});
