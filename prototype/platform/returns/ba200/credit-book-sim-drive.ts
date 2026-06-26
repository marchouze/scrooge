// platform/returns/ba200/credit-book-sim-drive.ts
//
// SIMULATOR-FIRST CREDIT BOOK — drive helpers (D-BA-RETURN-SIMULATOR-FIRST).
//
// Pure adapters that fold the canonical simulated loan book
// (`CREDIT_BOOK_SIM_BOOK`) through the REAL engines:
//
//   - `simBookToBa200Portfolio` → `generateBa200CreditRisk` : the BA 200
//     credit-risk loans-and-advances projection (EAD, RWA-free gross/net, ECL +
//     impairments by IFRS 9 stage + product category, NPL / coverage ratios).
//
//   - `simBookCreditRwa` → `computeRwa` (credit section): the CRE20 standardised
//     credit-RWA — the SAME engine path the BA 700 credit-RWA leg uses
//     (`computeRwaComputed` does `readDebtExposures` → `debtExposureToCreditExposure`
//     → `computeRwa`; here the in-memory loan book supplies the exposures instead
//     of the empty live `readDebtExposures` loan source).
//
// NO new event types; NO hardcoded figures — both helpers run the production
// engines over the canonical book so the golden tests and the recon gate validate
// the ENGINE, not a transcription.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST; Reg 23; Basel CRE20; IFRS 9 §5.5.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import {
  type Ba200ClassificationEntry,
  type Ba200CreditRisk,
  type Ba200LoanEntry,
  generateBa200CreditRisk,
} from "../../reporting/ba-200-credit-risk";
import { type RwaEngineOutput, computeRwa } from "../../risk/rwa-engine";
import {
  CREDIT_BOOK_SIM_BOOK,
  type CreditBookSimBook,
  type SimLoanSpec,
  simLoanEclMinor,
  simLoanToCreditExposure,
} from "./credit-book-sim-book";

/**
 * BA 200 classification map for the simulated credit book — one row per SA-CR
 * exposure class present in the book. Free-form productCategory → published-form
 * loans-and-advances row label.
 */
export const CREDIT_BOOK_SIM_CLASSIFICATION_MAP: readonly Ba200ClassificationEntry[] = [
  { productCategory: "sovereign", ba200RowLabel: "Loans and advances — sovereign / public sector" },
  { productCategory: "bank", ba200RowLabel: "Loans and advances — banks" },
  { productCategory: "corporate", ba200RowLabel: "Loans and advances — corporate" },
  { productCategory: "sme-corporate", ba200RowLabel: "Loans and advances — SME corporate" },
  { productCategory: "retail", ba200RowLabel: "Loans and advances — retail" },
  {
    productCategory: "residential-mortgage",
    ba200RowLabel: "Loans and advances — residential mortgage advances",
  },
];

/** Translate a simulated loan into a BA 200 portfolio entry (IFRS 9 ECL split). */
export function simLoanToBa200Entry(loan: SimLoanSpec): Ba200LoanEntry {
  const ecl = simLoanEclMinor(loan);
  const ecl12Month = loan.stage === 1 ? ecl : 0;
  const eclLifetime = loan.stage === 1 ? 0 : ecl;
  return {
    counterpartyId: loan.counterpartyId,
    productCategory: loan.productCategory,
    grossCarryingAmount: loan.grossMinor,
    stage: loan.stage,
    ecl12Month,
    eclLifetime,
    allowanceForCreditLoss: ecl,
    netCarryingAmount: loan.grossMinor - ecl,
    currency: loan.currency,
  };
}

/** Fold the whole sim book into a BA 200 portfolio. */
export function simBookToBa200Portfolio(
  book: CreditBookSimBook = CREDIT_BOOK_SIM_BOOK,
): readonly Ba200LoanEntry[] {
  return book.loans.map(simLoanToBa200Entry);
}

/**
 * Drive the BA 200 (credit-risk loans-and-advances) projection from the simulated
 * loan book through the REAL `generateBa200CreditRisk` engine.
 */
export function driveBa200FromSimBook(
  book: CreditBookSimBook = CREDIT_BOOK_SIM_BOOK,
): Ba200CreditRisk {
  return generateBa200CreditRisk({
    entity: book.entity,
    asOf: book.asOf,
    periodId: `period:${book.entity}:asof:${book.asOf.slice(0, 10)}`,
    functionalCurrency: book.functionalCurrency,
    portfolio: simBookToBa200Portfolio(book),
    classificationMap: CREDIT_BOOK_SIM_CLASSIFICATION_MAP,
  });
}

/**
 * Drive the CRE20 standardised credit-RWA from the simulated loan book through the
 * REAL `computeRwa` engine (credit section only — market + operational empty).
 * This is the exact engine the BA 700 credit-RWA leg consumes.
 */
export function driveCreditRwaFromSimBook(
  book: CreditBookSimBook = CREDIT_BOOK_SIM_BOOK,
): RwaEngineOutput {
  return computeRwa({
    entityId: book.entity,
    asOf: book.asOf,
    functionalCurrency: book.functionalCurrency,
    creditExposures: book.loans.map(simLoanToCreditExposure),
    tradingBookPositions: [],
    businessIndicator: {
      ildcMinor: 0,
      scMinor: 0,
      fcMinor: 0,
      eurToFunctionalRate: 1,
      ilm: 1,
    },
    sourceEventIds: book.loans.map((l) => l.loanId),
  });
}

/** Total CRE20 standardised credit RWA (minor units) from the sim book. */
export function simBookCreditRwaMinor(book: CreditBookSimBook = CREDIT_BOOK_SIM_BOOK): number {
  return driveCreditRwaFromSimBook(book).credit.totalMinor;
}
