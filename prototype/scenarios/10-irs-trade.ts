// scenarios/10-irs-trade.ts
//
// OTC Interest Rate Swap (IRS) — bank pays 8.5% fixed / receives JIBAR 3M.
// Notional ZAR 100m; 5-year tenor; quarterly; ACT/365.
// Counterparty: CP-IRS-INST-001 (institutional).
//
// Lifecycle:
//   T0   IrsTradeBooked              — bank pays 8.5% fixed / receives JIBAR 3M
//   T1   IrsCouponScheduleGenerated  — 20 quarterly payment dates (5yr × 4/yr)
//   T2   IrsCouponPaymentInstructed  — first quarterly coupon at day 90
//                                       Net: fixed 8.5% × 100m × (90/365) ≈ R2.09m pay
//   T3   IrsCouponSettlementConfirmed — correspondent confirms settlement
//   EOD  IrsPositionRevalued         — MTM at current JIBAR curve; DV01 ~ZAR 50k per bp
//
// FX Forward parallel: see scenarios/07-fx-forward-trade.ts.
//
// Authority:
//   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   ISDA-2002-MASTER            (swap documentation standard)
//   IFRS-9-§4.1                 (classification and measurement; FVTPL)
//   ORG-PR-11                   (derivatives trading authority)
//
// Run: `bun run scenario:irs-trade`
//
// Authors: Eitan (IRRBB / derivatives engineer, engineering)

import { unlinkSync } from "node:fs";

import { type Actor, BANK_ZA_001, newEventId } from "@platform/core/types";
import { type ProvenanceTag, simulatedTag } from "@platform/event-store/provenance";
import { EventStore } from "@platform/event-store/store";
import type { Event } from "@platform/event-store/types";
import {
  type IrsTradeBookedPayload,
  makeIrsCouponPaymentInstructed,
  makeIrsCouponScheduleGenerated,
  makeIrsCouponSettlementConfirmed,
  makeIrsTradeBooked,
} from "@platform/markets/cdm/ird";
import { runEodIrsRevaluation } from "@platform/markets/eod/irs-revaluation";
import { staticJibarRateSource } from "@platform/markets/eod/jibar-curve-seed";
import { generateCouponSchedule } from "@platform/markets/ird/coupon-schedule";
import { logger } from "@platform/observability/logger";

// ---------------------------------------------------------------------------
// Scenario constants
// ---------------------------------------------------------------------------

export const SCENARIO_ID = "irs-trade-lifecycle-m5";
export const SOURCE_LINEAGE = "scenario-runner:10-irs-trade";
export const ENTITY = BANK_ZA_001;

export const COUNTERPARTY_ID = "CP-IRS-INST-001";
export const COUNTERPARTY_NAME = "SimulatedInstitutional Co. (IRS fixture)";

// Trade economics.
const TRADE_DATE_ISO = "2026-05-17";
const EFFECTIVE_DATE_ISO = "2026-05-19"; // T+2
const MATURITY_DATE_ISO = "2031-05-19"; // 5 years
const NOTIONAL_ZAR_MINOR = 10_000_000_000; // ZAR 100,000,000 in cents
const FIXED_RATE = 0.085; // 8.5%
const CURRENCY = "ZAR";

// First quarterly payment date (day 90 from effective date).
const FIRST_PAYMENT_DATE_ISO = "2026-08-17";

// Valuation date for EOD revaluation.
const VALUATION_DATE_ISO = "2026-05-17";

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export const SCENARIO_PROVENANCE: ProvenanceTag = simulatedTag({
  scenario: SCENARIO_ID,
  sourceLineage: SOURCE_LINEAGE,
});

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

const EITAN: Actor = { type: "human", id: "eitan@bank.local" };
const TOMAS: Actor = { type: "human", id: "tomas@bank.local" };

// ---------------------------------------------------------------------------
// Trade booked — T0
// ---------------------------------------------------------------------------

function buildIrsTradeBooked(asOf: string): Event {
  const base = makeIrsTradeBooked({
    asOf,
    entity: ENTITY,
    actor: EITAN,
    citations: ["D-MARKETS-SCHEMA-FOUNDATION", "ISDA-2002-MASTER", "IFRS-9-§4.1", "ORG-PR-11"],
    payload: {
      tradeId: { scheme: "INTERNAL", value: "TRD-IRS-M5-001" },
      counterparty: {
        partyId: COUNTERPARTY_ID,
        name: COUNTERPARTY_NAME,
        role: "counterparty",
        jurisdiction: "ZA",
      },
      notional: { currency: CURRENCY, amountMinor: NOTIONAL_ZAR_MINOR },
      fixedRate: FIXED_RATE,
      floatingIndex: "JIBAR-3M",
      bankPays: "fixed",
      tradeDate: { iso: TRADE_DATE_ISO, calendar: "JIHCAL" },
      effectiveDate: { iso: EFFECTIVE_DATE_ISO, calendar: "JIHCAL" },
      maturityDate: { iso: MATURITY_DATE_ISO, calendar: "JIHCAL" },
      paymentFrequency: "quarterly",
      dayCountConvention: "ACT/365",
      bookId: "BOOK-IRD-RATES",
      traderRef: "eitan@bank.local",
    },
    eventId: newEventId(),
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

// ---------------------------------------------------------------------------
// Coupon schedule generated — T1
// ---------------------------------------------------------------------------

function buildCouponScheduleGenerated(asOf: string, tradeBooked: Event): Event {
  const tradePayload = tradeBooked.payload as unknown as IrsTradeBookedPayload;

  const schedule = generateCouponSchedule(tradePayload, staticJibarRateSource);

  const base = makeIrsCouponScheduleGenerated({
    asOf,
    entity: ENTITY,
    actor: EITAN,
    citations: ["D-MARKETS-SCHEMA-FOUNDATION", "ISDA-2002-MASTER", "IFRS-9-§4.1"],
    payload: {
      tradeId: tradePayload.tradeId,
      paymentDates: schedule.periods.map((p) => ({
        iso: p.paymentDate,
        calendar: "JIHCAL" as const,
      })),
      fixedCoupons: schedule.periods.map((p) => ({
        currency: CURRENCY,
        amountMinor: p.fixedCouponMinor,
      })),
      floatingCouponEstimates: schedule.periods.map((p) => ({
        currency: CURRENCY,
        amountMinor: p.floatingCouponEstimateMinor,
      })),
      generatedAt: `${asOf}T07:00:00.000Z`,
    },
    eventId: newEventId(),
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

// ---------------------------------------------------------------------------
// First coupon payment instructed — T2
// ---------------------------------------------------------------------------

function buildFirstCouponPaymentInstructed(asOf: string): Event {
  // Fixed coupon: 100m × 8.5% × (90/365) ≈ 2,095,890 ZAR (209,589,041 minor).
  const accrualDays = 90;
  const dcf = accrualDays / 365;
  const fixedCouponMinor = Math.round(NOTIONAL_ZAR_MINOR * FIXED_RATE * dcf);

  // First floating estimate from JIBAR curve (3M forward ≈ 8.15%).
  const forwardJibar = staticJibarRateSource.getForwardJibar(2, 92); // effective+2 to +92
  const floatingCouponMinor = Math.round(NOTIONAL_ZAR_MINOR * forwardJibar * dcf);

  // Net settlement: bank pays fixed, receives float.
  // bankPays=fixed → bank pays (fixedCoupon − floatingCoupon).
  const netMinor = fixedCouponMinor - floatingCouponMinor;
  const direction = netMinor >= 0 ? "pay" : "receive";

  const base = makeIrsCouponPaymentInstructed({
    asOf,
    entity: ENTITY,
    actor: EITAN,
    citations: ["D-MARKETS-SCHEMA-FOUNDATION", "ISDA-2002-MASTER", "ORG-PR-11"],
    payload: {
      tradeId: { scheme: "INTERNAL", value: "TRD-IRS-M5-001" },
      paymentDate: { iso: FIRST_PAYMENT_DATE_ISO, calendar: "JIHCAL" },
      netSettlementAmount: { currency: CURRENCY, amountMinor: Math.abs(netMinor) },
      paymentDirection: direction,
      instructedAt: `${asOf}T09:00:00.000Z`,
    },
    eventId: newEventId(),
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

// ---------------------------------------------------------------------------
// First coupon settlement confirmed — T3
// ---------------------------------------------------------------------------

function buildFirstCouponSettlementConfirmed(asOf: string): Event {
  const accrualDays = 90;
  const dcf = accrualDays / 365;
  const fixedCouponMinor = Math.round(NOTIONAL_ZAR_MINOR * FIXED_RATE * dcf);
  const forwardJibar = staticJibarRateSource.getForwardJibar(2, 92);
  const floatingCouponMinor = Math.round(NOTIONAL_ZAR_MINOR * forwardJibar * dcf);
  const netMinor = Math.abs(fixedCouponMinor - floatingCouponMinor);

  const base = makeIrsCouponSettlementConfirmed({
    asOf,
    entity: ENTITY,
    actor: TOMAS,
    citations: ["D-MARKETS-SCHEMA-FOUNDATION", "ISDA-2002-MASTER"],
    payload: {
      tradeId: { scheme: "INTERNAL", value: "TRD-IRS-M5-001" },
      paymentDate: { iso: FIRST_PAYMENT_DATE_ISO, calendar: "JIHCAL" },
      settledAmount: { currency: CURRENCY, amountMinor: netMinor },
      confirmedAt: `${asOf}T14:00:00.000Z`,
      correspondentRef: "SWIFT-IRS-M5-001-Q1",
    },
    eventId: newEventId(),
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

// ---------------------------------------------------------------------------
// Scenario builder
// ---------------------------------------------------------------------------

export interface IrsScenarioEvents {
  readonly tradeBooked: Event;
  readonly couponSchedule: Event;
  readonly firstCouponInstructed: Event;
  readonly firstCouponConfirmed: Event;
  readonly all: ReadonlyArray<Event>;
}

export function buildIrsScenarioEvents(): IrsScenarioEvents {
  const tradeTs = `${TRADE_DATE_ISO}T07:00:00.000Z`;
  const scheduleTs = `${TRADE_DATE_ISO}T07:01:00.000Z`;
  const instructTs = `${TRADE_DATE_ISO}T09:00:00.000Z`;
  const confirmTs = `${FIRST_PAYMENT_DATE_ISO}T14:00:00.000Z`;

  void confirmTs;

  const tradeBooked = buildIrsTradeBooked(tradeTs);
  const couponSchedule = buildCouponScheduleGenerated(scheduleTs, tradeBooked);
  const firstCouponInstructed = buildFirstCouponPaymentInstructed(instructTs);
  const firstCouponConfirmed = buildFirstCouponSettlementConfirmed(FIRST_PAYMENT_DATE_ISO);

  return {
    tradeBooked,
    couponSchedule,
    firstCouponInstructed,
    firstCouponConfirmed,
    all: [tradeBooked, couponSchedule, firstCouponInstructed, firstCouponConfirmed],
  };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface IrsScenarioResult {
  readonly ok: boolean;
  readonly emitted: number;
  readonly revalued: number;
  readonly mtmZar: number;
  readonly countsByType: Record<string, number>;
  readonly errors: string[];
}

export function runScenario(opts: { dbPath: string; cleanup: boolean }): IrsScenarioResult {
  const events = buildIrsScenarioEvents();

  try {
    unlinkSync(opts.dbPath);
  } catch {
    /* first run or already clean */
  }

  const store = new EventStore(opts.dbPath);
  store.appendAll([...events.all]);

  // EOD revaluation.
  const revalResult = runEodIrsRevaluation(store, VALUATION_DATE_ISO, staticJibarRateSource);

  const total = store.count();
  const countsByType: Record<string, number> = {};
  for (const e of store.replay({ entity: ENTITY })) {
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

  const ok =
    revalResult.errors.length === 0 && total >= events.all.length && revalResult.revalued >= 1;

  return {
    ok,
    emitted: total,
    revalued: revalResult.revalued,
    mtmZar: revalResult.totalMtmZar,
    countsByType,
    errors: revalResult.errors,
  };
}

export function main(): void {
  logger.info(
    {
      scenario: SCENARIO_ID,
      sourceLineage: SOURCE_LINEAGE,
      tradeDate: TRADE_DATE_ISO,
      effectiveDate: EFFECTIVE_DATE_ISO,
      maturityDate: MATURITY_DATE_ISO,
      fixedRate: `${(FIXED_RATE * 100).toFixed(2)}%`,
      floatingIndex: "JIBAR-3M",
      bankPays: "fixed",
      notionalZar: `ZAR ${(NOTIONAL_ZAR_MINOR / 100).toLocaleString()}`,
      paymentFrequency: "quarterly",
      dayCount: "ACT/365",
      expectedCoupons: 20,
    },
    "scenario 10 — IRS trade — starting",
  );

  const result = runScenario({
    dbPath: ".local/scenario-irs-trade.db",
    cleanup: true,
  });

  logger.info(
    {
      ok: result.ok,
      emitted: result.emitted,
      revalued: result.revalued,
      mtmZar: result.mtmZar / 100,
      countsByType: result.countsByType,
      errors: result.errors,
      authority: ["D-MARKETS-SCHEMA-FOUNDATION", "ISDA-2002-MASTER", "IFRS-9-§4.1", "ORG-PR-11"],
      substrateGaps: [
        "[GAP-IRS-1] JIBAR curve is a static seed — replace with Ravi IRRBB live curve",
        "[GAP-IRS-2] No JIHCAL business-day adjustment on payment dates",
        "[GAP-IRS-3] Floating estimates use forward curve, not live JIBAR fix",
        "[GAP-IRS-4] No explicit IrsTradeMatured event on maturity date",
      ],
    },
    result.ok ? "scenario 10 — IRS — PASSED" : "scenario 10 — IRS — FAILED",
  );

  process.exit(result.ok ? 0 : 1);
}

if (import.meta.main) {
  main();
}
