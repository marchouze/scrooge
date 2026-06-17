// v2-core/agent-performance/index.ts
//
// Barrel export for the Bucket C PILOT agent-performance sub-package.
//
// Public surface:
//   events      — re-declared money-free payload schemas (AgentPerformanceEvaluated,
//                 AgentFeedbackIssued) + the migrated type manifest.
//   projection  — AgentPerformanceRegister, foldAgentPerformanceRegister
//                 (the event-list verbatim parity projection).
//
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC.
// Author: Atlas (Core banking platform architect, engineering).

export * from "./events";
export * from "./projection";
