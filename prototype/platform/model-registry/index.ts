// platform/model-registry/index.ts
//
// Model-registry skeleton. Co-curated by Rohan (model builder, first
// line — submits versions + methodology) and Nadia (independent
// validator, second line — classifies tier, approves, withholds, raises
// and closes findings).
//
// The interface enforces the co-ownership boundary at the type level:
// Rohan's substrate calls `submit`; Nadia's substrate calls
// `classifyTier` / `approveValidation` / `withholdValidation` /
// `raiseFinding` / `closeFinding`. The registry is event-sourced (P1) —
// status fields are computed by folding the event log, never stored as
// authoritative state.
//
// Authorising spec:
//   - `Team/Nadia.md` §9, §11, §12, §13, §14, §15
//   - `Team/Rohan.md` §11 (`ModelVersionPublished` is a related but
//     distinct, broader event — `ModelSubmitted` is the validation-flow
//     trigger)
//   - Procedures (planned): `Procedures/by-policy/model-validation.md`,
//     `Procedures/by-policy/model-registry-cycle.md` (co-owner)
//
// What this skeleton does NOT do (deferred):
//   - Tier-classification rule logic (Nadia authors the
//     validation-methodology library at `prototype/runtime/_validation-
//     methodology-library.md`, planned).
//   - Backtest-cycle scheduling (Rohan + Atlas, separate slice).
//   - Production-use boundary (`envelope` field on
//     `ModelValidationApproved`) — the schema accepts the version, but
//     pre-trade gateway envelope-aware enforcement is Kai's substrate
//     work.
//   - Model-version artefact storage (Rohan's `ModelVersionPublished`
//     side).
//
// Author: Nadia + Rohan (model-registry skeleton, first slice)

export type {
  ApproveArgs,
  ApproveResult,
  ClassifyResult,
  ClassifyTierArgs,
  CloseFindingArgs,
  CloseFindingResult,
  FindingSeverity,
  FindingView,
  ModelRegistry,
  ModelRegistryConfig,
  ModelTier,
  ModelView,
  RaiseFindingArgs,
  RaiseFindingResult,
  SubmitArgs,
  SubmitResult,
  ValidationStatus,
  WithholdArgs,
  WithholdResult,
} from "./registry";
export { LocalModelRegistry } from "./registry";
