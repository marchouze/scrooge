// scripts/backfill-fil-instances.ts
//
// WS-V2-AUTHORITATIVE Slice S1 — FIL-instance + market-data backfill KEYSTONE.
//
// THE GAP (verified on a clean CI store): a `bun run ci:migrate` store carries
// 2010 governance events and ZERO trading events — no `FxTradeExecuted`, no
// `FilInstrumentCreated`, no `DailyPnLReportGenerated`, no `MarketRiskMeasure-
// Computed`/`MarketRiskVarComputed`. The V1-removal waves purged the FX trading
// book from the canonical store. Consequently EVERY V2 parity gate
// (`daily-pnl-v2-parity`, `var-v2-parity`, `ba320-fx-v2-parity`) is VACUOUS —
// nothing on either side to compare. S1 makes them NON-VACUOUS with real data.
//
// WHAT THIS SCRIPT DOES (idempotent, replay-safe — re-run = 0 new events):
//   1. SOURCE RESOLUTION. Read `FxTradeExecuted` from the main store
//      (`BANK_EVENT_DB`, via composition.eventStore). If trades exist → derive
//      FIL instances from them (a true backfill). If ZERO → seed a small
//      DETERMINISTIC anchor FX book first (simulated provenance + named scenario
//      `ws-v2-authoritative-s1` — truthfully labelled, Charter cmd 3 no-green-by-
//      concealment; simulated is the operating-book class admitted in build phase),
//      then derive.
//   2. FIL MATERIALISATION INTO THE MAIN STORE. For each source trade emit
//      `FilInstrumentCreated` (+ `FilInstrumentTerminated` for settled/matured)
//      via the registered `make*` builders, economic terms decimal-native Money
//      ({currency, amount} MAJOR-unit string), tenant from the anchor, reporting
//      currency from `anchorFunctionalCurrency()` (NEVER hardcoded — Charter
//      cmd 4). The Phase-2/3 V2 readers (daily-pnl-v2.ts, ba320-fx-v2.ts) read
//      FilInstrumentCreated from THIS store — the prior `seed:v2-fil-instances-
//      ir-fx` wrote only to the separate v2-anchor.db, which those readers never
//      consult.
//   3. MARKET-DATA SEED (GAP-ONLY). Production `fx-quote` ticks (`mid`) for every
//      referenced pair + an FX return history (≥ MIN_RETURN_OBSERVATIONS+1 levels)
//      so the V1/V2 VaR engines have enough history. Never overwrites an existing
//      tick (INSERT OR IGNORE + presence guard).
//   4. RUN THE ENGINES so the parity gates have both sides:
//        - V1 FX EOD revaluation → FxPositionRevalued (feeds V1 daily-pnl)
//        - V1 daily-P&L report   → DailyPnLReportGenerated (V1 side of A2)
//        - V1 VaR                → MarketRiskMeasureComputed (V1 side of A3)
//        - V2 VaR                → MarketRiskVarComputed (V2 side of A3)
//      The V2 daily-P&L side is computed live by recon:daily-pnl-v2-parity
//      (computeDailyPnLV2 over the FIL projection) — no persisted V2 P&L needed.
//
// NO FLIPS. S1 promotes no `v2Status`. Byte-clean OR genuine divergence are both
// valid S1 outcomes (the brief): the job is non-vacuity, not necessarily passing.
//
// BOUNDARY: this is a SCRIPT (not under v2-core), so it MAY read v1 and import
// platform/. It imports v2-core only for the FIL URN/schema grammar (permitted
// v1→v2 direction).
//
// Authority: D-V2-AUTHORITATIVE-FLIP-PREREQS (CEO-approved 2026-06-16);
//   D-ENGINEERING-INTEGRITY-CHARTER; D-FIL-FRAMEWORK-UNIFICATION;
//   D-MODEL-BINDING-CONTRACT-V1; D-V1-REMOVAL-PHASE2-GAP-A2;
//   D-V1-REMOVAL-PHASE2-GAP-A3; Principle 1; Principle 5.
// brief: brief:atlas:ws-v2-authoritative-s1-fil-instance-market-data-:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { nowUtc } from "../platform/core/types";
import {
  makeFilInstrumentCreated,
  makeFilInstrumentTerminated,
} from "../platform/event-store/event-types/fil-instances";
import { scenarioId, simulatedTag } from "../platform/event-store/provenance";
import type { ProvenanceTag } from "../platform/event-store/provenance";
import { anchorFunctionalCurrency } from "../platform/identity/functional-currency";
import { resolveMarketDataDbPath } from "../platform/market-data/resolve-market-data-db";
import { MarketDataStore } from "../platform/market-data/store";
import { MIN_RETURN_OBSERVATIONS } from "../platform/market-risk/var-engine";
import { makeFxTradeExecuted, makeSettlementConfirmed } from "../platform/markets/cdm/fx";
import type { FxTradeExecutedPayload } from "../platform/markets/cdm/fx";
import { divD, roundDecimal, toDecimal } from "../v2-core/fil-core/decimal";
import { type Money, moneyFromDecimal } from "../v2-core/fil-core/primitives";
import { formatInstanceUrn, formatTypeUrn } from "../v2-core/fil-core/urn";
import type { FilEconomicTerms } from "../v2-core/fil-instances/events";

// ---------------------------------------------------------------------------
// Constants — anchor identity. The reporting (functional) currency is resolved
// from the legal-entity tree, NEVER hardcoded (Charter cmd 4). The fixture FX
// book is denominated against that currency.
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = ENTITY;
const REPORTING = anchorFunctionalCurrency();

const BACKFILL_ACTOR = { type: "service" as const, id: "agent:atlas:backfill-fil-instances" };
const FIL_CITATIONS = [
  "D-V2-AUTHORITATIVE-FLIP-PREREQS",
  "D-FIL-FRAMEWORK-UNIFICATION",
  "D-MODEL-BINDING-CONTRACT-V1",
  "P1-EVENTS-AS-TRUTH",
];
const TRADE_CITATIONS = [
  "D-V2-AUTHORITATIVE-FLIP-PREREQS",
  "D-FX-SALES-TRADING-FRONTEND",
  "D-MARKETS-SCHEMA-FOUNDATION",
];

// Fixture trades are SIMULATED with a named scenario — NOT build-phase-fixture.
// The operating-book provenance filter (the NOP / VaR basis) excludes
// build-phase-fixture as seed-harness scaffolding but ADMITS simulated events in
// the build phase (platform/projections/filter.ts §operating-book). Simulated +
// scenario is the correct class for a synthetic-but-operating FX book — the same
// class the sim hub and the pre-licence scenario harness use. The sourceLineage
// matches the `^backfill:` registered pattern (provenance-lineage.registry.ts).
const S1_SCENARIO = scenarioId("ws-v2-authoritative-s1");
const FIXTURE_PROVENANCE: ProvenanceTag = simulatedTag({
  scenario: S1_SCENARIO,
  sourceLineage: "backfill:ws-v2-authoritative-s1",
});

// FIL type URNs (align with the S4 product filTypeScopes / the prior seed).
const FX_SPOT_TYPE_URN = formatTypeUrn({
  assetClass: "fx",
  familyPath: "spot",
  typeSlug: "otc-vanilla",
  version: { major: 1, minor: 0 },
});
const FX_FORWARD_TYPE_URN = formatTypeUrn({
  assetClass: "fx",
  familyPath: "forward",
  typeSlug: "otc-vanilla",
  version: { major: 1, minor: 0 },
});

// ---------------------------------------------------------------------------
// Decimal-native Money: source legs carry integer MINOR units; the v2 FIL
// economic terms carry decimal-native MAJOR-unit Money. Conversion through the
// v2 decimal engine — NO float arithmetic (`recon:no-float-money-arithmetic`).
// ---------------------------------------------------------------------------

function minorNumberToMajorMoney(minorUnits: number, currency: string): Money {
  const wholeMinor = roundDecimal(toDecimal(String(minorUnits)), 0, "HALF_UP");
  return moneyFromDecimal(currency, roundDecimal(divD(wholeMinor, toDecimal("100")), 2, "HALF_UP"));
}

// ---------------------------------------------------------------------------
// (1) SOURCE RESOLUTION — count existing FxTradeExecuted in the main store.
// ---------------------------------------------------------------------------

function countFxTrades(): number {
  let n = 0;
  for (const _ of eventStore.replay({ type: "FxTradeExecuted" })) n += 1;
  return n;
}

// ---------------------------------------------------------------------------
// (1b) DETERMINISTIC ANCHOR FX BOOK — seeded ONLY when the store has no trades.
//
// A small, fixed book sufficient to exercise the gates: three open FX-spot
// trades (one per controlled-launch counterparty pattern) + one settled trade
// (to materialise a FilInstrumentTerminated). Notionals + rate are fixed
// constants (deterministic — re-run identical). Provenance: simulated + scenario.
// ---------------------------------------------------------------------------

interface FixtureTrade {
  readonly tradeId: string;
  readonly counterpartyId: string;
  readonly counterpartyName: string;
  readonly base: string; // non-ZAR leg currency
  readonly side: "buy" | "sell";
  readonly baseNotionalMajor: number; // notional in base currency, major units
  readonly rate: number; // REPORTING per 1 base unit (e.g. ZAR per USD)
  readonly settled: boolean;
}

// REPORTING-per-base reference rates for the fixture book. Fixed constants —
// the production market-data ticks seeded in step (3) carry these same mids so
// the V2 valuation has a usable mark.
const FIXTURE_RATES: Readonly<Record<string, number>> = {
  USD: 18.52,
  EUR: 20.15,
  GBP: 23.4,
};

const FIXTURE_BOOK: readonly FixtureTrade[] = [
  {
    tradeId: "S1-FX-FIXTURE-USD-001",
    counterpartyId: "urn:party:legal-entity:standard-bank-za",
    counterpartyName: "The Standard Bank of South Africa Limited",
    base: "USD",
    side: "buy",
    baseNotionalMajor: 500_000,
    rate: FIXTURE_RATES.USD,
    settled: false,
  },
  {
    tradeId: "S1-FX-FIXTURE-EUR-001",
    counterpartyId: "urn:party:legal-entity:investec-bank-za",
    counterpartyName: "Investec Bank Limited",
    base: "EUR",
    side: "sell",
    baseNotionalMajor: 300_000,
    rate: FIXTURE_RATES.EUR,
    settled: false,
  },
  {
    tradeId: "S1-FX-FIXTURE-GBP-001",
    counterpartyId: "urn:party:legal-entity:standard-bank-za",
    counterpartyName: "The Standard Bank of South Africa Limited",
    base: "GBP",
    side: "buy",
    baseNotionalMajor: 200_000,
    rate: FIXTURE_RATES.GBP,
    settled: false,
  },
  {
    tradeId: "S1-FX-FIXTURE-USD-SETTLED-001",
    counterpartyId: "urn:party:legal-entity:investec-bank-za",
    counterpartyName: "Investec Bank Limited",
    base: "USD",
    side: "buy",
    baseNotionalMajor: 100_000,
    rate: FIXTURE_RATES.USD,
    settled: true,
  },
];

const FIXTURE_TRADE_DATE = "2026-06-01";
const FIXTURE_SETTLE_DATE = "2026-06-03"; // T+2
const FIXTURE_TRADE_TS = `${FIXTURE_TRADE_DATE}T09:00:00.000Z`;
const FIXTURE_SETTLE_TS = `${FIXTURE_SETTLE_DATE}T09:00:00.000Z`;

function buildFixtureTradeEvent(ft: FixtureTrade) {
  const baseMinor = ft.baseNotionalMajor * 100;
  // counter (reporting) leg minor = base major × rate × 100, integer.
  const reportingMinor = Math.round(ft.baseNotionalMajor * ft.rate * 100);
  // BUY base vs reporting: bank pays reporting, receives base.
  // SELL base vs reporting: bank pays base, receives reporting.
  const payCurrency = ft.side === "buy" ? REPORTING : ft.base;
  const receiveCurrency = ft.side === "buy" ? ft.base : REPORTING;
  // The leg invariant requires notional.currency === payCurrency and
  // counterNotional.currency === receiveCurrency.
  const reportingLeg = { currency: REPORTING, amountMinor: reportingMinor };
  const baseLeg = { currency: ft.base, amountMinor: baseMinor };
  const notional = ft.side === "buy" ? reportingLeg : baseLeg;
  const counterNotional = ft.side === "buy" ? baseLeg : reportingLeg;
  const payload: FxTradeExecutedPayload = {
    tradeId: { scheme: "INTERNAL", value: ft.tradeId },
    productTaxonomy: "FX-spot",
    currencyPair: { base: ft.base, quote: REPORTING },
    side: ft.side,
    legs: [
      {
        legKind: "near",
        payCurrency,
        receiveCurrency,
        notional,
        counterNotional,
        rate: { currency: REPORTING, amount: ft.rate },
        settlementDate: { iso: FIXTURE_SETTLE_DATE, calendar: "JIHCAL" },
      },
    ],
    tradeDate: { iso: FIXTURE_TRADE_DATE, calendar: "JIHCAL" },
    counterparty: {
      partyId: ft.counterpartyId,
      name: ft.counterpartyName,
      role: "counterparty",
      jurisdiction: "ZA",
    },
    venue: "OTC",
    trader: BACKFILL_ACTOR.id,
    bookId: "BOOK-FX-MARKETS-LP",
    bookType: "trading",
    settlementForm: "physical",
    settlementPath: "correspondent",
    finsurvCategory: "ODP-001-cross-border-institutional",
    clientFlowRef: `ws-v2-s1:${ft.tradeId}`,
  };
  return makeFxTradeExecuted({
    asOf: FIXTURE_TRADE_TS,
    entity: ENTITY,
    actor: BACKFILL_ACTOR,
    citations: [...TRADE_CITATIONS],
    payload,
  });
}

/** Append the deterministic anchor FX book (idempotent — skips trades already present). */
function seedAnchorFxBook(): { tradesSeeded: number } {
  const existing = new Set<string>();
  for (const e of eventStore.replay({ type: "FxTradeExecuted" })) {
    const p = e.payload as { tradeId?: { value?: string } };
    if (p.tradeId?.value) existing.add(p.tradeId.value);
  }

  let seeded = 0;
  for (const ft of FIXTURE_BOOK) {
    if (existing.has(ft.tradeId)) continue;
    const ev = buildFixtureTradeEvent(ft);
    eventStore.append({ ...ev, provenance: FIXTURE_PROVENANCE });
    seeded += 1;

    if (ft.settled) {
      // Emit a SettlementConfirmed so the trade resolves to a settled lifecycle
      // (→ FilInstrumentTerminated in step 2). Settlement is also a fixture.
      const settleEv = makeFxSettlementConfirmedFixture(ft);
      eventStore.append({ ...settleEv, provenance: FIXTURE_PROVENANCE });
    }
  }
  return { tradesSeeded: seeded };
}

// SettlementConfirmed fixture — keyed by tradeId so the terminal resolver picks
// it up (→ FilInstrumentTerminated in step 2). realisedPnlDelta is 0 (the trade
// settles at its execution rate in the fixture book — no realised move).
function makeFxSettlementConfirmedFixture(ft: FixtureTrade) {
  return makeSettlementConfirmed({
    asOf: FIXTURE_SETTLE_TS,
    entity: ENTITY,
    actor: BACKFILL_ACTOR,
    citations: [...TRADE_CITATIONS],
    payload: {
      tradeId: ft.tradeId,
      currencyPair: `${ft.base}/${REPORTING}`,
      settledDate: FIXTURE_SETTLE_TS,
      realisedPnlDelta: 0,
      settlementRef: `s1-fixture-swift-${ft.tradeId}`,
      citations: [...TRADE_CITATIONS],
    },
  });
}

// ---------------------------------------------------------------------------
// (2) FIL MATERIALISATION — derive FilInstrumentCreated/Terminated from the
// FxTradeExecuted set in the main store. Idempotent: skip an instance URN that
// already carries the lifecycle event.
// ---------------------------------------------------------------------------

interface NearLeg {
  legKind?: string;
  notional?: { currency?: string; amountMinor?: number };
  counterNotional?: { currency?: string; amountMinor?: number };
  settlementDate?: { iso?: string };
}

function tradeIdOf(p: Record<string, unknown>): string | undefined {
  const t = p.tradeId;
  if (typeof t === "string") return t;
  if (t && typeof t === "object" && typeof (t as { value?: unknown }).value === "string") {
    return (t as { value: string }).value;
  }
  return undefined;
}

type TerminalStage = "settled" | "matured" | "cancelled";

function buildTerminals(): Map<string, { stage: TerminalStage; asOf: string }> {
  const out = new Map<string, { stage: TerminalStage; asOf: string }>();
  const scan = (type: string, stage: TerminalStage) => {
    for (const e of eventStore.replay({ type })) {
      const id = tradeIdOf(e.payload as Record<string, unknown>);
      if (id) out.set(id, { stage, asOf: e.as_of });
    }
  };
  scan("SettlementConfirmed", "settled");
  scan("TradeMatured", "matured");
  scan("FxTradeCancelled", "cancelled");
  return out;
}

function existingFilInstances(type: string): Set<string> {
  const out = new Set<string>();
  for (const e of eventStore.replay({ type })) {
    const p = e.payload as { instance?: string };
    if (p.instance) out.add(p.instance);
  }
  return out;
}

function materialiseFilInstances(): { created: number; terminated: number; skipped: number } {
  const terminals = buildTerminals();
  const haveCreated = existingFilInstances("FilInstrumentCreated");
  const haveTerminated = existingFilInstances("FilInstrumentTerminated");

  let created = 0;
  let terminated = 0;
  let skipped = 0;

  for (const e of eventStore.replay({ type: "FxTradeExecuted" })) {
    const p = e.payload as Record<string, unknown>;
    const tradeId = tradeIdOf(p);
    if (!tradeId) {
      skipped += 1;
      continue;
    }
    const counterparty = p.counterparty as { partyId?: string } | undefined;
    const counterpartyId = counterparty?.partyId;
    if (!counterpartyId) {
      skipped += 1;
      continue;
    }
    const legs = (p.legs as NearLeg[] | undefined) ?? [];
    const near = legs.find((l) => l.legKind === "near") ?? legs[0];
    if (!near || !near.notional || !near.counterNotional) {
      skipped += 1;
      continue;
    }

    // Reporting-currency leg selection (mirror the v1 SA-CCR adapter convention:
    // the netting set is denominated in the reporting/functional currency).
    let reportingMinor: number | null = null;
    if (near.notional.currency === REPORTING) reportingMinor = near.notional.amountMinor ?? null;
    else if (near.counterNotional.currency === REPORTING)
      reportingMinor = near.counterNotional.amountMinor ?? null;
    if (reportingMinor === null || reportingMinor === 0) {
      skipped += 1; // cross pair with no reporting leg — forms no reporting netting set
      continue;
    }

    const pair = p.currencyPair as { base?: string; quote?: string } | undefined;
    const base = pair?.base ?? "";
    const quote = pair?.quote ?? "";
    const side = p.side as string | undefined;
    const taxonomy = String(p.productTaxonomy ?? "FX-spot");
    const typeUrn = taxonomy.toLowerCase().includes("forward")
      ? FX_FORWARD_TYPE_URN
      : FX_SPOT_TYPE_URN;

    const instance = formatInstanceUrn({ tenant: TENANT, instanceId: tradeId });

    const economicTerms: FilEconomicTerms = {
      assetClass: "fx",
      notional: minorNumberToMajorMoney(Math.abs(reportingMinor), REPORTING),
      direction: side === "sell" ? "short" : "long",
      counterpartyId,
      nettingSetId: `NS-${counterpartyId}-${REPORTING}`,
      currency: REPORTING,
      settlementDate: near.settlementDate?.iso ?? e.as_of,
      ...(base && quote ? { hedgingSetTag: `${base}/${quote}` } : {}),
    };

    if (!haveCreated.has(instance)) {
      const ev = makeFilInstrumentCreated({
        asOf: e.as_of,
        entity: ENTITY,
        actor: BACKFILL_ACTOR,
        citations: [...FIL_CITATIONS],
        payload: {
          kind: "FilInstrumentCreated",
          instance,
          type: typeUrn,
          tenant: TENANT,
          asOf: e.as_of,
          originatingEvent: { eventType: "FxTradeExecuted", eventId: e.event_id },
          initialStage: "active",
          economicTerms,
        },
      });
      eventStore.append(ev);
      haveCreated.add(instance);
      created += 1;
    }

    const term = terminals.get(tradeId);
    if (term && !haveTerminated.has(instance)) {
      const ev = makeFilInstrumentTerminated({
        asOf: term.asOf,
        entity: ENTITY,
        actor: BACKFILL_ACTOR,
        citations: [...FIL_CITATIONS],
        payload: {
          kind: "FilInstrumentTerminated",
          instance,
          type: typeUrn,
          tenant: TENANT,
          asOf: term.asOf,
          originatingEvent: { eventType: "FxTradeExecuted", eventId: e.event_id },
          terminalStage: term.stage,
        },
      });
      eventStore.append(ev);
      haveTerminated.add(instance);
      terminated += 1;
    }
  }

  return { created, terminated, skipped };
}

// ---------------------------------------------------------------------------
// (3) MARKET-DATA SEED — production fx-quote ticks for each referenced pair, +
// a return history (≥ MIN_RETURN_OBSERVATIONS+1 levels) so the VaR engines have
// enough observations. Gap-only: never overwrite an existing production tick.
// ---------------------------------------------------------------------------

const HISTORY_LEVELS = MIN_RETURN_OBSERVATIONS + 5; // headroom over the 20-obs floor

function referencedBaseCurrencies(): Set<string> {
  const out = new Set<string>();
  for (const e of eventStore.replay({ type: "FxTradeExecuted" })) {
    const p = e.payload as Record<string, unknown>;
    const pair = p.currencyPair as { base?: string } | undefined;
    if (pair?.base && pair.base !== REPORTING) out.add(pair.base);
  }
  return out;
}

function seedMarketData(): { pairs: number; ticksSeeded: number } {
  const md = new MarketDataStore(resolveMarketDataDbPath().path);
  const bases = referencedBaseCurrencies();
  let ticksSeeded = 0;

  for (const base of bases) {
    const pair = `${base}/${REPORTING}`;
    const baseRate = FIXTURE_RATES[base] ?? 1;
    if (baseRate <= 0) continue;

    // Already have a production history of sufficient depth? Skip (gap-only).
    const existing = md.query({
      provenance: "production",
      instrument: pair,
      dataType: "fx-quote",
      limit: HISTORY_LEVELS + 1,
    });
    if (existing.length >= HISTORY_LEVELS + 1) continue;

    // Seed a deterministic, mildly-varying daily mid series ending at the EOD
    // reference date. The variation is a fixed sinusoid (no RNG) so the return
    // window is non-degenerate (non-zero VaR) yet fully reproducible.
    for (let i = HISTORY_LEVELS; i >= 0; i--) {
      const day = new Date(Date.parse(`${FIXTURE_SETTLE_DATE}T17:00:00.000Z`));
      day.setUTCDate(day.getUTCDate() - i);
      const asOf = day.toISOString();
      // ±0.4% deterministic wobble around the reference rate.
      const mid = baseRate * (1 + 0.004 * Math.sin(i * 0.7));
      const id = `s1-fixture:${pair}:${asOf.slice(0, 10)}`;
      const before = md.getLatest("ws-v2-s1-fixture", pair, asOf, "production");
      md.append({
        id,
        source: "ws-v2-s1-fixture",
        instrument: pair,
        dataType: "fx-quote",
        provenance: "production",
        asOf,
        payload: { mid, bid: mid * 0.9995, ask: mid * 1.0005, pair },
      });
      // INSERT OR IGNORE makes the append idempotent on id; count only new rows.
      const after = md.getLatest("ws-v2-s1-fixture", pair, asOf, "production");
      if (!before && after) ticksSeeded += 1;
    }
  }

  return { pairs: bases.size, ticksSeeded };
}

// ---------------------------------------------------------------------------
// (4) RUN THE ENGINES — populate both sides of the parity gates, against the
// SAME store + market-data store the recon gates read.
// ---------------------------------------------------------------------------

import { makeMarketRiskMeasureComputed } from "../platform/event-store/event-types/market-risk-measure";
import { lookupQuoteWithInverse } from "../platform/market-data/store";
import { computeMarketRisk } from "../platform/market-risk/var-engine";
import { emitMarketRiskVarV2 } from "../platform/market-risk/var-engine-v2";
import { runEodFxRevaluation } from "../platform/markets/eod/fx-revaluation";
import type { FxRateSource } from "../platform/markets/eod/fx-revaluation";
import { runDailyPnLReport } from "../platform/product-control/daily-pnl";
import { marketVarAppetiteCeilingZar } from "../platform/risk/ras-appetite-register";

const EOD_DATE = nowUtc().slice(0, 10);

/**
 * Market-data-backed FX rate source for the EOD revaluation — sources the latest
 * production mid from the SAME MarketDataStore the gates read, so V1 reval marks
 * agree with the V2 valuation inputs. Direction-aware via lookupQuoteWithInverse.
 * Throws on a missing pair (fail-closed — the engine's caller treats the throw as
 * "no mark" rather than folding a silent zero).
 */
function makeMarketDataRateSource(md: MarketDataStore): FxRateSource {
  return {
    getRate(currencyPair: string): number {
      const quote = lookupQuoteWithInverse(md, currencyPair, { provenance: "production" });
      if (!quote || quote.rate <= 0) {
        throw new Error(`no production mark for "${currencyPair}"`);
      }
      return quote.rate;
    },
  };
}

/** V1 VaR emit — mirror scripts/market-risk-measure-run.ts (idempotent per day). */
function runV1Var(marketData: MarketDataStore): void {
  const asOf = nowUtc();
  const measureId = `MR-MEASURE-${ENTITY}-${asOf.slice(0, 10)}`;
  const exists = [...eventStore.replay({ type: "MarketRiskMeasureComputed" })].some(
    (e) => (e.payload as { measureId?: string }).measureId === measureId,
  );
  if (exists) return;
  const report = computeMarketRisk({ eventStore, marketData, asOf });
  const event = makeMarketRiskMeasureComputed({
    asOf,
    entity: ENTITY,
    actor: BACKFILL_ACTOR,
    citations: [
      "D-BRC-INTERIM-MR-1-FX",
      "WS-MARKET-RISK-PROCEDURES",
      "model:market-risk-var-hs-v1",
      "model:market-risk-es-hs-v1",
    ],
    payload: {
      measureId,
      asOf,
      status: report.status,
      var: report.var,
      svar: report.svar,
      es: report.es,
      riskFactorCount: report.exposures.length,
      minObservations: report.minObservations,
      varAppetiteZar: marketVarAppetiteCeilingZar(),
    },
  });
  eventStore.append(event);
}

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------

console.log("\n=== WS-V2-AUTHORITATIVE S1 — FIL-instance + market-data backfill ===");
console.log(`store           : ${process.env.BANK_EVENT_DB ?? "(home default)"}`);
console.log(`reporting ccy   : ${REPORTING} (from anchorFunctionalCurrency())`);

const tradesBefore = countFxTrades();
console.log(`FxTradeExecuted in store (before): ${tradesBefore}`);

if (tradesBefore === 0) {
  const { tradesSeeded } = seedAnchorFxBook();
  console.log(`  → seeded deterministic fixture book (${tradesSeeded} trades)`);
}

const fil = materialiseFilInstances();
console.log(
  `FIL instances   : ${fil.created} created, ${fil.terminated} terminated, ${fil.skipped} skipped`,
);

const md = seedMarketData();
console.log(`market data     : ${md.pairs} pair(s), ${md.ticksSeeded} new production tick(s)`);

const marketDataStore = new MarketDataStore(resolveMarketDataDbPath().path);

// Engines — guarded so a single-engine error does not abort the whole backfill
// (a missing side degrades the corresponding gate to advisory, not a crash).
runEngine("FX EOD revaluation", () => {
  runEodFxRevaluation(eventStore, EOD_DATE, makeMarketDataRateSource(marketDataStore));
});
runEngine("V1 daily-P&L report", () => {
  runDailyPnLReport(eventStore, nowUtc);
});
runEngine("V1 VaR (MarketRiskMeasureComputed)", () => {
  runV1Var(marketDataStore);
});
runEngine("V2 VaR (MarketRiskVarComputed)", () => {
  emitMarketRiskVarV2(eventStore, marketDataStore, marketVarAppetiteCeilingZar(), nowUtc);
});
// NOTE: the V2 daily-P&L side is computed LIVE by recon:daily-pnl-v2-parity
// (computeDailyPnLV2 over the FIL projection). We deliberately do NOT persist a
// V2 DailyPnLReportGenerated event here — doing so would leave a V2-path report
// (marketDataAsOf set) as the latest DailyPnL event, which the parity gate skips
// as the V1 side ("no V1 data"). The V1 runDailyPnLReport above is the V1 side.

console.log(`\nFilInstrumentCreated in store (after): ${countType("FilInstrumentCreated")}`);
console.log(`DailyPnLReportGenerated (after)     : ${countType("DailyPnLReportGenerated")}`);
console.log(`MarketRiskMeasureComputed (after)   : ${countType("MarketRiskMeasureComputed")}`);
console.log(`MarketRiskVarComputed (after)       : ${countType("MarketRiskVarComputed")}`);
console.log("=== S1 backfill complete ===\n");

function countType(type: string): number {
  let n = 0;
  for (const _ of eventStore.replay({ type })) n += 1;
  return n;
}

function runEngine(label: string, fn: () => void): void {
  try {
    fn();
    console.log(`  [engine] ${label}: ok`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  [engine] ${label}: skipped (${msg})`);
  }
}
