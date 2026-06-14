// v2-core/eval/index.ts
//
// Barrel export for the eval-harness sub-package (V2 S13).
//
// Public surface:
//   exam            — Exam / ExamSet / ExamExpectation types + schemas;
//                     checkExamSetWellFormed (well-formedness gate)
//   harness         — runEval (the harness), EvalSubject / ObservedOutput /
//                     EvalResult / ExamResult / EvalVerdict
//   gate            — evaluateChangeGate (the structured-first change-gate),
//                     ChangeGateResult / ChangeGateStatus / ChangeGateArgs
//   events          — ExamSetRegistered / EvalRunCompleted payloads + schemas +
//                     evalRunCompletedFromResult builder + EVAL_EVENT_KINDS
//   sa-ccr-exam-set — SA_CCR_PILOT_EXAM_SET, makeSaCcrEvalSubject,
//                     SA_CCR_SUBJECT_HASH (the pilot)
//   posture-eval-subject — makePostureEvalSubject (the posture adapter)
//   posture-exam-set     — POSTURE_PILOT_EXAM_SET (the pilot posture exam-set)
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-W4-MODEL-LIBRARY-PILOT;
//   D-W8-POSTURE-REGISTER-SLICE-1.
// Author: Vera (Internal Audit Engineer, governance).

export * from "./exam";
export * from "./harness";
export * from "./gate";
export * from "./events";
export * from "./sa-ccr-exam-set";
export * from "./posture-eval-subject";
export * from "./posture-exam-set";
