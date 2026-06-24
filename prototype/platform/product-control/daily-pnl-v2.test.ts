// platform/product-control/daily-pnl-v2.test.ts
//
// Regression proof for the V2 daily-P&L per-currency breakdown.
//
// BUG (pre-fix): `computeDailyPnLV2` keyed `byCurrency` on
// `economicTerms.currency`, which in the anchor-book FX materialisation is
// ALWAYS the reporting (ZAR) notional leg (see
// scripts/seed-v2-fil-instances-ir-fx.ts: `currency: "ZAR"` + hedgingSetTag
// "<CCY>/ZAR"). Every bucket failed the `currency !== reporting` guard, so
// `byCurrency` came back `[]` even though the headline total was non-zero and
// there were open FIL FX instruments. The per-currency view degraded to empty.
//
// FIX: bucket on the FOREIGN (non-reporting) currency derived from the pair
// (hedgingSetTag). This test asserts byCurrency is non-empty and that its
// per-currency unrealised sums reconcile EXACTLY to
// totalUnrealisedPnlZarMinor for a seeded multi-currency FIL FX book.
//
// Authority: D-FIL-BOOK-COMPOSITE-VALUATION; D-TRUSTED-FIGURES-PROGRAM-V1;
//   D-V1-REMOVAL-PHASE2-GAP-A2; IAS-21-§28.

import { describe, expect, test } from "bun:test";
import { filInstrumentCreatedPayloadSchema } from "../../v2-core/fil-instances/events";
import { makeFilInstrumentCreated } from "../event-store/event-types/fil-instances";
import { EventStore } from "../event-store/store";
import type { Actor, ProvenanceTag } from "../event-store/types";
import { MarketDataStore } from "../market-data/store";
import { computeDailyPnLV2 } from "./daily-pnl-v2";

const ACTOR: Actor = { type: "system", id: "atlas:daily-pnl-v2-test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = "tenant:za-bank";
const CITES = ["D-FIL-BOOK-COMPOSITE-VALUATION"];
const PROD_TAG: ProvenanceTag = { kind: "production", sourceLineage: "daily-pnl-v2-test" };
const FX_TYPE_URN = "fil:type:fx:spot:otc-vanilla@1.0";
const AS_OF = "2026-06-19T10:00:00.000Z";
const REPORT_DATE = "2026-06-19";

interface Seed {
  id: string;
  /** Foreign currency of the pair (the non-ZAR leg). */
  foreign: string;
  direction: "long" | "short";
  /** ZAR notional, major-unit decimal string. */
  notionalZar: string;
}

/** Append one production FX FIL instrument — anchor-book shape (ZAR notional + pair tag). */
function appendFxInstrument(store: EventStore, s: Seed): void {
  const ev = makeFilInstrumentCreated({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    provenance: PROD_TAG,
    payload: filInstrumentCreatedPayloadSchema.parse({
      kind: "FilInstrumentCreated",
      instance: `fil:inst:${ENTITY}:${s.id}`,
      type: FX_TYPE_URN,
      tenant: TENANT,
      asOf: AS_OF,
      originatingEvent: { eventType: "FxTradeExecuted", eventId: `evt-${s.id}` },
      initialStage: "active",
      economicTerms: {
        assetClass: "fx",
        // Anchor-book materialisation: notional + currency are the ZAR leg; the
        // foreign exposure is carried in hedgingSetTag.
        notional: { currency: "ZAR", amount: s.notionalZar },
        direction: s.direction,
        counterpartyId: "urn:party:legal-entity:standard-bank-za",
        nettingSetId: "NS-test-ZAR",
        currency: "ZAR",
        settlementDate: REPORT_DATE,
        hedgingSetTag: `${s.foreign}/ZAR`,
      },
    }),
  });
  store.append({ ...ev, provenance: PROD_TAG });
}

/** Seed a production fx-quote so the pair is markable (markStatus: "live"). */
function appendQuote(mds: MarketDataStore, foreign: string, mid: number): void {
  mds.append({
    id: `tick-${foreign}`,
    source: "fx-test",
    instrument: `${foreign}/ZAR`,
    dataType: "fx-quote",
    provenance: "production",
    asOf: AS_OF,
    payload: { mid },
  });
}

describe("computeDailyPnLV2 — per-currency breakdown reconciles to the headline", () => {
  test("multi-currency FIL FX book → byCurrency non-empty and sums to the headline", () => {
    const store = new EventStore(":memory:");
    const mds = new MarketDataStore(":memory:");

    const seeds: Seed[] = [
      { id: "FX-USD-1", foreign: "USD", direction: "long", notionalZar: "1000000.00" },
      { id: "FX-EUR-1", foreign: "EUR", direction: "short", notionalZar: "500000.00" },
      { id: "FX-GBP-1", foreign: "GBP", direction: "long", notionalZar: "250000.00" },
    ];
    for (const s of seeds) appendFxInstrument(store, s);
    appendQuote(mds, "USD", 18.5);
    appendQuote(mds, "EUR", 20.1);
    appendQuote(mds, "GBP", 23.7);

    const { payload } = computeDailyPnLV2(store, mds, REPORT_DATE, () => AS_OF);

    // All three positions are open and markable.
    expect(payload.activePositions).toBe(3);
    expect(payload.unmarkableLivePositions).toBe(0);

    // The headline is non-zero (long 1,000,000 − short 500,000 + long 250,000
    // ZAR = 750,000.00 ZAR = 75,000,000 minor; the FCY-cash Valuable values the
    // ZAR leg at rate 1, so the headline is the net ZAR notional).
    expect(payload.totalUnrealisedPnlZarMinor).toBe(75_000_000);

    // REGRESSION: byCurrency must NOT be empty for an open multi-currency book.
    expect(payload.byCurrency.length).toBe(3);

    // Buckets are keyed by the FOREIGN currency, never the reporting leg.
    const currencies = payload.byCurrency.map((c) => c.currency).sort();
    expect(currencies).toEqual(["EUR", "GBP", "USD"]);
    expect(currencies).not.toContain("ZAR");

    // RECONCILIATION: the per-currency unrealised sums equal the headline total.
    const byCurrencySum = payload.byCurrency.reduce((acc, c) => acc + c.unrealisedPnlZarMinor, 0);
    expect(byCurrencySum).toBe(payload.totalUnrealisedPnlZarMinor);

    // Each bucket carries its own position's signed ZAR value.
    const byCcy = new Map(payload.byCurrency.map((c) => [c.currency, c]));
    expect(byCcy.get("USD")?.unrealisedPnlZarMinor).toBe(100_000_000);
    expect(byCcy.get("EUR")?.unrealisedPnlZarMinor).toBe(-50_000_000);
    expect(byCcy.get("GBP")?.unrealisedPnlZarMinor).toBe(25_000_000);
    for (const row of payload.byCurrency) expect(row.tradeCount).toBe(1);
  });

  test("an unmarkable position is excluded from BOTH the headline and its bucket", () => {
    const store = new EventStore(":memory:");
    const mds = new MarketDataStore(":memory:");

    appendFxInstrument(store, {
      id: "FX-USD-OK",
      foreign: "USD",
      direction: "long",
      notionalZar: "1000000.00",
    });
    appendFxInstrument(store, {
      id: "FX-JPY-NOMARK",
      foreign: "JPY",
      direction: "long",
      notionalZar: "300000.00",
    });
    // Only USD has a production quote — JPY is a feed gap (no-silent-zero).
    appendQuote(mds, "USD", 18.5);

    const { payload } = computeDailyPnLV2(store, mds, REPORT_DATE, () => AS_OF);

    expect(payload.activePositions).toBe(2);
    expect(payload.unmarkableLivePositions).toBe(1);
    expect(payload.unrealisedComplete).toBe(false);

    // Headline excludes the unmarkable JPY leg (never folded as a silent 0).
    expect(payload.totalUnrealisedPnlZarMinor).toBe(100_000_000);

    // byCurrency still reconciles: the JPY bucket exists with a 0 unrealised
    // (its trade is counted, its P&L excluded), USD carries the full headline.
    const byCurrencySum = payload.byCurrency.reduce((acc, c) => acc + c.unrealisedPnlZarMinor, 0);
    expect(byCurrencySum).toBe(payload.totalUnrealisedPnlZarMinor);

    const byCcy = new Map(payload.byCurrency.map((c) => [c.currency, c]));
    expect(byCcy.get("USD")?.unrealisedPnlZarMinor).toBe(100_000_000);
    expect(byCcy.get("JPY")?.unrealisedPnlZarMinor).toBe(0);
    expect(byCcy.get("JPY")?.tradeCount).toBe(1);
  });
});
