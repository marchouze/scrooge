// tests/backfill-from-records.test.ts
//
// Unit tests for runtime/decisions/backfill-from-records.ts — the boot-
// time backfill that emits CeoDecision events for any on-disk decision
// records missing from the event store.
//
// Author: Atlas (substrate)

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import { backfillCeoDecisionsFromRecords } from "../runtime/decisions/backfill-from-records";

function newOwnerInbox(): string {
  const root = mkdtempSync(join(tmpdir(), "backfill-records-"));
  const dir = join(root, "Owner Inbox");
  mkdirSync(dir);
  return dir;
}

function writeRecord(dir: string, filename: string, body: string): void {
  writeFileSync(join(dir, filename), body);
}

const SINGLE_RECORD = [
  "---",
  "asOf: 2026-05-10T11:00:00.000Z",
  "---",
  "# CEO decision record: D-FOO",
  "- **Decision ID:** `D-FOO`",
  "- **Title:** Foo policy — adopt",
  "- **Action:** approve",
  "- **Outcome:** Approved as drafted.",
].join("\n");

describe("backfillCeoDecisionsFromRecords", () => {
  it("emits a CeoDecision event for an on-disk record not in the store", () => {
    const dir = newOwnerInbox();
    writeRecord(dir, "2026-05-10_scrooge_ceo-decision-record_d-foo.md", SINGLE_RECORD);
    const store = new EventStore(":memory:");

    const r = backfillCeoDecisionsFromRecords(dir, store);

    expect(r.emitted).toEqual(["D-FOO"]);
    expect(r.skipped).toEqual([]);
    const events = [...store.replay({ type: "CeoDecision" })];
    expect(events).toHaveLength(1);
    expect((events[0]?.payload as { decisionId: string }).decisionId).toBe("D-FOO");
  });

  it("is idempotent — second run skips ids already in the store", () => {
    const dir = newOwnerInbox();
    writeRecord(dir, "2026-05-10_scrooge_ceo-decision-record_d-foo.md", SINGLE_RECORD);
    const store = new EventStore(":memory:");

    const first = backfillCeoDecisionsFromRecords(dir, store);
    const second = backfillCeoDecisionsFromRecords(dir, store);

    expect(first.emitted).toEqual(["D-FOO"]);
    expect(second.emitted).toEqual([]);
    expect(second.skipped).toEqual(["D-FOO"]);
    const events = [...store.replay({ type: "CeoDecision" })];
    expect(events).toHaveLength(1);
  });

  it("emits one event per id for a multi-id record", () => {
    const dir = newOwnerInbox();
    writeRecord(
      dir,
      "2026-05-10_scrooge_ceo-decision-record_d-pack.md",
      [
        "---",
        "asOf: 2026-05-10T12:00:00.000Z",
        "---",
        "# Pack",
        "- **Decision IDs resolved:** `D-A` + `D-B` + `D-C`",
        "- **Action:** approve",
        "- **Title:** Six-pack",
      ].join("\n"),
    );
    const store = new EventStore(":memory:");

    const r = backfillCeoDecisionsFromRecords(dir, store);

    expect([...r.emitted].sort()).toEqual(["D-A", "D-B", "D-C"]);
    const events = [...store.replay({ type: "CeoDecision" })];
    expect(events).toHaveLength(3);
  });

  // ---------------------------------------------------------------------
  // Supersession: when a decisionId has multiple on-disk records (e.g.
  // a request-revision followed by a later approve), the dedup key is
  // (decisionId, asOf) — every record emits exactly one event. The
  // dashboard projection's "latest event by asOf wins" rule then routes
  // the decision correctly.
  //
  // Bug context: D-BANK-NAME-SELECTION had two records (2026-05-07
  // request-revision + 2026-05-09 approve "Hoz"). The earlier
  // bare-decisionId dedup emitted only the first event, so the
  // projection saw it as still "request-revision" / open. See
  // backfill-from-records.ts § Idempotency for the fix shape.
  // ---------------------------------------------------------------------

  const REVISION_RECORD = [
    "---",
    "asOf: 2026-05-07T13:34:39.660Z",
    "---",
    "# CEO decision record: D-BANK-NAME-SELECTION, 2026-05-07",
    "- **Decision ID:** `D-BANK-NAME-SELECTION`",
    "- **Title:** Bank name — selection from Linnea inaugural shortlist",
    "- **Action:** request-revision",
    "- **Outcome:** WITHDRAWN. Decision returned to open.",
  ].join("\n");

  const APPROVE_RECORD = [
    "---",
    "asOf: 2026-05-09T07:00:00.000Z",
    "---",
    "# CEO decision record: D-BANK-NAME-SELECTION, 2026-05-09 (revised)",
    "- **Decision ID:** `D-BANK-NAME-SELECTION`",
    "- **Title:** Bank-name selection — final (revised)",
    "- **Action:** approve",
    '- **Outcome:** **The bank\'s name is "Hoz."** Three letters.',
  ].join("\n");

  it("emits one event per record when the same decisionId is re-actioned", () => {
    const dir = newOwnerInbox();
    writeRecord(
      dir,
      "2026-05-07_scrooge_ceo-decision-record_d-bank-name-selection.md",
      REVISION_RECORD,
    );
    writeRecord(dir, "2026-05-09_scrooge_ceo-decision-record_d-bank-name-hoz.md", APPROVE_RECORD);
    const store = new EventStore(":memory:");

    const r = backfillCeoDecisionsFromRecords(dir, store);

    // Both records emit; the projection picks the latest-asOf event.
    expect([...r.emitted].sort()).toEqual(["D-BANK-NAME-SELECTION", "D-BANK-NAME-SELECTION"]);
    expect(r.skipped).toEqual([]);

    const events = [...store.replay({ type: "CeoDecision" })];
    const bankNameEvents = events.filter(
      (e) => (e.payload as { decisionId: string }).decisionId === "D-BANK-NAME-SELECTION",
    );
    expect(bankNameEvents).toHaveLength(2);

    // Project "latest by asOf wins" — mirrors reduceCeoDecisions in
    // dashboard/derive.ts. The supersession test asserts the projection
    // result without importing the full derive pipeline (Vera god-file
    // F-020 risk avoidance).
    const sorted = bankNameEvents.sort((a, b) => (a.as_of < b.as_of ? -1 : 1));
    const latest = sorted[sorted.length - 1];
    expect(latest).toBeDefined();
    expect((latest?.payload as { action: string }).action).toBe("approve");
    expect((latest?.payload as { outcome: string }).outcome).toContain("Hoz");
  });

  it("is idempotent on second boot when records are re-actioned", () => {
    const dir = newOwnerInbox();
    writeRecord(
      dir,
      "2026-05-07_scrooge_ceo-decision-record_d-bank-name-selection.md",
      REVISION_RECORD,
    );
    writeRecord(dir, "2026-05-09_scrooge_ceo-decision-record_d-bank-name-hoz.md", APPROVE_RECORD);
    const store = new EventStore(":memory:");

    const first = backfillCeoDecisionsFromRecords(dir, store);
    const second = backfillCeoDecisionsFromRecords(dir, store);

    expect(first.emitted).toHaveLength(2);
    expect(second.emitted).toEqual([]);
    expect([...second.skipped].sort()).toEqual(["D-BANK-NAME-SELECTION", "D-BANK-NAME-SELECTION"]);
    const events = [...store.replay({ type: "CeoDecision" })];
    expect(events).toHaveLength(2);
  });

  it("emits only the missing record when one is already in the store", () => {
    const dir = newOwnerInbox();
    writeRecord(
      dir,
      "2026-05-07_scrooge_ceo-decision-record_d-bank-name-selection.md",
      REVISION_RECORD,
    );
    writeRecord(dir, "2026-05-09_scrooge_ceo-decision-record_d-bank-name-hoz.md", APPROVE_RECORD);
    const store = new EventStore(":memory:");

    // Pre-seed an event matching the 2026-05-07 record; backfill should
    // skip that one and emit only the 2026-05-09 record.
    store.append({
      event_id: "evt-pre-existing",
      type: "CeoDecision",
      as_of: "2026-05-07T13:34:39.660Z",
      entity: "BANK-ZA-001",
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      payload: {
        decisionId: "D-BANK-NAME-SELECTION",
        title: "Bank name — selection",
        action: "request-revision",
        outcome: "WITHDRAWN.",
      },
    });

    const r = backfillCeoDecisionsFromRecords(dir, store);

    expect(r.emitted).toEqual(["D-BANK-NAME-SELECTION"]);
    expect(r.skipped).toEqual(["D-BANK-NAME-SELECTION"]);
    const events = [...store.replay({ type: "CeoDecision" })];
    expect(events).toHaveLength(2);
    // The newly emitted event is the 2026-05-09 record (approve / Hoz).
    const newest = events.find((e) => e.as_of === "2026-05-09T07:00:00.000Z");
    expect(newest).toBeDefined();
    expect((newest?.payload as { action: string }).action).toBe("approve");
    expect((newest?.payload as { outcome: string }).outcome).toContain("Hoz");
  });

  it("does not overwrite an existing event for the same (decisionId, asOf)", () => {
    const dir = newOwnerInbox();
    writeRecord(dir, "2026-05-10_scrooge_ceo-decision-record_d-foo.md", SINGLE_RECORD);
    const store = new EventStore(":memory:");

    // Pre-populate with a real CeoDecision event for D-FOO at the SAME
    // asOf as the on-disk record — backfill must not duplicate or
    // overwrite it.
    store.append({
      event_id: "evt-pre-existing",
      type: "CeoDecision",
      as_of: "2026-05-10T11:00:00.000Z",
      entity: "BANK-ZA-001",
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      payload: {
        decisionId: "D-FOO",
        title: "Foo (real event)",
        action: "modify",
        outcome: "Real-event outcome",
      },
    });

    const r = backfillCeoDecisionsFromRecords(dir, store);

    expect(r.emitted).toEqual([]);
    expect(r.skipped).toEqual(["D-FOO"]);
    const events = [...store.replay({ type: "CeoDecision" })];
    expect(events).toHaveLength(1);
    expect((events[0]?.payload as { outcome: string }).outcome).toBe("Real-event outcome");
  });
});
