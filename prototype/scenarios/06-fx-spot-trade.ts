// scenarios/06-fx-spot-trade.ts
//
// Synthetic ZAR/USD FX Spot trade — institutional client buys USD against ZAR.
//
// Exercises: FxTradeExecuted (productTaxonomy: "FX-spot") → FxSettlementInstructed
//
// This scenario validates the M4 FX Spot product definition (M4_FX_SPOT_FIXTURE)
// by emitting the two canonical CDM events that anchor the FX Spot lifecycle:
//
//   T0  FxTradeExecuted    — bank buys USD 5m vs ZAR 92.5m at 18.5000 (T+2 spot)
//   T1  FxSettlementInstructed — USD leg via correspondent (pacs.009 path)
//   T2  FxSettlementInstructed — ZAR leg via correspondent (pacs.009 path)
//
// Remaining lifecycle events (PrincipalPayment, SettlementConfirmed,
// TradeReportSubmitted, TradeMatured) require downstream substrate (Tomas
// settlement-confirmation family; Mira FinSurv reporting). Substrate gaps
// are surfaced in the completion brief.
//
// Authority:
//   D-PRODUCT-CONSTRUCTION-SUBSTRATE — product definition substrate
//   D-MARKETS-SCHEMA-FOUNDATION      — CDM event families
//   D-FX-CLS-MEMBERSHIP              — correspondent settlement path
//   D-FX-AD-STATUS                   — FinSurv reporting obligation
//   D-FX-BOOK-BOUNDARY               — bookType required on FX TradeExecuted
//   ORG-MK-08                        — SARB ZAR Fixing Rate (rate observable)
//   ORG-EXCON-ODP-001                — FinSurv category (Excon AD rules)
//
// Run: `bun run scenario:fx-spot`
//
// Authors:
//   Kai (trading systems engineer, engineering) — CDM event wiring + scenario runner
//   Saskia (Head of Global Markets, governance) — trade economics + FinSurv obligations

import { unlinkSync } from "node:fs";

import { type Actor, BANK_ZA_001, newEventId } from "@platform/core/types";
import { type ProvenanceTag, simulatedTag } from "@platform/event-store/provenance";
import { EventStore } from "@platform/event-store/store";
import type { Event } from "@platform/event-store/types";
import { makeFxSettlementInstructed, makeFxTradeExecuted } from "@platform/markets/cdm/fx";
import { M4_FX_SPOT_FIXTURE } from "@platform/markets/products/fixtures";
import { logger } from "@platform/observability/logger";

// ---------------------------------------------------------------------------
// Scenario constants
// ---------------------------------------------------------------------------

export const SCENARIO_ID = "fx-spot-product-definition-m4";
export const SOURCE_LINEAGE = "scenario-runner:06-fx-spot-trade";
export const ENTITY = BANK_ZA_001;

// Synthetic institutional counterparty — designed to exercise the
// ZAR/USD FX Spot product definition only. Not a live counterparty.
export const COUNTERPARTY_ID = "CP-SYN-FX-SPOT-001";
export const COUNTERPARTY_NAME = "SimulatedInstitutional Co. (FX-Spot fixture)";

// Scenario clock: 2026-05-12 09:00 SAST = 07:00 UTC
const TRADE_DATE_ISO = "2026-05-12";
// T+2 settlement: 2026-05-14 (ZA+US holiday-calendar intersection; JIHCAL)
const SETTLEMENT_DATE_ISO = "2026-05-14";

// Trade economics: bank buys USD 5,000,000 vs ZAR 92,500,000 at 18.5000
// (SARB ZAR Fixing Rate observable per ORG-MK-08)
const USD_NOTIONAL_MINOR = 5_000_000_00; // USD 5,000,000 in cents
const ZAR_NOTIONAL_MINOR = 9_250_000_000_00; // ZAR 92,500,000 in cents
const SPOT_RATE = 18.5; // ZAR per USD

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

const SASKIA: Actor = { type: "human", id: "saskia@bank.local" };
const TOMAS: Actor = { type: "human", id: "tomas@bank.local" };

// ---------------------------------------------------------------------------
// Event builders — pure, return Event; no I/O.
// ---------------------------------------------------------------------------

/**
 * T0 — FxTradeExecuted.
 * Bank buys USD 5m vs ZAR 92.5m at spot rate 18.5000. Physical settlement,
 * correspondent path (D-FX-CLS-MEMBERSHIP). bookType = "trading" per
 * D-FX-BOOK-BOUNDARY.
 */
function buildFxTradeExecuted(asOf: string): Event {
  const base = makeFxTradeExecuted({
    asOf,
    entity: ENTITY,
    actor: SASKIA,
    citations: [
      "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
      "D-FX-BOOK-BOUNDARY",
      "D-FX-AD-STATUS",
      "ORG-MK-08",
      "ORG-EXCON-ODP-001",
    ],
    payload: {
      tradeId: { scheme: "INTERNAL", value: "TRD-FX-SPOT-M4-001" },
      productTaxonomy: "FX-spot",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      legs: [
        {
          legKind: "near",
          // Bank pays ZAR, receives USD
          payCurrency: "ZAR",
          receiveCurrency: "USD",
          notional: { currency: "ZAR", amountMinor: ZAR_NOTIONAL_MINOR },
          counterNotional: { currency: "USD", amountMinor: USD_NOTIONAL_MINOR },
          rate: { currency: "ZAR", amount: SPOT_RATE },
          settlementDate: { iso: SETTLEMENT_DATE_ISO, calendar: "JIHCAL" },
        },
      ],
      tradeDate: { iso: TRADE_DATE_ISO, calendar: "JIHCAL" },
      counterparty: {
        partyId: COUNTERPARTY_ID,
        name: COUNTERPARTY_NAME,
        role: "counterparty",
        jurisdiction: "ZA",
      },
      venue: "OTC",
      trader: "saskia@bank.local",
      bookId: "BOOK-FX-MARKETS-LP",
      bookType: "trading",
      settlementForm: "physical",
      settlementPath: "correspondent",
      // FinSurv category per ORG-EXCON-ODP-001 — non-resident counterparty OTC
      finsurvCategory: "ODP-001-cross-border-institutional",
    },
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

/**
 * T1 — FxSettlementInstructed (USD leg, bank receives).
 * Bank receives USD 5m via correspondent (pacs.009 path per D-FX-CLS-MEMBERSHIP).
 */
function buildUsdSettlementInstructed(asOf: string, tradeEventId: string): Event {
  // tradeEventId is the upstream event this settlement instruction references.
  // It is not yet carried on ProvenanceTag itself (substrate gap); surfaced in the
  // completion brief. For now, the cross-reference lives in the payload tradeId.
  void tradeEventId;
  const base = makeFxSettlementInstructed({
    asOf,
    entity: ENTITY,
    actor: TOMAS,
    citations: ["D-FX-CLS-MEMBERSHIP", "D-PRODUCT-CONSTRUCTION-SUBSTRATE", "ORG-MK-08"],
    payload: {
      tradeId: { scheme: "INTERNAL", value: "TRD-FX-SPOT-M4-001" },
      legKind: "near",
      settlementId: { scheme: "INTERNAL", value: "STL-FX-SPOT-M4-001-USD" },
      settlementPath: "correspondent",
      settlementForm: "physical",
      correspondent: {
        partyId: "CORRESPONDENT-BANK-001",
        name: "SimulatedCorrespondent Bank",
        role: "settlement-agent",
        jurisdiction: "ZA",
      },
      counterparty: {
        partyId: COUNTERPARTY_ID,
        name: COUNTERPARTY_NAME,
        role: "counterparty",
        jurisdiction: "ZA",
      },
      // Bank receives USD (positive = inflow)
      netCash: { currency: "USD", amountMinor: USD_NOTIONAL_MINOR },
      settlementDate: { iso: SETTLEMENT_DATE_ISO, calendar: "JIHCAL" },
      messageStandard: "ISO-20022-pacs.009",
    },
    eventId: newEventId(),
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

/**
 * T2 — FxSettlementInstructed (ZAR leg, bank pays).
 * Bank pays ZAR 92.5m via correspondent (pacs.009 path per D-FX-CLS-MEMBERSHIP).
 */
function buildZarSettlementInstructed(asOf: string, tradeEventId: string): Event {
  // tradeEventId cross-reference: payload tradeId is the canonical link
  // (ProvenanceTag does not yet carry sourceEventId — substrate gap).
  void tradeEventId;
  const base = makeFxSettlementInstructed({
    asOf,
    entity: ENTITY,
    actor: TOMAS,
    citations: ["D-FX-CLS-MEMBERSHIP", "D-PRODUCT-CONSTRUCTION-SUBSTRATE", "ORG-MK-08"],
    payload: {
      tradeId: { scheme: "INTERNAL", value: "TRD-FX-SPOT-M4-001" },
      legKind: "near",
      settlementId: { scheme: "INTERNAL", value: "STL-FX-SPOT-M4-001-ZAR" },
      settlementPath: "correspondent",
      settlementForm: "physical",
      correspondent: {
        partyId: "CORRESPONDENT-BANK-001",
        name: "SimulatedCorrespondent Bank",
        role: "settlement-agent",
        jurisdiction: "ZA",
      },
      counterparty: {
        partyId: COUNTERPARTY_ID,
        name: COUNTERPARTY_NAME,
        role: "counterparty",
        jurisdiction: "ZA",
      },
      // Bank pays ZAR (negative = outflow)
      netCash: { currency: "ZAR", amountMinor: -ZAR_NOTIONAL_MINOR },
      settlementDate: { iso: SETTLEMENT_DATE_ISO, calendar: "JIHCAL" },
      messageStandard: "ISO-20022-pacs.009",
    },
    eventId: newEventId(),
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

// ---------------------------------------------------------------------------
// Scenario builder — pure, returns the ordered event list.
// ---------------------------------------------------------------------------

export interface FxSpotScenarioEvents {
  readonly trade: Event;
  readonly usdSettlement: Event;
  readonly zarSettlement: Event;
  readonly all: ReadonlyArray<Event>;
}

export function buildFxSpotScenarioEvents(): FxSpotScenarioEvents {
  // All events use the trade-date timestamp for simplicity; a real clock
  // would advance per event. T+2 settlement date is captured in the payload.
  const tradeTimestamp = "2026-05-12T07:00:00.000Z";
  const settlementTimestamp = "2026-05-12T07:02:00.000Z";

  const trade = buildFxTradeExecuted(tradeTimestamp);
  const usdSettlement = buildUsdSettlementInstructed(settlementTimestamp, trade.event_id);
  const zarSettlement = buildZarSettlementInstructed(settlementTimestamp, trade.event_id);

  return {
    trade,
    usdSettlement,
    zarSettlement,
    all: [trade, usdSettlement, zarSettlement],
  };
}

// ---------------------------------------------------------------------------
// Runner — invoked by `bun run scenario:fx-spot`.
// ---------------------------------------------------------------------------

export interface FxSpotScenarioResult {
  readonly ok: boolean;
  readonly emitted: number;
  readonly countsByType: Record<string, number>;
  readonly productId: string;
}

export function runFxSpotScenario(opts: {
  dbPath: string;
  cleanup: boolean;
}): FxSpotScenarioResult {
  const events = buildFxSpotScenarioEvents();

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
    productId: M4_FX_SPOT_FIXTURE.productId,
  };
}

// ---------------------------------------------------------------------------
// Substrate gaps surfaced by this scenario
// ---------------------------------------------------------------------------
//
// 1. PrincipalPayment event family not yet built.
//    Remaining FX Spot lifecycle events (PrincipalPayment, SettlementConfirmed,
//    TradeReportSubmitted, TradeMatured) require downstream substrate that does
//    not exist at M4 Slice 1. Surfaced as a roadmap item.
//
// 2. FinSurv submission event family not yet built.
//    TradeReportSubmitted{regulator:'SARB-FinSurv'} requires Mira's FinSurv
//    reporting substrate (roadmap: D-FX-FINSURV-REPORTING).
//
// 3. Scenario clock substrate.
//    This scenario uses inline timestamps rather than the D-SCENARIO-CLOCK
//    substrate (same gap as scenario 03). Swap when Atlas's clock substrate
//    merges.
//
// ---------------------------------------------------------------------------

// Top-level invocation — gated on import.meta.main so the test can import
// the module without firing the runner.
if (import.meta.main) {
  logger.info(
    {
      scenario: SCENARIO_ID,
      sourceLineage: SOURCE_LINEAGE,
      productId: M4_FX_SPOT_FIXTURE.productId,
      productFamily: M4_FX_SPOT_FIXTURE.family,
      lifecycle: M4_FX_SPOT_FIXTURE.lifecycle,
      tradeDate: TRADE_DATE_ISO,
      settlementDate: SETTLEMENT_DATE_ISO,
      spotRate: SPOT_RATE,
      usdNotional: `USD ${(USD_NOTIONAL_MINOR / 100).toLocaleString()}`,
      zarNotional: `ZAR ${(ZAR_NOTIONAL_MINOR / 100).toLocaleString()}`,
    },
    "scenario 06 — FX Spot trade — starting",
  );

  const result = runFxSpotScenario({
    dbPath: ".local/scenario-fx-spot.db",
    cleanup: true,
  });

  logger.info(
    {
      ok: result.ok,
      emitted: result.emitted,
      countsByType: result.countsByType,
      productId: result.productId,
      authority: [
        "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
        "D-FX-CLS-MEMBERSHIP",
        "D-FX-AD-STATUS",
        "ORG-MK-08",
        "ORG-EXCON-ODP-001",
      ],
      substrateGaps: [
        "PrincipalPayment event family not yet built",
        "TradeReportSubmitted (SARB-FinSurv) substrate pending",
        "SettlementConfirmed event family pending (Tomas roadmap)",
      ],
    },
    result.ok ? "scenario 06 — FX Spot trade — PASSED" : "scenario 06 — FX Spot trade — FAILED",
  );

  process.exit(result.ok ? 0 : 1);
}
