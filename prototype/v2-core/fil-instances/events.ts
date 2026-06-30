// v2-core/fil-instances/events.ts
//
// FIL instance lifecycle EVENT FAMILY (V2 WS-V2-BBAAS, FIL-instance
// materialisation slice).
//
// S0 (fil-core/lifecycle.ts) gave the kernel lifecycle SHAPES
// (`FilInstrumentCreated` / `FilInstrumentAmended` / `FilInstrumentTerminated`)
// — Zod shapes only, NOT registered event types, NOT projected. This module
// PROMOTES those shapes into a real, registered v2 event family by composing on
// the kernel base (instance URN + type URN + asOf) and adding the axes a
// materialised anchor-book record needs:
//
//   - `tenant`             — the tenant axis (S2). For the anchor book this is
//                            the anchor tenant id (LE-ZA-HOZ-BANK).
//   - `originatingEvent`   — a reference to the registered v1 event that carries
//                            the economic detail (the originating trade event,
//                            or the amendment-via event). Principle 1: the FIL
//                            instance record points back to the canonical event.
//   - `economicTerms`      — the SA-CCR-relevant economic terms a
//                            `RiskMeasurable` consumer reads off the instance:
//                            notional, currency, counterparty / netting set,
//                            asset class, direction, settlement date (the static
//                            term from which remaining-maturity is derived
//                            at-as-of), hedging-set tag. Carried on `Created`
//                            (and re-stamped on `Amended`) so the projection can
//                            answer the position query WITHOUT reaching back into
//                            v1 (D-MODEL-BINDING-CONTRACT-V1: facets are the sole
//                            data-access path).
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` — NO imports from `platform/`,
// `runtime/`, `domains/` (enforced by `recon:v2-no-v1-import`). The v1-side
// registry wiring (`platform/event-store/event-types/fil-instances.ts` +
// `registry/fil-instances.ts`) imports FROM here, never vice-versa.
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION; D-MODEL-BINDING-CONTRACT-V1;
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS; Principle 1; Principle 2; Principle 5.
// Author: Atlas (Substrate Architect, engineering).

import { z } from "zod";
import {
  type FilLifecycleStage,
  filEventRefSchema,
  filLifecycleStageSchema,
} from "../fil-core/lifecycle";
import { instantSchema, moneySchema } from "../fil-core/primitives";
import { filInstanceUrnSchema, filTypeUrnSchema } from "../fil-core/urn";
import { bopCategoryTagSchema } from "../finsurv/bop-category";

// ---------------------------------------------------------------------------
// FIL economic-terms asset class — the FIL-native partition a RiskMeasurable /
// Valuable consumer keys on. Re-declared here (not imported from fil-facets) to
// keep the event family's grammar self-contained; the value set is the
// SA-CCR-quantifiable subset of the taxonomy asset classes PLUS `cash`. IR + FX
// are the SA-CCR-materialised scope; `cash` is the post-settlement member of the
// FX-trading book slice (D-CASH-ASSET-CLASS-V1) — a monetary cash balance that
// is NOT itself an SA-CCR derivative exposure but IS a real, event-sourced FIL
// instance (instrument-of-record) carrying its own Valuable. The wider union is
// admitted so later slices (credit/equity/commodity) extend without a schema
// change.
// ---------------------------------------------------------------------------

export const filSaCcrAssetClassSchema = z.enum([
  "ir",
  "fx",
  "cash",
  "credit",
  "equity",
  "commodity",
  // `capital` — the bank's OWN qualifying regulatory capital (D-CAPITAL-ASSET-
  // CLASS-V1). NOT itself an SA-CCR derivative exposure; it is the own-funds
  // instrument-of-record that sources the BA-700 / BA-100 capital numerator. It
  // is admitted into the FIL economic-terms asset-class union so a capital FIL
  // instance is a real, event-sourced instrument carrying its qualifying-capital
  // tier (read by the capital-composition fold), exactly as `cash` is admitted as
  // the post-settlement member without being an SA-CCR derivative.
  "capital",
]);

export type FilSaCcrAssetClass = z.infer<typeof filSaCcrAssetClassSchema>;

// ---------------------------------------------------------------------------
// Qualifying-capital dimension (D-CAPITAL-ASSET-CLASS-V1). A `capital`
// asset-class FIL instance carries the typed regulatory-capital tier the BA-700 /
// BA-100 composition fold sums on. The tier vocabulary is the Basel III / Reg 38
// three-tier partition (CET1 / AT1 / Tier 2); the sub-category names the specific
// own-funds component (paid-up ordinary shares, share premium, retained earnings,
// AT1 perpetual non-cumulative, Tier 2 subordinated debt, etc.).
//
// The tier values are byte-identical to `v2-core/accounting/chart-of-accounts.ts`
// `CoaCapitalTier` (`"cet1" | "at1" | "t2"`); re-declared here (not imported) to
// keep the event grammar self-contained, exactly as `filSaCcrAssetClassSchema`
// re-declares the SA-CCR asset-class subset. The composition fold cross-checks the
// instance tier against the CoA `capitalTier` of the resolved equity/liability
// account, so the two stay consistent (the recon gate fails closed on drift).
//
// SOURCE (Charter cmd 4 — source, don't hardcode): the tier partition is
// Reg 38(8) / BCBS RBC20.2 + CAP; the sub-categories are the CAP definition-of-
// capital components. Citations are carried on the Capital FIL model declaration
// and the posting rules, NOT magic numbers here — this is the typed vocabulary.
// ---------------------------------------------------------------------------

/** Basel III / Reg 38(8) qualifying-capital tier (aligned with CoaCapitalTier). */
export const filCapitalTierSchema = z.enum(["cet1", "at1", "t2"]);

export type FilCapitalTier = z.infer<typeof filCapitalTierSchema>;

/**
 * The own-funds sub-category — the specific CAP capital component within a tier.
 * A closed set so the composition fold can render BA-100 capital lines and the
 * recon gate can assert tier↔sub-category coherence (a `cet1.*` sub-category may
 * only sit under tier `cet1`, etc.). Fail-closed: an unknown sub-category is
 * rejected at parse, never silently bucketed.
 */
export const filCapitalSubCategorySchema = z.enum([
  // CET1 components (BCBS CAP; Reg 38(8); Banks Act §70 — paid-up share capital).
  "cet1.paid-up-ordinary-shares",
  "cet1.share-premium",
  "cet1.retained-earnings",
  "cet1.oci-reserve",
  // AT1 components (BCBS CAP — perpetual, non-cumulative, going-concern triggers).
  "at1.perpetual-noncumulative",
  // Tier 2 components (BCBS CAP — subordinated debt ≥5yr; qualifying provisions).
  "t2.subordinated-debt",
  "t2.qualifying-general-provisions",
]);

export type FilCapitalSubCategory = z.infer<typeof filCapitalSubCategorySchema>;

/**
 * The qualifying-capital dimension carried on a `capital` FIL instance's economic
 * terms. The tier is the composition axis; the sub-category names the CAP
 * component. The composition fold buckets the instrument by `tier`; the BA-100
 * line render keys on `subCategory`.
 */
export const filQualifyingCapitalSchema = z.object({
  /** The regulatory-capital tier (CET1 / AT1 / Tier 2). */
  tier: filCapitalTierSchema,
  /** The specific own-funds component within the tier (CAP definition of capital). */
  subCategory: filCapitalSubCategorySchema,
});

export type FilQualifyingCapital = z.infer<typeof filQualifyingCapitalSchema>;

// ---------------------------------------------------------------------------
// DEPOSIT TERMS (D-BA-RETURN-CELL-VALUE-ENGINE; L5-FTR deposit-instrument slice).
//
// The funding/deposit dimension carried on a money-market DEPOSIT FIL instance
// (`fil:type:ir:money-market.deposit:*`) — the bank-as-taker liability. The
// deposit FIL *model* already exists (`mm-deposit-model.ts`, Valuable+Performable
// amortised-cost) and the deposit-liability CoA accounts exist (ACC-6100-001..004
// by counterparty sector). What was MISSING — the gap this slice closes — is the
// typed reporting dimension the deposit needs so a BA 100 (balance-sheet) and a
// BA 300 (liquidity) leaf fold can place the instrument onto the right SARB line
// from the EVENT, not from a coarser CoA proxy (sibling-fold discipline,
// Principle 1).
//
// TWO dimensions, both fail-closed (Charter cmd 2 — no silent bucketing):
//   - `depositCategory` — the SARB BA 100 deposit-LINE discriminator. The closed
//     set maps 1:1 onto the BA 100 R0570–R0620 deposit detail rows (savings /
//     call / fixed-and-notice / negotiable-cert-of-deposit / other / repo). The
//     fixed-term deposit model maps to `fixed-notice`.
//   - `counterpartySector` — the LCR run-off + BA 100 R1010 sector-analysis
//     discriminator. The closed set is the Basel LCR deposit-source partition
//     (retail-stable / retail-less-stable / wholesale-operational /
//     wholesale-non-operational) — byte-identical to the ACC-6100-001..004
//     deposit-liability CoA sub-accounts, so the posting rule resolves the
//     liability leg's account DETERMINISTICALLY from this sector (the account IS
//     the event's economic dimension — same pattern as the capital tier→account).
//
// SOURCE, don't hardcode (Charter cmd 4): the sectors are the BCBS LCR (d238)
// deposit-source partition + SARB Reg 26; the categories are the BA 100 form
// deposit rows. Citations live on the posting rule + model declaration, not magic
// strings here — this is the typed vocabulary.
//
// OPTIONAL + additive: only money-market deposit instances carry it; every
// existing (ir/fx/cash/capital/…) instance parses unchanged (replay-safe —
// Charter cmd 9). The deposit posting rule fails closed on a deposit instance that
// lacks the block (no silent default).
// ---------------------------------------------------------------------------

/**
 * SARB BA 100 deposit-line discriminator — the closed set mapping onto the
 * BA 100 R0570–R0620 deposit detail rows. Fixed-term deposits are `fixed-notice`.
 */
export const filDepositCategorySchema = z.enum([
  "savings", // BA 100 R0570 — Savings deposits.
  "call", // BA 100 R0580 — Call deposits.
  "fixed-notice", // BA 100 R0590 — Fixed and notice deposits.
  "negotiable-cert", // BA 100 R0600 — Negotiable certificates of deposit.
  "other", // BA 100 R0610 — Other deposits and loan accounts.
  "repo", // BA 100 R0620 — Deposits received under repurchase agreements.
]);

export type FilDepositCategory = z.infer<typeof filDepositCategorySchema>;

// ---------------------------------------------------------------------------
// CASH TERMS (D-BA-RETURN-CAPABILITY-FIRST; D-BA-RETURN-PER-PRODUCT-RICHNESS).
// The counterparty-class dimension carried on a settled CASH FIL instance.
// Drives BA 100 row placement (Reg 26 counterparty-sector taxonomy).
//
//   "central-bank"     → R0010 primary + R0050 / R1020 memos.
//   "bank"             → R0120 primary + R0910 / R1050 memos (FX nostro).
//   "customer-non-bank"→ R0120 primary + R0900 memo.
//
// Authority: Banks Act Reg 26; SARB BA 100 (D5/2025 §2.1.3); D-BA-RETURN-
//   CAPABILITY-FIRST; D-BA-RETURN-PER-PRODUCT-RICHNESS; D-ENGINEERING-
//   INTEGRITY-CHARTER (cmd 2 fail-closed; cmd 5 no-silent-deferral; cmd 9
//   replay-safe). Principle 1 (dimension on the event, not inferred from CoA).
// ---------------------------------------------------------------------------

/**
 * BA 100 counterparty-class discriminator for a settled CASH FIL instance.
 * "central-bank" → R0010 + R0050/R1020 memos; "bank" → R0120 + R0910/R1050;
 * "customer-non-bank" → R0120 + R0900 memo.
 */
export const filCashCounterpartyClassSchema = z.enum(["central-bank", "bank", "customer-non-bank"]);

export type FilCashCounterpartyClass = z.infer<typeof filCashCounterpartyClassSchema>;

/**
 * FRTB trading/banking-book discriminator for a settled cash FIL instance.
 * Re-declared here (not imported from v2-core/desk/events.ts) to keep the
 * events schema self-contained — structurally identical to `DeskBookType`.
 * "trading" → C0020 (Trading book); "banking-treasury" → C0010 (Banking book).
 * Authority: D-FX-BOOK-BOUNDARY; D-FRTB-TRADING-DESK-STRUCTURE.
 */
export const filCashBookTypeSchema = z.enum(["trading", "banking-treasury"]);

export type FilCashBookType = z.infer<typeof filCashBookTypeSchema>;

/**
 * Cash dimension block — OPTIONAL on settled `cash` FIL instances. The BA 100
 * leaf fold fails closed when absent (Charter cmd 2). Additive: existing
 * instruments parse unchanged (Charter cmd 9 replay-safe).
 */
export const filCashTermsSchema = z.object({
  /** BA 100 counterparty class (Reg 26) — drives primary row + memo rows. */
  counterpartyClass: filCashCounterpartyClassSchema,
  /**
   * FRTB trading/banking-book book designation (D-FX-BOOK-BOUNDARY). Present
   * when propagated from the originating FX trade's `bookType`. Drives the BA
   * 100 C0010/C0020 column split. Absent → fold places on C0040 only + emits
   * a loud gap (fail-closed; Charter cmd 2 / cmd 4 — never guess a column).
   * Replay-safe: optional so pre-existing cash instruments parse unchanged.
   */
  bookType: filCashBookTypeSchema.optional(),
});

export type FilCashTerms = z.infer<typeof filCashTermsSchema>;

/**
 * BCBS LCR (d238) / SARB Reg 26 deposit-source counterparty sector — byte-
 * identical to the ACC-6100-001..004 deposit-liability CoA sub-accounts. Drives
 * both the BA 300 LCR run-off band and the BA 100 R1010 sector analysis.
 */
export const filDepositCounterpartySectorSchema = z.enum([
  "retail-stable", // ACC-6100-001.
  "retail-less-stable", // ACC-6100-002.
  "wholesale-operational", // ACC-6100-003.
  "wholesale-non-operational", // ACC-6100-004.
]);

export type FilDepositCounterpartySector = z.infer<typeof filDepositCounterpartySectorSchema>;

/**
 * The deposit dimension carried on a money-market deposit FIL instance. The
 * posting rule keys the liability-leg account on `counterpartySector`; the BA 100
 * leaf fold keys the deposit line on `depositCategory`; the BA 300 LCR fold keys
 * the run-off band on `counterpartySector`.
 */
export const filDepositTermsSchema = z.object({
  /** The SARB BA 100 deposit-line category (savings / call / fixed-notice / …). */
  depositCategory: filDepositCategorySchema,
  /** The BCBS LCR / Reg 26 counterparty sector (drives LCR run-off + R1010). */
  counterpartySector: filDepositCounterpartySectorSchema,
});

export type FilDepositTerms = z.infer<typeof filDepositTermsSchema>;

// ---------------------------------------------------------------------------
// LOAN TERMS (D-BA-RETURN-CELL-VALUE-ENGINE; L5-FTR loan-origination slice;
// DISCOVERY backlog item #2). The credit/lending dimension carried on a born-V2
// LOAN-ORIGINATION FIL instance (`fil:type:credit:loan.advance:*`) — the
// bank-as-LENDER asset (loans and advances to customers). This is the asset-side
// mirror of `depositTerms` (the bank-as-taker liability): one self-describing
// instrument-of-record whose BA 100 (balance-sheet advances), BA 200 (credit-risk
// loans-and-advances) and BA 700 (credit-RWA) leaf folds read the SARB line / the
// IFRS 9 stage / the SA-CR exposure class DIRECTLY from the EVENT, not from a
// coarser CoA proxy (sibling-fold discipline, Principle 1).
//
// THREE dimensions, all fail-closed (Charter cmd 2 — no silent bucketing):
//   - `loanProductSubType` — the SARB BA 100 advances-LINE discriminator. The
//     closed set maps 1:1 onto the BA 100 R0130–R0230 loans-and-advances detail
//     rows (home-loan → R0130, commercial-mortgage → R0140, credit-card → R0150,
//     lease-instalment → R0160, overdraft → R0170, term-loan → R0200, other →
//     R0230). The exact SARB Excel row labels are the canonical source (per
//     `project_ba_return_numbering_excel_canonical`).
//   - `ifrs9Stage` — the IFRS 9 §5.5 staging discriminator (1 performing /
//     2 SICR / 3 credit-impaired) that drives the BA 200 by-stage ECL split
//     (12-month vs lifetime) and the NPL / coverage ratios.
//   - `exposureClass` — the SA credit-risk (Reg 23 / Basel CRE20) standardised
//     exposure class that drives the BA 200 by-category fold AND the credit-RWA
//     risk-weight (the dominant BA 700 capital denominator). The closed set is the
//     six+ Reg 23 / CRE20 classes (sovereign / bank / corporate / sme-corporate /
//     retail / residential-mortgage). For residential mortgages the CRE20 risk
//     weight steps with the loan-to-value band, so `ltvBucket` is REQUIRED for
//     `residential-mortgage` (and only meaningful there).
//
// SOURCE, don't hardcode (Charter cmd 4): the product sub-types are the SARB BA 100
// form advances rows; the exposure classes + LTV bands are Reg 23 / Basel CRE20;
// the staging set is IFRS 9 §5.5. Citations live on the posting rule + the leaf
// folds, not magic strings here — this is the typed vocabulary.
//
// OPTIONAL + additive: only loan-origination instances carry it; every existing
// (ir/fx/cash/capital/deposit/…) instance parses unchanged (replay-safe —
// Charter cmd 9). The loan posting rule + the credit folds fail closed on a loan
// instance that lacks the block, or on a residential-mortgage that lacks an LTV
// bucket (no silent default).
// ---------------------------------------------------------------------------

/**
 * SARB BA 100 loans-and-advances LINE discriminator — the closed set mapping 1:1
 * onto the BA 100 R0130–R0230 advances detail rows (SARB Excel form labels are the
 * canonical source). Each value names the BA 100 advances row it folds onto.
 */
export const filLoanProductSubTypeSchema = z.enum([
  "home-loan", // BA 100 R0130 — Homeloans.
  "commercial-mortgage", // BA 100 R0140 — Commercial mortgages.
  "credit-card", // BA 100 R0150 — Credit cards.
  "lease-instalment", // BA 100 R0160 — Lease and instalment debtors.
  "overdraft", // BA 100 R0170 — Overdrafts.
  "term-loan", // BA 100 R0200 — Term loans.
  "other", // BA 100 R0230 — Other loans to customers / clients.
]);

export type FilLoanProductSubType = z.infer<typeof filLoanProductSubTypeSchema>;

/**
 * IFRS 9 §5.5 expected-credit-loss STAGE. Stage 1 (performing) carries 12-month
 * ECL; Stage 2 (SICR) + Stage 3 (credit-impaired) carry lifetime ECL. Drives the
 * BA 200 by-stage ECL split + NPL / coverage ratios.
 */
export const filIfrs9StageSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export type FilIfrs9Stage = z.infer<typeof filIfrs9StageSchema>;

/**
 * SA credit-risk (Reg 23 / Basel CRE20) standardised EXPOSURE CLASS — the obligor
 * classification that drives BOTH the BA 200 by-category credit-risk fold AND the
 * CRE20 standardised risk-weight (the dominant BA 700 credit-RWA denominator).
 * The closed set is the six Reg 23 / CRE20 classes the simulated credit book
 * spans. Byte-compatible with the BA 200 product-category vocabulary.
 */
export const filLoanExposureClassSchema = z.enum([
  "sovereign", // CRE20 — sovereign (RSA ZAR-domestic = 0%).
  "bank", // CRE20.21 — bank exposure (SCRA).
  "corporate", // CRE20.46 — corporate (investment-grade default).
  "sme-corporate", // CRE20 — SME corporate (corporate sub-treatment).
  "retail", // CRE20 — regulatory retail.
  "residential-mortgage", // CRE20 — residential real estate (LTV-stepped).
]);

export type FilLoanExposureClass = z.infer<typeof filLoanExposureClassSchema>;

/**
 * Loan-to-value (LTV) band per Basel CRE20 for residential-mortgage exposures —
 * the risk weight steps with the LTV. Byte-identical to the rwa-engine `LtvBucket`
 * union; re-declared here (not imported) to keep the event grammar self-contained,
 * exactly as `filSaCcrAssetClassSchema` re-declares the SA-CCR asset-class subset.
 * REQUIRED on a `residential-mortgage` exposure (fail-closed in the fold);
 * meaningless on any other class.
 */
export const filLoanLtvBucketSchema = z.enum([
  "ltv-le-50",
  "ltv-50-60",
  "ltv-60-80",
  "ltv-80-90",
  "ltv-90-100",
  "ltv-gt-100",
]);

export type FilLoanLtvBucket = z.infer<typeof filLoanLtvBucketSchema>;

/**
 * The loan dimension carried on a born-V2 loan-origination FIL instance. The
 * posting rule keys the advances-asset leg's BA 100 row + the credit-risk fold on
 * `loanProductSubType`; the BA 200 ECL split on `ifrs9Stage`; the BA 200
 * by-category fold + the CRE20 credit-RWA risk-weight on `exposureClass` (+
 * `ltvBucket` for residential mortgages).
 */
export const filLoanTermsSchema = z
  .object({
    /** The SARB BA 100 advances-line product sub-type (home-loan / overdraft / …). */
    loanProductSubType: filLoanProductSubTypeSchema,
    /** IFRS 9 §5.5 ECL stage (1 performing / 2 SICR / 3 credit-impaired). */
    ifrs9Stage: filIfrs9StageSchema,
    /** Reg 23 / CRE20 standardised exposure class (drives the credit-RWA weight). */
    exposureClass: filLoanExposureClassSchema,
    /** CRE20 LTV band — REQUIRED for `residential-mortgage`, else omitted. */
    ltvBucket: filLoanLtvBucketSchema.optional(),
  })
  .superRefine((terms, ctx) => {
    // CRE20: the residential-mortgage risk weight is LTV-stepped, so an LTV band is
    // MANDATORY — a residential mortgage without one cannot be risk-weighted
    // (fail-closed; no silent default to a wrong weight — Charter cmd 2).
    if (terms.exposureClass === "residential-mortgage" && terms.ltvBucket === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ltvBucket"],
        message:
          "loanTerms coherence: a residential-mortgage exposure MUST carry an ltvBucket (the CRE20 risk weight is LTV-stepped) — fail-closed",
      });
    }
    // An LTV band on a NON-mortgage exposure is a construction defect (it would be
    // silently ignored by the risk-weight lookup) — reject at parse.
    if (terms.exposureClass !== "residential-mortgage" && terms.ltvBucket !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ltvBucket"],
        message: `loanTerms coherence: ltvBucket is only meaningful for residential-mortgage exposures, not ${terms.exposureClass}`,
      });
    }
  });

export type FilLoanTerms = z.infer<typeof filLoanTermsSchema>;

// ---------------------------------------------------------------------------
// FX AGREEMENT QUAD (D-FX-INSTRUMENT-BUYSELL-QUAD, CEO-approved 2026-06-24).
//
// MODEL TRUTH: an FX spot/forward IS an agreement to BUY one currency and SELL
// another on a settlement date. The durable FIL instrument historically reduced
// this to a single positive `notional` + `direction` (the SA-CCR risk shape),
// DROPPING the counter leg at the booking site — the two sides survived only on
// the capture event (`FxTradeExecuted` legs) and the settlement events
// (boughtSettled/soldSettled). This block makes the instrument SELF-DESCRIBING:
// it carries both sides of the agreement from the bank's perspective.
//
//   - `buy`  — the leg the bank BUYS / RECEIVES on settlement (positive Money;
//              currency inside the Money — decimal-native MAJOR units,
//              D-V2-CORE-MONEY-DECIMAL-NATIVE).
//   - `sell` — the leg the bank SELLS / PAYS on settlement (positive Money).
//
// `settlementDate` already lives on `economicTerms` (the static maturity anchor),
// so it is NOT re-stated here. `notional` / `direction` become DERIVED from the
// quad: `notional` is the magnitude of whichever quad leg is denominated in the
// instrument's `currency`, and `direction` follows the bought side relative to
// the pair (long = the bank bought the base currency of the `hedgingSetTag`).
//
// OPTIONAL + additive: only quad-carrying FX instances populate it; every
// existing event (which carries none) parses unchanged (replay-safe — Charter
// cmd 9). The `recon:fx-agreement-quad-integrity` gate fails closed on a
// fx-asset-class instance that lacks it at cutover (no silent default — cmd 2).
// ---------------------------------------------------------------------------

export const fxAgreementSchema = z.object({
  /** The leg the BANK buys / receives on settlement (positive Money; ccy inside). */
  buy: moneySchema,
  /** The leg the BANK sells / pays on settlement (positive Money; ccy inside). */
  sell: moneySchema,
});

export type FxAgreement = z.infer<typeof fxAgreementSchema>;

/** Strip a leading `-` from a canonical decimal string (magnitude compare). */
function decimalMagnitude(amount: string): string {
  const t = amount.trim();
  return t.startsWith("-") ? t.slice(1) : t;
}

/**
 * Tier↔sub-category coherence — `true` iff `subCategory` belongs to `tier` (the
 * sub-category string is prefixed with the tier). Pure, fail-closed-friendly:
 * the recon gate + the posting rules call this so a `cet1` instrument tagged
 * `t2.subordinated-debt` is caught, never silently summed into the wrong tier.
 */
export function capitalSubCategoryMatchesTier(
  tier: FilCapitalTier,
  subCategory: FilCapitalSubCategory,
): boolean {
  return subCategory.startsWith(`${tier}.`);
}

// ---------------------------------------------------------------------------
// A reference to the canonical v1 event of record that this lifecycle event
// derives from (Principle 1: the FIL instance is a render of the trade event).
// ---------------------------------------------------------------------------

export const filOriginatingEventRefSchema = z.object({
  /** The registered event type that carries the economic detail. */
  eventType: filEventRefSchema,
  /** The canonical event_id in the source (v1) store. */
  eventId: z.string().min(1),
});

export type FilOriginatingEventRef = z.infer<typeof filOriginatingEventRefSchema>;

// ---------------------------------------------------------------------------
// Economic terms — the SA-CCR-relevant fields a RiskMeasurable consumer reads
// off a materialised instance. These are the STATIC economic terms of the
// trade (notional, settlement date, direction, …); the as-of-sensitive
// remaining-maturity is DERIVED by the projection from `settlementDate` minus
// the query as_of, exactly as the v1 SA-CCR adapter does — so byte-parity
// holds without storing a stale maturity on the event.
// ---------------------------------------------------------------------------

const filEconomicTermsObjectSchema = z.object({
  /** SA-CCR asset class (`ir` | `fx` | …). */
  assetClass: filSaCcrAssetClassSchema,
  /** Notional, always positive — direction encoded separately. v2-native Money. */
  notional: moneySchema,
  /** Trade direction (long/short) for the supervisory delta. */
  direction: z.enum(["long", "short"]),
  /** Counterparty party id (the netting-set counterparty). */
  counterpartyId: z.string().min(1),
  /** Legally-enforceable netting set id (`NS-<counterpartyId>-<ccy>`). */
  nettingSetId: z.string().min(1),
  /** Netting-set / notional currency (ISO-4217 alpha-3). */
  currency: z.string().length(3),
  /**
   * Settlement / maturity date (ISO-8601 date or instant) of the driving leg.
   * Remaining-maturity is derived from this at the query as_of — NOT stored.
   */
  settlementDate: z.string().min(1),
  /**
   * TRADE / DEAL date (ISO-8601 date or instant) — the economic-recognition date
   * of the agreement (D-FX-E2E-CORRECTNESS-V1, Lane 1). This is the date the trade
   * was struck, distinct from `settlementDate` (the value date). For an FX trade it
   * drives the trade-date OBS-memorandum recognition (D-FX-TRADE-DATE-FVTPL-OBS);
   * the contract's day-1 OBS posting is recognised AS-OF this date. The booking
   * site sets it to the date the user/desk SPECIFIES — backdated, live, or future —
   * and the event's `as_of` is aligned to it so a backdated trade folds into the
   * correct period (no auto-increment, no forced T+2).
   *
   * OPTIONAL + additive: born-V2 going forward, but optional for replay-safety —
   * every existing instance (which carries none) parses unchanged (Charter cmd 9).
   * When ABSENT, consumers fall back to the event `as_of` (the prior implicit
   * trade date), so the fold behaviour is behaviour-neutral for legacy events.
   * Canonical render path: `economicTerms.tradeDate` (Lane 2 / Noa displays it).
   */
  tradeDate: z.string().min(1).optional(),
  /** Hedging-set tag (FX pair, e.g. `EUR/ZAR`; IR currency/bucket). */
  hedgingSetTag: z.string().min(1).optional(),
  /**
   * Originating-instrument back-reference (D-CASH-ASSET-CLASS-V1). When a
   * settled trade MATERIALISES a successor instrument — an FX spot settling into
   * a `cash` asset (the FX OTC NPA declares the maturity→cash rule) — the
   * successor carries the FIL instance URN of the originating instrument here, so
   * the single-graph link from the cash holding back to the trade that produced
   * it is EXPLICIT (Principle 1 / Principle 2 — no orphan node). The Slice-3
   * recon gate fails closed on any `cash`-asset-class instance that lacks this
   * back-ref. Optional at the schema level because origin-less instruments (an
   * FX trade created directly from execution) legitimately have no predecessor.
   */
  originatingInstrument: filInstanceUrnSchema.optional(),
  /**
   * Booking-time PRODUCT BINDING (S0d, D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD).
   * The id of the NPA-approved `V2ProductRegistered` product the instance was
   * booked under (e.g. `v2:prd:bank:fx:otc-vanilla`). Stamped at booking time
   * (the `FilInstrumentCreated` emission) so the accounting fold can resolve the
   * instance's composed reporting treatment DIRECTLY from the bound product —
   * deterministically — instead of inferring it from a type-scope fallback. The
   * booking path stamps this ONLY when an approved product governs the instance's
   * FIL type (the NPA gate); an instance whose type has no approved governing
   * product carries no `productId` and the fold fails closed for it (no silent
   * default — Engineering Charter cmd 2). OPTIONAL + additive: legacy / un-migrated
   * instances that predate S0d carry no `productId` and continue to fold via the
   * documented fail-closed path, so existing events parse unchanged (replay-safe).
   */
  productId: z.string().min(1).optional(),
  /**
   * Qualifying-capital dimension (D-CAPITAL-ASSET-CLASS-V1). Carried on a
   * `capital` asset-class FIL instance — the typed regulatory-capital tier +
   * own-funds sub-category the BA-700 / BA-100 capital-composition fold sums on.
   * OPTIONAL + additive: only `capital` instances carry it; every existing
   * (ir/fx/cash/…) instance parses unchanged (replay-safe — Charter cmd 9). The
   * capital-materialisation recon gate fails closed on a `capital` instance that
   * lacks this block (no silent default — Charter cmd 2).
   */
  qualifyingCapital: filQualifyingCapitalSchema.optional(),
  /**
   * Deposit dimension (D-BA-RETURN-CELL-VALUE-ENGINE; L5-FTR deposit slice).
   * Carried on a money-market DEPOSIT FIL instance (the bank-as-taker liability)
   * — the typed deposit-category + counterparty-sector the BA 100 (balance-sheet)
   * and BA 300 (LCR/NSFR liquidity) leaf folds place the instrument onto its SARB
   * line/band with. OPTIONAL + additive: only deposit instances carry it; every
   * existing instance parses unchanged (replay-safe — Charter cmd 9). The deposit
   * posting rule fails closed on a deposit instance lacking it (no silent default
   * — Charter cmd 2).
   */
  depositTerms: filDepositTermsSchema.optional(),
  /**
   * Loan dimension (D-BA-RETURN-CELL-VALUE-ENGINE; L5-FTR loan-origination slice;
   * DISCOVERY backlog item #2). Carried on a born-V2 LOAN-ORIGINATION FIL instance
   * (the bank-as-LENDER asset) — the typed SARB loan-product sub-type (BA 100
   * advances row) + IFRS 9 stage (BA 200 ECL split) + SA-CR exposure class
   * (BA 200 by-category + the CRE20 credit-RWA weight, the dominant BA 700
   * denominator). OPTIONAL + additive: only loan instances carry it; every
   * existing instance parses unchanged (replay-safe — Charter cmd 9). The loan
   * posting rule + the credit folds fail closed on a loan instance lacking it
   * (no silent default — Charter cmd 2).
   */
  loanTerms: filLoanTermsSchema.optional(),
  /**
   * Cash dimension (D-BA-RETURN-CAPABILITY-FIRST; D-BA-RETURN-PER-PRODUCT-
   * RICHNESS). Carried on a settled `cash` asset-class FIL instance — the typed
   * counterparty-class (Reg 26 taxonomy) the BA 100 leaf fold uses to place the
   * cash balance onto its primary BA 100 row (R0010 or R0120) and memo rows.
   * OPTIONAL + additive: only settled FX cash legs carry it where the settlement
   * routing is known; every existing instance parses unchanged (replay-safe —
   * Charter cmd 9). The BA 100 leaf fold fails closed on a cash instance lacking
   * it — the position stays unresolved rather than guessing (Charter cmd 2;
   * no silent default). Authority: D-BA-RETURN-CAPABILITY-FIRST.
   */
  cashTerms: filCashTermsSchema.optional(),
  /**
   * The symmetric BUY/SELL agreement quad (D-FX-INSTRUMENT-BUYSELL-QUAD). Carried
   * on an `fx` asset-class instance so the instrument is self-describing: it
   * states BOTH currencies of the agreement (what the bank buys, what it sells) on
   * the settlement date, rather than only the single SA-CCR `notional` +
   * `direction`. OPTIONAL + additive: only quad-carrying FX instances populate it;
   * every existing event parses unchanged (replay-safe — Charter cmd 9). The
   * `.superRefine` below cross-checks the quad against `notional` / `direction` /
   * `hedgingSetTag` WHEN present; the `recon:fx-agreement-quad-integrity` gate
   * fails closed on any `fx` instance lacking it at cutover.
   */
  fxAgreement: fxAgreementSchema.optional(),
  /**
   * Fair-value MOVEMENT since the last measurement (D-FX-TRADE-DATE-FVTPL-OBS).
   * Carried on a `FilInstrumentAmended` (revaluation) event so the FVTPL
   * revaluation rule (`PR-FX-REVAL-V2`, IFRS 9 §5.7.1) posts the fair-value DELTA
   * to the on-balance-sheet FX-derivative position vs P&L — NOT the full notional
   * (the corrected behaviour). SIGNED Money: a positive `amount` is a gain (Dr
   * derivative asset / Cr unrealised P&L); a negative is a loss. The currency is
   * the leg currency the position is carried in (typically the instrument
   * `currency`). OPTIONAL + additive: only revaluation amendments that carry a
   * measured delta populate it; every existing event (which carries none) parses
   * unchanged (replay-safe — Charter cmd 9). When ABSENT (the dark / un-measured
   * state) the reval rule posts a zero-amount memo — never a spurious
   * notional-sized posting (fail-closed; no silent default — Charter cmd 2).
   */
  fairValueDeltaSinceLastMeasurement: moneySchema.optional(),
  /**
   * DAY-1 FAIR VALUE at trade-date recognition (D-FX-IFRS-REVIEW-FOUNDATION, F13).
   * An AT-MARKET FX forward has fair value ≈ 0 at inception, so trade-date posts
   * OBS-only (no on-balance-sheet gross-up — IFRS 9 §5.1.1, B3.1.2). An OFF-MARKET
   * forward (an agreed rate away from the market forward — e.g. a day-1 premium /
   * discount) has a NON-ZERO day-1 fair value that IFRS 9 §B5.1.2A requires to be
   * recognised on-balance-sheet at inception, NOT silently treated as zero. This
   * SIGNED Money carries that day-1 FV in the reporting/position currency when the
   * trade is NOT at-market: positive = the contract is an asset to the bank at
   * inception (Dr derivative asset / Cr P&L); negative = a liability (Cr derivative
   * / Dr P&L). OPTIONAL + additive: ABSENT (the default) means an AT-MARKET trade
   * (FV ≈ 0, OBS-only — the existing path); every existing event parses unchanged
   * (replay-safe — Charter cmd 9). The initial-recognition rule reads it so an
   * off-market forward is recognised at its real fair value rather than the silent
   * FV=0 assumption (fail-closed against a dropped day-1 premium — Charter cmd 2).
   */
  dayOneFairValue: moneySchema.optional(),
  /**
   * ZAR (reporting-currency) COST BASIS of the position
   * (D-FX-PNL-FCY-EXPOSURE-REVALUATION). Carried on a settled `cash` asset-class
   * FIL instance — the booked ZAR value GIVEN UP / RECEIVED to acquire the FCY
   * balance (NOT the settled-spot value). FX trading-book P&L is the change in the
   * ZAR value of the FCY exposure carried at THIS cost basis: unrealised =
   * `ZAR market value − zarCostBasis`. A settled FCY cash position therefore
   * revalues IDENTICALLY to the open FX contract for the same spot move (the
   * exposure stays open across settlement — settlement is a change of FORM). For a
   * domestic (reporting-currency) cash leg this equals the leg's own amount (rate
   * 1). OPTIONAL + additive: only settled FX cash legs carry it; every existing
   * event parses unchanged (replay-safe — Charter cmd 9). When ABSENT the
   * revaluation engine falls back to full retranslation (the pre-correction read)
   * — never a silent wrong cost basis.
   */
  zarCostBasis: moneySchema.optional(),
});

/**
 * `FilEconomicTerms` is the z.infer of the BARE object schema (the `.superRefine`
 * below drops required-field narrowing — per the brief, coherence is swept by
 * tests, not tsc). Consumers type against this; the refined schema does the
 * runtime check.
 */
export type FilEconomicTerms = z.infer<typeof filEconomicTermsObjectSchema>;

// ---------------------------------------------------------------------------
// COHERENCE — when `fxAgreement` is present, it must AGREE with the derived SA-CCR
// shape (`notional` / `direction`) and the pair (`hedgingSetTag`). `notional` /
// `direction` are DERIVED from the quad, so a mismatch is a construction defect,
// not a legitimate state — fail at parse (fail-closed; no silent acceptance).
//
// Three asserted invariants, all fail-closed:
//   (1) PAIR — both `buy.currency` and `sell.currency` are the two currencies of
//       `hedgingSetTag` (`<base>/<quote>`), when the tag is present.
//   (2) DIRECTION — `direction === "long"`  ⇒ the bank BOUGHT the pair's BASE
//       currency (buy.currency === base); `"short"` ⇒ it bought the QUOTE
//       (buy.currency === quote). The bought side IS the direction.
//   (3) NOTIONAL — the stored `notional` magnitude equals the magnitude of
//       whichever quad leg is denominated in the instrument's `currency` (the
//       SA-CCR notional is one of the two legs; the anchor book denominates it in
//       the reporting leg, so the check resolves the matching leg rather than
//       hardcoding bought/sold).
// ---------------------------------------------------------------------------

export const filEconomicTermsSchema = filEconomicTermsObjectSchema.superRefine((terms, ctx) => {
  const agreement = terms.fxAgreement;
  if (agreement === undefined) return; // optional ⇒ replay-safe; nothing to cross-check.

  const buyCcy = agreement.buy.currency;
  const sellCcy = agreement.sell.currency;

  // The two legs must be different currencies — an FX agreement exchanges two
  // distinct currencies (fail-closed on a degenerate same-ccy quad).
  if (buyCcy === sellCcy) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["fxAgreement"],
      message: `fxAgreement coherence: buy and sell legs must be DIFFERENT currencies (both ${buyCcy})`,
    });
    return;
  }

  // (1) + (2) — pair + direction, anchored on hedgingSetTag when present.
  if (terms.hedgingSetTag !== undefined) {
    const slash = terms.hedgingSetTag.indexOf("/");
    const base = slash > 0 ? terms.hedgingSetTag.slice(0, slash) : terms.hedgingSetTag;
    const quote = slash > 0 ? terms.hedgingSetTag.slice(slash + 1) : "";
    if (base.length > 0 && quote.length > 0) {
      const pairCcys = new Set([base, quote]);
      if (!pairCcys.has(buyCcy) || !pairCcys.has(sellCcy)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fxAgreement"],
          message: `fxAgreement coherence: buy/sell currencies (${buyCcy}/${sellCcy}) must be the two currencies of hedgingSetTag ${terms.hedgingSetTag}`,
        });
      }
      // DIRECTION: long ⇒ bought the base; short ⇒ bought the quote.
      const boughtBase = buyCcy === base;
      const expectedDirection = boughtBase ? "long" : "short";
      if (terms.direction !== expectedDirection) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fxAgreement"],
          message: `fxAgreement coherence: direction ${terms.direction} disagrees with the bought side — the bank bought ${buyCcy} (pair ${terms.hedgingSetTag}), which implies direction ${expectedDirection}`,
        });
      }
    }
  }

  // (3) NOTIONAL — the stored notional magnitude equals the quad leg denominated
  // in the instrument's currency. The SA-CCR notional IS one of the two legs.
  const legInInstrumentCcy =
    terms.currency === buyCcy
      ? agreement.buy
      : terms.currency === sellCcy
        ? agreement.sell
        : undefined;
  if (legInInstrumentCcy === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["fxAgreement"],
      message: `fxAgreement coherence: instrument currency ${terms.currency} is neither the buy (${buyCcy}) nor sell (${sellCcy}) leg — notional cannot be tied to a quad leg`,
    });
  } else if (
    decimalMagnitude(legInInstrumentCcy.amount) !== decimalMagnitude(terms.notional.amount)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["fxAgreement"],
      message: `fxAgreement coherence: notional ${terms.notional.amount} ${terms.currency} != the ${terms.currency} quad leg magnitude ${legInInstrumentCcy.amount} — notional must derive from the quad`,
    });
  }
});

// ---------------------------------------------------------------------------
// The three registered lifecycle event payloads. Each composes the kernel base
// (instance + type + asOf) with the materialisation axes.
// ---------------------------------------------------------------------------

const instanceBaseShape = {
  /** `fil:inst:<tenant>:<instance-id>` — the instance identity (W9 §3.1). */
  instance: filInstanceUrnSchema,
  /** `fil:type:<asset-class>:<family>:<slug>@maj.min` — the taxonomy ref. */
  type: filTypeUrnSchema,
  /** The tenant axis (S2) — anchor tenant for the anchor book. */
  tenant: z.string().min(1),
  /** ISO-8601 instant the lifecycle transition takes effect. */
  asOf: instantSchema,
  /** The canonical v1 event this lifecycle event renders (Principle 1). */
  originatingEvent: filOriginatingEventRefSchema,
} as const;

/** Instrument created — the first lifecycle event for an instance (W9 §3.3). */
export const filInstrumentCreatedPayloadSchema = z.object({
  kind: z.literal("FilInstrumentCreated"),
  ...instanceBaseShape,
  /** The lifecycle stage at creation (`active` for an executed trade). */
  initialStage: filLifecycleStageSchema,
  /** The economic terms the RiskMeasurable consumer needs. */
  economicTerms: filEconomicTermsSchema,
});

export type FilInstrumentCreatedPayload = z.infer<typeof filInstrumentCreatedPayloadSchema>;

/** Instrument amended — an in-life economic change (W9 §3.3). */
export const filInstrumentAmendedPayloadSchema = z.object({
  kind: z.literal("FilInstrumentAmended"),
  ...instanceBaseShape,
  /** The registered event type that carries the economic amendment detail. */
  amendmentVia: filEventRefSchema,
  /** Re-stamped economic terms after the amendment (full snapshot — P1 latest-wins). */
  economicTerms: filEconomicTermsSchema,
});

export type FilInstrumentAmendedPayload = z.infer<typeof filInstrumentAmendedPayloadSchema>;

// ---------------------------------------------------------------------------
// Derecognition + FVOCI-reclass economic terms — OPTIONAL refinements carried on
// the terminal event so the FX derecognition (PR-FX-CLOSE-V2) and FVOCI→P&L
// reclassification (PR-FX-FVOCI-RECLASS-V2) rules can fire at fold time
// (WS-FIL-FX-SETTLEMENT-EVENTS, D-FIL-FX-SETTLEMENT-EVENTS).
//
// Append-only-safe: both blocks are OPTIONAL, so the existing terminal events
// (which carry neither) continue to parse and fold to the clean zero-amount
// derecognition memo exactly as before. A terminal event that DOES carry these
// terms drives the reversal/reclass postings.
// ---------------------------------------------------------------------------

/**
 * Derecognition economic terms (IFRS 9 §3.2.3): the accumulated unrealised
 * revaluation that sat in the FX unrealised-P&L account and must be reversed +
 * recognised as realised on derecognition. Signed Money: a positive `amount`
 * is an accumulated gain (credit balance) to reverse; the rule moves it to
 * realised P&L. The currency is the leg currency the reval accumulated in.
 */
export const filFxDerecognitionTermsSchema = z.object({
  /** Accumulated unrealised reval to reverse + realise. Signed major-unit Money. */
  accumulatedUnrealised: moneySchema,
});

export type FilFxDerecognitionTerms = z.infer<typeof filFxDerecognitionTermsSchema>;

/**
 * FVOCI-reclassification economic terms (IFRS 9 §5.7.10–11): when the instrument
 * was FVOCI-elected, the accumulated OCI reserve that recycles into P&L on
 * derecognition. Carried on the terminal event so the fold can fire the recycle.
 * `electedFvoci` makes the election EXPLICIT on the terminal event (the fold
 * does not have to re-derive it from a separate election stream at close time);
 * `accumulatedOci` is the signed reserve balance to recycle.
 */
export const filFxFvociReclassTermsSchema = z.object({
  /** True iff the instrument carried an FVOCI election (IFRS 9 §5.7.5). */
  electedFvoci: z.literal(true),
  /** Accumulated FVOCI reserve to recycle into P&L. Signed major-unit Money. */
  accumulatedOci: moneySchema,
});

export type FilFxFvociReclassTerms = z.infer<typeof filFxFvociReclassTermsSchema>;

/** Instrument terminated — a terminal transition (W9 §3.3). */
export const filInstrumentTerminatedPayloadSchema = z.object({
  kind: z.literal("FilInstrumentTerminated"),
  ...instanceBaseShape,
  /** The terminal stage reached (settled / matured / cancelled / terminated). */
  terminalStage: z.enum(["settled", "matured", "cancelled", "terminated"]),
  /**
   * Optional derecognition terms (accumulated unrealised reval). When present,
   * the fold fires PR-FX-CLOSE-V2's reversal; when absent it posts the clean
   * zero-amount memo (the pre-WS-FIL-FX-SETTLEMENT-EVENTS behaviour — preserved).
   */
  derecognitionTerms: filFxDerecognitionTermsSchema.optional(),
  /**
   * Optional FVOCI-reclassification terms (election + accumulated OCI). When
   * present, the fold fires PR-FX-FVOCI-RECLASS-V2's OCI→P&L recycle.
   */
  fvociReclassTerms: filFxFvociReclassTermsSchema.optional(),
});

export type FilInstrumentTerminatedPayload = z.infer<typeof filInstrumentTerminatedPayloadSchema>;

// ---------------------------------------------------------------------------
// FilFxSettlementConfirmed — the FX settlement event (WS-FIL-FX-SETTLEMENT-
// EVENTS, D-FIL-FX-SETTLEMENT-EVENTS). Carries the per-leg economic terms the
// settlement realised-P&L (PR-FX-SETTLE-V2) and swap near/far-leg
// (PR-FX-SWAP-NEAR-V2 / PR-FX-SWAP-FAR-V2) rules consume: bought/sold currency,
// the receivable/payable carrying amount at the BOOKED rate, and the actual cash
// at the SETTLEMENT rate. The realised FX P&L is the booked-vs-settled difference
// (IAS 21 §23, §28).
//
// LEG DISCRIMINATOR (`legRole`): ONE settlement event type with a leg
// discriminator (`spot` | `swap-near` | `swap-far`) rather than three parallel
// event types — the economic terms are IDENTICAL per leg (a swap is two physical
// settlements), so a single carrier with a role tag is the source-don't-duplicate
// choice (Engineering Charter cmd 4). The fold selects PR-FX-SETTLE-V2 for
// `spot`, PR-FX-SWAP-NEAR-V2 for `swap-near`, PR-FX-SWAP-FAR-V2 for `swap-far`.
// ---------------------------------------------------------------------------

export const filFxSettlementLegRoleSchema = z.enum(["spot", "swap-near", "swap-far"]);

export type FilFxSettlementLegRole = z.infer<typeof filFxSettlementLegRoleSchema>;

export const filFxSettlementConfirmedPayloadSchema = z.object({
  kind: z.literal("FilFxSettlementConfirmed"),
  ...instanceBaseShape,
  /** Which leg of the trade this settlement realises (spot / swap near / swap far). */
  legRole: filFxSettlementLegRoleSchema,
  /** Bought-currency leg: the receivable carrying amount at the BOOKED rate. */
  boughtBooked: moneySchema,
  /** Bought-currency leg: the cash actually received at the SETTLEMENT rate (same ccy). */
  boughtSettled: moneySchema,
  /** Sold-currency leg: the payable carrying amount at the BOOKED rate. */
  soldBooked: moneySchema,
  /** Sold-currency leg: the cash actually paid at the SETTLEMENT rate (same ccy). */
  soldSettled: moneySchema,
  /**
   * OPTIONAL BoP-category tag (FinSurv per-transaction reporting scaffold,
   * D-FX-OTC-CLOSURE-BACKLOG Phase C10). When a cross-border FX settlement is
   * tagged with its FinSurv economic class (ORG-FX-FIN-01..14) at settlement
   * time, the tag is carried here so the read-side FinSurv projection can fold
   * it WITHOUT reaching back into the trade. Append-only-safe: OPTIONAL, so
   * existing settlement events (which carry no tag) parse unchanged, and the FX
   * accounting fold — which reads only the booked/settled legs — is unaffected
   * (BoP is a regulatory-reporting axis, NOT an accounting one). The precise
   * BOPCUS code on the tag is licence-day-deferred (`null` in the build phase).
   * See `v2-core/finsurv/bop-category.ts` + PROC-FINSURV-BOP-01.
   */
  bopCategory: bopCategoryTagSchema.optional(),
});

export type FilFxSettlementConfirmedPayload = z.infer<typeof filFxSettlementConfirmedPayloadSchema>;

// ---------------------------------------------------------------------------
// FilNdfFixingObserved — the NDF fixing / cash-settlement event (WS-FIL-FX-
// SETTLEMENT-EVENTS). An NDF is cash-settled — principal NEVER exchanges — so
// this event carries ONLY the cash-settlement economic terms PR-FX-NDF-FIX-V2
// consumes: the settlement currency and the net cash difference
// `notional × (fixing − contracted)` (IFRS 9 §5.7.1 / IAS 21 §28).
//
// The fixing and contracted rates + notional are carried for traceability /
// audit; the net cash difference is carried PRE-COMPUTED (signed Money) because
// the multiplication `notional × (fixing − contracted)` is a markets-domain
// determination, not an accounting one — the posting rule consumes the settled
// cash amount, exactly as the markets desk computes it. No principal legs.
// ---------------------------------------------------------------------------

export const filNdfFixingObservedPayloadSchema = z.object({
  kind: z.literal("FilNdfFixingObserved"),
  ...instanceBaseShape,
  /** Settlement currency the net cash difference is paid/received in. */
  settlementCurrency: z.string().length(3),
  /** Contracted (strike) rate, decimal string (audit / traceability). */
  contractedRate: z.string().min(1),
  /** Observed fixing rate, decimal string (audit / traceability). */
  fixingRate: z.string().min(1),
  /** Notional the fixing applies to, in the (non-settlement) reference currency. */
  notional: moneySchema,
  /**
   * Net cash difference in the settlement currency = notional × (fixing −
   * contracted). Positive = gain (cash received); negative = loss (cash paid).
   * Signed major-unit Money.
   */
  netCashDifference: moneySchema,
  /**
   * OPTIONAL BoP-category tag (FinSurv per-transaction reporting scaffold,
   * D-FX-OTC-CLOSURE-BACKLOG Phase C10). An NDF cash-settlement is a
   * capital-account financial-derivative flow (ORG-FX-FIN-08); when tagged, the
   * class is carried here. Append-only-safe (OPTIONAL); the accounting fold reads
   * only `netCashDifference`, so it is unaffected. Precise BOPCUS code is
   * licence-day-deferred (`null` in the build phase). See
   * `v2-core/finsurv/bop-category.ts` + PROC-FINSURV-BOP-01.
   */
  bopCategory: bopCategoryTagSchema.optional(),
});

export type FilNdfFixingObservedPayload = z.infer<typeof filNdfFixingObservedPayloadSchema>;

// ---------------------------------------------------------------------------
// The discriminated union + the registered event kinds.
// ---------------------------------------------------------------------------

export const filInstanceLifecycleEventSchema = z.discriminatedUnion("kind", [
  filInstrumentCreatedPayloadSchema,
  filInstrumentAmendedPayloadSchema,
  filInstrumentTerminatedPayloadSchema,
  filFxSettlementConfirmedPayloadSchema,
  filNdfFixingObservedPayloadSchema,
]);

export type FilInstanceLifecycleEvent = z.infer<typeof filInstanceLifecycleEventSchema>;

export const FIL_INSTANCE_EVENT_KINDS = [
  "FilInstrumentCreated",
  "FilInstrumentAmended",
  "FilInstrumentTerminated",
  "FilFxSettlementConfirmed",
  "FilNdfFixingObserved",
] as const;

export type FilInstanceEventKind = (typeof FIL_INSTANCE_EVENT_KINDS)[number];

/** The terminal-stage → kernel terminal mapping (re-export for projection use). */
export type FilTerminalStage = Extract<
  FilLifecycleStage,
  "settled" | "matured" | "cancelled" | "terminated"
>;
