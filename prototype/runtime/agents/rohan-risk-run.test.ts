// runtime/agents/rohan-risk-run.test.ts
//
// Unit tests for rohan-risk-run store-derived helpers:
//
//   readLatestHelenaSnapshot:
//   - Empty store → { asOf: null, lineStatuses: {} } (no-snapshot fallback)
//   - One RiskAppetiteSnapshot → consumes the event's `lineStatuses`
//     payload directly (NOT a local shadow — the shadow was deleted)
//   - Latest snapshot wins when several exist (max as_of)
//
//   hasModelValidationApproved:
//   - Empty store → false (independent-validation staffing gap still open)
//   - ≥1 ModelValidationApproved → true (gap closed; Nadia hired 2026-05-09)
//
// These two helpers are the store-derive seam introduced under
// D-CRO-GAP-REMEDIATION-FOLLOWON: Rohan (Risk engineer) reads Helena
// (CRO) appetite-line status from the event, and derives the
// independent-validation staffing gap from ModelValidationApproved
// presence rather than carrying stale static prose.
//
// The handler itself reads the module-global eventStore (matching the
// scope of the other co-located handler tests); these helpers accept an
// injectable store so the derive logic is testable in isolation.
//
// Authority: D-CRO-GAP-REMEDIATION-FOLLOWON.
// Author: Rohan (Risk engineer) — handler; Atlas (Substrate engineer) — runtime.

import { describe, expect, it } from "bun:test";

import { makeModelValidationApproved } from "../../platform/event-store/event-types/model-risk";
import { makeRiskAppetiteSnapshot } from "../../platform/event-store/event-types/risk-treasury-extended";
import { EventStore } from "../../platform/event-store/store";
import { hasModelValidationApproved, readLatestHelenaSnapshot } from "./rohan-risk-run";

function makeStore(): EventStore {
  // Raw in-memory EventStore — these helpers only replay() (reads) plus
  // the test seeds via append(); no permission-gate carve-out required
  // (matches the rohan-goal-loop.test.ts raw-store pattern).
  return new EventStore(":memory:");
}

const BASE_CITATIONS = ["RAS-FRAMEWORK-2026-05-06"];
const BASE_ENTITY = "LE-ZA-HOZ-BANK";

function appendHelenaSnapshot(
  store: EventStore,
  asOf: string,
  lineStatuses: Record<string, string>,
): void {
  store.append(
    makeRiskAppetiteSnapshot({
      asOf,
      entity: BASE_ENTITY,
      actor: { type: "service", id: "agent:helena:risk-appetite-watch" },
      citations: BASE_CITATIONS,
      payload: {
        appetiteLineCount: Object.keys(lineStatuses).length,
        measuredCount: 0,
        unmeasuredCount: Object.keys(lineStatuses).length,
        lineStatuses,
        runTrigger: "test:helena-watch",
      },
    }),
  );
}

function appendModelValidationApproved(store: EventStore, modelId: string, asOf: string): void {
  store.append(
    makeModelValidationApproved({
      asOf,
      entity: BASE_ENTITY,
      actor: { type: "service", id: "agent:nadia:model-validation" },
      citations: BASE_CITATIONS,
      payload: {
        modelId,
        version: "v1.0",
        approvedBy: "Nadia",
        validationFindingsResolved: [],
        expiryDate: "2027-06-08T00:00:00.000Z",
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// readLatestHelenaSnapshot — appetite-line status read from the event
// ---------------------------------------------------------------------------

describe("readLatestHelenaSnapshot", () => {
  it("returns the no-snapshot fallback on an empty store", () => {
    const r = readLatestHelenaSnapshot(makeStore());
    expect(r.asOf).toBeNull();
    expect(r.lineStatuses).toEqual({});
  });

  it("consumes the event's lineStatuses payload (not a local shadow)", () => {
    const store = makeStore();
    const lineStatuses = {
      "appetite:liquidity:lcr": "green",
      "appetite:capital:cet1-buffer": "amber",
      "appetite:model:tier-discipline": "green",
    };
    appendHelenaSnapshot(store, "2026-06-08T06:00:00.000Z", lineStatuses);
    const r = readLatestHelenaSnapshot(store);
    expect(r.asOf).toBe("2026-06-08T06:00:00.000Z");
    // The statuses come straight from the event — proving the read is
    // off the event payload, not a hand-copied shadow (which would have
    // returned every line as "unmeasured").
    expect(r.lineStatuses).toEqual(lineStatuses);
    expect(r.lineStatuses["appetite:liquidity:lcr"]).toBe("green");
  });

  it("returns the latest snapshot when several exist (max as_of)", () => {
    const store = makeStore();
    appendHelenaSnapshot(store, "2026-06-06T06:00:00.000Z", {
      "appetite:liquidity:lcr": "red",
    });
    appendHelenaSnapshot(store, "2026-06-08T06:00:00.000Z", {
      "appetite:liquidity:lcr": "green",
    });
    const r = readLatestHelenaSnapshot(store);
    expect(r.asOf).toBe("2026-06-08T06:00:00.000Z");
    expect(r.lineStatuses["appetite:liquidity:lcr"]).toBe("green");
  });

  it("tolerates a snapshot with no lineStatuses field (older shape)", () => {
    const store = makeStore();
    store.append(
      makeRiskAppetiteSnapshot({
        asOf: "2026-06-08T06:00:00.000Z",
        entity: BASE_ENTITY,
        actor: { type: "service", id: "agent:helena:risk-appetite-watch" },
        citations: BASE_CITATIONS,
        payload: { appetiteLineCount: 5, measuredCount: 1 },
      }),
    );
    const r = readLatestHelenaSnapshot(store);
    expect(r.asOf).toBe("2026-06-08T06:00:00.000Z");
    expect(r.lineStatuses).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// hasModelValidationApproved — independent-validation staffing gap derive
// ---------------------------------------------------------------------------

describe("hasModelValidationApproved", () => {
  it("is false on an empty store (staffing gap still open)", () => {
    expect(hasModelValidationApproved(makeStore())).toBe(false);
  });

  it("is true once a ModelValidationApproved event exists (gap closed)", () => {
    const store = makeStore();
    appendModelValidationApproved(store, "model:fx-spot-var-v0", "2026-05-20T09:00:00.000Z");
    expect(hasModelValidationApproved(store)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Acceptance-gate scenario: populated store → live statuses consumed +
// staffing gap closed; empty store → valid no-snapshot fallback.
// ---------------------------------------------------------------------------

describe("rohan-risk-run — derive-from-store acceptance", () => {
  it("populated store: lineStatuses come from the event AND staffing gap is closed", () => {
    const store = makeStore();
    appendHelenaSnapshot(store, "2026-06-08T06:00:00.000Z", {
      "appetite:model:tier-discipline": "green",
      "appetite:liquidity:lcr": "green",
    });
    appendModelValidationApproved(store, "model:fx-spot-var-v0", "2026-05-20T09:00:00.000Z");

    const snap = readLatestHelenaSnapshot(store);
    expect(Object.keys(snap.lineStatuses).length).toBe(2);
    expect(snap.lineStatuses["appetite:model:tier-discipline"]).toBe("green");
    // Gap derived as CLOSED → the "Independent Validation not yet
    // staffed" bullet is dropped from the run report.
    expect(hasModelValidationApproved(store)).toBe(true);
  });

  it("empty store: no-snapshot fallback yields a valid (empty) appetite set + open gap", () => {
    const store = makeStore();
    const snap = readLatestHelenaSnapshot(store);
    expect(snap.asOf).toBeNull();
    expect(Object.keys(snap.lineStatuses).length).toBe(0);
    // No ModelValidationApproved → gap still surfaces (fallback prose).
    expect(hasModelValidationApproved(store)).toBe(false);
  });
});
