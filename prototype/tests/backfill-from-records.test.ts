// tests/backfill-from-records.test.ts
//
// D-DECISIONS-FRAMEWORK-REDESIGN Slice D — RETIRED tests.
//
// The `backfillCeoDecisionsFromRecords` function is now a no-op stub.
// Historical test cases that asserted legacy `CeoDecision` emission are
// replaced by a single test confirming the stub always returns empty
// results (backwards-compat contract).
//
// The behaviour under test was:
//   - Scan Owner Inbox/ for *_ceo-decision-record_*.md files.
//   - Emit CeoDecision events for records not already in the store.
//   - Idempotent on re-run.
//
// That behaviour now belongs to `scripts/migrate/backfill-all-decisions.ts`
// (tested in tests/backfill-all-decisions.test.ts).
//
// Authority: D-DECISIONS-FRAMEWORK-REDESIGN Slice D (CEO-approved 2026-05-16).
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import { backfillCeoDecisionsFromRecords } from "../runtime/decisions/backfill-from-records";

describe("backfillCeoDecisionsFromRecords (retired stub)", () => {
  it("returns empty emitted + skipped arrays (no-op stub)", () => {
    const store = new EventStore(":memory:");
    const r = backfillCeoDecisionsFromRecords("/any/path", store);
    expect(r.emitted).toEqual([]);
    expect(r.skipped).toEqual([]);
  });

  it("does not append any events to the store", () => {
    const store = new EventStore(":memory:");
    backfillCeoDecisionsFromRecords("/any/path", store);
    const all = [...store.replay({})];
    expect(all).toHaveLength(0);
  });

  it("is idempotent — multiple calls still return empty results", () => {
    const store = new EventStore(":memory:");
    const first = backfillCeoDecisionsFromRecords("/any/path", store);
    const second = backfillCeoDecisionsFromRecords("/any/path", store);
    expect(first.emitted).toEqual([]);
    expect(second.emitted).toEqual([]);
  });
});
