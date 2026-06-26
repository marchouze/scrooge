// platform/returns/ba200/credit-rwa-ba700-leg.ts
//
// SIMULATOR-FIRST CREDIT BOOK — BA 700 credit-RWA leg (D-BA-RETURN-SIMULATOR-FIRST).
//
// The credit-RWA leg is the DOMINANT BA 700 capital-adequacy denominator
// component. The canonical production source is `computeRwaComputed`
// (`readDebtExposures` → `debtExposureToCreditExposure` → `computeRwa`) — but the
// live `readDebtExposures` loan source is EMPTY (only bonds + interbank), so the
// production credit-RWA leg from the LOAN book folds to 0 pre-licence-day.
//
// This module composes a BA 700 `RwaDecomposition` whose CREDIT leg is driven by
// the simulated loan book under the operating-book lens, and stays 0 under the
// production-only lens — the per-lens provenance split the BA 700 capital ratios
// rely on (the includeSimulated-into-Prod regression guard, D-V2-UI-VISIBILITY-
// REMEDIATION). The market + operational legs pass through unchanged from whatever
// the caller supplies (typically the existing RwaComputed event of record).
//
// PROVENANCE BOUNDARY (the load-bearing rule):
//   - `lens: "operating-book"` → credit leg = simulated-loan-book CRE20 credit RWA
//     (R1,235m oracle) + any caller-supplied live credit RWA (bonds/interbank).
//   - `lens: "production"`     → credit leg = caller-supplied live credit RWA ONLY
//     (the simulated loan book is invisible; pre-licence-day this is 0 for loans).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE;
//   D-V2-UI-VISIBILITY-REMEDIATION; Reg 23; Basel CRE20; Reg 38.
// Author: Bea (Accounting & financial reporting engineer, engineering)
//   + Camille (Chief Financial Officer, governance — capital-stack methodology).

import type { RwaDecomposition } from "../../reporting/ba-700-capital";
import { CREDIT_BOOK_SIM_BOOK, type CreditBookSimBook } from "./credit-book-sim-book";
import { simBookCreditRwaMinor } from "./credit-book-sim-drive";

/** Provenance lens for the BA 700 credit-RWA leg. */
export type CreditRwaLens = "production" | "operating-book";

export interface Ba700CreditRwaLegInput {
  /** The provenance lens. Production sees only real live exposures (no sim book). */
  readonly lens: CreditRwaLens;
  /**
   * Credit RWA (minor units) from the REAL live debt-exposure base
   * (bonds + interbank via readDebtExposures → computeRwa). Pre-licence-day the
   * LOAN component of this is 0; bonds/interbank may contribute. Defaults to 0.
   */
  readonly liveCreditRwaMinor?: number;
  /** Market RWA (minor units) — passes through unchanged. Defaults to 0. */
  readonly marketRwaMinor?: number;
  /** Operational RWA (minor units) — passes through unchanged. Defaults to 0. */
  readonly operationalRwaMinor?: number;
  /** The simulated loan book (defaults to the canonical book). */
  readonly simBook?: CreditBookSimBook;
}

/**
 * Compose the BA 700 `RwaDecomposition` credit leg with the per-lens provenance
 * split. Under the operating-book lens the simulated loan book's CRE20 credit RWA
 * is added; under the production lens it is excluded (invisible pre-licence-day).
 */
export function ba700RwaWithSimCreditLeg(input: Ba700CreditRwaLegInput): RwaDecomposition {
  const book = input.simBook ?? CREDIT_BOOK_SIM_BOOK;
  const live = input.liveCreditRwaMinor ?? 0;
  const simulatedCredit = input.lens === "operating-book" ? simBookCreditRwaMinor(book) : 0;
  return {
    creditRwaMinor: live + simulatedCredit,
    marketRwaMinor: input.marketRwaMinor ?? 0,
    operationalRwaMinor: input.operationalRwaMinor ?? 0,
    source:
      input.lens === "operating-book"
        ? "credit-leg:operating-book(live+credit-book-sim-v1);market+op:caller"
        : "credit-leg:production(live-only);market+op:caller",
  };
}

/** The simulated-loan-book credit RWA contribution under a given lens (minor units). */
export function simCreditRwaContributionMinor(
  lens: CreditRwaLens,
  book: CreditBookSimBook = CREDIT_BOOK_SIM_BOOK,
): number {
  return lens === "operating-book" ? simBookCreditRwaMinor(book) : 0;
}
