// tests/counterparty-classification.test.ts
//
// resolveCounterpartyBaselClass — latest-effective Basel-class resolution from
// CounterpartyBaselClassAssigned events, and the RWA projection's use of it
// (authoritative class over the prudent corporate-non-ig fallback).
// Authority: D-FX-COUNTERPARTY-BASEL-CLASSIFICATION; BCBS CRE20.

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  makeCcrEadComputed,
  makeCounterpartyBaselClassAssigned,
} from "../platform/event-store/event-types/counterparty-credit-risk";
import { EventStore } from "../platform/event-store/store";
import { makeFxTradeExecuted } from "../platform/markets/cdm/fx";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";
import { computeRwaFromPositions } from "../platform/projections/rwa-from-positions";
import {
  resolveAllCounterpartyClasses,
  resolveCounterpartyBaselClass,
} from "../platform/risk/counterparty-classification";

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

describe("rwa-from-positions uses the authoritative class over the fallback", () => {
  beforeEach(() => setDefaultProvenanceModeOverride("combined"));
  afterEach(() => setDefaultProvenanceModeOverride(undefined));

  function appendEad(store: EventStore, counterpartyId: string): void {
    store.append(
      makeCcrEadComputed({
        asOf: "2026-06-11T17:00:00.000Z",
        entity: ENTITY,
        actor: { type: "service", id: "agent:rohan" },
        citations: ["BCBS-279"],
        payload: {
          nettingSetId: `NS-${counterpartyId}-ZAR`,
          counterpartyId,
          rc: 1_000_000,
          pfe: 200_000,
          alpha: 1.4,
          ead: 1_680_000,
          currency: "ZAR",
          computationDate: "2026-06-11",
          methodology: "sa-ccr",
          sourceEvents: { rcEventId: "rc-1", pfeComponents: 1 },
        },
      }),
    );
  }

  it("falls back to corporate-non-ig (100%) when unclassified", () => {
    const store = new EventStore(":memory:");
    appendEad(store, "CP-UNCLASSIFIED");
    const { output } = computeRwaFromPositions(store, "2026-06-11T18:00:00.000Z");
    // corporate-non-ig unrated → 100% RW → credit RWA == EAD.
    expect(output.credit.totalMinor).toBe(1_680_000);
    const labels = output.credit.lines.map((l) => l.label).join(" ");
    expect(labels).toContain("corporate-non-ig");
    store.close();
  });

  it("converts a non-ZAR EAD to ZAR before it enters CreditRWA (D-FX-EAD-FX-CONVERSION)", () => {
    const store = new EventStore(":memory:");
    // An FxTradeExecuted gives the USD/ZAR rate (18 ZAR per 1 USD) to the rate map.
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
    // A USD-denominated SA-CCR EAD of USD 100,000 (10,000,000 minor).
    store.append(
      makeCcrEadComputed({
        asOf: "2026-06-11T17:00:00.000Z",
        entity: ENTITY,
        actor: { type: "service", id: "agent:rohan" },
        citations: ["BCBS-279"],
        payload: {
          nettingSetId: "NS-CP-USD-USD",
          counterpartyId: "CP-USD",
          rc: 6_000_000,
          pfe: 1_142_857,
          alpha: 1.4,
          ead: 10_000_000, // USD 100,000.00
          currency: "USD",
          computationDate: "2026-06-11",
          methodology: "sa-ccr",
          sourceEvents: { rcEventId: "rc-usd", pfeComponents: 1 },
        },
      }),
    );
    const { output } = computeRwaFromPositions(store, "2026-06-11T18:00:00.000Z");
    // USD 10,000,000 minor × 18 = ZAR 180,000,000 minor at 100% (corporate-non-ig) RW.
    expect(output.credit.totalMinor).toBe(180_000_000);
    const note = output.credit.lines.map((l) => l.label).join(" ");
    expect(note).toContain("corporate-non-ig");
    store.close();
  });

  it("applies the authoritative class when assigned (bank → lower RW than 100%)", () => {
    const store = new EventStore(":memory:");
    appendEad(store, "CP-BANK");
    assignClass(store, {
      counterpartyId: "CP-BANK",
      baselClass: "bank",
      effectiveFrom: "2026-06-01",
      ratingBucket: "a",
    });
    const { output } = computeRwaFromPositions(store, "2026-06-11T18:00:00.000Z");
    // A bank exposure attracts a lower standardised RW than corporate-non-ig 100%.
    expect(output.credit.totalMinor).toBeLessThan(1_680_000);
    const labels = output.credit.lines.map((l) => l.label).join(" ");
    expect(labels).toContain("bank");
    store.close();
  });
});
