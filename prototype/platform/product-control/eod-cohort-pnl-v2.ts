// platform/product-control/eod-cohort-pnl-v2.ts
//
// M4 (partial) — EOD-driven daily P&L over the SIMULATED FX cohort. SUT side.
//
// This is a SUT cadence job (Product Control): at each EOD boundary the Phase-0
// bus fires it; it reads the bank's own booked FIL FX instruments
// (`FilInstrumentCreated`, assetClass "fx") and the adopted PRODUCTION market
// marks, and computes the unrealised P&L of the cohort. Correctness is judged
// AGAINST THE SIMULATOR: known inputs (booked rate, simulated spot/forward path,
// OIS curve) → expected outputs, NOT a V1 parity gate.
//
// Forwards are valued with the M1 PRESENT-VALUED path (`forwardMtmValue`):
// MtM = signedNotionalBase × (F_t − K) × DF(0,T). Spot positions value at the
// closing spot rate. This is the boundary-respecting read: market marks come
// from the MarketDataStore `production` selector (the ingested feed), never from
// the simulator directly. Lives on the SUT side — the bank's own P&L
// computation, not simulator code.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20).
// Author: Atlas (Core banking platform architect, engineering).

import {
  STANDARD_FORWARD_TENOR_DAYS,
  forwardMtmValue,
  oisDiscountFactor,
} from "../../v2-core/fil-models/fx-valuation/methodology";
import type { EventStore } from "../event-store/store";
import { type MarketDataStore, lookupQuoteWithInverse } from "../market-data/store";

/** Per-instrument cohort P&L row (reporting-ccy major units). */
export interface CohortPnLRow {
  readonly instance: string;
  readonly pair: string;
  readonly isForward: boolean;
  /** Unrealised MtM in the reporting currency (major-unit number). */
  readonly unrealisedReporting: number;
  /** "live" if a usable production mark was found, else "unavailable" (fail-closed). */
  readonly markStatus: "live" | "unavailable";
}

export interface CohortPnLResult {
  readonly reportDate: string;
  readonly reporting: string;
  readonly rows: readonly CohortPnLRow[];
  /** Sum of live rows' unrealised MtM (reporting major). */
  readonly totalUnrealisedReporting: number;
  /** Count of instruments with no usable production mark (excluded from total). */
  readonly marksUnavailable: number;
}

interface BookedFxInstrument {
  readonly instance: string;
  readonly base: string;
  readonly pair: string;
  readonly isForward: boolean;
  readonly signedNotionalBase: number;
  readonly bookedRate: number;
  readonly settlementDate: string;
}

/**
 * Compute the cohort's daily P&L for `reportDate` from the booked FIL FX
 * instruments + the production market marks. Pure read; deterministic given the
 * event store + market store contents.
 */
export function computeCohortPnL(args: {
  readonly eventStore: EventStore;
  readonly marketDataStore: MarketDataStore;
  readonly reporting: string;
  readonly reportDate: string;
  /** Map of trade booked rate, keyed by instance URN (the simulator's known input). */
  readonly bookedRateByInstance: ReadonlyMap<string, number>;
}): CohortPnLResult {
  const { eventStore, marketDataStore, reporting, reportDate, bookedRateByInstance } = args;

  const instruments = collectFxInstruments(eventStore, bookedRateByInstance);
  const rows: CohortPnLRow[] = [];
  let total = 0;
  let unavailable = 0;

  for (const inst of instruments) {
    const spotQuote = lookupQuoteWithInverse(marketDataStore, inst.pair, {
      provenance: "production",
    });
    if (spotQuote === null || spotQuote.rate <= 0) {
      rows.push({
        instance: inst.instance,
        pair: inst.pair,
        isForward: inst.isForward,
        unrealisedReporting: 0,
        markStatus: "unavailable",
      });
      unavailable += 1;
      continue;
    }

    let unrealised = 0;
    if (inst.isForward) {
      // Forward points + OIS discount factor from the production marks.
      const fwdPoints = forwardPointsFor(marketDataStore, inst.pair);
      const oisRate = oisRateFor(marketDataStore, reporting);
      const tenorDays = calendarDaysRemaining(reportDate, inst.settlementDate);
      const df = oisDiscountFactor(oisRate, tenorDays);
      const mtm = forwardMtmValue({
        currency: inst.base,
        signedNotional: String(inst.signedNotionalBase),
        bookedRate: inst.bookedRate,
        currentForwardRate: spotQuote.rate + fwdPoints,
        discountFactor: df,
        reporting,
      });
      unrealised = Number(mtm.value.amount);
    } else {
      // Spot: MtM = signedNotional × (spot − booked).
      unrealised = inst.signedNotionalBase * (spotQuote.rate - inst.bookedRate);
    }

    total += unrealised;
    rows.push({
      instance: inst.instance,
      pair: inst.pair,
      isForward: inst.isForward,
      unrealisedReporting: unrealised,
      markStatus: "live",
    });
  }

  return {
    reportDate,
    reporting,
    rows,
    totalUnrealisedReporting: total,
    marksUnavailable: unavailable,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectFxInstruments(
  store: EventStore,
  bookedRateByInstance: ReadonlyMap<string, number>,
): BookedFxInstrument[] {
  const terminated = new Set<string>();
  for (const e of store.replay({ type: "FilInstrumentTerminated" })) {
    const inst = (e.payload as { instance?: string }).instance;
    if (inst) terminated.add(inst);
  }

  const out: BookedFxInstrument[] = [];
  for (const e of store.replay({ type: "FilInstrumentCreated" })) {
    const p = e.payload as Record<string, unknown>;
    const economic = p.economicTerms as Record<string, unknown> | undefined;
    if (!economic || economic.assetClass !== "fx") continue;
    const instance = p.instance as string | undefined;
    if (!instance || terminated.has(instance)) continue;

    const pair = (economic.hedgingSetTag as string | undefined) ?? "";
    const base = (economic.currency as string | undefined) ?? "";
    const direction = economic.direction as "long" | "short" | undefined;
    const notional = economic.notional as { amount?: string } | undefined;
    const settlementDate = (economic.settlementDate as string | undefined) ?? "";
    if (!pair || !base || !direction || !notional?.amount) continue;

    const typeUrn = p.type as string | undefined;
    const isForward = typeof typeUrn === "string" && typeUrn.includes(":forward:");
    const magnitude = Number(notional.amount);
    const signed = direction === "long" ? magnitude : -magnitude;
    const bookedRate = bookedRateByInstance.get(instance) ?? 0;

    out.push({
      instance,
      base,
      pair,
      isForward,
      signedNotionalBase: signed,
      bookedRate,
      settlementDate,
    });
  }
  return out;
}

function forwardPointsFor(store: MarketDataStore, pair: string): number {
  const slash = pair.indexOf("/");
  const base = slash > 0 ? pair.slice(0, slash) : pair;
  const reporting = slash > 0 ? pair.slice(slash + 1) : "";
  const instrument = `${base}/${reporting}:fwd-points`;
  const tick = store.getLatest("fx-sim", instrument, undefined, "production");
  if (!tick) return 0;
  const points = (tick.payload as { points?: number; mid?: number }).points;
  return typeof points === "number" ? points : 0;
}

function oisRateFor(store: MarketDataStore, reporting: string): number {
  const instrument = `OIS:${reporting}:${STANDARD_FORWARD_TENOR_DAYS}d`;
  const tick = store.getLatest("fx-sim", instrument, undefined, "production");
  if (!tick) return 0;
  const rate = (tick.payload as { annualRate?: number }).annualRate;
  return typeof rate === "number" ? rate : 0;
}

function calendarDaysRemaining(fromDate: string, toDate: string): number {
  const t0 = Date.parse(fromDate);
  const t1 = Date.parse(toDate);
  if (Number.isNaN(t0) || Number.isNaN(t1)) return 0;
  return Math.max(0, Math.round((t1 - t0) / 86_400_000));
}
