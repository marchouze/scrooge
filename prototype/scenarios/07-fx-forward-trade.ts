// scenarios/07-fx-forward-trade.ts
//
// Synthetic ZAR/USD FX Outright Forward — institutional client buys USD
// forward against ZAR, 3-month tenor (T+90 settlement).
//
// Exercises the full 6-event FX Forward lifecycle (mirror of scenario 06
// but with longer-dated settlement and mid-life MtM revaluation cycles):
//
//   T0    FxTradeExecuted              — bank buys USD 5m vs ZAR fwd at 18.7000
//   T0+1  FxSettlementInstructed (USD) — USD receive leg via correspondent
//   T0+1  FxSettlementInstructed (ZAR) — ZAR deliver leg via correspondent
//   ...   FxPositionRevalued (×N)      — daily/weekly EOD revaluation over
//                                          the life of the forward (FVTPL
//                                          MtM per IFRS 9 §5.7.1 / IAS 21 §28).
//                                          These are emitted by Anya's EOD
//                                          revaluation runner, not by this
//                                          scenario; this runner emits two
//                                          mid-life revaluation ticks
//                                          explicitly to exercise the path.
//   T90   PrincipalPayment (ZAR)       — correspondent confirms ZAR delivered
//   T90   PrincipalPayment (USD)       — correspondent confirms USD received
//   T90   SettlementConfirmed          — both legs settled; lifecycle closed
//
// FX Forward differs from FX Spot only in:
//   - settlementDate is T+N (weeks-to-years), not T+2
//   - the position carries MtM exposure over its life (FVTPL revaluations)
//   - IFRS 9 classification is the same (FVTPL trading book; FVOCI only when
//     hedge-accounting-designated, which is out of scope for this scenario —
//     see D-FX-HEDGE-DESIGNATION substrate gap).
//
// NDF variant: a second runner (runNdfForwardScenario) exercises the
// non-deliverable variant with NdfFixingObserved replacing the two
// PrincipalPayment events.
//
// Authority:
//   D-PRODUCT-CONSTRUCTION-SUBSTRATE — product definition substrate
//   D-MARKETS-SCHEMA-FOUNDATION      — CDM event families
//   D-FX-CLS-MEMBERSHIP              — correspondent settlement path
//   D-FX-AD-STATUS                   — FinSurv reporting obligation
//   D-FX-BOOK-BOUNDARY               — bookType required on FX TradeExecuted
//   D-MARKETS-CAPITAL-TIME-SHAPE     — daily MtM revaluation cadence
//   IAS-21-§28                       — monetary items at closing rate
//   IFRS-9-§5.7.1                    — FVTPL changes in P&L
//   ORG-EXCON-ODP-001                — FinSurv category (Excon AD rules)
//
// Run: `bun run scenario:fx-forward`
//
// Authors:
//   Saskia (Markets franchise lead, engineering) — trade economics +
//     forward-specific lifecycle wiring + NDF fixing path
//   Rohan (Market risk quant, engineering) — MtM revaluation tick design
//   Bea (Finance engineer, accounting) — IFRS 9 FVTPL treatment review

import { unlinkSync } from "node:fs";

import { type Actor, BANK_ZA_001, newEventId } from "@platform/core/types";
import { makeFxPositionRevalued } from "@platform/event-store/event-types/fx-accounting";
import { type ProvenanceTag, simulatedTag } from "@platform/event-store/provenance";
import { EventStore } from "@platform/event-store/store";
import type { Event } from "@platform/event-store/types";
import {
  makeFxSettlementInstructed,
  makeFxTradeExecuted,
  makeNdfFixingObserved,
  makePrincipalPayment,
  makeSettlementConfirmed,
} from "@platform/markets/cdm/fx";
import { logger } from "@platform/observability/logger";

// ---------------------------------------------------------------------------
// Scenario constants
// ---------------------------------------------------------------------------

export const SCENARIO_ID = "fx-forward-product-definition-m4";
export const NDF_SCENARIO_ID = "fx-forward-ndf-variant-m4";
export const SOURCE_LINEAGE = "scenario-runner:07-fx-forward-trade";
export const ENTITY = BANK_ZA_001;

export const COUNTERPARTY_ID = "CP-SYN-FX-FWD-001";
export const COUNTERPARTY_NAME = "SimulatedInstitutional Co. (FX-Forward fixture)";

// Trade date 2026-05-12; forward settlement 2026-08-12 (T+92, 3-month tenor).
const TRADE_DATE_ISO = "2026-05-12";
const FORWARD_SETTLEMENT_DATE_ISO = "2026-08-12";

// Mid-life MtM revaluation ticks (Anya's EOD runner would emit these
// daily; we emit two ticks here to exercise the path explicitly).
const REVAL_TICK_1_ISO = "2026-06-09";
const REVAL_TICK_2_ISO = "2026-07-09";

// Trade economics: bank buys USD 5,000,000 vs ZAR at forward rate 18.7000
// (slightly higher than spot — reflects forward points: ZAR carries higher
// rates than USD, so forward ZAR is cheaper / forward USD is more expensive)
const USD_NOTIONAL_MINOR = 5_000_000_00; // USD 5,000,000 in cents
const ZAR_NOTIONAL_MINOR = 9_350_000_000_00; // ZAR 93,500,000 in cents
const FORWARD_RATE = 18.7; // ZAR per USD (forward; spot was 18.5)

// Closing rates at the two revaluation ticks (from seeds/fx-rates.json)
const REVAL_RATE_1 = 18.75; // ZAR/USD on 2026-06-09 (forward in-the-money)
const REVAL_RATE_2 = 18.88; // ZAR/USD on 2026-07-09 (forward further ITM)

// ---------------------------------------------------------------------------
// Provenance tag
// ---------------------------------------------------------------------------

export const SCENARIO_PROVENANCE: ProvenanceTag = simulatedTag({
  scenario: SCENARIO_ID,
  sourceLineage: SOURCE_LINEAGE,
});

export const NDF_SCENARIO_PROVENANCE: ProvenanceTag = simulatedTag({
  scenario: NDF_SCENARIO_ID,
  sourceLineage: SOURCE_LINEAGE,
});

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

const SASKIA: Actor = { type: "human", id: "saskia@bank.local" };
const TOMAS: Actor = { type: "human", id: "tomas@bank.local" };
const ANYA: Actor = { type: "service", id: "anya:eod-fx-revaluation" };

// ---------------------------------------------------------------------------
// Deliverable Forward — event builders
// ---------------------------------------------------------------------------

function buildFxForwardTradeExecuted(asOf: string): Event {
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
      tradeId: { scheme: "INTERNAL", value: "TRD-FX-FWD-M4-001" },
      productTaxonomy: "FX-forward",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      legs: [
        {
          legKind: "near",
          payCurrency: "ZAR",
          receiveCurrency: "USD",
          notional: { currency: "ZAR", amountMinor: ZAR_NOTIONAL_MINOR },
          counterNotional: { currency: "USD", amountMinor: USD_NOTIONAL_MINOR },
          rate: { currency: "ZAR", amount: FORWARD_RATE },
          settlementDate: { iso: FORWARD_SETTLEMENT_DATE_ISO, calendar: "JIHCAL" },
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
      finsurvCategory: "ODP-001-cross-border-institutional-forward",
    },
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

function buildSettlementInstructed(
  asOf: string,
  leg: "USD" | "ZAR",
  provenance: ProvenanceTag,
): Event {
  const isUsd = leg === "USD";
  const base = makeFxSettlementInstructed({
    asOf,
    entity: ENTITY,
    actor: TOMAS,
    citations: ["D-FX-CLS-MEMBERSHIP", "D-PRODUCT-CONSTRUCTION-SUBSTRATE", "ORG-MK-08"],
    payload: {
      tradeId: { scheme: "INTERNAL", value: "TRD-FX-FWD-M4-001" },
      legKind: "near",
      settlementId: {
        scheme: "INTERNAL",
        value: `STL-FX-FWD-M4-001-${leg}`,
      },
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
      netCash: {
        currency: leg,
        amountMinor: isUsd ? USD_NOTIONAL_MINOR : -ZAR_NOTIONAL_MINOR,
      },
      settlementDate: { iso: FORWARD_SETTLEMENT_DATE_ISO, calendar: "JIHCAL" },
      messageStandard: "ISO-20022-pacs.009",
    },
    eventId: newEventId(),
  });
  return { ...base, provenance };
}

function buildPositionRevalued(
  asOf: string,
  revalRate: number,
  unrealisedPnlZarMinor: number,
  provenance: ProvenanceTag,
): Event {
  const base = makeFxPositionRevalued({
    asOf,
    entity: ENTITY,
    actor: ANYA,
    citations: [
      "IAS-21-§28",
      "IFRS-9-§5.7.1",
      "D-MARKETS-CAPITAL-TIME-SHAPE",
      "EXCON-SARB-CIRC-3-2020",
    ],
    payload: {
      tradeId: "TRD-FX-FWD-M4-001",
      currencyPair: "USD/ZAR",
      bookRate: FORWARD_RATE,
      revalRate,
      notionalBaseMinor: USD_NOTIONAL_MINOR,
      unrealisedPnlZarMinor,
      revaluedAt: `${asOf}T18:00:00.000Z`,
      rateSource: "static-seed",
    },
  });
  return { ...base, provenance };
}

function buildPrincipalPayment(
  asOf: string,
  leg: "deliver" | "receive",
  provenance: ProvenanceTag,
): Event {
  const isReceive = leg === "receive";
  const base = makePrincipalPayment({
    asOf,
    entity: ENTITY,
    actor: TOMAS,
    citations: ["D-FX-CLS-MEMBERSHIP", "D-FX-AD-STATUS", "ORG-MK-08"],
    payload: {
      tradeId: "TRD-FX-FWD-M4-001",
      legKind: leg,
      currencyPair: "USD/ZAR",
      currency: isReceive ? "USD" : "ZAR",
      netCash: isReceive ? USD_NOTIONAL_MINOR : -ZAR_NOTIONAL_MINOR,
      settlementDate: FORWARD_SETTLEMENT_DATE_ISO,
      settlementPath: "correspondent",
      correspondent: {
        name: "SimulatedCorrespondent Bank",
        bic: "SBZAZAJJXXX",
      },
      settlementConfirmationRef: `CONF-${isReceive ? "USD" : "ZAR"}-FWD-M4-001`,
      citations: ["D-FX-CLS-MEMBERSHIP", "D-FX-AD-STATUS", "ORG-MK-08"],
    },
    eventId: newEventId(),
  });
  return { ...base, provenance };
}

function buildSettlementConfirmed(asOf: string, provenance: ProvenanceTag): Event {
  // Realised P&L = cumulative MtM at maturity (vs book rate). For this
  // scenario the final closing rate at maturity is 18.97, vs the booked
  // 18.70 — bank realises ZAR 13,500,000 unrealised → realised on settle.
  // (USD 5m × (18.97 − 18.70) = ZAR 1,350,000; in minor units 135,000,000.)
  const realisedPnlDelta = 135_000_000;
  const base = makeSettlementConfirmed({
    asOf,
    entity: ENTITY,
    actor: TOMAS,
    citations: ["D-FX-CLS-MEMBERSHIP", "D-FX-AD-STATUS", "IAS-21-§23"],
    payload: {
      tradeId: "TRD-FX-FWD-M4-001",
      currencyPair: "USD/ZAR",
      settledDate: FORWARD_SETTLEMENT_DATE_ISO,
      realisedPnlDelta,
      settlementRef: "SWIFT-CONF-FWD-M4-001",
      finsurvReportingRef: undefined,
      citations: ["D-FX-CLS-MEMBERSHIP", "D-FX-AD-STATUS"],
    },
    eventId: newEventId(),
  });
  return { ...base, provenance };
}

// ---------------------------------------------------------------------------
// NDF variant — event builders (fixing replaces PrincipalPayment legs)
// ---------------------------------------------------------------------------

function buildNdfTradeExecuted(asOf: string): Event {
  const base = makeFxTradeExecuted({
    asOf,
    entity: ENTITY,
    actor: SASKIA,
    citations: [
      "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
      "D-FX-BOOK-BOUNDARY",
      "D-FX-AD-STATUS",
      "ORG-EXCON-ODP-001",
    ],
    payload: {
      tradeId: { scheme: "INTERNAL", value: "TRD-FX-NDF-M4-001" },
      productTaxonomy: "NDF",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      legs: [
        {
          legKind: "near",
          payCurrency: "ZAR",
          receiveCurrency: "USD",
          notional: { currency: "ZAR", amountMinor: ZAR_NOTIONAL_MINOR },
          counterNotional: { currency: "USD", amountMinor: USD_NOTIONAL_MINOR },
          rate: { currency: "ZAR", amount: FORWARD_RATE },
          settlementDate: { iso: FORWARD_SETTLEMENT_DATE_ISO, calendar: "JIHCAL" },
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
      settlementForm: "cash",
      settlementPath: "correspondent",
      ndfFixingSource: "SARB-ZAR-Fixing-1600-SAST",
      ndfSettlementCurrency: "USD",
      finsurvCategory: "ODP-001-cross-border-institutional-ndf",
    },
  });
  return { ...base, provenance: NDF_SCENARIO_PROVENANCE };
}

function buildNdfFixingObserved(asOf: string): Event {
  // NDF cash-settles in USD at the fixing.
  //   netCash_USD = notional_USD × (fixingRate − contractRate) / fixingRate
  //   = 5,000,000 × (18.97 − 18.70) / 18.97
  //   ≈ 5,000,000 × 0.014233 = ~71,165 USD (in minor units: 71,16500)
  const fixingRate = 18.97;
  const netCashUsdMinor = Math.round(
    USD_NOTIONAL_MINOR * ((fixingRate - FORWARD_RATE) / fixingRate),
  );
  const base = makeNdfFixingObserved({
    asOf,
    entity: ENTITY,
    actor: SASKIA,
    citations: [
      "D-FX-AD-STATUS",
      "ORG-EXCON-ODP-001",
      "IFRS-9-§3.2.3",
    ],
    payload: {
      tradeId: "TRD-FX-NDF-M4-001",
      currencyPair: "USD/ZAR",
      fixingSource: "SARB-ZAR-Fixing-1600-SAST",
      fixingDate: "2026-08-10",
      fixingRate,
      contractRate: FORWARD_RATE,
      settlementCurrency: "USD",
      netCashMinor: netCashUsdMinor,
      settlementDate: FORWARD_SETTLEMENT_DATE_ISO,
      citations: ["D-FX-AD-STATUS", "ORG-EXCON-ODP-001"],
    },
    eventId: newEventId(),
  });
  return { ...base, provenance: NDF_SCENARIO_PROVENANCE };
}

// ---------------------------------------------------------------------------
// Scenario builders
// ---------------------------------------------------------------------------

export interface FxForwardScenarioEvents {
  readonly trade: Event;
  readonly usdSettlement: Event;
  readonly zarSettlement: Event;
  readonly revalTick1: Event;
  readonly revalTick2: Event;
  readonly zarPrincipalPayment: Event;
  readonly usdPrincipalPayment: Event;
  readonly settlementConfirmed: Event;
  readonly all: ReadonlyArray<Event>;
}

export function buildFxForwardScenarioEvents(): FxForwardScenarioEvents {
  const tradeTs = "2026-05-12T07:00:00.000Z";
  const settlementInstructTs = "2026-05-12T07:02:00.000Z";
  const reval1Ts = "2026-06-09T18:00:00.000Z";
  const reval2Ts = "2026-07-09T18:00:00.000Z";
  const confirmTs = "2026-08-12T10:00:00.000Z";

  // Unrealised P&L deltas:
  //   tick 1: USD 5m × (18.75 − 18.70) = ZAR 250,000 = 25_000_000 minor (gain)
  //   tick 2: USD 5m × (18.88 − 18.75) = ZAR 650,000 = 65_000_000 minor (gain)
  const tick1PnlMinor = 25_000_000;
  const tick2PnlMinor = 65_000_000;

  const trade = buildFxForwardTradeExecuted(tradeTs);
  const usdSettlement = buildSettlementInstructed(settlementInstructTs, "USD", SCENARIO_PROVENANCE);
  const zarSettlement = buildSettlementInstructed(settlementInstructTs, "ZAR", SCENARIO_PROVENANCE);
  const revalTick1 = buildPositionRevalued(
    REVAL_TICK_1_ISO,
    REVAL_RATE_1,
    tick1PnlMinor,
    SCENARIO_PROVENANCE,
  );
  const revalTick2 = buildPositionRevalued(
    REVAL_TICK_2_ISO,
    REVAL_RATE_2,
    tick2PnlMinor,
    SCENARIO_PROVENANCE,
  );
  void reval1Ts;
  void reval2Ts;
  const zarPrincipalPayment = buildPrincipalPayment(confirmTs, "deliver", SCENARIO_PROVENANCE);
  const usdPrincipalPayment = buildPrincipalPayment(confirmTs, "receive", SCENARIO_PROVENANCE);
  const settlementConfirmed = buildSettlementConfirmed(confirmTs, SCENARIO_PROVENANCE);

  return {
    trade,
    usdSettlement,
    zarSettlement,
    revalTick1,
    revalTick2,
    zarPrincipalPayment,
    usdPrincipalPayment,
    settlementConfirmed,
    all: [
      trade,
      usdSettlement,
      zarSettlement,
      revalTick1,
      revalTick2,
      zarPrincipalPayment,
      usdPrincipalPayment,
      settlementConfirmed,
    ],
  };
}

export interface NdfForwardScenarioEvents {
  readonly trade: Event;
  readonly fixing: Event;
  readonly all: ReadonlyArray<Event>;
}

export function buildNdfForwardScenarioEvents(): NdfForwardScenarioEvents {
  const tradeTs = "2026-05-12T07:00:00.000Z";
  const fixingTs = "2026-08-10T16:00:00.000Z";
  const trade = buildNdfTradeExecuted(tradeTs);
  const fixing = buildNdfFixingObserved(fixingTs);
  return { trade, fixing, all: [trade, fixing] };
}

// ---------------------------------------------------------------------------
// Runners
// ---------------------------------------------------------------------------

export interface FxForwardScenarioResult {
  readonly ok: boolean;
  readonly emitted: number;
  readonly countsByType: Record<string, number>;
}

export function runFxForwardScenario(opts: {
  dbPath: string;
  cleanup: boolean;
}): FxForwardScenarioResult {
  const events = buildFxForwardScenarioEvents();
  try {
    unlinkSync(opts.dbPath);
  } catch {
    /* first run or already clean */
  }
  const store = new EventStore(opts.dbPath);
  store.appendAll([...events.all]);
  const total = store.count();

  let provenanceOk = true;
  for (const e of store.replay({ entity: ENTITY })) {
    if (e.provenance?.kind !== "simulated" || e.provenance.scenario !== SCENARIO_ID) {
      provenanceOk = false;
      break;
    }
  }

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
  };
}

export function runNdfForwardScenario(opts: {
  dbPath: string;
  cleanup: boolean;
}): FxForwardScenarioResult {
  const events = buildNdfForwardScenarioEvents();
  try {
    unlinkSync(opts.dbPath);
  } catch {
    /* first run or already clean */
  }
  const store = new EventStore(opts.dbPath);
  store.appendAll([...events.all]);
  const total = store.count();
  let provenanceOk = true;
  for (const e of store.replay({ entity: ENTITY })) {
    if (e.provenance?.kind !== "simulated" || e.provenance.scenario !== NDF_SCENARIO_ID) {
      provenanceOk = false;
      break;
    }
  }
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
  };
}

// ---------------------------------------------------------------------------
// Substrate gaps surfaced by this scenario
// ---------------------------------------------------------------------------
//
// 1. Hedge-accounting designation (D-FX-HEDGE-DESIGNATION).
//    This scenario books the forward as FVTPL (trading book). Real-world
//    forwards used for cash-flow hedging would be FVOCI with effectiveness
//    testing per IFRS 9 §6. The classifier and event family must learn the
//    HedgeDesignated event before that becomes meaningful.
//
// 2. Forward-curve substrate not yet built.
//    The MtM ticks emitted here use spot ZAR/USD rates as a proxy. A real
//    forward MtM uses the forward curve at the residual tenor (not spot).
//    Rohan's risk-substrate roadmap item: FxForwardCurvePublished event +
//    curve-storage projection. Until then the EOD revaluation overstates
//    MtM by the basis between spot and forward.
//
// 3. NdfFixingObserved → SubLedger posting rule not yet wired.
//    Bea's posting-rules/fx-spot.ts handles physical settlement legs only.
//    The NDF cash-leg posting (single-currency net cash) is a separate
//    posting rule (NDF-cash-settle) — substrate gap surfaced in this PR.
//
// 4. ProvenanceTag.sourceEventId not yet wired (same gap as scenario 06).
//
// ---------------------------------------------------------------------------

if (import.meta.main) {
  if (process.env.BANK_SCENARIO_SHARED === "1") {
    const { setDefaultProvenanceModeOverride } = await import("../platform/projections");
    setDefaultProvenanceModeOverride("combined");
    logger.info(
      { BANK_SCENARIO_SHARED: "1", provenanceMode: "combined" },
      "scenario 07 — BANK_SCENARIO_SHARED=1 → provenance mode set to combined",
    );
  }

  logger.info(
    {
      scenario: SCENARIO_ID,
      sourceLineage: SOURCE_LINEAGE,
      tradeDate: TRADE_DATE_ISO,
      settlementDate: FORWARD_SETTLEMENT_DATE_ISO,
      forwardRate: FORWARD_RATE,
      tenorDays: 92,
      usdNotional: `USD ${(USD_NOTIONAL_MINOR / 100).toLocaleString()}`,
      zarNotional: `ZAR ${(ZAR_NOTIONAL_MINOR / 100).toLocaleString()}`,
    },
    "scenario 07 — FX Forward trade — starting",
  );

  const deliverable = runFxForwardScenario({
    dbPath: ".local/scenario-fx-forward.db",
    cleanup: true,
  });

  const ndf = runNdfForwardScenario({
    dbPath: ".local/scenario-fx-forward-ndf.db",
    cleanup: true,
  });

  const ok = deliverable.ok && ndf.ok;

  logger.info(
    {
      deliverable: {
        ok: deliverable.ok,
        emitted: deliverable.emitted,
        countsByType: deliverable.countsByType,
      },
      ndf: {
        ok: ndf.ok,
        emitted: ndf.emitted,
        countsByType: ndf.countsByType,
      },
      authority: [
        "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
        "D-FX-CLS-MEMBERSHIP",
        "D-FX-AD-STATUS",
        "D-MARKETS-CAPITAL-TIME-SHAPE",
        "IAS-21-§28",
        "IFRS-9-§5.7.1",
      ],
      substrateGaps: [
        "Hedge-accounting designation (D-FX-HEDGE-DESIGNATION) — currently all forwards classified FVTPL",
        "Forward-curve substrate not yet built — MtM uses spot as proxy (overstates)",
        "NDF cash-leg posting rule not yet wired (Bea posting-rules/fx-spot.ts is physical-only)",
      ],
    },
    ok ? "scenario 07 — FX Forward — PASSED" : "scenario 07 — FX Forward — FAILED",
  );

  process.exit(ok ? 0 : 1);
}
