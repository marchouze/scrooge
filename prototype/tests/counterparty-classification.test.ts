// tests/counterparty-classification.test.ts
//
// resolveCounterpartyBaselClass — latest-effective Basel-class resolution from
// CounterpartyBaselClassAssigned events, and the RWA projection's use of it
// (authoritative class over the prudent corporate-non-ig fallback).
// Authority: D-FX-COUNTERPARTY-BASEL-CLASSIFICATION; BCBS CRE20.

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { makeCounterpartyBaselClassAssigned } from "../platform/event-store/event-types/counterparty-credit-risk";
import { EventStore } from "../platform/event-store/store";
import { makeFxTradeExecuted } from "../platform/markets/cdm/fx";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";
import { computeRwaFromPositions } from "../platform/projections/rwa-from-positions";
import {
  resolveAllCounterpartyClasses,
  resolveCounterpartyBaselClass,
} from "../platform/risk/counterparty-classification";
import type { FilEventRef } from "../v2-core/fil-core/lifecycle";
import type { Instant } from "../v2-core/fil-core/primitives";
import type { FilInstanceUrn, FilTypeUrn } from "../v2-core/fil-core/urn";
import type { FilInstanceLifecycleEvent } from "../v2-core/fil-instances";
import { computeSaCcr } from "../v2-core/fil-models/sa-ccr";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:helena:cro" };
const CITES = ["D-FX-COUNTERPARTY-BASEL-CLASSIFICATION", "BCBS-CRE20"];

function assignClass(
  store: EventStore,
  opts: {
    counterpartyId: string;
    baselClass: Parameters<typeof makeCounterpartyBaselClassAssigned>[0]["payload"]["baselClass"];
    effectiveFrom: string;
    ratingBucket?: "aaa-aa" | "a" | "bbb" | "bb" | "below-bb" | "unrated";
  },
): void {
  store.append(
    makeCounterpartyBaselClassAssigned({
      asOf: opts.effectiveFrom,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      payload: {
        counterpartyId: opts.counterpartyId,
        baselClass: opts.baselClass,
        ...(opts.ratingBucket ? { ratingBucket: opts.ratingBucket } : {}),
        assignedBy: "Helena (CRO)",
        approverAuthority: "CRO",
        rationale: "test assessment",
        evidenceRef: "doc:test",
        effectiveFrom: opts.effectiveFrom,
        assignedAt: opts.effectiveFrom,
      },
    }),
  );
}

describe("resolveCounterpartyBaselClass", () => {
  it("returns null when no assignment exists", () => {
    const store = new EventStore(":memory:");
    expect(resolveCounterpartyBaselClass(store, "CP-X")).toBeNull();
    store.close();
  });

  it("returns the assigned class", () => {
    const store = new EventStore(":memory:");
    assignClass(store, { counterpartyId: "CP-A", baselClass: "bank", effectiveFrom: "2026-06-01" });
    const r = resolveCounterpartyBaselClass(store, "CP-A");
    expect(r?.baselClass).toBe("bank");
    store.close();
  });

  it("latest-effective assignment wins", () => {
    const store = new EventStore(":memory:");
    assignClass(store, {
      counterpartyId: "CP-A",
      baselClass: "corporate-non-ig",
      effectiveFrom: "2026-06-01",
    });
    assignClass(store, {
      counterpartyId: "CP-A",
      baselClass: "corporate-ig",
      effectiveFrom: "2026-06-05",
    });
    expect(resolveCounterpartyBaselClass(store, "CP-A")?.baselClass).toBe("corporate-ig");
    store.close();
  });

  it("ignores an assignment whose effectiveFrom is after asOf", () => {
    const store = new EventStore(":memory:");
    assignClass(store, {
      counterpartyId: "CP-A",
      baselClass: "bank",
      effectiveFrom: "2026-06-10",
    });
    // asOf before the assignment takes effect → not in effect yet
    expect(resolveCounterpartyBaselClass(store, "CP-A", "2026-06-05")).toBeNull();
    expect(resolveCounterpartyBaselClass(store, "CP-A", "2026-06-15")?.baselClass).toBe("bank");
    store.close();
  });

  it("resolveAllCounterpartyClasses returns a per-counterparty map", () => {
    const store = new EventStore(":memory:");
    assignClass(store, { counterpartyId: "CP-A", baselClass: "bank", effectiveFrom: "2026-06-01" });
    assignClass(store, { counterpartyId: "CP-B", baselClass: "pse", effectiveFrom: "2026-06-01" });
    const m = resolveAllCounterpartyClasses(store);
    expect(m.get("CP-A")?.baselClass).toBe("bank");
    expect(m.get("CP-B")?.baselClass).toBe("pse");
    expect(m.size).toBe(2);
    store.close();
  });
});

// ---------------------------------------------------------------------------
// FIL SA-CCR instance helper (post-flip: CcrEadComputed events no longer drive
// credit RWA; FIL instances are the data source).
// ---------------------------------------------------------------------------

function makeFilFxInstance(opts: {
  tradeId: string;
  counterpartyId: string;
  currency: string;
  notionalMinorUnits: bigint;
  settlementDate?: string;
}): FilInstanceLifecycleEvent {
  const nettingSetId = `NS-${opts.counterpartyId}-${opts.currency}`;
  return {
    kind: "FilInstrumentCreated",
    instance: `fil:inst:LE-ZA-HOZ-BANK:${opts.tradeId}` as FilInstanceUrn,
    type: "fil:type:fx:vanilla:v1.0@1.0" as FilTypeUrn,
    tenant: "LE-ZA-HOZ-BANK",
    asOf: "2026-06-01T00:00:00.000Z" as Instant,
    originatingEvent: { eventType: "FxTradeExecuted" as FilEventRef, eventId: opts.tradeId },
    initialStage: "active",
    economicTerms: {
      assetClass: "fx",
      notional: { currency: opts.currency, minorUnits: opts.notionalMinorUnits },
      direction: "long",
      counterpartyId: opts.counterpartyId,
      nettingSetId,
      currency: opts.currency,
      settlementDate: opts.settlementDate ?? "2030-12-31",
    },
  };
}

function computeExpectedEad(opts: {
  counterpartyId: string;
  currency: string;
  notionalMinorUnits: bigint;
  asOf: string;
}): number {
  const ns = {
    nettingSetId: `NS-${opts.counterpartyId}-${opts.currency}`,
    counterpartyId: opts.counterpartyId,
    csaPresent: false,
    currency: opts.currency,
  };
  const { ead } = computeSaCcr({
    nettingSet: ns,
    vMtm: { currency: opts.currency, minorUnits: 0n },
    collateralHeld: { currency: opts.currency, minorUnits: 0n },
    trades: [
      {
        tradeId: "T-001",
        counterpartyId: opts.counterpartyId,
        nettingSetId: ns.nettingSetId,
        assetClass: "fx",
        notional: { currency: opts.currency, minorUnits: opts.notionalMinorUnits },
        direction: "long",
        remainingYears: 4.6,
        currency: opts.currency,
      },
    ],
    asOf: opts.asOf,
  });
  return Number(ead.ead.minorUnits);
}

describe("rwa-from-positions uses the authoritative class over the fallback (FIL SA-CCR path)", () => {
  const AS_OF_CC = "2026-06-11T18:00:00.000Z";
  const NOTIONAL = 100_000_000_00n; // large notional → non-trivial EAD

  beforeEach(() => setDefaultProvenanceModeOverride("combined"));
  afterEach(() => setDefaultProvenanceModeOverride(undefined));

  it("falls back to corporate-non-ig (100%) when unclassified", () => {
    const store = new EventStore(":memory:");
    const instances = [
      makeFilFxInstance({
        tradeId: "T-001",
        counterpartyId: "CP-UNCLASSIFIED",
        currency: "ZAR",
        notionalMinorUnits: NOTIONAL,
      }),
    ];
    const { output } = computeRwaFromPositions(store, AS_OF_CC, undefined, instances);
    // corporate-non-ig unrated → 100% RW → credit RWA == EAD
    const expected = computeExpectedEad({
      counterpartyId: "CP-UNCLASSIFIED",
      currency: "ZAR",
      notionalMinorUnits: NOTIONAL,
      asOf: AS_OF_CC,
    });
    expect(expected).toBeGreaterThan(0);
    expect(output.credit.totalMinor).toBe(expected);
    const labels = output.credit.lines.map((l) => l.label).join(" ");
    expect(labels).toContain("corporate-non-ig");
    store.close();
  });

  it("converts a non-ZAR EAD to ZAR before it enters CreditRWA (D-FX-EAD-FX-CONVERSION)", () => {
    const store = new EventStore(":memory:");
    // FxTradeExecuted provides the USD/ZAR rate (18 ZAR per 1 USD) to the rate map.
    store.append(
      makeFxTradeExecuted({
        asOf: "2026-06-11T10:00:00.000Z",
        entity: ENTITY,
        actor: { type: "service", id: "agent:test" },
        citations: CITES,
        payload: {
          tradeId: { scheme: "INTERNAL", value: "RATE-1" },
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
              settlementDate: { iso: "2026-06-13", calendar: "JIHCAL" },
            },
          ],
          tradeDate: { iso: "2026-06-11", calendar: "JIHCAL" },
          counterparty: {
            partyId: "CP-RATE",
            name: "CP-RATE",
            role: "counterparty",
            jurisdiction: "ZA",
          },
          venue: "OTC",
          trader: "trader:test",
          bookId: "FX-BOOK",
          bookType: "trading",
          settlementForm: "physical",
          settlementPath: "correspondent",
          clientFlowRef: "cf:RATE-1",
        },
      }),
    );
    // FIL instance for a USD-denominated netting set.
    const USD_NOTIONAL = 100_000_000n; // USD 1,000,000 in minor (cents)
    const instances = [
      makeFilFxInstance({
        tradeId: "T-USD-001",
        counterpartyId: "CP-USD",
        currency: "USD",
        notionalMinorUnits: USD_NOTIONAL,
      }),
    ];
    const { output } = computeRwaFromPositions(store, AS_OF_CC, undefined, instances);
    // Expected: FIL SA-CCR EAD in USD × 18 ZAR/USD × 100% RW
    const eadUsd = computeExpectedEad({
      counterpartyId: "CP-USD",
      currency: "USD",
      notionalMinorUnits: USD_NOTIONAL,
      asOf: AS_OF_CC,
    });
    const expectedZar = eadUsd * 18; // USD minor × 18 → ZAR minor (rate from FxTradeExecuted)
    expect(eadUsd).toBeGreaterThan(0);
    expect(output.credit.totalMinor).toBe(expectedZar);
    const note = output.credit.lines.map((l) => l.label).join(" ");
    expect(note).toContain("corporate-non-ig");
    store.close();
  });

  it("applies the authoritative class when assigned (bank → lower RW than 100%)", () => {
    const store = new EventStore(":memory:");
    assignClass(store, {
      counterpartyId: "CP-BANK",
      baselClass: "bank",
      effectiveFrom: "2026-06-01",
      ratingBucket: "a",
    });
    const instances = [
      makeFilFxInstance({
        tradeId: "T-002",
        counterpartyId: "CP-BANK",
        currency: "ZAR",
        notionalMinorUnits: NOTIONAL,
      }),
    ];
    const { output } = computeRwaFromPositions(store, AS_OF_CC, undefined, instances);
    const uncategorisedEad = computeExpectedEad({
      counterpartyId: "CP-BANK",
      currency: "ZAR",
      notionalMinorUnits: NOTIONAL,
      asOf: AS_OF_CC,
    });
    // A bank exposure attracts a lower standardised RW than corporate-non-ig 100%.
    expect(output.credit.totalMinor).toBeGreaterThan(0);
    expect(output.credit.totalMinor).toBeLessThan(uncategorisedEad);
    const labels = output.credit.lines.map((l) => l.label).join(" ");
    expect(labels).toContain("bank");
    store.close();
  });
});
