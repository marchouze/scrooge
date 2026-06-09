// platform/markets/eod/irs-revaluation.ts
//
// EOD mark-to-market revaluation for OTC Interest Rate Swap positions.
//
// ─── CANONICAL EVENT FAMILY (D-IRS-FAMILY-CONVERGE-ACCOUNTING) ────────────────
// This engine emits the ACCOUNTING `IrdSwapPositionRevalued` family — the single
// canonical revaluation fact for GL posting (SLA interpreter PR-IRS-002, posting
// type `ird-swap-revaluation`) AND BA 320 IR-general-risk reporting
// (ba-320-irs-events-adapter.ts, which reads `dv01ByTenorBucket`). It previously
// emitted the trade-domain `IrsPositionRevalued`, which nothing on the GL or
// BA 320 path consumed — the live IRS book posted NOTHING and surfaced every live
// swap as a BA 320 substrate gap. That mirror is retired here; CVA reads the
// accounting family too (cva-engine.ts). Authority: D-IRS-FAMILY-CONVERGE-
// ACCOUNTING (CEO-approved 2026-06-09); D-SLA-ENGINE-RULES-AS-DATA Batch 3.
//
// Mirrors the fx-forward-revaluation.ts structure:
//   1. Replay IrsTradeBooked → collect open swaps.
//   2. Replay IrsCouponSettlementConfirmed → track settled payment dates.
//   3. Replay IrdSwapPositionRevalued → (a) idempotency gate by
//      (tradeId, revalDate); (b) prior closing NPV per tradeId (the opening NPV
//      / delta basis for the next reval).
//   4. For each open un-revalued swap:
//      a. Generate remaining coupon schedule (payment dates > valuationDate).
//      b. Fixed leg PV: Σ (fixedCoupon_i × discountFactor_i).
//      c. Floating leg PV: Σ (forwardJibar_i × notional × dcf_i × discountFactor_i).
//      d. MTM (= closing NPV) = floatingLegPV − fixedLegPV [bankPays=fixed]
//                               fixedLegPV − floatingLegPV [bankPays=floating]
//      e. DV01 ≈ Σ (0.0001 × notional × dcf_i × df_i), bucketed: each period's
//         contribution is assigned to the BaselMaturityBand containing its
//         payment date (days from valuationDate). Scalar total kept too.
//      f. Emit IrdSwapPositionRevalued (npvClosing = MTM, npvOpening = prior
//         closing or 0, npvDelta = closing − opening, dv01ByTenorBucket,
//         bookDesignation = "trading").
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
import {
  type IrdSwapPositionRevaluedPayload,
  makeIrdSwapPositionRevalued,
} from "../../event-store/event-types/ird-accounting";
import type { EventStore } from "../../event-store/store";
import type {
  IrsCouponSettlementConfirmedPayload,
  IrsTradeBookedPayload,
} from "../../markets/cdm/ird";
import { type BaselMaturityBand, daysToBaselMaturityBand } from "../../types/basel";
import { dayCountFraction, generateCouponSchedule } from "../ird/coupon-schedule";
import { type IrsRateSource, staticJibarRateSource } from "./jibar-curve-seed";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type EodIrsRevaluationResult = {
  /** Number of swaps where IrdSwapPositionRevalued was emitted. */
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

const BANK_ENTITY = "LE-ZA-HOZ-BANK";

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
// DV01 per-tenor-bucket reconstruction (shared)
// ---------------------------------------------------------------------------

/**
 * Reconstruct the per-tenor-bucket DV01 grid for an IRS from its booking terms,
 * as at `valuationDate`. Each remaining coupon period contributes
 * `0.0001 × notional × dcf × df` to the BCBS standardised maturity band that
 * contains its payment date (days from `valuationDate`); per-band contributions
 * are rounded to integer minor units and zero-rounding bands dropped.
 *
 * This is the SINGLE source of the DV01 bucketing rule: both `runEodIrsRevaluation`
 * (forward MTM run) and `scripts/backfill-irs-historical-gl.ts` (historical
 * `IrsPositionRevalued` → `IrdSwapPositionRevalued` backfill) call it, so the
 * bucketing is byte-identical across the live path and the backfill path.
 *
 * Returns `{}` when no remaining period rounds to a non-zero contribution — the
 * caller then omits the optional `dv01ByTenorBucket` field entirely (no
 * fabrication of empty buckets).
 *
 * @param trade          The originating `IrsTradeBooked` payload.
 * @param valuationDate  YYYY-MM-DD valuation date.
 * @param rateSource     JIBAR rate source (defaults to staticJibarRateSource).
 * @param settledDates   Payment dates already settled (excluded from the grid).
 */
export function computeIrsDv01ByTenorBucket(
  trade: IrsTradeBookedPayload,
  valuationDate: string,
  rateSource: IrsRateSource = staticJibarRateSource,
  settledDates: ReadonlySet<string> = new Set<string>(),
): Partial<Record<BaselMaturityBand, number>> {
  const schedule = generateCouponSchedule(trade, rateSource);
  const notionalMinor = trade.notional.amountMinor;
  const convention = trade.dayCountConvention;

  // Per-band raw (fractional) accumulation; rounded per band at the end.
  const dv01ByBandRaw: Partial<Record<BaselMaturityBand, number>> = {};

  for (const period of schedule.periods) {
    if (period.paymentDate <= valuationDate || settledDates.has(period.paymentDate)) continue;

    const payDays = calendarDaysRemaining(valuationDate, period.paymentDate);
    const df = rateSource.getDiscountFactor(payDays);
    const dcf = dayCountFraction(period.periodStart, period.paymentDate, convention);

    // DV01 contribution: 1bp × notional × dcf × discount factor.
    const periodDv01 = 0.0001 * notionalMinor * dcf * df;

    const band = daysToBaselMaturityBand(payDays);
    dv01ByBandRaw[band] = (dv01ByBandRaw[band] ?? 0) + periodDv01;
  }

  // Round per-band DV01 to integer minor units; drop zero-rounding bands.
  const dv01ByTenorBucket: Partial<Record<BaselMaturityBand, number>> = {};
  for (const [band, raw] of Object.entries(dv01ByBandRaw) as [BaselMaturityBand, number][]) {
    const rounded = Math.round(raw);
    if (rounded !== 0) dv01ByTenorBucket[band] = rounded;
  }
  return dv01ByTenorBucket;
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
  // Step 3: Replay prior IrdSwapPositionRevalued to derive
  //   (a) idempotency gate — positions already revalued for this valuationDate;
  //   (b) the latest prior closing NPV per trade — the opening-NPV basis for the
  //       delta on the next reval (replay yields ascending sequence → last write
  //       per tradeId for a strictly-earlier revalDate wins).
  // -------------------------------------------------------------------------
  const alreadyRevaluedToday = new Set<string>();
  const priorClosingNpvMinor = new Map<string, number>();
  for (const e of store.replay({ type: "IrdSwapPositionRevalued" })) {
    const p = e.payload as unknown as IrdSwapPositionRevaluedPayload;
    if (p.revalDate === valuationDate) {
      alreadyRevaluedToday.add(p.tradeId);
    } else if (p.revalDate < valuationDate) {
      priorClosingNpvMinor.set(p.tradeId, p.npvClosingMinor);
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
      }

      // Per-tenor-bucket DV01 grid — the SAME bucketing rule the historical-IRS
      // GL backfill reuses (computeIrsDv01ByTenorBucket). Each remaining,
      // unsettled coupon period contributes 1bp × notional × dcf × df to the
      // BCBS band containing its payment date; rounded per band, zero bands
      // dropped.
      const dv01ByTenorBucket = computeIrsDv01ByTenorBucket(
        trade,
        valuationDate,
        rateSource,
        settledDates,
      );

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

      // Closing NPV = the mark-to-market from the bank's perspective (signed:
      // positive = net asset, negative = net liability). Opening NPV = the prior
      // reval's closing NPV (or 0 at first reval). Delta drives PR-IRS-002.
      const npvClosingMinor = Math.round(mtmMinor);
      const npvOpeningMinor = priorClosingNpvMinor.get(tradeId) ?? 0;
      const npvDeltaMinor = npvClosingMinor - npvOpeningMinor;

      const payload: IrdSwapPositionRevaluedPayload = {
        tradeId,
        npvDeltaMinor,
        npvClosingMinor,
        npvOpeningMinor,
        revalDate: valuationDate,
        currency,
        // BA 320 IR-general-risk maturity-ladder feed (bucketed DV01). Only
        // populated when at least one band rounded to a non-zero contribution.
        ...(Object.keys(dv01ByTenorBucket).length > 0 ? { dv01ByTenorBucket } : {}),
      };

      store.append(
        makeIrdSwapPositionRevalued({
          asOf: valuationDate,
          entity: BANK_ENTITY,
          actor: RECON_ACTOR,
          citations: RECON_CITATIONS,
          payload,
          eventId: newEventId(),
        }),
      );

      revalued++;
      totalMtmZar += npvClosingMinor;
    } catch (err) {
      errors.push(`${tradeId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  void revaluedAt;

  return { revalued, skipped, asOf: valuationDate, totalMtmZar, errors };
}
