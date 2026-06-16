// v2-core/fil-models/ir/bond/shared/bond-observables.ts
//
// Observable catalog + yield key convention for the FVTPL bond. The bond values
// by DISCOUNTING at a market yield resolved from one of two observable keys:
//
//   ISIN yield (preferred): "bond:<isin>:yield"     e.g. "bond:ZAG000149037:yield"
//   credit-spread fallback: the position's `fallbackYieldKey` — a
//                           "<CCY>:govt-curve:<tenor>" + spread observable that
//                           is only used WHEN the ISIN key is absent.
//
// FAIL-CLOSED (Engineering Charter cmd 2 + cmd 4): the resolver returns the
// yield from the ISIN key if present; ELSE the fallback key if present; ELSE it
// THROWS. There is NO silent default yield — an unmarkable bond cannot be valued,
// and surfacing that as a hard error is the correct fail-closed behaviour.
//
// Authority: D-V1-REMOVAL-PHASE-3C; D-ENGINEERING-INTEGRITY-CHARTER;
//   brief:atlas:v1-removal-phase-3c-bond-accounting-on-v2-fvtpl-:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

import type { Instant } from "../../../../fil-core/primitives.ts";
import type { MarketDataSlice, ObservableRef } from "../../../../fil-facets/facets.ts";

/** The preferred ISIN-specific yield observable key. */
export function bondYieldKey(isin: string): string {
  return `bond:${isin}:yield`;
}

/** ObservableRef for the ISIN-specific yield (a price-kind mark). */
export function bondYieldObsRef(isin: string): ObservableRef {
  return { observableId: bondYieldKey(isin), kind: "price" };
}

/** ObservableRef for the credit-spread-adjusted fallback curve key. */
export function bondFallbackYieldObsRef(fallbackYieldKey: string): ObservableRef {
  return { observableId: fallbackYieldKey, kind: "curve" };
}

/**
 * Resolve the market yield (annualised decimal) for a bond, fail-closed.
 * Tries the ISIN key first, then the credit-spread-adjusted fallback key; throws
 * if NEITHER resolves. Returns the yield AND the lineage of observables used.
 */
export function resolveBondYield(args: {
  readonly isin: string;
  readonly fallbackYieldKey: string;
  readonly marks: MarketDataSlice;
  readonly asOf: Instant;
}): { readonly yieldDecimal: number; readonly observablesUsed: readonly ObservableRef[] } {
  const isinKey = bondYieldKey(args.isin);
  const isinYield = args.marks.observables[isinKey];
  if (isinYield !== undefined) {
    return { yieldDecimal: isinYield, observablesUsed: [bondYieldObsRef(args.isin)] };
  }
  const fallbackYield = args.marks.observables[args.fallbackYieldKey];
  if (fallbackYield !== undefined) {
    return {
      yieldDecimal: fallbackYield,
      observablesUsed: [bondFallbackYieldObsRef(args.fallbackYieldKey)],
    };
  }
  throw new Error(
    `bondModel: cannot resolve a market yield for ISIN "${args.isin}" (asOf ${args.asOf}) — neither the ISIN yield observable "${isinKey}" nor the credit-spread fallback "${args.fallbackYieldKey}" is present in the market-data slice. An unmarkable bond cannot be valued (fail-closed; no silent default yield). D-V1-REMOVAL-PHASE-3C.`,
  );
}
