// platform/reporting/ba100-functional-net.ts
//
// BA 100 per-account FUNCTIONAL-CURRENCY (ZAR) net balance — the shared, single-
// source helper that converts the V2 trial balance into per-account signed ZAR
// (functional) net amounts for the BA 100 balance-sheet headline.
//
// WHY THIS EXISTS (the R790m bug fix — D-BA-RETURN-FAIL-SAFE-RESIDUAL-EXPOSURE).
// The old `generateBa100BalanceSheet` headline path filtered the trial balance to
// FUNCTIONAL-currency rows only (dropping every EUR/GBP/USD nostro) and then took
// `Math.abs(amountMinor)` per row — which sign-FLIPPED the two NEGATIVE ZAR cash
// accounts (the short funding legs) into positive ASSETS and IGNORED the FCY
// nostros. The live result was TOTAL ASSETS R790,196,306 = |−510.9m| + |−279.3m|,
// which neither balanced (790 ≠ 300) nor matched the GL. Same bug family as the
// `currency:"multi"` GL flatten that `recon:gl-currency-dimension-integrity` was
// minted to stop.
//
// THE CORRECT CONVERSION (sourced, not re-marked). Each FCY nostro is a foreign-
// currency MONETARY item carried at its SETTLE-rate COST BASIS (IAS 21 §23). The
// per-entry ZAR cost rate is read from `foldSettledFcyCashCostRates` — the SAME
// source the production `buildGlView` uses (D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1)
// — NOT a `buildRateMap` market rate (empty on this store) and NOT the latest spot
// (which does NOT balance the books: the EOD-MTM reval to the closing mark lives
// in ACC-1200-099, already a row in the trial balance, so cost-basis + the reval
// row = the §23 closing carrying value WITHOUT double-counting). Because BA 100
// reads the SAME cost rates + the SAME trial-balance rows the GL view reads, the
// BA 100 section totals reconcile to the GL trial-balance section totals BY
// CONSTRUCTION (sibling-fold reconciliation, Principle 1).
//
// FAIL-CLOSED (Engineering Charter cmd 2). A balance-sheet account whose FCY net
// has NO resolvable cost rate is NOT silently dropped: its account id + native
// currency are surfaced in `unconvertible` so the caller can flag the gap. The
// functional net is returned ONLY for accounts that fully resolved.
//
// NO CURRENCY SENTINEL (recon:gl-currency-dimension-integrity). The per-(account,
// currency) rows are translated leg-by-leg and summed into a single ZAR figure per
// account — there is never a "multi"/"mixed" sentinel currency.
//
// BOUNDARY: V1-side platform reporting module — MAY import v2-core + platform
// projections + market-data (the permitted v1→v2 direction).
//
// Authority: D-BA-RETURN-FAIL-SAFE-RESIDUAL-EXPOSURE; D-GL-PER-ENTRY-FUNCTIONAL-
//   BALANCE-V1; D-GL-FUNCTIONAL-CURRENCY-BALANCING-V1; SARB BA 100 (D5/2025
//   §2.1.3); IAS 21 §21 / §23; Banks Act §75; Reg 32; Principle 1; Principle 5;
//   recon:gl-currency-dimension-integrity; D-ENGINEERING-INTEGRITY-CHARTER.
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille (CFO); domain owner of SARB BA 100).

import { foldSettledFcyCashCostRates } from "../accounting/posting-rules-v2/fx-cash-reval-fold";
import type { EventStore } from "../event-store/store";
import type { TrialBalanceSnapshotRow } from "../event-store/event-types";
import { type MarketDataStore, lookupQuoteWithInverse } from "../market-data/store";
import type { ProvenanceFilter } from "../projections/filter";
import { computeTrialBalanceV2Uncached } from "../projections/gl-projection-v2";
import { isOffBalanceSheetAccountId } from "./ba-100-balance-sheet";

/** The settled-FCY-cash nostro account-id prefix carried at SETTLE-rate cost basis. */
const NOSTRO_ACCOUNT_PREFIX = "ACC-1200-";

/**
 * Translate a NATIVE minor-unit amount to FUNCTIONAL-currency (ZAR) minor units.
 * Functional currency is the identity. A settled-FCY-cash NOSTRO row carries its
 * SETTLE-rate COST BASIS (`costRate`, IAS 21 §23 monetary item); all other FCY
 * rows translate at the latest PRODUCTION spot. Returns `null` on a missing rate
 * — honest, never a silent 0 (Charter cmd 2). The rate is a plain presentation
 * number (no money-name token), the established V2 reporting-conversion convention.
 */
function toFunctionalMinor(
  nativeNet: number,
  currency: string,
  functionalCurrency: string,
  marketData: MarketDataStore,
  costRate: number | undefined,
): number | null {
  if (currency === functionalCurrency) return nativeNet;
  if (costRate !== undefined) {
    if (costRate <= 0) return null;
    return Math.round(nativeNet * costRate);
  }
  const quote = lookupQuoteWithInverse(marketData, `${currency}/${functionalCurrency}`, {
    provenance: "production",
  });
  if (quote === null || quote.rate <= 0) return null;
  return Math.round(nativeNet * quote.rate);
}

/** A balance-sheet account whose FCY net could not be translated to functional ZAR. */
export interface UnconvertibleAccount {
  readonly accountId: string;
  readonly currency: string;
  /** The native signed minor-unit amount that could not be converted. */
  readonly nativeMinor: number;
}

export interface Ba100FunctionalNetArgs {
  readonly eventStore: EventStore;
  readonly marketData: MarketDataStore;
  readonly entity: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly functionalCurrency: string;
  /**
   * The active provenance lens — passed to the cost-rate fold so it reads the SAME
   * lens as the trial-balance fold (the caller pins the lens via
   * setDefaultProvenanceModeOverride for the synchronous fold; this arg keeps the
   * cost-rate fold's explicit-filter API satisfied without re-reading global state).
   */
  readonly filter: ProvenanceFilter;
}

export interface Ba100FunctionalNet {
  /**
   * Per-account signed FUNCTIONAL-currency (ZAR) net in minor units, summed across
   * every currency the account holds (each leg translated leg-by-leg — never a
   * currency sentinel). Positive = debit-natural net; negative = credit-natural net.
   * OFF-balance-sheet memorandum accounts are EXCLUDED. Only fully-resolved accounts
   * appear (an account with ANY unconvertible leg is surfaced in `unconvertible`
   * instead — fail-closed, never a partial silent total).
   */
  readonly netByAccount: ReadonlyMap<string, number>;
  /** Balance-sheet accounts with a leg that had no resolvable functional rate. */
  readonly unconvertible: readonly UnconvertibleAccount[];
}

/**
 * Compute the per-account signed FUNCTIONAL-currency (ZAR) net of the V2 trial
 * balance for the BA 100 balance sheet. Uncached trial-balance read (the caller is
 * read-only or pins its own cache key); cost-basis FCY translation matching the GL
 * view; OBS memorandum accounts excluded; fail-closed on a missing rate.
 */
export function computeBa100FunctionalNet(args: Ba100FunctionalNetArgs): Ba100FunctionalNet {
  const tb = computeTrialBalanceV2Uncached({
    eventStore: args.eventStore,
    entity: args.entity,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
  });
  return functionalNetFromRows(tb.rows, args);
}

/**
 * The pure core: fold per-(account, currency) trial-balance rows into per-account
 * signed functional-ZAR nets. Split out so a caller that already holds the rows can
 * reuse it without a second trial-balance computation.
 */
export function functionalNetFromRows(
  rows: readonly TrialBalanceSnapshotRow[],
  args: Omit<Ba100FunctionalNetArgs, "eventStore"> & { readonly eventStore: EventStore },
): Ba100FunctionalNet {
  const cashCostRates = foldSettledFcyCashCostRates({
    eventStore: args.eventStore,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    filter: args.filter,
  });

  // Accumulate per-account ZAR net; track which accounts had an unconvertible leg
  // so a partial (and therefore wrong) total is never emitted for them.
  const net = new Map<string, number>();
  const broken = new Set<string>();
  const unconvertible: UnconvertibleAccount[] = [];

  for (const r of rows) {
    if (isOffBalanceSheetAccountId(r.leafAccountId)) continue; // OBS — not a BS line.
    const costRate = r.leafAccountId.startsWith(NOSTRO_ACCOUNT_PREFIX)
      ? cashCostRates.get(r.currency)
      : undefined;
    const zar = toFunctionalMinor(
      r.amountMinor,
      r.currency,
      args.functionalCurrency,
      args.marketData,
      costRate,
    );
    if (zar === null) {
      broken.add(r.leafAccountId);
      unconvertible.push({
        accountId: r.leafAccountId,
        currency: r.currency,
        nativeMinor: r.amountMinor,
      });
      continue;
    }
    net.set(r.leafAccountId, (net.get(r.leafAccountId) ?? 0) + zar);
  }

  // Fail-closed: drop any account that had even one unconvertible leg — its total
  // would be partial (and wrong). It is surfaced in `unconvertible`, never hidden.
  for (const accountId of broken) net.delete(accountId);

  return { netByAccount: net, unconvertible };
}
