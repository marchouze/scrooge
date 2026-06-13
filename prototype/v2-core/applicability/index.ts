// v2-core/applicability/index.ts
//
// Barrel export for the applicability-assessment sub-package (V2 S8).
//
// Public surface:
//   events      — Requested / Performed / Concluded payloads + schemas + verdicts
//   engine      — assessApplicability (pure), deriveVerdict
//   projection  — AssessmentRegister, foldAssessmentRegister, emptyAssessmentRegister
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

export * from "./events";
export * from "./engine";
export * from "./projection";
