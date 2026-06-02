// platform/valuation/mark-adoption-engine.test.ts
//
// Unit + integration tests for adoptDailyOfficialFxMarks — the daily
// feed-universe FX mark adoption that decouples official-mark adoption from
// position revaluation. Without it, Product-Control P&L Attribution fails
// "missing input marketMoveMarks" for any freshly-traded pair that has no
// prior-day OfficialMarkAdopted mark.
//
// Authority: D-EVENT-VIEW-BOUNDARY-WIRE; D-TRUSTED-FIGURES-PROGRAM-V1.

import { describe, expect, it } from "bun:test";

import { makeFxPositionRevalued } from "../event-store/event-types/fx-accounting";
import { makePolicyVersionActivated } from "../event-store/event-types/policy-activation";
import type { OfficialMarkAdoptedPayload } from "../event-store/event-types/valuation";
import { EventStore } from "../event-store/store";
import { MarketDataStore } from "../market-data/store";
import { makeFxTradeExecuted } from "../markets/cdm/fx";
import { computePnLAttribution } from "../product-control/pnl-attribution";
import { adoptDailyOfficialFxMarks, resolveActivePolicyVersionRef } from "./mark-adoption-engine";

const ENTITY = "LE-ZA-HOZ-BANK";

function emptyStore(): EventStore {
  return new EventStore(":memory:");
}

function marketData(): MarketDataStore {
  return new MarketDataStore(":memory:");
}

/** Activate the founding valuation policy so adoptFxMark can resolve a ref. */
function seedValuationPolicy(store: EventStore): string {
  store.append(
    makePolicyVersionActivated({
      asOf: "2026-05-01T00:00:00.000Z",
      entity: ENTITY,
      actor: { type: "service", id: "agent:helena:cro" },
      citations: ["Policies/valuation-policy-v1.md"],
      payload: {
        policyDomain: "valuation",
        policyId: "VALUATION-POLICY-V1",
        version: "1.0",
        effectiveFrom: "2026-05-01T00:00:00.000Z",
        documentHash: `blake3:${"a".repeat(64)}`,
        supersedes: null,
        activatedBy: "agent:helena:cro",
      },
    }),
  );
  const ref = resolveActivePolicyVersionRef(store);
  if (!ref) throw new Error("test setup: valuation policy ref did not resolve");
  return ref;
}

/** Append a production fx-quote tick for a pair on a given day. */
function seedTick(md: MarketDataStore, pair: string, mid: number, day: string): void {
  md.append({
    id: `${pair}-${day}`,
    source: "twelve-data",
    instrument: pair,
    dataType: "fx-quote",
    provenance: "production",
    asOf: `${day}T00:00:00.000Z`,
    payload: { mid },
  });
}

function marksFor(store: EventStore, pair: string): OfficialMarkAdoptedPayload[] {
  const out: OfficialMarkAdoptedPayload[] = [];
  for (const e of store.replay({ type: "OfficialMarkAdopted" })) {
    const p = e.payload as unknown as OfficialMarkAdoptedPayload;
    if (p.markType === "fx-rate" && p.instrumentKey === pair) out.push(p);
  }
  return out;
}

describe("adoptDailyOfficialFxMarks — unit", () => {
  it("adopts one fx-rate mark per feed pair, dated at the tick's asOf, with no positions", () => {
    const store = emptyStore();
    const md = marketData();
    const ref = seedValuationPolicy(store);
    seedTick(md, "USD/ZAR", 16.25, "2026-06-01");
    seedTick(md, "AUD/ZAR", 11.1, "2026-06-01");

    const res = adoptDailyOfficialFxMarks(store, md, "2026-06-01", ref);

    expect(res.adopted.sort()).toEqual(["AUD/ZAR", "USD/ZAR"]);
    const usd = marksFor(store, "USD/ZAR");
    const aud = marksFor(store, "AUD/ZAR");
    expect(usd).toHaveLength(1);
    expect(aud).toHaveLength(1);
    expect(usd[0]?.markAsOf).toBe("2026-06-01T00:00:00.000Z");
    expect(usd[0]?.mark).toBe("16.250000");
    expect(aud[0]?.mark).toBe("11.100000");
  });

  it("is idempotent — a second run for the same day adopts nothing", () => {
    const store = emptyStore();
    const md = marketData();
    const ref = seedValuationPolicy(store);
    seedTick(md, "AUD/ZAR", 11.1, "2026-06-01");

    adoptDailyOfficialFxMarks(store, md, "2026-06-01", ref);
    const second = adoptDailyOfficialFxMarks(store, md, "2026-06-01", ref);

    expect(second.adopted).toEqual([]);
    expect(second.skipped).toEqual(["AUD/ZAR"]);
    expect(marksFor(store, "AUD/ZAR")).toHaveLength(1);
  });

  it("skips a pair with no usable mid rate (noRate, no silent mark)", () => {
    const store = emptyStore();
    const md = marketData();
    const ref = seedValuationPolicy(store);
    md.append({
      id: "JPY/ZAR-2026-06-01",
      source: "twelve-data",
      instrument: "JPY/ZAR",
      dataType: "fx-quote",
      provenance: "production",
      asOf: "2026-06-01T00:00:00.000Z",
      payload: { note: "no rate" },
    });

    const res = adoptDailyOfficialFxMarks(store, md, "2026-06-01", ref);
    expect(res.adopted).toEqual([]);
    expect(res.noRate).toEqual(["JPY/ZAR"]);
    expect(marksFor(store, "JPY/ZAR")).toHaveLength(0);
  });

  it("does nothing when no active valuation policy ref exists", () => {
    const store = emptyStore();
    const md = marketData();
    seedTick(md, "USD/ZAR", 16.25, "2026-06-01");
    const res = adoptDailyOfficialFxMarks(store, md, "2026-06-01", null);
    expect(res.adopted).toEqual([]);
    expect(marksFor(store, "USD/ZAR")).toHaveLength(0);
  });
});

/** A live AUD/ZAR position booked on the prior day, revalued both days. */
function seedExistingAudPosition(store: EventStore): void {
  store.append(
    makeFxTradeExecuted({
      asOf: "2026-06-01T10:00:00.000Z",
      entity: ENTITY,
      actor: { type: "service", id: "trader:test" },
      citations: ["TEST"],
      payload: {
        tradeId: { scheme: "INTERNAL", value: "FX-AUD-1" },
        productTaxonomy: "FX-spot",
        currencyPair: { base: "AUD", quote: "ZAR" },
        side: "buy",
        legs: [
          {
            legKind: "near",
            payCurrency: "ZAR",
            receiveCurrency: "AUD",
            notional: { currency: "ZAR", amountMinor: 11_100_000 },
            counterNotional: { currency: "AUD", amountMinor: 1_000_000 },
            rate: { currency: "ZAR", amount: 11.1 },
            settlementDate: { iso: "2026-06-03", calendar: "JIHCAL" },
          },
        ],
        tradeDate: { iso: "2026-06-01", calendar: "JIHCAL" },
        counterparty: {
          partyId: "urn:party:legal-entity:standard-bank-za",
          name: "Standard Bank ZA",
          role: "counterparty",
          jurisdiction: "ZA",
        },
        venue: "OTC",
        trader: "trader:test",
        bookId: "FX-SPOT-BOOK",
        bookType: "trading",
        settlementForm: "physical",
        settlementPath: "correspondent",
        finsurvCategory: "ODP-001",
        clientFlowRef: "test:flow-aud-1",
      },
    }),
  );
  for (const [day, pnl] of [
    ["2026-06-01", 50_000],
    ["2026-06-02", 80_000],
  ] as const) {
    store.append(
      makeFxPositionRevalued({
        asOf: `${day}T17:00:00.000Z`,
        entity: ENTITY,
        actor: { type: "service", id: "rohan:mtm" },
        citations: ["TEST"],
        payload: {
          tradeId: "FX-AUD-1",
          currencyPair: "AUD/ZAR",
          bookRate: 11.1,
          revalRate: 11.1 + (day === "2026-06-02" ? 0.08 : 0.05),
          notionalBaseMinor: 1_000_000,
          unrealisedPnlZarMinor: pnl,
          revaluedAt: `${day}T17:00:00.000Z`,
          rateSource: "twelve-data",
        },
      }),
    );
  }
}

describe("adoptDailyOfficialFxMarks — integration with P&L attribution", () => {
  it("flips marketMove from absent to present for an existing position once its pair is marked", () => {
    const store = emptyStore();
    const md = marketData();
    const ref = seedValuationPolicy(store);
    seedExistingAudPosition(store);
    seedTick(md, "AUD/ZAR", 11.15, "2026-06-01");

    // Before: no prior-day AUD/ZAR mark → market-move is absent (the failure).
    const before = computePnLAttribution(store, "2026-06-02", "2026-06-01");
    expect(before.marketMove.present).toBe(false);

    // Adopt the daily feed-universe marks for the prior day.
    const res = adoptDailyOfficialFxMarks(store, md, "2026-06-01", ref);
    expect(res.adopted).toContain("AUD/ZAR");

    // After: prior-day mark exists → market-move is present (failure cleared).
    const after = computePnLAttribution(store, "2026-06-02", "2026-06-01");
    expect(after.marketMove.present).toBe(true);
  });
});
