// platform/returns/ba200/loan-origination-sim-book.ts
//
// SIMULATOR-FIRST BORN-V2 LOAN-ORIGINATION BOOK — live-store drive helpers
// (D-BA-RETURN-SIMULATOR-FIRST; D-BA-RETURN-CELL-VALUE-ENGINE item #2).
//
// Closes the live-store half of GAP-BA200-CREDIT-SIM-GL. The IN-MEMORY oracle
// (`credit-book-sim-book.ts` / `-drive.ts`) already drives BA 200 + the CRE20
// credit RWA + the BA 700 credit leg by feeding the canonical loan book DIRECTLY
// into the engines. THIS module proves the SAME oracle figures flow through the
// EVENT-SOURCED path: it emits the canonical `CREDIT_BOOK_SIM_BOOK` as born-V2
// loan-origination FIL events (`FilInstrumentCreated`, type
// `fil:type:credit:loan.advance:vanilla`, carrying typed `loanTerms`) into a real
// `EventStore`, so `readDebtExposures` → `debtExposureToCreditExposure` →
// `computeRwa` (the exact path `computeRwaComputed` uses for the dominant BA 700
// credit-RWA denominator) folds them to the Reg 23 / Basel CRE20 oracle.
//
// Before the born-V2 loan fold (this slice) `readDebtExposures` had NO loan source
// at all, so a live loan book folded the credit-RWA leg to an honest 0. This is the
// CORE UNBLOCK: the credit leg now goes NON-ZERO from a seeded sim loan book.
//
// The exposure is event-sourced + provenance-tagged, so the SAME per-lens
// provenance boundary the BA 700 credit leg relies on holds: a production-only lens
// excludes the simulated loan book (the honest pre-licence-day empty state); the
// operating-book lens admits it. The live-store seed into the canonical store
// (ci:migrate) remains the licence-day real-borrower DATA boundary — this drive
// runs the engine over a self-contained in-memory store, exactly as the deposit /
// capital / FX slices prove their folds.
//
// NO new event types; NO v1-only emission (D-V1-REMOVAL-PHASE-1) — born-V2 FIL
// lifecycle events only. NO hardcoded figures — the loan terms come from the one
// canonical book, run through the real engines.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST; D-BA-RETURN-CELL-VALUE-ENGINE;
//   D-BA-RETURN-CAPABILITY-FIRST; D-V1-REMOVAL-PHASE-1; Reg 23; Basel CRE20;
//   IFRS 9 §5.5.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { filEventRefSchema } from "../../../v2-core/fil-core/lifecycle";
import { instantSchema } from "../../../v2-core/fil-core/primitives";
import { formatInstanceUrn } from "../../../v2-core/fil-core/urn";
import {
  type FilInstrumentCreatedPayload,
  type FilLoanExposureClass,
  type FilLoanLtvBucket,
  type FilLoanProductSubType,
  filInstrumentCreatedPayloadSchema,
} from "../../../v2-core/fil-instances/events";
import { LOAN_ADVANCE_TYPE_URN } from "../../../v2-core/fil-models/credit/types/loan-type-definitions";
import { makeFilInstrumentCreated } from "../../event-store/event-types/fil-instances";
import { type ProvenanceTag, simulatedTag } from "../../event-store/provenance";
import { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";
import {
  CREDIT_BOOK_SIM_BOOK,
  CREDIT_BOOK_SIM_SCENARIO,
  type CreditBookSimBook,
  type SimLoanSpec,
} from "./credit-book-sim-book";

const ENTITY = CREDIT_BOOK_SIM_BOOK.entity;
const AS_OF = CREDIT_BOOK_SIM_BOOK.asOf;
const ACTOR: Actor = { type: "service", id: "agent:bea:loan-origination-sim" };

/** Default simulated-provenance tag for the born-V2 loan book. */
export function loanSimProvenance(): ProvenanceTag {
  return simulatedTag({
    scenario: CREDIT_BOOK_SIM_SCENARIO,
    sourceLineage: "platform/returns/ba200/loan-origination-sim-book.ts",
    tags: ["manual-simulation", "loan-origination"],
  });
}

/**
 * Map a canonical sim-loan CRE20 counterparty type → the typed `loanTerms`
 * exposure class. This is the inverse of the in-memory oracle's
 * `simLoanToCreditExposure`; it keeps the born-V2 loan FIL event keyed off the SAME
 * canonical book so the two drives (in-memory + event-sourced) cannot diverge.
 */
function exposureClassForLoan(loan: SimLoanSpec): FilLoanExposureClass {
  switch (loan.productCategory) {
    case "sovereign":
      return "sovereign";
    case "bank":
      return "bank";
    case "corporate":
      return "corporate";
    case "sme-corporate":
      return "sme-corporate";
    case "retail":
      return "retail";
    case "residential-mortgage":
      return "residential-mortgage";
  }
}

/**
 * Map a canonical sim-loan to its SARB BA 100 loan-product sub-type. The oracle
 * book is keyed by CRE20 exposure class, not by SARB product line, so this assigns
 * each class a representative advances product (home loans for residential
 * mortgages, term loans for corporate/SME/sovereign/bank, other for retail) — a
 * faithful placement of the build-phase simulated book, never a fabricated split.
 */
function productSubTypeForLoan(loan: SimLoanSpec): FilLoanProductSubType {
  switch (loan.productCategory) {
    case "residential-mortgage":
      return "home-loan";
    case "retail":
      return "credit-card";
    default:
      return "term-loan";
  }
}

/** The canonical book's LTV bucket → typed loanTerms LTV (residential-mortgage only). */
function ltvBucketForLoan(loan: SimLoanSpec): FilLoanLtvBucket | undefined {
  if (loan.productCategory !== "residential-mortgage") return undefined;
  // The canonical book's `ltvBucket` is the rwa-engine LtvBucket union, byte-
  // identical to FilLoanLtvBucket.
  return loan.ltvBucket as FilLoanLtvBucket | undefined;
}

/**
 * Build the born-V2 loan-origination FIL event for one canonical sim loan. The
 * payload is PARSED through the canonical `filInstrumentCreatedPayloadSchema` so it
 * is both runtime-validated (fail-closed — the loanTerms LTV coherence superRefine
 * fires here) AND correctly branded (instant / event-ref), never hand-cast.
 */
export function loanToFilCreatedPayload(loan: SimLoanSpec): FilInstrumentCreatedPayload {
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId: loan.loanId });
  const ltvBucket = ltvBucketForLoan(loan);
  return filInstrumentCreatedPayloadSchema.parse({
    kind: "FilInstrumentCreated",
    instance,
    type: LOAN_ADVANCE_TYPE_URN,
    tenant: ENTITY,
    asOf: instantSchema.parse(AS_OF),
    originatingEvent: {
      eventType: filEventRefSchema.parse("LoanOriginatedV2"),
      eventId: `LOAN-${loan.loanId}`,
    },
    initialStage: "active",
    economicTerms: {
      assetClass: "credit",
      notional: { currency: loan.currency, amount: String(loan.grossMajor) },
      direction: "long", // the bank holds the advance (asset)
      counterpartyId: loan.counterpartyId,
      nettingSetId: `NS-LOAN-${loan.loanId}-${loan.currency}`,
      currency: loan.currency,
      settlementDate: AS_OF.slice(0, 10),
      loanTerms: {
        loanProductSubType: productSubTypeForLoan(loan),
        ifrs9Stage: loan.stage,
        exposureClass: exposureClassForLoan(loan),
        ...(ltvBucket !== undefined ? { ltvBucket } : {}),
      },
    },
  });
}

/**
 * Seed the whole canonical born-V2 loan book into the supplied store as
 * simulated-tagged `FilInstrumentCreated` events. Returns the store for chaining.
 */
export function seedLoanOriginationBook(
  store: EventStore,
  book: CreditBookSimBook = CREDIT_BOOK_SIM_BOOK,
  provenance: ProvenanceTag = loanSimProvenance(),
): EventStore {
  for (const loan of book.loans) {
    const payload = loanToFilCreatedPayload(loan);
    store.append(
      makeFilInstrumentCreated({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: ["D-BA-RETURN-SIMULATOR-FIRST", "Reg 23", "Basel CRE20", "IFRS-9-§5.5"],
        provenance,
        payload: payload as unknown as Parameters<typeof makeFilInstrumentCreated>[0]["payload"],
      }),
    );
  }
  return store;
}

/** Build an in-memory store pre-seeded with the simulated born-V2 loan book. */
export function buildLoanOriginationStore(
  book: CreditBookSimBook = CREDIT_BOOK_SIM_BOOK,
  provenance: ProvenanceTag = loanSimProvenance(),
): EventStore {
  return seedLoanOriginationBook(new EventStore(":memory:"), book, provenance);
}
