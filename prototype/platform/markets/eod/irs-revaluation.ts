// platform/markets/eod/irs-revaluation.ts
//
// EOD mark-to-market revaluation for OTC Interest Rate Swap positions.
//
// Mirrors the fx-forward-revaluation.ts structure exactly:
//   1. Replay IrsTradeBooked → collect open swaps.
//   2. Replay IrsCouponSettlementConfirmed → track settled payment dates.
//   3. Replay IrsPositionRevalued by (tradeId, valuationDate) → idempotency gate.
//   4. For each open un-revalued swap:
//      a. Generate remaining coupon schedule (payment dates > valuationDate).
//      b. Fixed leg PV: Σ (fixedCoupon_i × discountFactor_i).
//      c. Floating leg PV: Σ (forwardJibar_i × notional × dcf_i × discountFactor_i).
//      d. MTM = fixedLegPV − floatingLegPV  [if bankPays=fixed]
//              floatingLegPV − fixedLegPV  [if bankPays=floating]
//      e. DV01 ≈ Σ (0.0001 × notional × dcf_i × discountFactor_i).
//      f. Emit IrsPositionRevalued.
//   5. Return EodIrsRevaluationResult.
//
// Substrate gaps (v0):
//   [GAP-IRS-1] Rate source is a static seed ([GAP-IRS-1] in jibar-curve-seed.ts).
//   [GAP-IRS-2] No business-day calendar adjustment (JIHCAL).
//   [GAP-IRS-3] Floating coupon estimates use forward JIBAR from the static curve.
//               Real production: use the daily JIBAR fix broadcast.
//   [GAP-IRS-4] Matured swaps not explicitly terminated — they are excluded by
//               the "remaining dates > valuationDate" filter. Production: emit
//               IrsTradeMatured on maturity date to explicitly close the position.
//
// Authority:
//   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   ISDA-2002-MASTER            (swap documentation)
//   IFRS-9-§4.1                 (classification and measurement; FVTPL)
//   BCBS-D365-IRRBB             (IRRBB sensitivity metrics — DV01)
//   ORG-PR-11                   (derivatives trading authority)
//
// Authors: Eitan (IRRBB / derivatives engineer, engineering)

import { clock } from "../../composition";
import { newEventId } from "../../core/types";
import type { EventStore } from "../../event-store/store";
import {
  type IrsCouponSettlementConfirmedPayload,
  type IrsPositionRevaluedPayload,
  type IrsTradeBookedPayload,
  makeIrsPositionRevalued,
} from "../../markets/cdm/ird";
import { dayCountFraction, generateCouponSchedule } from "../ird/coupon-schedule";
import { type IrsRateSource, staticJibarRateSource } from "./jibar-curve-seed";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type EodIrsRevaluationResult = {
  /** Number of swaps where IrsPositionRevalued was emitted. */
  revalued: number;
  /** Number of swaps skipped (already revalued today or matured). */
  skipped: number;
  /** ISO 8601 date this run covered. */
  asOf: string;
  /** Sum of MTM across all revalued positions (ZAR minor units). */
  totalMtmZar: number;
  /** Any non-fatal errors encountered per tradeId. */
  errors: string[];
};

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const RECON_CITATIONS = [
  "IFRS-9-§4.1",
  "D-MARKETS-SCHEMA-FOUNDATION",
  "BCBS-D365-IRRBB",
  "ISDA-2002-MASTER",
  "ORG-PR-11",
];

const RECON_ACTOR = {
  type: "service" as const,
  id: "eitan:eod-irs-revaluation",
};

const BANK_ENTITY = "BANK-ZA-001";

// ---------------------------------------------------------------------------
// Helper: calendar days between two ISO 8601 dates
// ---------------------------------------------------------------------------

function calendarDaysRemaining(valuationDate: string, targetDate: string): number {
  const t0 = Date.parse(valuationDate);
  const t1 = Date.parse(targetDate);
  if (Number.isNaN(t0) || Number.isNaN(t1)) {
    throw new Error(
      `calendarDaysRemaining: invalid date — valuationDate="${valuationDate}" targetDate="${targetDate}"`,
    );
  }
  return Math.max(0, Math.round((t1 - t0) / 86_400_000));
}

// ---------------------------------------------------------------------------
// Main revaluation runner
// ---------------------------------------------------------------------------

/**
 * Run EOD IRS mark-to-market revaluation for `valuationDate`.
 *
 * @param store          EventStore to replay and append into.
 * @param valuationDate  YYYY-MM-DD valuation date (EOD).
 * @param rateSource     JIBAR rate source (defaults to staticJibarRateSource).
 */
export function runEodIrsRevaluation(
  store: EventStore,
  valuationDate: string,
  rateSource: IrsRateSource = staticJibarRateSource,
): EodIrsRevaluationResult {
  const revaluedAt = clock.now();
  const errors: string[] = [];

  // -------------------------------------------------------------------------
  // Step 1: Collect all open IRS trades.
  // -------------------------------------------------------------------------
  const trades = new Map<string, IrsTradeBookedPayload>();
  for (const e of store.replay({ type: "IrsTradeBooked" })) {
    const p = e.payload as unknown as IrsTradeBookedPayload;
    trades.set(p.tradeId.value, p);
  }

  // -------------------------------------------------------------------------
  // Step 2: Track confirmed coupon settlement dates per trade.
  // -------------------------------------------------------------------------
  const confirmedPaymentDates = new Map<string, Set<string>>();
  for (const e of store.replay({ type: "IrsCouponSettlementConfirmed" })) {
    const p = e.payload as unknown as IrsCouponSettlementConfirmedPayload;
    const tradeId = p.tradeId.value;
    if (!confirmedPaymentDates.has(tradeId)) {
      confirmedPaymentDates.set(tradeId, new Set());
    }
    confirmedPaymentDates.get(tradeId)?.add(p.paymentDate.iso);
  }

  // -------------------------------------------------------------------------
  // Step 3: Find positions already revalued today (idempotency gate).
  // -------------------------------------------------------------------------
  const alreadyRevaluedToday = new Set<string>();
  for (const e of store.replay({ type: "IrsPositionRevalued" })) {
    const p = e.payload as unknown as IrsPositionRevaluedPayload;
    if (p.valuationDate === valuationDate) {
      alreadyRevaluedToday.add(p.tradeId.value);
    }
  }

  let revalued = 0;
  let skipped = 0;
  let totalMtmZar = 0;

  // -------------------------------------------------------------------------
  // Step 4: Process each open position.
  // -------------------------------------------------------------------------
  for (const [tradeId, trade] of trades) {
    // Skip already revalued today.
    if (alreadyRevaluedToday.has(tradeId)) {
      skipped++;
      continue;
    }

    // Skip matured trades (maturity date ≤ valuation date).
    if (trade.maturityDate.iso <= valuationDate) {
      skipped++;
      continue;
    }

    try {
      // Generate the full coupon schedule.
      const schedule = generateCouponSchedule(trade, rateSource);
      const settledDates = confirmedPaymentDates.get(tradeId) ?? new Set<string>();

      // Remaining coupon periods: payment date in the future.
      const remainingPeriods = schedule.periods.filter(
        (p) => p.paymentDate > valuationDate && !settledDates.has(p.paymentDate),
      );

      if (remainingPeriods.length === 0) {
        // All coupons settled — treat as wound down.
        skipped++;
        continue;
      }

      const currency = trade.notional.currency;
      const notionalMinor = trade.notional.amountMinor;
      const convention = trade.dayCountConvention;

      let fixedLegPvMinor = 0;
      let floatingLegPvMinor = 0;
      let dv01Minor = 0;

      for (const period of remainingPeriods) {
        // Days from valuation date to payment date.
        const payDays = calendarDaysRemaining(valuationDate, period.paymentDate);
        const df = rateSource.getDiscountFactor(payDays);

        // Fixed leg: coupon × discount factor.
        fixedLegPvMinor += period.fixedCouponMinor * df;

        // Floating leg: forwardJibar × notional × dcf × discount factor.
        const startDays = Math.max(0, calendarDaysRemaining(valuationDate, period.periodStart));
        const endDays = Math.max(1, calendarDaysRemaining(valuationDate, period.paymentDate));
        const dcf = dayCountFraction(period.periodStart, period.paymentDate, convention);

        let forwardJibar = 0;
        try {
          forwardJibar = rateSource.getForwardJibar(startDays, endDays);
        } catch {
          // Rate source failure for this period — use 0.
        }

        floatingLegPvMinor += notionalMinor * forwardJibar * dcf * df;

        // DV01 contribution: 1bp × notional × dcf × discount factor.
        dv01Minor += 0.0001 * notionalMinor * dcf * df;
      }

      // MTM from the bank's perspective.
      // bankPays=fixed → bank is short the fixed leg, long float.
      //   MTM gain when rates rise (float leg > fixed leg).
      //   MTM = floatingLegPV − fixedLegPV? No — convention:
      //   MTM = fixedLegPV − floatingLegPV when bankPays=fixed:
      //   a receiver of the fixed leg holds positive MTM when rates fall.
      //   For a payer (bankPays=fixed): positive MTM when rates RISE.
      //   So: MTM(payer) = floatingLegPV − fixedLegPV.
      //   MTM(receiver) = fixedLegPV − floatingLegPV.
      const mtmMinor =
        trade.bankPays === "fixed"
          ? floatingLegPvMinor - fixedLegPvMinor // payer benefits when rates rise
          : fixedLegPvMinor - floatingLegPvMinor; // receiver benefits when rates fall

      const remainingTenorDays = calendarDaysRemaining(valuationDate, trade.maturityDate.iso);

      const payload: IrsPositionRevaluedPayload = {
        tradeId: trade.tradeId,
        valuationDate,
        fixedLegPv: { currency, amountMinor: Math.round(fixedLegPvMinor) },
        floatingLegPv: { currency, amountMinor: Math.round(floatingLegPvMinor) },
        markToMarket: { currency, amountMinor: Math.round(mtmMinor) },
        dv01: { currency, amountMinor: Math.round(dv01Minor) },
        remainingTenorDays,
      };

      store.append(
        makeIrsPositionRevalued({
          asOf: valuationDate,
          entity: BANK_ENTITY,
          actor: RECON_ACTOR,
          citations: RECON_CITATIONS,
          payload,
          eventId: newEventId(),
        }),
      );

      revalued++;
      totalMtmZar += Math.round(mtmMinor);
    } catch (err) {
      errors.push(`${tradeId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  void revaluedAt;

  return { revalued, skipped, asOf: valuationDate, totalMtmZar, errors };
}
