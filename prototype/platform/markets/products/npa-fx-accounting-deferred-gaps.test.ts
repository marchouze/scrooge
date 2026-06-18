// platform/markets/products/npa-fx-accounting-deferred-gaps.test.ts
//
// Unit tests for the FX accounting deferred-gap recorder (WS-ACCT-FX-
// COMPLETENESS Slice 3). Proves: (a) no-op on a clean store, (b) merges the
// 5 FX-posting-completeness gaps onto an existing accounting attestation
// (latest-wins, verdict carried forward), (c) idempotent.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, test } from "bun:test";

import { makeProductDimensionAttested } from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import { EventStore } from "../../event-store/store";
import {
  FX_ACCT_DIMENSION,
  FX_ACCT_PRODUCT_ID,
  fxAccountingDeferredGaps,
  recordFxAccountingDeferredGaps,
} from "./npa-fx-accounting-deferred-gaps";

function seedAccountingAttestation(store: EventStore): void {
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

describe("recordFxAccountingDeferredGaps", () => {
  test("no-op on a clean store (no accounting attestation to carry forward)", () => {
    const store = new EventStore(":memory:");
    const res = recordFxAccountingDeferredGaps(store);
    expect(res.recorded).toBe(false);
    expect(res.skipped).toBe(true);
  });

  test("merges the 5 FX posting-completeness gaps onto the latest accounting attestation", () => {
    const store = new EventStore(":memory:");
    seedAccountingAttestation(store);
    const res = recordFxAccountingDeferredGaps(store);
    expect(res.recorded).toBe(true);
    const gapIds = latestAcctGaps(store);
    for (const g of fxAccountingDeferredGaps()) {
      expect(gapIds).toContain(g.gapId);
    }
    expect(gapIds.length).toBe(5);
  });

  test("idempotent — re-running does not duplicate gaps", () => {
    const store = new EventStore(":memory:");
    seedAccountingAttestation(store);
    recordFxAccountingDeferredGaps(store);
    const second = recordFxAccountingDeferredGaps(store);
    expect(second.recorded).toBe(false);
    expect(second.skipped).toBe(true);
    expect(latestAcctGaps(store).length).toBe(5);
  });

  test("carries the prior verdict forward unchanged (gaps are non-blocking)", () => {
    const store = new EventStore(":memory:");
    seedAccountingAttestation(store);
    recordFxAccountingDeferredGaps(store);
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
});
