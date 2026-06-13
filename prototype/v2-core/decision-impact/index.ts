// v2-core/decision-impact/index.ts
//
// Barrel export for the decision-impact sweep sub-package (V2 S9).
//
// Public surface:
//   events      — DecisionImpactSweepRequested / DecisionImpactAssessed payloads
//                 + schemas + the impacted-artefact / edge / action vocabularies
//   engine      — computeDecisionImpact (pure), deriveRecommendedActions,
//                 recommendedActionForKind, CandidateArtefact, SweptDecision
//   projection  — SweepRegister, foldSweepRegister, emptySweepRegister,
//                 impactsForDecision / listSweeps / getSweep / sweepsForDecision
//
// Authority: D-W8-DECISION-IMPACT-SWEEP; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Owen (Company Secretary, governance).

export * from "./events";
export * from "./engine";
export * from "./projection";
