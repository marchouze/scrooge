// v2-core/fil-models/credit/types/loan-type-definitions.ts
//
// Formal FilTypeDefinition registration for the born-V2 LOAN-ORIGINATION FIL type
// family (D-BA-RETURN-CELL-VALUE-ENGINE; L5-FTR loan-origination slice; DISCOVERY
// backlog item #2).
//
// `fil:type:credit:loan.advance:vanilla@1.0` — the bank's loans-and-advances
// instrument-of-record (bank as LENDER), ATOMIC (no legs). The asset class is
// CURRENCY-AGNOSTIC: a ZAR home loan is held exactly as a foreign-currency term
// loan would be, so currency is an INSTANCE-level economic term and never part of
// the type identity (no currency marker in the slug — parallels `capital:
// instrument:vanilla` and `ir:money-market.deposit:fixed-term`). The SARB
// loan-product sub-type (BA 100 advances row), the IFRS 9 stage, and the SA-CR
// exposure class are likewise INSTANCE-level economic terms
// (`economicTerms.loanTerms`), NOT separate types: one shared core loan type
// instantiated with a product / stage / exposure-class dimension, so the credit
// folds key off one taxonomy node. It implements:
//   - Lifecycled  — the loan-advance lifecycle (active → matured|settled|
//                   cancelled|terminated), `loan-lifecycles.ts`.
//   - Accountable — IFRS 9 §4.1.2 amortised-cost recognition of the financial
//                   asset (Dr loan-asset / Cr settlement-cash); the posting rules
//                   (`posting-rules/loan.ts`) fire at fold time.
//   - RegulatoryClassifiable — the SA-CR exposure-class + IFRS 9 stage axes the
//                   BA 200 credit-risk return + the CRE20 credit-RWA weight read.
//   - Reportable  — the source of the BA 100 advances rows (R0130–R0230), the
//                   BA 200 credit-risk return, and the BA 700 credit-RWA leg
//                   (Reg 23, Basel CRE20, IFRS 9 §5.5, SARB PA D5/2025).
//
// A loan IS a credit exposure: it carries EAD into the credit-RWA denominator and
// ECL into the IFRS 9 impairment. It does NOT implement Valuable / RiskMeasurable
// in the SA-CCR/market sense (a banking-book funded advance is not a mark-to-market
// trading derivative — it is measured at amortised cost less ECL).
//
// BORN-V2: the loan reuses the generic FIL lifecycle events; it emits NO v1-only
// event type (D-V1-REMOVAL-PHASE-1). The natural v1 event family `LoanBooked` is
// `v1-only` and is NOT used or widened here.
//
// Authority: D-BA-RETURN-CELL-VALUE-ENGINE; D-BA-RETURN-CAPABILITY-FIRST;
//   D-BA-RETURN-SIMULATOR-FIRST; D-FIL-FRAMEWORK-UNIFICATION;
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-ENGINEERING-INTEGRITY-CHARTER;
//   D-V1-REMOVAL-PHASE-1; urn:reg:za:regs-relating-to-banks:reg23;
//   urn:reg:bcbs:cre:20; IFRS-9-§4.1.2; IFRS-9-§5.5; D5/2025 §2.1.3 (form BA 100).
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { ATOMIC_COMPOSITION } from "../../../fil-core/composition.ts";
import type { FilTypeDefinition } from "../../../fil-core/type-definition.ts";
import type { FilTypeUrn } from "../../../fil-core/urn.ts";
import { LOAN_ADVANCE_LIFECYCLE } from "./loan-lifecycles.ts";

// ---------------------------------------------------------------------------
// Loan-and-advance instrument — atomic, single currency, loan dimension on the
// economic terms.
// ---------------------------------------------------------------------------
export const LOAN_ADVANCE_TYPE: FilTypeDefinition = {
  urn: "fil:type:credit:loan.advance:vanilla@1.0" as FilTypeUrn,
  assetClass: "credit",
  familyPath: "loan.advance",
  composition: ATOMIC_COMPOSITION,
  lifecycle: LOAN_ADVANCE_LIFECYCLE,
  implementsFacets: ["Lifecycled", "Accountable", "RegulatoryClassifiable", "Reportable"],
  minting: "kernel",
};

export const LOAN_TYPE_DEFINITIONS = [LOAN_ADVANCE_TYPE] as const;

/** The Loan FIL type URN string — the canonical reference for emitters. */
export const LOAN_ADVANCE_TYPE_URN = LOAN_ADVANCE_TYPE.urn;

/** Taxonomy prefix guard — `fil:type:credit:loan.`. */
export const LOAN_TYPE_PREFIX = "fil:type:credit:loan.";

/** True iff the FIL taxonomy type URN names a loan-and-advance instrument. */
export function isLoanInstance(typeUrn: string): boolean {
  return typeUrn.startsWith(LOAN_TYPE_PREFIX);
}
