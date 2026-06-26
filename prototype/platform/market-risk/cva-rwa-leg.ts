// platform/market-risk/cva-rwa-leg.ts
//
// CVA RWA leg — converts the standardised CVA CAPITAL charge (computeCva) into
// the RWA-engine's `cvaRwaMinor` passthrough input, so the BA 700 total RWA
// sources the REAL CVA charge instead of the historical zero placeholder.
//
// THE WIRING (the gap this closes): the RWA engine (platform/risk/rwa-engine.ts)
// exposes `cvaRwaMinor` as an optional input that DEFAULTS TO ZERO — a documented
// placeholder ("[CVA RWA placeholder — Reporting Slice 4 (BA 600) populates via
// cvaRwaMinor input]"). The CVA engine (platform/market-risk/cva-engine.ts)
// computes the CVA capital figure over the OTC counterparty book. This module is
// the bridge: CVA capital → RWA → cvaRwaMinor.
//
// CAPITAL → RWA (Basel): a capital REQUIREMENT is 8% of RWA, so the implied RWA
// of a capital charge K is RWA = K / 0.08 = K × 12.5. The CVA capital charge
// computeCva returns (LGD × EAD × PD × discount, summed over counterparties) is a
// capital figure; its RWA equivalent is × 12.5.
//
// PROVENANCE: computeCva is provenance-filtered through its
// `derivativeProvenanceFilter` (the same filter the RWA fold applies). A
// production read of a simulated-only book → computeCva status `no-otc-exposure`
// → CVA RWA leg = 0 (the production CVA RWA stays zero pre-licence-day). The
// simulated read drives the leg non-zero. No silent zero: the leg is 0 ONLY when
// computeCva loudly reports no OTC exposure or insufficient inputs.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 5 (CVA engine); BCBS d424 MAR50;
//   Regulations Relating to Banks Reg 28 (RWA = capital × 12.5).
//
// Author: Atlas (Core banking platform architect, engineering).

import { mulD, roundDecimal, toCanonicalString, toDecimal } from "../core/decimal-engine";
import type { EventStore } from "../event-store/store";
import { MarketDataStore } from "../market-data/store";
import type { ProvenanceFilter } from "../projections/filter";
import { type CvaReport, computeCva } from "./cva-engine";

/**
 * Basel capital → RWA multiplier. RWA = capital / 8% = capital × 12.5.
 * Named so the conversion is explicit, never a magic constant.
 */
export const CAPITAL_TO_RWA_MULTIPLIER = 12.5;

export interface CvaRwaLeg {
  /** The CVA capital charge (ZAR minor), 0 when computeCva reports no exposure. */
  readonly cvaCapitalMinor: number;
  /** The CVA RWA equivalent (ZAR minor) = capital × 12.5. */
  readonly cvaRwaMinor: number;
  /** The underlying CVA report (status + per-counterparty breakdown). */
  readonly report: CvaReport;
}

/**
 * Compute the CVA RWA leg over the derivative counterparty book. Pure read.
 *
 * Returns `cvaRwaMinor = 0` ONLY when computeCva loudly reports `no-otc-exposure`
 * or `insufficient-credit-inputs` (never a silent zero). When `computed`, the
 * leg is the CVA capital × 12.5, in ZAR minor units, rounded to the nearest cent.
 *
 * @param marketData Optional market-data store for live credit spreads. When
 *   omitted, computeCva uses its documented fallback PD weights by counterparty
 *   class (store-free) — sufficient for the RWA-leg wiring.
 */
export function computeCvaRwaLeg(args: {
  readonly eventStore: EventStore;
  readonly asOf: string;
  readonly derivativeProvenanceFilter?: ProvenanceFilter;
  readonly marketData?: MarketDataStore;
}): CvaRwaLeg {
  const marketData = args.marketData ?? new MarketDataStore(":memory:");
  const report = computeCva({
    eventStore: args.eventStore,
    marketData,
    asOf: args.asOf,
    ...(args.derivativeProvenanceFilter !== undefined
      ? { derivativeProvenanceFilter: args.derivativeProvenanceFilter }
      : {}),
  });

  // CVA capital (ZAR major) → minor → RWA, via the decimal engine (no float
  // money arithmetic — D-DECIMAL-NATIVE-MONEY-ARITHMETIC). `present` only when
  // status=computed.
  const cvaCapitalMajor = report.cva.present ? report.cva.value : 0;
  const cvaCapitalMinorDec = mulD(toDecimal(String(cvaCapitalMajor)), toDecimal("100"));
  const cvaCapitalMinor = Number(toCanonicalString(roundDecimal(cvaCapitalMinorDec, 0, "HALF_UP")));
  const cvaRwaMinorDec = mulD(
    toDecimal(String(cvaCapitalMinor)),
    toDecimal(String(CAPITAL_TO_RWA_MULTIPLIER)),
  );
  const cvaRwaMinor = Number(toCanonicalString(roundDecimal(cvaRwaMinorDec, 0, "HALF_UP")));

  return { cvaCapitalMinor, cvaRwaMinor, report };
}
