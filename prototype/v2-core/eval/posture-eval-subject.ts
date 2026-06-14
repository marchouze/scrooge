// v2-core/eval/posture-eval-subject.ts
//
// V2 S13 (W8 Slice B) — the POSTURE EvalSubject adapter.
//
// The eval harness (`runEval`) is subject-agnostic: a subject is an adapter that,
// given an exam's scenario, returns an `ObservedOutput` (a flat record of named
// fields). The SA-CCR pilot adapter drives a FIL-Model's pure compute; THIS
// adapter drives the v2-native posture register's pure scope-evaluation.
//
// `makePostureEvalSubject(postureId, register)` builds an `EvalSubject` of kind
// "posture", scoped to a single postureId. `observe(exam)` reads a
// `PostureContext` off the exam's `scenario`, looks the posture up in the folded
// register, evaluates its APPLIES_WHEN predicate against the context via
// `evaluateAppliesToScope`, and surfaces the named fields the posture exams
// assert:
//
//   applies        — boolean: the posture's APPLIES_WHEN predicate holds in the
//                    scenario context (independent of active/inactive state).
//   postureActive  — boolean: the posture is registered, active, AND applies in
//                    the scenario context (the register's getActivePostures
//                    reading — what a live evaluation would actually act on).
//   dimensionKey   — string: read from the posture's `parameters.dimensionKey`
//                    when present, else "" (the posture's measurement-axis tag,
//                    surfaced for exams that pin a named dimension).
//
// PACKAGE BOUNDARY: no v1 imports. Imports restricted to intra-package relatives
// (the no-v1-import gate `recon:v2-no-v1-import` stays green).
//
// Authority: D-W8-EXAM-GOVERNANCE; D-W8-POSTURE-REGISTER-SLICE-1;
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS. Principle 1 (the eval is replayable);
//   Principle 2 (single-graph discipline).
// Author: Vera (Internal Audit Engineer, governance), exam standard; posture
//         register methodology by Mira (Chief Obligations & Regulatory Officer,
//         compliance).

import type { PostureContext } from "../posture/applies-when";
import { evaluateAppliesToScope } from "../posture/applies-when";
import type { PostureRegister } from "../posture/projection";
import type { Exam } from "./exam";
import type { EvalSubject, ObservedOutput } from "./harness";

// ---------------------------------------------------------------------------
// Scenario shape — what a posture exam's `scenario` carries
// ---------------------------------------------------------------------------

/**
 * A posture exam's scenario is a `PostureContext` — the evaluation environment
 * the posture's APPLIES_WHEN predicate is tested against. All fields optional;
 * an unsupplied dimension fails the corresponding atomic predicate (a posture
 * APPLIES_WHEN jurisdiction=ZA is inactive when the context carries none).
 */
type PostureScenario = PostureContext;

// ---------------------------------------------------------------------------
// The posture subject adapter
// ---------------------------------------------------------------------------

/**
 * Build a posture `EvalSubject` scoped to a single `postureId`. `observe(exam)`
 * reads the `PostureContext` from the exam's scenario, looks the posture up in
 * `register`, evaluates its APPLIES_WHEN predicate, and surfaces the named
 * fields the exams assert. Pure — a deterministic function of (postureId,
 * register, scenario); no IO, no clock.
 */
export function makePostureEvalSubject(postureId: string, register: PostureRegister): EvalSubject {
  return {
    subjectKind: "posture",
    subjectScope: postureId,
    observe(exam: Exam): ObservedOutput {
      const context = exam.scenario as unknown as PostureScenario;
      const posture = register.getPosture(postureId);

      // A posture not present in the register can never apply or be active.
      if (posture === null) {
        return {
          applies: false,
          postureActive: false,
          dimensionKey: "",
        };
      }

      // `applies` — the APPLIES_WHEN predicate holds in the scenario context,
      // independent of the active/inactive dimension.
      const applies = evaluateAppliesToScope(posture.appliesToScope, context);

      // `postureActive` — the register's live reading: the posture is active AND
      // applies in this context. Mirrors getActivePostures (active && predicate).
      const postureActive = posture.active && applies;

      // `dimensionKey` — the posture's measurement-axis tag from parameters, if
      // present; "" otherwise.
      const rawDimensionKey =
        posture.parameters !== undefined ? posture.parameters.dimensionKey : undefined;
      const dimensionKey = typeof rawDimensionKey === "string" ? rawDimensionKey : "";

      return {
        applies,
        postureActive,
        dimensionKey,
      };
    },
  };
}
