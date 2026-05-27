// platform/projections/alm-positions.test.ts
//
// Unit tests for the ALM-positions projection.
//
// Covers:
//   1. Empty event store → all four arrays empty + gaps[] enumerates each
//      missing event class + buildPhase: true.
//   2. Fed HQLA via TradeBooked → hqlaPositions populated; gaps still
//      name the funding / ASF / RSF classes.
//   3. T+0 vs T+30 horizon labels propagate correctly.
//   4. The projection's source-event-class registry is stable
//      (ALM_POSITION_SOURCE_EVENTS).
//   5. The snapshot's note string mentions the as-of timestamp and the
//      horizon, helping operators correlate Anya's deliverable to the
//      underlying projection state.
//
// Authority: brief
//   `brief:ravi:alm-position-substrate-and-helena-liquidity-line:2026-05-21`
// Author: Ravi (Treasury and ALM engineer, engineering)

import { describe, expect, it } from "bun:test";

import { newEventId } from "../core/types";
import { EventStore } from "../event-store/store";
import { ALM_POSITION_SOURCE_EVENTS, getALMPositionSnapshot } from "./alm-positions";

const AS_OF = "2026-05-21T12:00:00.000Z";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore(): EventStore {
  return new EventStore();
}

/**
 * Append a `TradeBooked` event with security-position payload — the
 * collateral inventory projection picks these up and classifies into HQLA
 * tiers via `classifyHQLA`.
 */
function appendTradeBooked(
  store: EventStore,
  args: {
    isin: string;
    assetClass: "sovereign-bond" | "corporate-bond" | "equity";
    issuer: string;
    creditRating?: string;
    riskWeight?: number;
    marketValueZar: number;
    currency?: string;
  },
): void {
  store.append({
    event_id: newEventId(),
    type: "TradeBooked",
    as_of: AS_OF,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:test" },
    citations: ["D-RAS"],
    payload: {
      tradeId: newEventId(),
      isin: args.isin,
      instrumentName: `${args.assetClass}-${args.isin}`,
      assetClass: args.assetClass,
      issuer: args.issuer,
      ...(args.creditRating ? { creditRating: args.creditRating } : {}),
      ...(args.riskWeight !== undefined ? { riskWeight: args.riskWeight } : {}),
      faceValue: args.marketValueZar,
      marketValueZar: args.marketValueZar,
      marketValue: args.marketValueZar,
      currency: args.currency ?? "ZAR",
    },
  });
}

// ---------------------------------------------------------------------------
// 1. Empty event store — build-phase baseline
// ---------------------------------------------------------------------------

describe("alm-positions — build-phase empty store", () => {
  it("returns empty arrays + gaps[] enumerating each missing class", () => {
    const store = makeStore();
    const snap = getALMPositionSnapshot(store, AS_OF, 30);

    expect(snap.asOf).toBe(AS_OF);
    expect(snap.horizonDays).toBe(30);
    expect(snap.hqlaPositions.length).toBe(0);
    expect(snap.fundingPositions.length).toBe(0);
    // WS2: ASF always has at least one item (Tier 1 capital from computeCapitalMetrics
    // build-phase baseline — R300m ICAAP v1 figure, 100% ASF weight per BA 326 §8).
    expect(snap.asfItems.length).toBeGreaterThanOrEqual(1);
    expect(snap.rsfItems.length).toBe(0);
    // buildPhase is false now that ASF is partially wired (Tier 1 capital always present)
    expect(snap.buildPhase).toBe(false);

    // gaps[] must name each canonical missing event class
    expect(snap.gaps.length).toBeGreaterThan(0);
    const joined = snap.gaps.join(" ");
    expect(joined).toContain(ALM_POSITION_SOURCE_EVENTS.hqlaCollateral);
    expect(joined).toContain(ALM_POSITION_SOURCE_EVENTS.fundingDepositTaken);
    expect(joined).toContain(ALM_POSITION_SOURCE_EVENTS.fundingSettlementOut);
    expect(joined).toContain(ALM_POSITION_SOURCE_EVENTS.fundingLineDraw);
    expect(joined).toContain(ALM_POSITION_SOURCE_EVENTS.asfBalanceSheet);
  });

  it("note string mentions horizon and as-of", () => {
    const store = makeStore();
    const snap = getALMPositionSnapshot(store, AS_OF, 0);
    expect(snap.note).toContain(AS_OF);
    expect(snap.note).toContain("T+0d");
  });

  it("propagates T+30 horizon to the snapshot", () => {
    const store = makeStore();
    const snap = getALMPositionSnapshot(store, AS_OF, 30);
    expect(snap.horizonDays).toBe(30);
    expect(snap.note).toContain("T+30d");
  });
});

// ---------------------------------------------------------------------------
// 2. Fed HQLA via TradeBooked — partial wiring through collateral inventory
// ---------------------------------------------------------------------------

describe("alm-positions — fed HQLA path via TradeBooked", () => {
  it("populates hqlaPositions when sovereign-bond trade is booked", () => {
    const store = makeStore();
    appendTradeBooked(store, {
      isin: "ZAG000123456",
      assetClass: "sovereign-bond",
      issuer: "RSA Government",
      riskWeight: 0,
      marketValueZar: 50_000_000,
    });

    const snap = getALMPositionSnapshot(store, AS_OF, 30);

    // HQLA path: at least one position folded through the collateral inventory.
    // (The exact tier depends on the classifier; we assert presence + amount.)
    expect(snap.hqlaPositions.length).toBeGreaterThanOrEqual(1);
    const total = snap.hqlaPositions.reduce((s, p) => s + p.amountZar, 0);
    expect(total).toBeGreaterThan(0);

    // Funding still empty — DepositTaken / FundingLineDrawn / IBL not emitted.
    expect(snap.fundingPositions.length).toBe(0);
    // WS2: ASF includes Tier 1 capital (build-phase baseline). RSF includes the
    // HQLA position wired above (hqla-l1 at 5% RSF weight).
    expect(snap.asfItems.length).toBeGreaterThanOrEqual(1);
    expect(snap.rsfItems.length).toBeGreaterThanOrEqual(1);

    // gaps[] should still name the unwired classes — but the inventory test
    // doesn't enforce the gap inventory size precisely (the projection may
    // detect that CollateralInventorySnapshotted still hasn't been emitted
    // and still gap-flag it). What we do assert is that the build-phase flag
    // tracks the *aggregate* position count (non-empty HQLA → non-buildPhase).
    expect(snap.buildPhase).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Source-event-class registry stability
// ---------------------------------------------------------------------------

describe("alm-positions — source-event registry stability", () => {
  it("ALM_POSITION_SOURCE_EVENTS exposes the seven canonical class names", () => {
    expect(ALM_POSITION_SOURCE_EVENTS.hqlaCollateral).toBe("CollateralInventorySnapshotted");
    expect(ALM_POSITION_SOURCE_EVENTS.hqlaCash).toBe("CashBalanceSnapshotted");
    expect(ALM_POSITION_SOURCE_EVENTS.fundingDepositTaken).toBe("DepositTaken");
    expect(ALM_POSITION_SOURCE_EVENTS.fundingSettlementOut).toBe("SettlementInstructionIssued");
    expect(ALM_POSITION_SOURCE_EVENTS.fundingLineDraw).toBe("FundingLineDrawn");
    expect(ALM_POSITION_SOURCE_EVENTS.asfBalanceSheet).toBe("BalanceSheetProjected");
    expect(ALM_POSITION_SOURCE_EVENTS.rsfBalanceSheet).toBe("BalanceSheetProjected");
  });
});

// ---------------------------------------------------------------------------
// 4. Settlement outflow derivation from TradeBooked (explicit settlementDate)
// ---------------------------------------------------------------------------

function appendBuyTradeWithSettlementDate(
  store: EventStore,
  args: {
    isin: string;
    marketValueZar: number;
    settlementDate: string;
  },
): void {
  store.append({
    event_id: newEventId(),
    type: "TradeBooked",
    as_of: AS_OF,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:test" },
    citations: ["D-RAS"],
    payload: {
      tradeId: newEventId(),
      isin: args.isin,
      side: "buy",
      marketValueZar: args.marketValueZar,
      currency: "ZAR",
      settlementDate: args.settlementDate,
    },
  });
}

describe("alm-positions — settlement outflow derivation", () => {
  it("includes buy trade with explicit settlementDate within T+30 horizon in fundingPositions", () => {
    const store = makeStore();
    // Settlement date 2 days after AS_OF — within T+30 horizon
    appendBuyTradeWithSettlementDate(store, {
      isin: "ZAG000456789",
      marketValueZar: 10_000_000,
      settlementDate: "2026-05-23",
    });

    const snap = getALMPositionSnapshot(store, AS_OF, 30);

    expect(snap.fundingPositions.length).toBeGreaterThanOrEqual(1);
    const settlement = snap.fundingPositions.find(
      (p) => p.category === "wholesale-non-operational" && p.amountZar === 10_000_000,
    );
    expect(settlement).toBeDefined();

    // Gap entry should be the informational note (count > 0), not the unconditional gap
    const gapEntry = snap.gaps.find((g) =>
      g.includes(ALM_POSITION_SOURCE_EVENTS.fundingSettlementOut),
    );
    expect(gapEntry).toBeDefined();
    expect(gapEntry).toContain("pending buy trade");
  });

  it("excludes buy trade with settlementDate outside the horizon", () => {
    const store = makeStore();
    // Settlement date 40 days after AS_OF — outside T+30 horizon
    appendBuyTradeWithSettlementDate(store, {
      isin: "ZAG000456789",
      marketValueZar: 10_000_000,
      settlementDate: "2026-06-30",
    });

    const snap = getALMPositionSnapshot(store, AS_OF, 30);

    // fundingPositions should not include this trade
    expect(snap.fundingPositions.length).toBe(0);
    // Gap should remain the unconditional form
    const gapEntry = snap.gaps.find((g) =>
      g.includes(ALM_POSITION_SOURCE_EVENTS.fundingSettlementOut),
    );
    expect(gapEntry).toBeDefined();
    expect(gapEntry).not.toContain("pending buy trade");
  });

  it("skips TradeBooked without settlementDate and gap remains unconditional", () => {
    const store = makeStore();
    // TradeBooked without settlementDate — should be skipped
    store.append({
      event_id: newEventId(),
      type: "TradeBooked",
      as_of: AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:test" },
      citations: ["D-RAS"],
      payload: {
        tradeId: newEventId(),
        isin: "ZAG000111222",
        side: "buy",
        marketValueZar: 5_000_000,
        currency: "ZAR",
        // no settlementDate
      },
    });

    const snap = getALMPositionSnapshot(store, AS_OF, 30);

    // No settlement outflows derived
    const settlementPositions = snap.fundingPositions.filter(
      (p) => p.category === "wholesale-non-operational",
    );
    expect(settlementPositions.length).toBe(0);

    // Gap entry mentions skipped trades
    const gapEntry = snap.gaps.find((g) =>
      g.includes(ALM_POSITION_SOURCE_EVENTS.fundingSettlementOut),
    );
    expect(gapEntry).toBeDefined();
    expect(gapEntry).toContain("0 settlement instructions");
  });

  it("excludes already-settled trades via TradeSettled tombstone", () => {
    const store = makeStore();
    const tradeId = newEventId();
    // Book a buy trade with settlementDate
    store.append({
      event_id: newEventId(),
      type: "TradeBooked",
      as_of: AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:test" },
      citations: ["D-RAS"],
      payload: {
        tradeId,
        isin: "ZAG000789012",
        side: "buy",
        marketValueZar: 8_000_000,
        currency: "ZAR",
        settlementDate: "2026-05-24",
      },
    });
    // Then mark it settled
    store.append({
      event_id: newEventId(),
      type: "TradeSettled",
      as_of: AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:test" },
      citations: ["D-RAS"],
      payload: { tradeId },
    });

    const snap = getALMPositionSnapshot(store, AS_OF, 30);

    // Settled trade should not appear in fundingPositions
    const settlement = snap.fundingPositions.find((p) => p.amountZar === 8_000_000);
    expect(settlement).toBeUndefined();
  });
});
