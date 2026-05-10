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

  it("does not overwrite an existing event for the same decisionId", () => {
    const dir = newOwnerInbox();
    writeRecord(dir, "2026-05-10_scrooge_ceo-decision-record_d-foo.md", SINGLE_RECORD);
    const store = new EventStore(":memory:");

    // Pre-populate with a real CeoDecision event for D-FOO with a
    // different outcome — backfill must not duplicate or overwrite it.
    store.append({
      event_id: "evt-pre-existing",
      type: "CeoDecision",
      as_of: "2026-05-10T09:00:00.000Z",
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
