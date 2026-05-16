// platform/records/index.ts
//
// RMS Phase 1 Slice 2 — record-helpers public surface.
//
// Spec: Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md §3
// Standing authority: D-RMS-PHASE-1 → D-RMS-PHASE-1-SLICE-2.
//
// Author: Owen (Company Secretary, governance) +
//         Atlas (Core banking platform architect, engineering)

export {
  recordAgentRun,
  recordAgentRunCompleted,
  recordAgentRunStarted,
  recordBriefIssued,
  recordDecisionRequested,
  recordFeedback,
  recordFiled,
  defaultRetentionForRegister,
  supersedeBrief,
  type RecordAgentRunCompletedInput,
  type RecordAgentRunCompletedResult,
  type RecordAgentRunResult,
  type RecordAgentRunStartedInput,
  type RecordAgentRunStartedResult,
  type RecordBriefIssuedInput,
  type RecordDecisionRequestedInput,
  type RecordDecisionRequestedResult,
  type RecordFeedbackInput,
  type RecordFeedbackResult,
  type RecordFiledInput,
  type RecordHelperDeps,
  type RecordHelperResult,
  type SupersedeBriefInput,
  type SupersedeBriefResult,
} from "./helpers";
