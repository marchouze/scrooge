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
//   - Equity (JSE, single-name + an index; LSE single-name) → EquityTradingPositionOpened
//   - Commodity (platinum, brent, maize) → CommodityTradingPositionOpened
//
// IR is NOT seeded here — that risk class is already driven by the existing bond /
// IRS adapters, and a live BondTradeExecuted requires its GL posting (PR-BOND-001)
// or recon:gl-ledger-coverage flags an uncovered lifecycle. The IR trading-book
// designation is proven by the golden-case test + the recon's in-memory IR oracle
// (tracked-deferred GAP-BA320-IR-SIM-GL). See the IR section below.
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
import {
  makeCommodityTradingPositionOpened,
  makeEquityTradingPositionOpened,
} from "../../platform/event-store/event-types/trading-book-positions";
import { simulatedTag } from "../../platform/event-store/provenance";
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

// IR — DELIBERATELY NOT SEEDED into the live store (tracked-deferred, see below).
//
// The interest-rate trading-book risk class is ALREADY driven by the existing
// `BondTradeExecuted` / `IrdSwapTradeExecuted` event adapters
// (ba-320-bond-events-adapter / ba-320-irs-events-adapter), which already filter
// `portfolio === "trading-book"`. The brief's IR scope is "ensure trading-book
// designation" — that designation is honoured by the adapters and PROVEN
// end-to-end (trading-book in, banking-book excluded) by the golden-case test
// `platform/returns/ba320/trading-book-sim-golden.test.ts` against an in-memory
// store + the Reg 28(3)(a) Table A oracle (R100m SA-gov @ 5-7y → R3,250,000).
//
// Seeding a NEW live BondTradeExecuted here would require its matching V1
// SubLedgerPostingEmitted (posting rule PR-BOND-001) or `recon:gl-ledger-coverage`
// flags an uncovered lifecycle — i.e. it would drag the whole bond GL-posting
// chain into this slice. The equity / commodity gap is the genuine "folds-to-zero"
// gap (no GL-posting coupling); IR is already wired. So the IR live-store seed is
// a TRACKED-DEFERRED gap (GAP-BA320-IR-SIM-GL), to be seeded WITH its GL postings
// in a follow-on once the trading-book bond GL fold is exercised on the sim path.
// Authority: Engineering Charter cmd 1 (root-cause, don't widen scope); cmd 5
// (no silent deferral — this is a named, tracked gap, not a hidden one).

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

function main(): number {
  const eq = emitEquity();
  const cm = emitCommodity();
  console.log(
    `[seed-trading-book-sim-v1] emitted equity=${eq} commodity=${cm} (scenario=trading-book-sim-v1, provenance=simulated, entity=${ENTITY}). IR risk class is already driven by the existing bond/IRS adapters (trading-book designation proven by the golden-case test; live IR seed tracked-deferred GAP-BA320-IR-SIM-GL). Production BA 320 read stays 0; simulated read drives the engine.`,
  );
  return 0;
}

process.exit(main());
