// platform/returns/ba200/credit-book-sim-book.ts
//
// SIMULATOR-FIRST CREDIT (LOANS-AND-ADVANCES) BOOK — canonical specification
// (D-BA-RETURN-SIMULATOR-FIRST).
//
// THE single source of truth for the simulated loan / advances book. The golden
// tests (`credit-book-sim-golden.test.ts`) and the recon gate
// (`platform/recon/ba200-credit-sim-drive.ts`) both read this module so the book
// and its hand-computed oracle figures can never drift apart (Engineering Charter
// cmd 4 — source, don't hardcode in two places).
//
// All amounts are CLEAN ROUND NUMBERS chosen so the BA 200 credit-risk fold and
// the CRE20 standardised credit-RWA fold land on the oracle figures below, which
// are derived from the regulation (SA credit-risk Reg 23 / Basel SA-CR CRE20 +
// IFRS 9 §5.5), NOT from the engine (domain-truth validation, not internal
// consistency).
//
// === WHY AN IN-MEMORY ORACLE, NOT A LIVE-STORE SEED (the V1 boundary) ===
//
// The BA 200 credit-risk machinery (the standardised CRE20 risk-weight table in
// rwa-engine.ts, the IFRS 9 staging engine in ifrs9-staging.ts, the EAD/ECL fold
// in ecl-engine.ts, the events-first BA 200 generator, and the credit-RWA leg
// already wired into BA 700 via RwaComputed) ALL EXIST. What is missing is a loan
// book to drive them: `readDebtExposures` reads ONLY `BondTradeExecuted` net
// positions + live `InterbankLoanPlaced` placements — it has NO loans-and-advances
// source at all, so the loan rows fold to an honest 0.
//
// The natural loan event family is `LoanBooked` — but it is registered `v1-only`
// (event-store/registry/missing-types.ts), as is `Ifrs9StageAssigned` (the staging
// event the BA 200 events-first generator joins). `readDebtExposures` does not even
// read `LoanBooked`. Live-seeding loans would therefore (a) NOT drive the existing
// `readDebtExposures` base and (b) WIDEN the v1-only estate (V1-retirement directive
// rule 1) without adding a born-V2 loan path or its GL postings (tripping
// `recon:gl-ledger-coverage` for the GL-posting-bearing lifecycle events).
//
// So — EXACTLY as the trading-book IR oracle (GAP-BA320-IR-SIM-GL) and the
// deposit/funding book (GAP-BA300-DEPOSIT-FUNDING-SIM-GL) did — the golden drive is
// PROVEN by a self-contained in-memory oracle over this canonical book, fed to the
// REAL engines (`generateBa200CreditRisk` + `computeRwa`), not by live-store
// pollution. The live-store seed is the tracked follow-on GAP-BA200-CREDIT-SIM-GL,
// gated on a born-V2 loan-origination + GL-posting path.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST; D-V1-REMOVAL-PHASE-1;
//   Regulations relating to Banks Reg 23 (credit risk); Basel CRE20 (standardised
//   credit risk); IFRS 9 §5.5 (ECL); D-IFRS9-STAGING-V1.
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line-mapping owner)
//   + Helena (Chief Risk Officer, governance — IFRS 9 staging + RWA methodology).

import { computeEcl } from "../../accounting/ifrs9-staging";
import type {
  CounterpartyType,
  CreditExposure,
  CreditRatingBucket,
  LtvBucket,
  ResidualMaturityBucket,
} from "../../risk/rwa-engine";

export const CREDIT_BOOK_SIM_SCENARIO = "credit-book-sim-v1" as const;

// ---------------------------------------------------------------------------
// Book element shape.
//
// One simulated loan / advance, carrying BOTH:
//   (a) the BA 200 credit-risk attributes (productCategory, IFRS 9 stage, gross
//       carrying amount, ECL split) that drive `generateBa200CreditRisk`; AND
//   (b) the CRE20 standardised-approach attributes (counterpartyType + rating /
//       maturity / LTV buckets) that drive the credit-RWA leg via `computeRwa`
//       — the same engine path `computeRwaComputed` uses for the BA 700 credit
//       leg (debtExposureToCreditExposure → computeRwa).
//
// The book deliberately spans all six SA-CR exposure classes (sovereign, bank,
// corporate, SME-corporate, retail, residential-mortgage) and a Stage 1 / 2 / 3
// IFRS 9 mix so every risk-weight branch and ECL-stage branch is exercised.
// ---------------------------------------------------------------------------

export interface SimLoanSpec {
  readonly loanId: string;
  /** Obligor / counterparty id (party-register grain). */
  readonly counterpartyId: string;
  /**
   * BA 200 product-category key (free-form; drives the by-category fold and the
   * classification-map row). Spans the six SA-CR exposure classes.
   */
  readonly productCategory:
    | "sovereign"
    | "bank"
    | "corporate"
    | "sme-corporate"
    | "retail"
    | "residential-mortgage";
  /** Gross carrying amount in ZAR MAJOR units (the authoritative quantity). */
  readonly grossMajor: number;
  /** Gross carrying amount in ZAR MINOR units = grossMajor × 100 (engine-carried). */
  readonly grossMinor: number;
  /** IFRS 9 stage (1 performing / 2 SICR / 3 credit-impaired). */
  readonly stage: 1 | 2 | 3;
  /**
   * ECL rate in basis points per `assessIfrs9Stage` (the IFRS 9 staging oracle):
   *   Stage 1, family "loan" (NOT a low-risk bond/repo/MM family) → 15 bps
   *   Stage 2 → 100 bps
   *   Stage 3 → 5000 bps
   * ECL = round(grossMinor × eclBasisPoints / 10_000).
   */
  readonly eclBasisPoints: number;
  /** CRE20 standardised counterparty type (drives the risk weight). */
  readonly counterpartyType: CounterpartyType;
  /** Optional external-rating bucket (absent ⇒ unrated). */
  readonly ratingBucket?: CreditRatingBucket;
  /** Residual maturity bucket (relevant for bank exposures). */
  readonly residualMaturity?: ResidualMaturityBucket;
  /** LTV bucket (required for residential-mortgage). */
  readonly ltvBucket?: LtvBucket;
  /** ISO 4217 currency. */
  readonly currency: string;
}

export interface CreditBookSimBook {
  readonly scenario: typeof CREDIT_BOOK_SIM_SCENARIO;
  readonly entity: string;
  /** ISO 8601 — the as-of the book is snapshotted at. */
  readonly asOf: string;
  readonly functionalCurrency: string;
  readonly loans: readonly SimLoanSpec[];
}

const toMinor = (major: number): number => Math.round(major * 100);

/**
 * ECL provision in minor units = round(grossMinor × eclBps / 10_000).
 * Delegates to the canonical IFRS 9 `computeEcl` (the staging-engine source of
 * truth) rather than re-implementing the arithmetic (Charter cmd 4 — source,
 * don't hardcode; the engine owns the money rounding).
 */
export function simLoanEclMinor(loan: SimLoanSpec): number {
  return computeEcl(loan.grossMinor, loan.eclBasisPoints);
}

const AS_OF = "2026-06-26T00:00:00.000Z";

// ---------------------------------------------------------------------------
// The book. Six SA-CR exposure classes × a Stage 1/2/3 IFRS 9 mix.
//   - sovereign           : RSA ZAR sovereign — 0% RW, Stage 1
//   - bank                : interbank-grade unrated bank — 75% RW, Stage 1
//   - corporate           : unrated investment-grade corporate — 65% RW, Stage 1
//   - sme-corporate       : unrated IG corporate, SICR — 65% RW, Stage 2
//   - retail              : regulatory retail — 75% RW, Stage 1
//   - residential-mortgage: LTV 60-80% — 30% RW, Stage 1
//   - residential-mortgage: LTV 80-90% impaired — 40% RW, Stage 3
// ---------------------------------------------------------------------------

export const CREDIT_BOOK_SIM_BOOK: CreditBookSimBook = {
  scenario: CREDIT_BOOK_SIM_SCENARIO,
  entity: "LE-ZA-HOZ-BANK",
  asOf: AS_OF,
  functionalCurrency: "ZAR",
  loans: [
    {
      loanId: "CBSIM-LOAN-SOVEREIGN",
      counterpartyId: "issuer:sovereign:RSA",
      productCategory: "sovereign",
      grossMajor: 1_000_000_000, // R1bn
      grossMinor: toMinor(1_000_000_000),
      stage: 1,
      eclBasisPoints: 15,
      counterpartyType: "sovereign-domestic-currency",
      currency: "ZAR",
    },
    {
      loanId: "CBSIM-LOAN-BANK",
      counterpartyId: "lei:SIM00INTERBANKBANK01",
      productCategory: "bank",
      grossMajor: 400_000_000, // R400m
      grossMinor: toMinor(400_000_000),
      stage: 1,
      eclBasisPoints: 15,
      counterpartyType: "bank",
      ratingBucket: "unrated",
      residualMaturity: "long-term",
      currency: "ZAR",
    },
    {
      loanId: "CBSIM-LOAN-CORPORATE",
      counterpartyId: "lei:SIM000CORPORATEAA01",
      productCategory: "corporate",
      grossMajor: 600_000_000, // R600m
      grossMinor: toMinor(600_000_000),
      stage: 1,
      eclBasisPoints: 15,
      counterpartyType: "corporate-ig",
      ratingBucket: "unrated",
      residualMaturity: "long-term",
      currency: "ZAR",
    },
    {
      loanId: "CBSIM-LOAN-SME-CORPORATE",
      counterpartyId: "lei:SIM0000000SMECORP01",
      productCategory: "sme-corporate",
      grossMajor: 200_000_000, // R200m — SICR (Stage 2)
      grossMinor: toMinor(200_000_000),
      stage: 2,
      eclBasisPoints: 100,
      counterpartyType: "corporate-ig",
      ratingBucket: "unrated",
      residualMaturity: "long-term",
      currency: "ZAR",
    },
    {
      loanId: "CBSIM-LOAN-RETAIL",
      counterpartyId: "party:retail:SIM-POOL-01",
      productCategory: "retail",
      grossMajor: 300_000_000, // R300m
      grossMinor: toMinor(300_000_000),
      stage: 1,
      eclBasisPoints: 15,
      counterpartyType: "retail",
      currency: "ZAR",
    },
    {
      loanId: "CBSIM-LOAN-MORTGAGE",
      counterpartyId: "party:mortgage:SIM-POOL-01",
      productCategory: "residential-mortgage",
      grossMajor: 500_000_000, // R500m — LTV 60-80%
      grossMinor: toMinor(500_000_000),
      stage: 1,
      eclBasisPoints: 15,
      counterpartyType: "residential-mortgage",
      ltvBucket: "ltv-60-80",
      currency: "ZAR",
    },
    {
      loanId: "CBSIM-LOAN-MORTGAGE-IMPAIRED",
      counterpartyId: "party:mortgage:SIM-POOL-02",
      productCategory: "residential-mortgage",
      grossMajor: 100_000_000, // R100m — LTV 80-90%, credit-impaired (Stage 3)
      grossMinor: toMinor(100_000_000),
      stage: 3,
      eclBasisPoints: 5_000,
      counterpartyType: "residential-mortgage",
      ltvBucket: "ltv-80-90",
      currency: "ZAR",
    },
  ],
};

/**
 * Map a simulated loan to the `CreditExposure` shape the CRE20 standardised RWA
 * engine (`computeRwa`) consumes — the SAME engine path the BA 700 credit-RWA leg
 * uses (`debtExposureToCreditExposure` → `computeRwa`). Sovereign exposures omit
 * the rating bucket (0% weight; under `exactOptionalPropertyTypes` an explicit
 * `undefined` is not assignable to the optional `CreditRatingBucket`).
 */
export function simLoanToCreditExposure(loan: SimLoanSpec): CreditExposure {
  return {
    counterpartyId: loan.counterpartyId,
    counterpartyType: loan.counterpartyType,
    eadMinor: loan.grossMinor,
    currency: loan.currency,
    ...(loan.ratingBucket !== undefined ? { ratingBucket: loan.ratingBucket } : {}),
    ...(loan.residualMaturity !== undefined ? { residualMaturity: loan.residualMaturity } : {}),
    ...(loan.ltvBucket !== undefined ? { ltvBucket: loan.ltvBucket } : {}),
    note: `sim-loan ${loan.loanId} category=${loan.productCategory} stage=${loan.stage}`,
  };
}

// ---------------------------------------------------------------------------
// HAND-COMPUTED ORACLE FIGURES (domain truth — derived from the regulation).
//
// === CRE20 standardised credit RWA (Reg 23 / Basel SA-CR) — RWA = Σ EAD × RW ===
//   sovereign (0%)              R1,000m × 0.00 =           0
//   bank (unrated long, 75%)    R  400m × 0.75 = R  300,000,000
//   corporate-ig (unrated, 65%) R  600m × 0.65 = R  390,000,000
//   sme-corporate (unrated,65%) R  200m × 0.65 = R  130,000,000
//   retail (75%)                R  300m × 0.75 = R  225,000,000
//   mortgage LTV 60-80% (30%)   R  500m × 0.30 = R  150,000,000
//   mortgage LTV 80-90% (40%)   R  100m × 0.40 = R   40,000,000
//   TOTAL credit RWA                           = R1,235,000,000
//
// === BA 200 / IFRS 9 ECL (§5.5) — ECL = gross × eclBps / 10_000 ===
//   Stage 1 (15 bps):
//     sovereign  R1,000m × 0.0015 = R1,500,000
//     bank       R  400m × 0.0015 = R  600,000
//     corporate  R  600m × 0.0015 = R  900,000
//     retail     R  300m × 0.0015 = R  450,000
//     mortgage   R  500m × 0.0015 = R  750,000
//     Stage-1 gross R2,800m, Stage-1 ECL = R4,200,000  (12-month ECL)
//   Stage 2 (100 bps):
//     sme-corp   R  200m × 0.0100 = R2,000,000
//     Stage-2 gross R200m, Stage-2 ECL = R2,000,000   (lifetime ECL)
//   Stage 3 (5000 bps):
//     mortgage-imp R 100m × 0.5000 = R50,000,000
//     Stage-3 gross R100m, Stage-3 ECL = R50,000,000  (lifetime ECL)
//   TOTAL gross  = R3,100,000,000
//   TOTAL ECL/ACL = R4,200,000 + R2,000,000 + R50,000,000 = R56,200,000
//
// === Derived BA 200 ratios ===
//   NPL ratio      = Stage-3 gross / total gross = R100m / R3,100m = 0.032258…
//   coverage ratio = Stage-3 ACL  / Stage-3 gross = R50m / R100m   = 0.500000
// ---------------------------------------------------------------------------

export const CREDIT_BOOK_SIM_ORACLE = {
  /** All figures in ZAR MINOR units (engine-native). */
  creditRwaMinor: 1_235_000_000_00,
  ba200: {
    totalGrossMinor: 3_100_000_000_00,
    totalEclMinor: 56_200_000_00,
    totalNetMinor: 3_100_000_000_00 - 56_200_000_00,
    stage1: { grossMinor: 2_800_000_000_00, eclMinor: 4_200_000_00, basis: "12-month" as const },
    stage2: { grossMinor: 200_000_000_00, eclMinor: 2_000_000_00, basis: "lifetime" as const },
    stage3: { grossMinor: 100_000_000_00, eclMinor: 50_000_000_00, basis: "lifetime" as const },
    /** Stage-3 gross / total gross. */
    nplRatio: 100_000_000_00 / 3_100_000_000_00,
    /** Stage-3 ACL / Stage-3 gross. */
    coverageRatio: 50_000_000_00 / 100_000_000_00,
    entryCount: 7,
  },
} as const;
