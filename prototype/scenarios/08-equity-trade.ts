// scenarios/08-equity-trade.ts
//
// Synthetic JSE listed-equity trade — bank buys 10,000 Naspers shares.
//
// Exercises the full 4-event equity lifecycle:
//
//   T0  EquityTradeExecuted       — bank buys 10,000 NPN at R4,250 = R42.5m; T+3 settlement (JSE)
//   T1  EquitySettlementInstructed — instruct Strate via correspondent (pacs.009 path)
//   T2  EquitySettlementConfirmed  — Strate confirms both securities and cash legs settled
//   EOD EquityPositionRevalued     — JSE close applied; unrealised P&L computed
//
// Authority:
//   D-MARKETS-SCHEMA-FOUNDATION   — CDM event families
//   JSE-EQUITIES-RULES            — JSE Equity Rules, Rule 11 — trading
//   IFRS-9-§4.1                   — FVTPL classification for trading book
//   STRATE-RULE-7                 — settlement via Strate CSD
//
// Run: `bun run scenario:equity-trade`
//
// Authors:
//   Kai (Quantitative Markets Architect, engineering) — CDM event wiring + scenario runner
//   Bea (Finance / accounting engineer, engineering)  — IFRS + revaluation economics

import { unlinkSync } from "node:fs";

import { type Actor, BANK_ZA_001, newEventId } from "@platform/core/types";
import { type ProvenanceTag, simulatedTag } from "@platform/event-store/provenance";
import { EventStore } from "@platform/event-store/store";
import type { Event } from "@platform/event-store/types";
import {
  makeEquityPositionRevalued,
  makeEquitySettlementConfirmed,
  makeEquitySettlementInstructed,
  makeEquityTradeBooked,
  makeEquityTradeExecuted,
} from "@platform/markets/cdm/equity";
import { makeStaticEquityPriceSource } from "@platform/markets/eod/equity-revaluation";
import { logger } from "@platform/observability/logger";

// ---------------------------------------------------------------------------
// Scenario constants
// ---------------------------------------------------------------------------

export const SCENARIO_ID = "equity-trade-npn-m3-001";
export const SOURCE_LINEAGE = "scenario-runner:08-equity-trade";
export const ENTITY = BANK_ZA_001;

// Synthetic institutional counterparty — not a live counterparty.
export const COUNTERPARTY_ID = "CP-SYN-EQ-001";
export const COUNTERPARTY_NAME = "SimulatedInstitutional Co. (Equity fixture)";

// Scenario clock
const TRADE_DATE_ISO = "2026-05-17";
// T+3 settlement per Strate/JSE rules
const SETTLEMENT_DATE_ISO = "2026-05-20";
const VALUATION_DATE = "2026-05-17";

// Trade economics: bank buys 10,000 NPN shares at R4,250 per share = R42.5m
const NPN_ISIN = "ZAE000015889";
const NPN_TICKER = "NPN";
const SHARE_QUANTITY = 10_000;
const PRICE_PER_SHARE_ZAR = 4_250.0; // ZAR major units
const TOTAL_CONSIDERATION_MINOR = Math.round(SHARE_QUANTITY * PRICE_PER_SHARE_ZAR * 100); // cents

// ---------------------------------------------------------------------------
// Provenance tag — all events in this scenario carry this exact tag.
// ---------------------------------------------------------------------------

export const SCENARIO_PROVENANCE: ProvenanceTag = simulatedTag({
  scenario: SCENARIO_ID,
  sourceLineage: SOURCE_LINEAGE,
});

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

const KAI: Actor = { type: "human", id: "kai@bank.local" };
const TOMAS: Actor = { type: "human", id: "tomas@bank.local" };
const EOD_SERVICE: Actor = { type: "service", id: "kai:eod-equity-revaluation" };

// ---------------------------------------------------------------------------
// Instrument definition
// ---------------------------------------------------------------------------

const NPN_INSTRUMENT = {
  identifier: { scheme: "ISIN", value: NPN_ISIN },
  class: "listed-equity" as const,
  issuer: {
    partyId: "LEI-NASPERS",
    name: "Naspers Limited",
    role: "issuer" as const,
    jurisdiction: "ZA",
  },
  venue: "JSE",
  currency: "ZAR",
};

// ---------------------------------------------------------------------------
// Event builders — pure, return Event; no I/O.
// ---------------------------------------------------------------------------

/**
 * T0 — EquityTradeExecuted.
 * Bank buys 10,000 NPN shares at R4,250 = R42.5m total consideration.
 * T+3 settlement via Strate (JSE-EQUITIES-RULES Rule 11; STRATE-RULE-7).
 */
function buildEquityTradeExecuted(asOf: string): Event {
  const base = makeEquityTradeExecuted({
    asOf,
    entity: ENTITY,
    actor: KAI,
    citations: [
      "D-MARKETS-SCHEMA-FOUNDATION",
      "JSE-EQUITIES-RULES",
      "IFRS-9-§4.1",
      "STRATE-RULE-7",
    ],
    payload: {
      tradeId: { scheme: "INTERNAL", value: "TRD-EQ-NPN-M3-001" },
      orderId: "ORD-EQ-NPN-M3-001",
      instrument: NPN_INSTRUMENT,
      side: "buy",
      quantity: { unit: "share", amount: SHARE_QUANTITY },
      executionPrice: { currency: "ZAR", amount: PRICE_PER_SHARE_ZAR },
      consideration: { currency: "ZAR", amountMinor: TOTAL_CONSIDERATION_MINOR },
      executedAt: "2026-05-17T07:15:00.000Z",
      venue: "JSE",
      bookId: "BOOK-EQ-TRADING",
      counterparty: {
        partyId: COUNTERPARTY_ID,
        name: COUNTERPARTY_NAME,
        role: "counterparty",
        jurisdiction: "ZA",
      },
      traderRef: "kai@bank.local",
    },
    eventId: newEventId(),
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

/**
 * Also book the trade into the EquityTradeBooked event (for position projection
 * and historical compatibility with the M1 event family).
 */
function buildEquityTradeBooked(asOf: string): Event {
  const base = makeEquityTradeBooked({
    asOf,
    entity: ENTITY,
    actor: KAI,
    citations: [
      "D-MARKETS-SCHEMA-FOUNDATION",
      "JSE-EQUITIES-RULES",
      "IFRS-9-§4.1",
      "STRATE-RULE-7",
    ],
    payload: {
      tradeId: { scheme: "INTERNAL", value: "TRD-EQ-NPN-M3-001" },
      instrument: NPN_INSTRUMENT,
      side: "buy",
      quantity: { unit: "share", amount: SHARE_QUANTITY },
      price: { currency: "ZAR", amount: PRICE_PER_SHARE_ZAR },
      consideration: { currency: "ZAR", amountMinor: TOTAL_CONSIDERATION_MINOR },
      tradeDate: { iso: TRADE_DATE_ISO, calendar: "JIHCAL" },
      settlementDate: { iso: SETTLEMENT_DATE_ISO, calendar: "JIHCAL" },
      counterparty: {
        partyId: COUNTERPARTY_ID,
        name: COUNTERPARTY_NAME,
        role: "counterparty",
        jurisdiction: "ZA",
      },
      venue: "JSE",
      trader: "kai@bank.local",
      bookId: "BOOK-EQ-TRADING",
    },
    eventId: newEventId(),
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

/**
 * T1 — EquitySettlementInstructed.
 * Instruct Strate via correspondent — pacs.009 path, T+3 settlement.
 */
function buildEquitySettlementInstructed(asOf: string): Event {
  const base = makeEquitySettlementInstructed({
    asOf,
    entity: ENTITY,
    actor: TOMAS,
    citations: ["D-MARKETS-SCHEMA-FOUNDATION", "STRATE-RULE-7", "JSE-EQUITIES-RULES"],
    payload: {
      tradeId: { scheme: "INTERNAL", value: "TRD-EQ-NPN-M3-001" },
      settlementId: { scheme: "INTERNAL", value: "STL-EQ-NPN-M3-001" },
      netCash: { currency: "ZAR", amountMinor: -TOTAL_CONSIDERATION_MINOR }, // bank pays
      netQuantity: { unit: "share", amount: SHARE_QUANTITY }, // bank receives
      settlementDate: { iso: SETTLEMENT_DATE_ISO, calendar: "JIHCAL" },
      settlementVenue: "STRATE",
      counterparty: {
        partyId: COUNTERPARTY_ID,
        name: COUNTERPARTY_NAME,
        role: "counterparty",
        jurisdiction: "ZA",
      },
    },
    eventId: newEventId(),
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

/**
 * T2 — EquitySettlementConfirmed.
 * Strate confirms both legs settled (T+3 per STRATE-RULE-7).
 */
function buildEquitySettlementConfirmed(asOf: string): Event {
  const base = makeEquitySettlementConfirmed({
    asOf,
    entity: ENTITY,
    actor: TOMAS,
    citations: ["D-MARKETS-SCHEMA-FOUNDATION", "STRATE-RULE-7", "JSE-EQUITIES-RULES"],
    payload: {
      tradeId: { scheme: "INTERNAL", value: "TRD-EQ-NPN-M3-001" },
      settlementDate: { iso: SETTLEMENT_DATE_ISO, calendar: "JIHCAL" },
      securitiesLeg: {
        direction: "receive",
        quantity: { unit: "share", amount: SHARE_QUANTITY },
        instrument: NPN_INSTRUMENT,
      },
      cashLeg: {
        direction: "pay",
        amount: { currency: "ZAR", amountMinor: TOTAL_CONSIDERATION_MINOR },
      },
      confirmedAt: "2026-05-20T10:30:00.000Z",
      strateRef: "STRATE-CONF-EQ-NPN-M3-001",
    },
    eventId: newEventId(),
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

/**
 * EOD — EquityPositionRevalued.
 * JSE close at R4,250 → unrealised P&L = (4250 - 4250) × 10,000 = R0 at trade price.
 * For scenario richness, use stub close price from jse-close-prices-stub.json (R4,250/share).
 */
function buildEquityPositionRevalued(asOf: string): Event {
  const priceSource = makeStaticEquityPriceSource();
  const closingPriceZAR = priceSource.getClosingPriceZAR(NPN_ISIN, VALUATION_DATE);
  const closingPriceMinor = Math.round(closingPriceZAR * 100);
  const marketValueMinor = closingPriceMinor * SHARE_QUANTITY;
  const unrealisedPnlMinor = marketValueMinor - TOTAL_CONSIDERATION_MINOR;

  const base = makeEquityPositionRevalued({
    asOf,
    entity: ENTITY,
    actor: EOD_SERVICE,
    citations: [
      "IFRS-9-§4.1",
      "IFRS-9-§5.7.1",
      "D-MARKETS-SCHEMA-FOUNDATION",
      "JSE-EQUITIES-RULES",
    ],
    payload: {
      tradeId: { scheme: "INTERNAL", value: "TRD-EQ-NPN-M3-001" },
      instrument: NPN_INSTRUMENT,
      valuationDate: VALUATION_DATE,
      closingPrice: { currency: "ZAR", amount: closingPriceZAR },
      quantity: { unit: "share", amount: SHARE_QUANTITY },
      bookValue: { currency: "ZAR", amountMinor: TOTAL_CONSIDERATION_MINOR },
      marketValue: { currency: "ZAR", amountMinor: marketValueMinor },
      unrealisedPnl: { currency: "ZAR", amountMinor: unrealisedPnlMinor },
    },
    eventId: newEventId(),
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

// ---------------------------------------------------------------------------
// Scenario builder — pure, returns the ordered event list.
// ---------------------------------------------------------------------------

export interface EquityTradeScenarioEvents {
  readonly tradeExecuted: Event;
  readonly tradeBooked: Event;
  readonly settlementInstructed: Event;
  readonly settlementConfirmed: Event;
  readonly positionRevalued: Event;
  readonly all: ReadonlyArray<Event>;
}

export function buildEquityTradeScenarioEvents(): EquityTradeScenarioEvents {
  const tradeTimestamp = "2026-05-17T07:15:00.000Z";
  const instructionTimestamp = "2026-05-17T07:16:00.000Z";
  const settlementTimestamp = "2026-05-20T10:30:00.000Z";
  const eodTimestamp = VALUATION_DATE;

  const tradeExecuted = buildEquityTradeExecuted(tradeTimestamp);
  const tradeBooked = buildEquityTradeBooked(tradeTimestamp);
  const settlementInstructed = buildEquitySettlementInstructed(instructionTimestamp);
  const settlementConfirmed = buildEquitySettlementConfirmed(settlementTimestamp);
  const positionRevalued = buildEquityPositionRevalued(eodTimestamp);

  return {
    tradeExecuted,
    tradeBooked,
    settlementInstructed,
    settlementConfirmed,
    positionRevalued,
    all: [tradeExecuted, tradeBooked, settlementInstructed, settlementConfirmed, positionRevalued],
  };
}

// ---------------------------------------------------------------------------
// Runner — invoked by `bun run scenario:equity-trade`.
// ---------------------------------------------------------------------------

export interface EquityTradeScenarioResult {
  readonly ok: boolean;
  readonly emitted: number;
  readonly countsByType: Record<string, number>;
  readonly ticker: string;
  readonly unrealisedPnlZAR: number;
}

export function runEquityTradeScenario(opts: {
  dbPath: string;
  cleanup: boolean;
}): EquityTradeScenarioResult {
  const events = buildEquityTradeScenarioEvents();

  // Wipe and recreate per-run so the script is deterministic on repeat.
  try {
    unlinkSync(opts.dbPath);
  } catch {
    /* first run or already clean */
  }

  const store = new EventStore(opts.dbPath);
  store.appendAll([...events.all]);

  const total = store.count();

  // Provenance recon — all events must carry the scenario tag.
  let provenanceOk = true;
  for (const e of store.replay({ entity: ENTITY })) {
    if (e.provenance?.kind !== "simulated" || e.provenance.scenario !== SCENARIO_ID) {
      provenanceOk = false;
      break;
    }
  }

  // Count by event type.
  const countsByType: Record<string, number> = {};
  for (const e of events.all) {
    countsByType[e.type] = (countsByType[e.type] ?? 0) + 1;
  }

  // Extract unrealised P&L from the revaluation event.
  const revalPayload = events.positionRevalued.payload as {
    unrealisedPnl: { amountMinor: number };
  };
  const unrealisedPnlZAR = revalPayload.unrealisedPnl.amountMinor / 100;

  store.close();
  if (opts.cleanup) {
    try {
      unlinkSync(opts.dbPath);
    } catch {
      /* nothing to clean */
    }
  }

  return {
    ok: provenanceOk && total === events.all.length,
    emitted: total,
    countsByType,
    ticker: NPN_TICKER,
    unrealisedPnlZAR,
  };
}

// ---------------------------------------------------------------------------
// Substrate gaps surfaced by this scenario
// ---------------------------------------------------------------------------
//
// 1. Strate live connectivity not yet built.
//    EquitySettlementConfirmed.strateRef is currently a stub reference.
//    Full Strate CSD integration requires Tomas's settlement messaging
//    substrate (roadmap: D-STRATE-CONNECTIVITY).
//
// 2. JSE live price feed not yet wired.
//    EOD revaluation uses jse-close-prices-stub.json. Production requires
//    a JSE MarketConnect or Bloomberg feed (roadmap: live-equity-price-feed).
//
// 3. IFRS-9 classifier not yet wired for equity trades.
//    FVTPL classification assumed (trading book); Bea's IFRS-9 classifier
//    substrate (D-IFRS9-CLASSIFIER) will confirm at position-build time.
//
// 4. OrderProposed event family not yet built.
//    EquityTradeExecuted.orderId references an order not yet tracked in the
//    event store. Order management substrate is a roadmap item.
//
// ---------------------------------------------------------------------------

// Top-level invocation — gated on import.meta.main.
if (import.meta.main) {
  logger.info(
    {
      scenario: SCENARIO_ID,
      sourceLineage: SOURCE_LINEAGE,
      ticker: NPN_TICKER,
      isin: NPN_ISIN,
      quantity: SHARE_QUANTITY,
      pricePerShareZAR: PRICE_PER_SHARE_ZAR,
      totalConsiderationZAR: TOTAL_CONSIDERATION_MINOR / 100,
      tradeDate: TRADE_DATE_ISO,
      settlementDate: SETTLEMENT_DATE_ISO,
      valuationDate: VALUATION_DATE,
    },
    "scenario 08 — Equity trade (NPN) — starting",
  );

  const result = runEquityTradeScenario({
    dbPath: ".local/scenario-equity-trade.db",
    cleanup: true,
  });

  logger.info(
    {
      ok: result.ok,
      emitted: result.emitted,
      countsByType: result.countsByType,
      ticker: result.ticker,
      unrealisedPnlZAR: result.unrealisedPnlZAR,
      authority: [
        "D-MARKETS-SCHEMA-FOUNDATION",
        "JSE-EQUITIES-RULES",
        "IFRS-9-§4.1",
        "STRATE-RULE-7",
      ],
      substrateGaps: [
        "Strate live connectivity pending (D-STRATE-CONNECTIVITY)",
        "JSE live price feed pending (live-equity-price-feed)",
        "IFRS-9 classifier for equity FVTPL pending (D-IFRS9-CLASSIFIER)",
        "OrderProposed event family not yet built (order-management substrate)",
      ],
    },
    result.ok
      ? "scenario 08 — Equity trade (NPN) — PASSED"
      : "scenario 08 — Equity trade (NPN) — FAILED",
  );

  process.exit(result.ok ? 0 : 1);
}
