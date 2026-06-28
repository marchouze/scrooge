// platform/accounting/posting-rules-v2/loan-instance-fold.ts
//
// STATE-DRIVEN LOAN-ORIGINATION EAD derivation (D-FIL-CONSUMER-SURFACE-
// ARCHITECTURE; D-BA-RETURN-CELL-VALUE-ENGINE item #2; L5-FTR loan-origination
// slice).
//
// THE SHIFT THIS MAKES (mirrors capital-instance-fold.ts / fx-instance-fold.ts).
// The born-V2 loan-origination credit EAD base must NOT be derived by REPLAYING the
// raw `FilInstrumentCreated` / `FilInstrumentTerminated` (loan) lifecycle events on
// the accounting / GL surface (`platform/accounting/ecl-engine.ts`) — that is the
// anti-pattern `recon:fil-state-surface-isolation` retires (the cancelled-FX defect
// of #1510). Instead, the set of LIVE loan instances and each instance's STAGE come
// from the FIL STATE register (`foldFilInstances`); the per-instance FLOW facts
// (notional principal = EAD; the typed `loanTerms`) come from the instance's CREATED
// event payload.
//
// STATE vs FLOW — the boundary:
//   - STATE (which instances, whether terminal/live): the register `stage`, folded
//     from the FULL entity-scoped register-kind stream (provenance-independent,
//     exactly as the capital derivation does).
//   - FLOW (EAD amount + loanTerms dimensions): read from the lens-admitted CREATED
//     event's `economicTerms` (the notional principal + loanTerms). A terminated
//     loan derecognises the advance (excluded from the live EAD base), so only
//     live (active/proposed) loan instances contribute — exactly what a raw
//     "created minus terminated" replay produced, sourced from STATE here.
//
// PROVENANCE: the CREATED events are read under the caller's provenance lens (so a
// production-only lens excludes a simulated loan book — the honest pre-licence-day
// empty state); the STATE register is built from the full stream so terminal
// detection is lens-independent (same decision the capital / FX derivations make).
//
// This is the sanctioned consumer surface: it is in `STATE_DERIVATION_ALLOWLIST`
// (platform/recon/fil-state-surface-isolation.ts) because it reads the FIL STATE
// register for structure and sources FLOW from the grouped lifecycle payloads —
// the accounting surface (`ecl-engine.ts`) calls THIS, never replaying FIL itself.
//
// Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE; D-BA-RETURN-CELL-VALUE-ENGINE;
//   D-BA-RETURN-SIMULATOR-FIRST; D-V1-REMOVAL-PHASE-1; Reg 23; Basel CRE20;
//   IFRS 9 §5.5; Principle 1.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import {
  type FilInstanceLifecycleEvent,
  type FilInstanceRegister,
  type FilInstrumentCreatedPayload,
  type FilLoanExposureClass,
  type FilLoanLtvBucket,
  foldFilInstances,
  isLiveStage,
} from "../../../v2-core";
import { isLoanPostingInstance } from "../../../v2-core/posting-rules/loan";
import { toDecimal, toMinorUnits } from "../../core/decimal-engine";
import type { EventStore } from "../../event-store/store";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../../projections/filter";

/** The FIL lifecycle event kinds folded into the loan STATE register. */
const REGISTER_EVENT_KIND_LIST = [
  "FilInstrumentCreated",
  "FilInstrumentAmended",
  "FilInstrumentTerminated",
] as const;

/**
 * A live loan exposure derived from the FIL state register — the minimal shape the
 * accounting ECL EAD base (`readDebtExposures`) needs. EAD is the notional principal
 * in engine-native MINOR units (scale 2) via the decimal engine (no float money).
 */
export interface LoanInstanceExposure {
  /** The FIL instance URN — the join key + the LEX/staging tradeId. */
  readonly instance: string;
  /** Exposure at default in minor units (notional principal). */
  readonly eadMinor: number;
  /** ISO 4217 currency. */
  readonly currency: string;
  /** SA-CR (Reg 23 / CRE20) exposure class. */
  readonly exposureClass: FilLoanExposureClass;
  /** Obligor / borrower party id (LEX grain). */
  readonly obligorPartyId?: string;
  /** CRE20 LTV band (residential-mortgage only). */
  readonly ltvBucket?: FilLoanLtvBucket;
}

export interface DeriveLoanInstanceExposuresArgs {
  readonly eventStore: EventStore;
  /** Provenance lens for the CREATED (FLOW) events. Defaults to the standard filter. */
  readonly filter?: ProvenanceFilter;
}

/**
 * Derive the LIVE born-V2 loan-origination exposures from the FIL state register.
 * STATE (which loans, whether live) comes from `foldFilInstances`; FLOW (EAD +
 * loanTerms) comes from the lens-admitted CREATED event payload. A terminated loan
 * is excluded (the advance is derecognised). NO raw FIL replay on the accounting
 * surface — that lives here, the sanctioned state-derivation module.
 */
export function deriveLoanInstanceExposures(
  args: DeriveLoanInstanceExposuresArgs,
): LoanInstanceExposure[] {
  const filter = args.filter ?? defaultProvenanceFilter();

  // (1) STATE register — folded from the FULL entity-agnostic register-kind stream
  // (provenance-independent, exactly as the capital derivation). Drives WHICH loan
  // instances exist + whether each is live/terminal.
  const registerEvents: FilInstanceLifecycleEvent[] = [];
  for (const t of REGISTER_EVENT_KIND_LIST) {
    for (const e of args.eventStore.replay({ type: t })) {
      registerEvents.push(e.payload as unknown as FilInstanceLifecycleEvent);
    }
  }
  const stateRegister: FilInstanceRegister = foldFilInstances(registerEvents);

  // (2) FLOW — the lens-admitted CREATED payloads, keyed by instance, for EAD +
  // loanTerms. Production-only lens excludes a simulated loan book here.
  const createdByInstance = new Map<string, FilInstrumentCreatedPayload>();
  for (const e of args.eventStore.replay({ type: "FilInstrumentCreated" })) {
    if (!eventMatchesProvenanceFilter(e, filter)) continue;
    const payload = e.payload as unknown as FilInstrumentCreatedPayload;
    if (typeof payload.type !== "string" || !isLoanPostingInstance(payload.type)) continue;
    createdByInstance.set(payload.instance, payload);
  }

  const out: LoanInstanceExposure[] = [];
  for (const [instanceUrn, row] of stateRegister) {
    // Loan rows only — selected off the STATE row's type (NOT an event scan).
    if (!isLoanPostingInstance(row.type)) continue;
    // Only LIVE advances carry EAD; a terminated loan is derecognised.
    if (!isLiveStage(row.stage)) continue;

    const created = createdByInstance.get(instanceUrn);
    if (created === undefined) continue; // register row with no lens-admitted created event

    const terms = created.economicTerms;
    const loanTerms = terms.loanTerms;
    if (loanTerms === undefined) continue; // fail-closed: a loan MUST carry loanTerms

    // Decimal-native MAJOR-unit string → engine-native MINOR units (scale 2) via
    // the decimal engine (no float money — D-DECIMAL-NATIVE-MONEY-ARITHMETIC).
    let eadMinor: number;
    try {
      eadMinor = Number(toMinorUnits(toDecimal(terms.notional.amount), 2));
    } catch {
      continue;
    }
    if (!Number.isFinite(eadMinor) || eadMinor <= 0) continue;

    out.push({
      instance: instanceUrn,
      eadMinor,
      currency: terms.notional.currency,
      exposureClass: loanTerms.exposureClass,
      ...(terms.counterpartyId !== undefined && terms.counterpartyId.length > 0
        ? { obligorPartyId: terms.counterpartyId }
        : {}),
      ...(loanTerms.ltvBucket !== undefined ? { ltvBucket: loanTerms.ltvBucket } : {}),
    });
  }
  return out;
}
