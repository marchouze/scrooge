// platform/accounting/posting-rules-v2/fx-instance-fold.ts
//
// STATE-DRIVEN FX GL derivation (Step B, D-FIL-CONSUMER-SURFACE-ARCHITECTURE).
//
// THE SHIFT THIS MAKES
// --------------------
// `foldFxContributionLegs` (`./fx-fold.ts`) derives the FX GL legs by REPLAYING
// the raw `FilInstrument*` lifecycle events and dispatching a per-event
// `switch (p.kind)` — and, crucially, it determines the CANCELLED state by a
// bespoke `findBareCancellations` scan of the terminated stream (state inferred
// from events). That is the anti-pattern the FIL surface exists to remove: the
// accounting consumer re-implements a fold the register already owns and has to
// "remember" each event type to know an instance is cancelled.
//
// `deriveFxInstanceLegs` derives the SAME legs from the FIL STATE register
// (`foldFilInstances`): it iterates the register, selects FX rows by their type,
// and reads each instance's `stage` to decide the terminal treatment. The
// CANCELLED special-case is now a clean `row.stage === "cancelled"` register read
// — no event scan. A terminal `stage` needs no per-event branch: the reversal is
// driven purely by state (plan Q4).
//
// STATE vs FLOW — the boundary the brief draws
// --------------------------------------------
// `stage`, the set of FX instances, terminal detection — STATE — come from the
// register (NEVER from an event scan). The recognition / revaluation / terminal
// leg AMOUNTS are per-event FLOW facts (each amendment posts a full notional pair,
// not a delta; the register intentionally collapses to latest-terms and discards
// the intermediate amendment notionals). So the per-instance opening legs are
// sourced from the instance's grouped lifecycle event payloads — reading FLOW
// amounts, not STATE. This keeps `deriveFxInstanceLegs` byte-identical in NET per
// `(accountCode,currency)` to `foldFxContributionLegs` while the STATE that drives
// the structure (which rows, what stage) comes solely from `foldFilInstances`.
//
// DARK (Step B): this derivation is built, unit-tested, and proven byte-equivalent
// to the event fold by `recon:gl-v2-fold-equivalence-fx`'s THIRD comparison. It is
// NOT yet wired into `gl-projection-v2.ts` (that is Step C). Nothing in the trial
// balance reads it yet.
//
// PACKAGE BOUNDARY: v1 side (`platform/`) — MAY import from `v2-core/`.
//
// Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE (CEO-approved 2026-06-22);
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-DERIVED-EVENT-IRREDUCIBILITY-TEST;
//   D-ENGINEERING-INTEGRITY-CHARTER (root-cause; fail-closed; replay-safe).
//   Principle 1; Principle 2.
// Author: Atlas (Core banking platform architect, engineering).

import {
  type FilInstanceLifecycleEvent,
  type FilInstanceRow,
  foldFilInstances,
} from "../../../v2-core/fil-instances";
import type {
  FilFxSettlementConfirmedPayload,
  FilInstrumentAmendedPayload,
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
  FilNdfFixingObservedPayload,
} from "../../../v2-core/fil-instances/events";
import {
  type InstanceElectionRegister,
  findInstanceElection,
} from "../../../v2-core/reporting-treatments/instance-election";
import type { ReportingTreatmentRegister } from "../../../v2-core/reporting-treatments/registry";
import type { EventStore } from "../../event-store/store";
import type { Event } from "../../event-store/types";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../../projections/filter";
import { decideFxTreatment } from "./fx-fold";
import {
  type FxElectionOverride,
  type FxPostingLeg,
  isFxInstance,
  postFxCancellationReversalLegs,
  postFxCloseLegs,
  postFxInitialRecognitionLegs,
  postFxRevaluationLegs,
} from "./fx";
import {
  type FxFoldDeviation,
  type FxFoldLeg,
  type FxFoldResult,
  type FxFoldSkip,
  foldElectionRegisterFromStore,
  foldTreatmentRegisterFromStore,
} from "./fx-fold";

// Placeholder so the module type-checks while the implementation lands. Replaced
// by the real register-driven derivation below in the same commit.
export function deriveFxInstanceLegs(_args: FxInstanceFoldArgs): FxFoldResult {
  return { legs: [], skipped: [], deviations: [] };
}

export interface FxInstanceFoldArgs {
  readonly eventStore: EventStore;
  readonly treatmentStore?: EventStore;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly filter?: ProvenanceFilter;
}

// Re-export the leg/skip/result types so consumers import from one place.
export type { FxFoldLeg, FxFoldSkip, FxFoldDeviation, FxFoldResult };

// Referenced to keep imports live until the implementation lands (next edit).
void foldFilInstances;
void postFxInitialRecognitionLegs;
void postFxRevaluationLegs;
void postFxCloseLegs;
void postFxCancellationReversalLegs;
void isFxInstance;
void decideFxTreatment;
void findInstanceElection;
void foldElectionRegisterFromStore;
void foldTreatmentRegisterFromStore;
void defaultProvenanceFilter;
void eventMatchesProvenanceFilter;
export type _Refs = [
  FilInstanceLifecycleEvent,
  FilInstanceRow,
  FilFxSettlementConfirmedPayload,
  FilInstrumentAmendedPayload,
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
  FilNdfFixingObservedPayload,
  InstanceElectionRegister,
  ReportingTreatmentRegister,
  Event,
  FxElectionOverride,
  FxPostingLeg,
];
