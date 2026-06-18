// platform/markets/products/npa-fx-accounting-deferred-gaps.test.ts
//
// Unit tests for the FX accounting deferred-gap recorder + the append-only
// closure (WS-ACCT-FX-COMPLETENESS Slice 3; WS-FIL-FX-SETTLEMENT-EVENTS Slice 4).
//
// After WS-FIL-FX-SETTLEMENT-EVENTS the five FX-posting-completeness gaps are
// RESOLVED (the FIL settlement event family fires every rule at fold time), so:
//   - the recorder records only the ACTIVE (still-open) subset — now empty;
//   - `runFxAccountingGapClosure` re-emits the attestation with the resolved
//     gaps removed (latest-wins, append-only — the original events stay).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, test } from "bun:test";

import {
  FX_SETTLEMENT_DEFERRED_GAPS,
  activeFxSettlementDeferredGaps,
} from "../../../v2-core/posting-rules/fx-settlement";
import {
  type ProductDeferredGap,
  makeProductDimensionAttested,
} from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import { EventStore } from "../../event-store/store";
import {
  FX_ACCT_DIMENSION,
  FX_ACCT_PRODUCT_ID,
  fxAccountingDeferredGaps,
  recordFxAccountingDeferredGaps,
  resolvedFxAccountingGapIds,
  runFxAccountingGapClosure,
} from "./npa-fx-accounting-deferred-gaps";

/** Seed an accounting attestation, optionally carrying the five deferred gaps. */
function seedAccountingAttestation(store: EventStore, withGaps: boolean): void {
  const deferredGaps: ProductDeferredGap[] | undefined = withGaps
    ? FX_SETTLEMENT_DEFERRED_GAPS.map((g) => ({
        gapId: g.gapId,
        title: g.title,
        owner: g.owner,
        targetTrigger: g.targetTrigger,
        citations: [...g.citations],
      }))
    : undefined;
  store.append({
    ...makeProductDimensionAttested({
      asOf: "2026-06-17T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:saskia:fx-npa-cycle" },
      citations: ["D-FX-NPA-RESTART", "dimension:accounting"],
      payload: {
        productId: FX_ACCT_PRODUCT_ID,
        dimension: FX_ACCT_DIMENSION,
        result: "design-attested",
        citationChain: ["D-FX-NPA-RESTART", "IFRS-9-§4.1.4"],
        ...(deferredGaps ? { deferredGaps } : {}),
      },
    }),
    provenance: buildPhaseFixtureTag({
      sourceLineage: "test:seed",
      variant: "test:fx-accounting-attestation",
      tags: ["test"],
    }),
  });
}

function latestAcctGaps(store: EventStore): string[] {
  let gaps: string[] = [];
  let latestAsOf = "";
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as {
      productId?: string;
      dimension?: string;
      deferredGaps?: Array<{ gapId: string }>;
    };
    if (p.productId !== FX_ACCT_PRODUCT_ID || p.dimension !== FX_ACCT_DIMENSION) continue;
    if (ev.as_of >= latestAsOf) {
      latestAsOf = ev.as_of;
      gaps = (p.deferredGaps ?? []).map((g) => g.gapId);
    }
  }
  return gaps;
}

describe("recordFxAccountingDeferredGaps — records only ACTIVE gaps", () => {
  test("no-op on a clean store (no accounting attestation to carry forward)", () => {
    const store = new EventStore(":memory:");
    const res = recordFxAccountingDeferredGaps(store);
    expect(res.recorded).toBe(false);
    expect(res.skipped).toBe(true);
  });

  test("records nothing now — all five gaps resolved (active subset empty)", () => {
    expect(activeFxSettlementDeferredGaps().length).toBe(0);
    expect(fxAccountingDeferredGaps().length).toBe(0);
    const store = new EventStore(":memory:");
    seedAccountingAttestation(store, /* withGaps */ false);
    const res = recordFxAccountingDeferredGaps(store);
    // No active gaps to add → skip.
    expect(res.recorded).toBe(false);
    expect(res.skipped).toBe(true);
    expect(latestAcctGaps(store).length).toBe(0);
  });
});

describe("runFxAccountingGapClosure — append-only resolution of the five gaps", () => {
  test("removes the five resolved gaps from the latest attestation (latest-wins)", () => {
    const store = new EventStore(":memory:");
    seedAccountingAttestation(store, /* withGaps */ true);
    expect(latestAcctGaps(store).length).toBe(5);

    const res = runFxAccountingGapClosure(store);
    expect(res.closed).toBe(true);
    expect(res.gapsBefore).toBe(5);
    expect(res.gapsAfter).toBe(0);
    expect(latestAcctGaps(store).length).toBe(0);
    // Append-only: the original gap-carrying attestation event is STILL in the
    // log (two ProductDimensionAttested events for the FX accounting dimension).
    const all = [...store.replay({ type: "ProductDimensionAttested" })].filter((ev) => {
      const p = ev.payload as { productId?: string; dimension?: string };
      return p.productId === FX_ACCT_PRODUCT_ID && p.dimension === FX_ACCT_DIMENSION;
    });
    expect(all.length).toBe(2);
  });

  test("the five resolved gap ids are exactly the FX settlement gaps", () => {
    expect([...resolvedFxAccountingGapIds()].sort()).toEqual(
      FX_SETTLEMENT_DEFERRED_GAPS.map((g) => g.gapId).sort(),
    );
  });

  test("idempotent — re-running after closure is a skip (resolved gaps already gone)", () => {
    const store = new EventStore(":memory:");
    seedAccountingAttestation(store, /* withGaps */ true);
    runFxAccountingGapClosure(store);
    const second = runFxAccountingGapClosure(store);
    expect(second.closed).toBe(false);
    expect(second.skipped).toBe(true);
    expect(latestAcctGaps(store).length).toBe(0);
  });

  test("carries the prior verdict forward unchanged (resolution is non-blocking)", () => {
    const store = new EventStore(":memory:");
    seedAccountingAttestation(store, /* withGaps */ true);
    runFxAccountingGapClosure(store);
    let latestResult = "";
    let latestAsOf = "";
    for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
      const p = ev.payload as { productId?: string; dimension?: string; result?: string };
      if (p.productId !== FX_ACCT_PRODUCT_ID || p.dimension !== FX_ACCT_DIMENSION) continue;
      if (ev.as_of >= latestAsOf) {
        latestAsOf = ev.as_of;
        latestResult = p.result ?? "";
      }
    }
    expect(latestResult).toBe("design-attested");
  });

  test("fail-closed: refuses with no accounting attestation of record", () => {
    const store = new EventStore(":memory:");
    const res = runFxAccountingGapClosure(store);
    expect(res.closed).toBe(false);
    expect(res.blockedReason).toBeDefined();
  });
});
