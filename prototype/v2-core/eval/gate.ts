// v2-core/eval/gate.ts
//
// V2 S13 — the CHANGE-GATE (structured-first).
//
// `evaluateChangeGate(...)` is the function the W8 disposal path / FIL-Model
// adoption path CAN call to gate a subject change on a PASSING eval. It is a
// pure decision over a recorded `EvalResult` (or a freshly-run one): a change is
// gate-cleared iff the subject passed its exam-set.
//
// COMPOSITION WITH NADIA'S INDEPENDENT-VALIDATION PLANE
// -----------------------------------------------------
// The eval harness is the SYSTEMATIC SUBSTRATE — a replayable battery of typed
// exams the bank runs on every candidate change. It is NOT a replacement for
// Nadia's (Model-validation engineer, governance) independent model validation:
//
//   • The harness answers "does the subject still satisfy its specified
//     invariants?" — mechanically, deterministically, on every change.
//   • Independent validation answers "is the specification itself sound, and do
//     I, an independent third-line validator, sign off on production use?" —
//     a judgment, recorded as `ModelValidationApproved` (the v1 model-risk
//     family, #1299) / the FIL-Model `validationStatus` transition.
//
// The two planes COMPOSE, they do not collapse:
//
//   change proposed
//        │
//        ├─ (1) systematic gate:  evaluateChangeGate(eval over the exam-set)
//        │         → MUST be `cleared` (a passing EvalRunCompleted of record)
//        │
//        └─ (2) independent gate: Nadia's ModelValidationApproved / FIL-Model
//                  validationStatus = "validation-approved" (a DISTINCT human/
//                  agent judgment that the gate does NOT and must not stand in
//                  for)
//
//   A change is ADOPTABLE iff BOTH planes clear. The gate exposes (1); it
//   surfaces (2) as a REQUIRED-BUT-EXTERNAL precondition (`independentSignOff`)
//   it records but never itself satisfies. Wiring the gate "available" means the
//   adoption path calls `evaluateChangeGate` and ALSO confirms the independent
//   sign-off — never one in place of the other.
//
// S13 SCOPE: provide the gate + prove it on the SA-CCR pilot. Do NOT retrofit it
// into every existing model/posture change path (brief §"Out of scope").
//
// PACKAGE BOUNDARY: no v1 imports.
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-W4-MODEL-LIBRARY-PILOT;
//   D-W8-POSTURE-REGISTER-SLICE-1. Principle 1; Principle 6 (the gate is an
//   agent-callable control, not a human checkpoint).
// Author: Vera (Internal Audit Engineer, governance).

import type { EvalResult } from "./harness";

// ---------------------------------------------------------------------------
// Gate decision
// ---------------------------------------------------------------------------

/** The systematic-gate verdict. */
export type ChangeGateStatus = "cleared" | "blocked";

/**
 * The result of the change-gate evaluation.
 *
 * `status`                 — cleared iff the eval passed (or passed-with-findings
 *                            when the caller's policy admits it — see args).
 * `evalVerdict`            — the eval verdict the decision was made on.
 * `reason`                 — human-readable justification.
 * `independentSignOff`     — the EXTERNAL precondition the gate records but does
 *                            NOT satisfy: the adoption path must ALSO confirm an
 *                            independent ModelValidationApproved / FIL-Model
 *                            validation-approved sign-off. `null` ⇒ not supplied
 *                            to the gate (the caller must confirm it separately).
 * `adoptable`              — the COMPOSED verdict: status === "cleared" AND the
 *                            independent sign-off is confirmed. `false` whenever
 *                            either plane is unmet — the gate never lets a change
 *                            through on the systematic plane alone.
 */
export interface ChangeGateResult {
  readonly status: ChangeGateStatus;
  readonly evalVerdict: EvalResult["verdict"];
  readonly reason: string;
  readonly independentSignOff: boolean | null;
  readonly adoptable: boolean;
}

// ---------------------------------------------------------------------------
// evaluateChangeGate
// ---------------------------------------------------------------------------

export interface ChangeGateArgs {
  /** The recorded (or freshly-run) eval result for the subject change. */
  readonly eval: EvalResult;
  /**
   * Whether the caller's policy admits `passed-with-findings` as cleared.
   * Defaults to false (only a clean `passed` clears the systematic plane).
   */
  readonly admitPassedWithFindings?: boolean;
  /**
   * Whether an independent ModelValidationApproved / FIL-Model
   * validation-approved sign-off has been confirmed by the caller. Threaded in
   * by the adoption path; the gate records it into the composed `adoptable`
   * verdict but never sets it. `undefined` ⇒ not supplied (adoptable stays
   * false — the composed verdict requires BOTH planes).
   */
  readonly independentSignOff?: boolean;
}

/**
 * Evaluate the change-gate over an eval result. Pure.
 *
 *   systematic plane (this gate):  eval verdict must be `passed`
 *                                  (or `passed-with-findings` if admitted)
 *   independent plane (Nadia):     `independentSignOff === true`
 *   adoptable = systematic cleared AND independent signed off
 */
export function evaluateChangeGate(args: ChangeGateArgs): ChangeGateResult {
  const admit = args.admitPassedWithFindings ?? false;
  const verdict = args.eval.verdict;

  const systematicCleared = verdict === "passed" || (admit && verdict === "passed-with-findings");

  const status: ChangeGateStatus = systematicCleared ? "cleared" : "blocked";

  const independentSignOff = args.independentSignOff === undefined ? null : args.independentSignOff;

  const adoptable = systematicCleared && independentSignOff === true;

  const passedCount = `${args.eval.examsPassed}/${args.eval.examsRun} exams passed`;
  let reason: string;
  if (!systematicCleared) {
    reason = `systematic gate BLOCKED: eval verdict '${verdict}' over exam-set '${args.eval.examSetId}' (${args.eval.examsFailed}/${args.eval.examsRun} exams failed)`;
  } else if (independentSignOff === null) {
    reason = `systematic gate CLEARED (${passedCount}); independent model-validation sign-off NOT supplied to the gate — the adoption path must confirm Nadia's ModelValidationApproved separately before adoption`;
  } else if (independentSignOff === false) {
    reason = `systematic gate CLEARED (${passedCount}), but independent model-validation sign-off is WITHHELD — change is NOT adoptable`;
  } else {
    reason = `ADOPTABLE: systematic gate CLEARED (${passedCount}) AND independent model-validation sign-off confirmed`;
  }

  return { status, evalVerdict: verdict, reason, independentSignOff, adoptable };
}
