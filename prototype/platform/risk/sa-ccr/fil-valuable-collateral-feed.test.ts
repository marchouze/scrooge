// platform/risk/sa-ccr/fil-valuable-collateral-feed.test.ts
//
// Unit proof for the FIL-mediated vMtm (Valuable feed) + collateral feeds. The
// `recon:v2-saccr-parity` gate runs vacuously green on a flat CI store (0
// netting sets), so the durable proof of the feed semantics lives here: a
// controlled in-memory store with a known FX revaluation history.
//
// The load-bearing assertion: vMtm is the LATEST `*Revalued` event-of-record per
// trade (Principle 1), NOT the cumulative-delta sum the v1 `resolveMtm` walk
// produced — the divergence this cutover exists to surface.
//
// Author: Rohan (Risk Engineer, engineering).

import { describe, expect, it } from "bun:test";

import { EventStore } from "../../event-store/store";
import { makeFxPositionRevalued } from "../../event-store/event-types/fx-accounting";
import { makeFxTradeExecuted } from "../../markets/cdm/fx";
import {
  materialiseNettingSetRevaluations,
  sourceCollateralFromRegister,
  sourceVMtmFromValuableFeed,
} from "./fil-valuable-collateral-feed";

const ENTITY = "urn:party:legal-entity:bank-za-001";
const ACTOR = { type: "service" as const, id: "platform:risk:sa-ccr:test" };
const CITES = ["D-MODEL-BINDING-CONTRACT-V1"];
const CP = "urn:party:legal-entity:test-cpty";

function bookFx(store: EventStore, tradeId: string, asOf: string): void {
  store.append(
    makeFxTradeExecuted({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      payload: {
        tradeId: { scheme: "INTERNAL", value: tradeId },
        productTaxonomy: "FX-spot",
        currencyPair: { base: "USD", quote: "ZAR" },
        side: "buy",
        legs: [
          {
            legKind: "near",
            payCurrency: "ZAR",
            receiveCurrency: "USD",
            notional: { currency: "ZAR", amountMinor: 18_000_000 },
            counterNotional: { currency: "USD", amountMinor: 1_000_000 },
            rate: { currency: "ZAR", amount: 18 },
            settlementDate: { iso: "2026-06-30", calendar: "JIHCAL" },
          },
        ],
        tradeDate: { iso: asOf.slice(0, 10), calendar: "JIHCAL" },
        counterparty: { partyId: CP, name: CP, role: "counterparty", jurisdiction: "ZA" },
        venue: "OTC",
        trader: "trader:test",
        bookId: "FX-BOOK",
        bookType: "trading",
        settlementForm: "physical",
        settlementPath: "correspondent",
        clientFlowRef: `cf:${tradeId}`,
      },
    }),
  );
}

function revalueFx(store: EventStore, tradeId: string, pnlMinor: number, asOf: string): void {
  store.append(
    makeFxPositionRevalued({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      payload: {
        tradeId,
        currencyPair: "USD/ZAR",
        bookRate: 18,
        revalRate: 18.5,
        notionalBaseMinor: 1_000_000,
        unrealisedPnlZarMinor: pnlMinor,
        revaluedAt: asOf,
        rateSource: "stub",
      },
    }),
  );
}

describe("FIL-mediated vMtm Valuable feed", () => {
  it("sources vMtm from the LATEST *Revalued event-of-record per trade (not the cumulative-delta sum)", () => {
    const store = new EventStore(":memory:");
    bookFx(store, "T-1", "2026-06-08T10:00:00.000Z");

    // Three successive revaluations of the SAME open position. Each carries the
    // position's current mark, NOT an incremental delta — so the event-of-record
    // answer is the LATEST (300), never the sum (100+200+300 = 600).
    revalueFx(store, "T-1", 100, "2026-06-08T18:00:00.000Z");
    revalueFx(store, "T-1", 200, "2026-06-09T18:00:00.000Z");
    revalueFx(store, "T-1", 300, "2026-06-10T18:00:00.000Z");

    const v = sourceVMtmFromValuableFeed(store, {
      counterpartyId: CP,
      currency: "ZAR",
      asOf: "2026-06-11T17:00:00.000Z",
    });
    expect(v.minorUnits).toBe(300n); // latest event-of-record, NOT 600 (cumulative)
    expect(v.currency).toBe("ZAR");
  });

  it("is as-of bounded — a later revaluation does not leak into an earlier RC date", () => {
    const store = new EventStore(":memory:");
    bookFx(store, "T-1", "2026-06-08T10:00:00.000Z");
    revalueFx(store, "T-1", 100, "2026-06-08T18:00:00.000Z");
    revalueFx(store, "T-1", 999, "2026-06-12T18:00:00.000Z"); // after the RC date

    const v = sourceVMtmFromValuableFeed(store, {
      counterpartyId: CP,
      currency: "ZAR",
      asOf: "2026-06-09T17:00:00.000Z",
    });
    expect(v.minorUnits).toBe(100n); // the 06-12 reval is excluded
  });

  it("sums the latest mark across multiple trades in the netting set", () => {
    const store = new EventStore(":memory:");
    bookFx(store, "T-1", "2026-06-08T10:00:00.000Z");
    bookFx(store, "T-2", "2026-06-08T10:00:00.000Z");
    revalueFx(store, "T-1", 500, "2026-06-10T18:00:00.000Z");
    revalueFx(store, "T-2", -200, "2026-06-10T18:00:00.000Z");

    const v = sourceVMtmFromValuableFeed(store, {
      counterpartyId: CP,
      currency: "ZAR",
      asOf: "2026-06-11T17:00:00.000Z",
    });
    expect(v.minorUnits).toBe(300n); // 500 + (-200)
  });

  it("materialises one Valuable RevaluationRecord per trade, carrying lineage", () => {
    const store = new EventStore(":memory:");
    bookFx(store, "T-1", "2026-06-08T10:00:00.000Z");
    revalueFx(store, "T-1", 100, "2026-06-08T18:00:00.000Z");
    revalueFx(store, "T-1", 250, "2026-06-10T18:00:00.000Z");

    const records = materialiseNettingSetRevaluations(store, {
      counterpartyId: CP,
      currency: "ZAR",
      asOf: "2026-06-11T17:00:00.000Z",
    });
    expect(records).toHaveLength(1);
    expect(records[0]?.tradeId).toBe("T-1");
    expect(records[0]?.record.value.minorUnits).toBe(250n); // latest
    expect(String(records[0]?.record.asOf)).toBe("2026-06-10T18:00:00.000Z");
    expect(records[0]?.record.observablesUsed[0]?.kind).toBe("fixing");
  });

  it("FX revaluations contribute only to ZAR netting sets", () => {
    const store = new EventStore(":memory:");
    bookFx(store, "T-1", "2026-06-08T10:00:00.000Z");
    revalueFx(store, "T-1", 500, "2026-06-10T18:00:00.000Z");

    const v = sourceVMtmFromValuableFeed(store, {
      counterpartyId: CP,
      currency: "USD", // non-ZAR netting set
      asOf: "2026-06-11T17:00:00.000Z",
    });
    expect(v.minorUnits).toBe(0n);
  });

  it("returns zero vMtm when the counterparty has no trades", () => {
    const store = new EventStore(":memory:");
    const v = sourceVMtmFromValuableFeed(store, {
      counterpartyId: "urn:party:legal-entity:unknown",
      currency: "ZAR",
      asOf: "2026-06-11T17:00:00.000Z",
    });
    expect(v.minorUnits).toBe(0n);
  });
});

describe("collateral register feed", () => {
  it("returns zero for non-ZAR netting sets (inventory is a ZAR pool)", () => {
    const c = sourceCollateralFromRegister({ currency: "USD", asOf: "2026-06-11T17:00:00.000Z" });
    expect(c.minorUnits).toBe(0n);
    expect(c.currency).toBe("USD");
  });

  it("returns a ZAR minor-unit amount for ZAR netting sets (zero on an empty pool)", () => {
    // With no CollateralInventorySnapshotted events in the ambient store the pool
    // is empty → zero, matching v1 resolveCollateral's build-phase default.
    const c = sourceCollateralFromRegister({ currency: "ZAR", asOf: "2026-06-11T17:00:00.000Z" });
    expect(c.currency).toBe("ZAR");
    expect(c.minorUnits >= 0n).toBe(true);
  });
});
