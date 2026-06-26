// scripts/sim/seed-trading-book-sim-v1.ts
//
// SIMULATOR-FIRST TRADING BOOK — Phase 1 (D-BA-RETURN-SIMULATOR-FIRST).
//
// Seeds a small, clearly-SYNTHETIC trading book that drives the BA 320
// (Market Risk) standardised-position-risk engine to realistic, oracle-validated,
// NON-ZERO outputs across the equity, commodity and interest-rate risk classes —
// the classes that previously folded to zero because no event stream fed their
// adapters.
//
// WHAT IT EMITS (all `provenance: simulated`, scenario "trading-book-sim-v1"):
//   - Equity (JSE, single-name + an index) → EquityTradingPositionOpened
//   - Equity (LSE, single-name) → EquityTradingPositionOpened
//   - Commodity (platinum, brent, maize) → CommodityTradingPositionOpened
//   - IR trading-book bond (SA gov + a corporate) → BondTradeExecuted
//       (portfolio="trading-book"), which the existing bond adapter folds into
//       the BA 320 IR general + specific ladders.
//
// All positions are allocated to a TRADING-BOOK FRTB desk (Trading Desk 1 or
// Hedging Desk 1 — both `bookType: "trading"`). Banking-book positions are OUT
// OF SCOPE for BA 320 (the FRTB boundary `recon:frtb-desk-integrity` enforces).
//
// PROVENANCE BOUNDARY (CRITICAL — the R300m-into-Prod lesson):
//   Every event carries `simulatedTag(...)`. The PRODUCTION BA 320 read uses
//   `defaultProvenanceFilter()` (production-only), which EXCLUDES every event
//   here — so the production-only market-risk charge stays ZERO pre-licence-day.
//   The simulated book appears only under a simulated-inclusive read. Both legs
//   are proven by `recon:ba320-trading-book-sim-drive` + the golden-case test.
//
// IDEMPOTENT + REPLAY-SAFE: fixed asOf, fixed event ids, guarded on event_id in
// the store. No wall-clock (Charter cmd 6).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FX-V2-SIMULATOR-FIRST; D-FRTB-TRADING-DESK-STRUCTURE;
//   D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE; D-MARKETS-CAPITAL-TIME-SHAPE;
//   Regulations Relating to Banks Reg 28(3)(a); BCBS D352 §718(xi)–(xv);
//   Principle 1; Principle 5.
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../../platform/composition";
import { money } from "../../platform/core/decimal-money";
import { encodeMoney } from "../../platform/core/money-codec";
import { makeBondTradeExecuted } from "../../platform/event-store/event-types/bond-accounting";
import {
  makeCommodityTradingPositionOpened,
  makeEquityTradingPositionOpened,
} from "../../platform/event-store/event-types/trading-book-positions";
import { simulatedTag } from "../../platform/event-store/provenance";
import { eventSchema } from "../../platform/event-store/types";
import { DEFAULT_SIM_DESK_ID, SIM_TRADING_BOOK_DESK_IDS } from "../../v2-core/desk/roster";

// ---------------------------------------------------------------------------
// Fixed simulation parameters — no wall-clock; idempotent ids.
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-06-26T00:00:00.000Z";
const OPENED_DATE = "2026-06-26";
const FUNCTIONAL = "ZAR";

// Trading-book desks (both bookType "trading"). The default is Trading Desk 1;
// the hedging desk is the second trading-book desk.
const TRADING_DESK = DEFAULT_SIM_DESK_ID;
const HEDGING_DESK = SIM_TRADING_BOOK_DESK_IDS[1] ?? DEFAULT_SIM_DESK_ID;

const ACTOR = { type: "service" as const, id: "agent:atlas:seed-trading-book-sim-v1" };

const CITATIONS = [
  "D-BA-RETURN-SIMULATOR-FIRST",
  "urn:reg:za:regs-relating-to-banks:reg28",
  "urn:reg:bcbs:mar:d352-718",
  "P1-EVENTS-AS-TRUTH",
];

const SIM_PROVENANCE = simulatedTag({
  scenario: "trading-book-sim-v1",
  sourceLineage: "scripts/sim/seed-trading-book-sim-v1.ts",
  tags: ["manual-simulation", "trading-book", "market-risk", "d-ba-return-simulator-first"],
});

// ---------------------------------------------------------------------------
// The simulated book. Values are chosen as clean round numbers so the BA 320
// fold lands on the hand-computed golden-case figures asserted by
// `platform/recon/ba320-trading-book-sim-drive.ts` + the golden-case test.
// ---------------------------------------------------------------------------

interface EquitySpec {
  positionId: string;
  instrumentId: string;
  instrumentName: string;
  market: string;
  isIndex: boolean;
  side: "long" | "short";
  quantity: number;
  marketValueMajor: string;
  liquidAndDiversified: boolean;
  deskId: string;
}

interface CommoditySpec {
  positionId: string;
  commodity: string;
  commodityName: string;
  group: "precious-metals" | "agricultural" | "minerals" | "base-metals";
  side: "long" | "short";
  quantity: number;
  marketValueMajor: string;
  deskId: string;
}

interface BondSpec {
  tradeId: string;
  bondIsin: string;
  side: "buy" | "sell";
  nominalMajor: string; // ZAR major; converted to nominalMinor (cents)
  couponRate: number;
  maturityDate: string;
  counterpartyLei: string;
}

// EQUITY — JSE market (golden case): long R10m + short R4m single-names (NOT
// diversified) → net R6m, gross R14m. Plus a JSE index (diversified). LSE single
// name to prove per-market segregation. Currency is the bank's functional ccy
// (the BA 320 equity charge is a ZAR-equivalent MV charge; FX of the position is
// captured separately in the FX risk class).
const EQUITY_BOOK: readonly EquitySpec[] = [
  {
    positionId: "TBSIM-EQ-JSE-NPN-LONG",
    instrumentId: "ZAE000015889",
    instrumentName: "Naspers N (sim)",
    market: "JSE",
    isIndex: false,
    side: "long",
    quantity: 5000,
    marketValueMajor: "10000000", // R10,000,000
    liquidAndDiversified: false,
    deskId: TRADING_DESK,
  },
  {
    positionId: "TBSIM-EQ-JSE-SOL-SHORT",
    instrumentId: "ZAE000006896",
    instrumentName: "Sasol (sim)",
    market: "JSE",
    isIndex: false,
    side: "short",
    quantity: 20000,
    marketValueMajor: "4000000", // R4,000,000
    liquidAndDiversified: false,
    deskId: TRADING_DESK,
  },
  {
    positionId: "TBSIM-EQ-JSE-TOP40-LONG",
    instrumentId: "ZAE000019188",
    instrumentName: "FTSE/JSE Top 40 index future (sim)",
    market: "JSE-INDEX",
    isIndex: true,
    side: "long",
    quantity: 1000,
    marketValueMajor: "8000000", // R8,000,000 — separate market key (index add-on)
    liquidAndDiversified: true,
    deskId: HEDGING_DESK,
  },
  {
    positionId: "TBSIM-EQ-LSE-HSBC-LONG",
    instrumentId: "GB0005405286",
    instrumentName: "HSBC Holdings (sim, ZAR-equivalent MV)",
    market: "LSE",
    isIndex: false,
    side: "long",
    quantity: 3000,
    marketValueMajor: "3000000", // R3,000,000 ZAR-equivalent
    liquidAndDiversified: true,
    deskId: TRADING_DESK,
  },
];

// COMMODITY — platinum (golden case): long R5m + short R2m → net R3m, gross R7m.
// Plus brent (single long) + maize (single short) for group coverage.
const COMMODITY_BOOK: readonly CommoditySpec[] = [
  {
    positionId: "TBSIM-CM-XPT-LONG",
    commodity: "XPT",
    commodityName: "Platinum (sim)",
    group: "precious-metals",
    side: "long",
    quantity: 5000,
    marketValueMajor: "5000000", // R5,000,000
    deskId: TRADING_DESK,
  },
  {
    positionId: "TBSIM-CM-XPT-SHORT",
    commodity: "XPT",
    commodityName: "Platinum (sim)",
    group: "precious-metals",
    side: "short",
    quantity: 2000,
    marketValueMajor: "2000000", // R2,000,000
    deskId: HEDGING_DESK,
  },
  {
    positionId: "TBSIM-CM-BRENT-LONG",
    commodity: "BRENT",
    commodityName: "Brent crude (sim)",
    group: "minerals",
    side: "long",
    quantity: 10000,
    marketValueMajor: "6000000", // R6,000,000
    deskId: TRADING_DESK,
  },
  {
    positionId: "TBSIM-CM-MAIZE-SHORT",
    commodity: "MAIZE",
    commodityName: "White maize (sim)",
    group: "agricultural",
    side: "short",
    quantity: 8000,
    marketValueMajor: "3000000", // R3,000,000
    deskId: TRADING_DESK,
  },
];

// IR — trading-book bonds. SA gov bond (golden case): R100m nominal, ~6y residual
// → band 5-7y (riskWeight 0.0325) → weighted R3,250,000; SA gov specific weight 0.
// Plus a corporate bond (qualifying-issuer 0.25% specific). Both trading-book.
const BOND_BOOK: readonly BondSpec[] = [
  {
    tradeId: "TBSIM-BOND-RSA-R2032",
    bondIsin: "ZAG000150001", // ZAG prefix → SA gov → 0% specific
    side: "buy",
    nominalMajor: "100000000", // R100,000,000
    couponRate: 0.085,
    maturityDate: "2032-06-26", // ~6y → 5-7y band (weight 0.0325)
    counterpartyLei: "SIM00000000000000RSA1",
  },
  {
    tradeId: "TBSIM-BOND-CORP-XYZ",
    bondIsin: "ZAE000corpXYZ2030", // non-ZAG → qualifying-issuer 0.25% specific
    side: "buy",
    nominalMajor: "40000000", // R40,000,000
    couponRate: 0.105,
    maturityDate: "2030-06-26", // ~4y → 4-5y band (weight 0.0275)
    counterpartyLei: "SIM00000000000000CRP1",
  },
];

// ---------------------------------------------------------------------------
// Idempotency helper.
// ---------------------------------------------------------------------------

/** Collect every existing event_id once (single replay) for O(1) idempotency. */
function collectExistingEventIds(): Set<string> {
  const ids = new Set<string>();
  for (const ev of eventStore.replay({})) ids.add(ev.event_id);
  return ids;
}

const EXISTING_EVENT_IDS = collectExistingEventIds();

function alreadyEmitted(eventId: string): boolean {
  return EXISTING_EVENT_IDS.has(eventId);
}

function majorToMinorCents(major: string): number {
  // ZAR scale 2; exact integer cents for the round seed values.
  return Math.round(Number(money(major, "ZAR").amount) * 100);
}

// ---------------------------------------------------------------------------
// Emit.
// ---------------------------------------------------------------------------

function emitEquity(): number {
  let n = 0;
  for (const e of EQUITY_BOOK) {
    const eventId = `EV-${e.positionId}`;
    if (alreadyEmitted(eventId)) continue;
    const ev = makeEquityTradingPositionOpened({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      eventId,
      provenance: SIM_PROVENANCE,
      payload: {
        positionId: e.positionId,
        instrumentId: e.instrumentId,
        instrumentName: e.instrumentName,
        market: e.market,
        isIndex: e.isIndex,
        side: e.side,
        quantity: e.quantity,
        marketValue: encodeMoney(money(e.marketValueMajor, FUNCTIONAL)),
        liquidAndDiversified: e.liquidAndDiversified,
        deskId: e.deskId,
        bookType: "trading",
        openedDate: OPENED_DATE,
      },
    });
    eventStore.append(ev);
    n += 1;
  }
  return n;
}

function emitCommodity(): number {
  let n = 0;
  for (const c of COMMODITY_BOOK) {
    const eventId = `EV-${c.positionId}`;
    if (alreadyEmitted(eventId)) continue;
    const ev = makeCommodityTradingPositionOpened({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      eventId,
      provenance: SIM_PROVENANCE,
      payload: {
        positionId: c.positionId,
        commodity: c.commodity,
        commodityName: c.commodityName,
        group: c.group,
        side: c.side,
        quantity: c.quantity,
        marketValue: encodeMoney(money(c.marketValueMajor, FUNCTIONAL)),
        deskId: c.deskId,
        bookType: "trading",
        openedDate: OPENED_DATE,
      },
    });
    eventStore.append(ev);
    n += 1;
  }
  return n;
}

function emitBonds(): number {
  let n = 0;
  for (const b of BOND_BOOK) {
    const eventId = `EV-${b.tradeId}`;
    if (alreadyEmitted(eventId)) continue;
    // The v1 BondTradeExecuted maker validates the payload but does not carry a
    // provenance param. Build via the typed maker (payload validation), then
    // stamp the simulated envelope provenance by re-parsing through the event
    // schema — so the bond is excluded from the production BA 320 read exactly
    // like the equity / commodity events. (No new v1 dependency; reuses the
    // existing maker. The BA 320 bond adapter's provenance filter is what makes
    // this seed production-invisible.)
    const base = makeBondTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      eventId,
      payload: {
        tradeId: b.tradeId,
        bondIsin: b.bondIsin,
        side: b.side,
        nominalMinor: majorToMinorCents(b.nominalMajor),
        cleanPricePercent: 100,
        accruedInterestMinor: 0,
        dirtyPricePercent: 100,
        settlementDate: OPENED_DATE,
        portfolio: "trading-book",
        couponRate: b.couponRate,
        maturityDate: b.maturityDate,
        currency: FUNCTIONAL,
        counterpartyLei: b.counterpartyLei,
        executedAt: AS_OF,
        bookDesignation: "trading",
      },
    });
    const ev = eventSchema.parse({ ...base, provenance: SIM_PROVENANCE });
    eventStore.append(ev);
    n += 1;
  }
  return n;
}

function main(): number {
  const eq = emitEquity();
  const cm = emitCommodity();
  const bd = emitBonds();
  console.log(
    `[seed-trading-book-sim-v1] emitted equity=${eq} commodity=${cm} bonds=${bd} (scenario=trading-book-sim-v1, provenance=simulated, entity=${ENTITY}). Production BA 320 read stays 0; simulated read drives the engine.`,
  );
  return 0;
}

process.exit(main());
