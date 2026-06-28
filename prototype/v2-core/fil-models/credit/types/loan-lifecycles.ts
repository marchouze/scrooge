// v2-core/fil-models/credit/types/loan-lifecycles.ts
//
// Loan-origination FIL lifecycle declaration (D-BA-RETURN-CELL-VALUE-ENGINE;
// L5-FTR loan-origination slice; DISCOVERY backlog item #2).
//
// `credit` loan-and-advance is the asset-side mirror of the `deposit` liability:
// the bank-as-LENDER funded exposure. A loan instrument is born `active` — the
// moment the advance is originated / drawn the asset is live on the book and
// drives the BA 100 advances line, the BA 200 credit-risk return, and the BA 700
// credit-RWA leg (the dominant capital denominator). It terminates when the loan
// is repaid / settled / written off (the advance leaves the book). The kernel
// stage vocabulary is fixed (`proposed | active | settled | matured | cancelled |
// terminated`), so the conceptual loan sub-states map onto it as:
//
//   originated / drawn / advanced  → kernel `active`   (live advance / EAD)
//   repaid (maturity)              |
//   settled (full early repayment) | → kernel terminal (advance derecognised)
//   written-off / cancelled        |
//
// The discriminator between repaid / settled / written-off is the REALISING event
// (`via`), not a distinct kernel stage — exactly as the capital + deposit
// lifecycles encode their terminal variants through the event ref.
//
// The loan reuses the GENERIC FIL lifecycle event family (`FilInstrumentCreated` /
// `FilInstrumentAmended` / `FilInstrumentTerminated`, `v2-core/fil-instances/
// events.ts`) rather than minting parallel loan-only events (Engineering Charter
// cmd 4 — source, don't duplicate; D-V1-REMOVAL-PHASE-1 — no new v1-only event).
// The loan SPECIFICITY lives entirely in the typed `economicTerms.loanTerms`
// dimension carried on those generic events.
//
// Authority: D-BA-RETURN-CELL-VALUE-ENGINE; D-BA-RETURN-CAPABILITY-FIRST;
//   D-BA-RETURN-SIMULATOR-FIRST; D-FIL-FRAMEWORK-UNIFICATION;
//   D-ENGINEERING-INTEGRITY-CHARTER; D-V1-REMOVAL-PHASE-1; Reg 23; Basel CRE20;
//   IFRS 9 §5.5; SARB BA 100 / BA 200 / BA 700.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import type { FilEventRef, FilLifecycleDeclaration } from "../../../fil-core/lifecycle.ts";

function ref(s: string): FilEventRef {
  return s as FilEventRef;
}

// `FilInstrumentCreated` realises the live advance (active) at origination /
// drawdown. `FilInstrumentTerminated` (terminal stage `matured` for a repaid
// loan, `settled` for full early repayment, `cancelled`/`terminated` for a
// write-off) derecognises the advance. `FilInstrumentAmended` re-stamps the
// carrying amount on a partial repayment / further advance / a stage migration
// (the carrying amount or staging the credit fold counts changes without the
// loan terminating).
export const LOAN_ADVANCE_LIFECYCLE: FilLifecycleDeclaration = {
  initial: "active",
  transitions: [
    // Admitted for a loan approved-but-not-yet-drawn that funds later (rare).
    { from: "proposed", to: "active", via: ref("FilInstrumentCreated") },
    // In-life economic change — partial repayment / further advance / stage move.
    { from: "active", to: "active", via: ref("FilInstrumentAmended") },
    // Terminal derecognitions of the live advance.
    { from: "active", to: "matured", via: ref("FilInstrumentTerminated") },
    { from: "active", to: "settled", via: ref("FilInstrumentTerminated") },
    { from: "active", to: "cancelled", via: ref("FilInstrumentTerminated") },
    { from: "active", to: "terminated", via: ref("FilInstrumentTerminated") },
  ],
};
