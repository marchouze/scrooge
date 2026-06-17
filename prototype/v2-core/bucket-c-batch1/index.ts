// v2-core/bucket-c-batch1/index.ts
//
// Bucket C — bulk batch 1: non-load-bearing control-plane substrate types.
//
// WHAT THIS IS
// ------------
// The single source of truth for the 57 money-free, non-load-bearing bucket-C
// substrate types migrated to the v2 control-plane store via the proven
// store-tee verbatim path (D-BANK-WIDE-V2-MIGRATION). The registry rows
// (`v2-core/registry/index.ts`) and the batch parity gate
// (`platform/recon/bucket-c-batch1-v2-parity.ts`) both derive their type set
// from `BUCKET_C_BATCH1_TYPES` here, so the two can never drift.
//
// Domain grouping (scope §4.3 wave order, non-load-bearing only):
//   - C-3 agent-lifecycle / escalation / goal-loop (20) — minus the run-lifecycle
//     trio + SubstrateAlert/ScheduledTrigger/SubstrateAgentRun* (deferred).
//   - C-4 governance-process (26).
//   - C-6 HR / agent-ops (11).
//
// EXPLICITLY EXCLUDED (held for a later CEO-gated batch):
//   - The 14 load-bearing dispatch types (run-lifecycle, RMS registers,
//     workstream lifecycle, ReconResult) — Scrooge owns the run lifecycle.
//   - The done pilot pair (AgentPerformanceEvaluated / AgentFeedbackIssued).
//   - SubstrateAlert (store-tee self-reference hazard, scope §4.3),
//     ScheduledTrigger / SubstrateAgentRun* (runtime-emitted; sequenced later).
//   - CISO/security process (C-7) — held for batch 2 to keep this set reviewable.
//
// THE SCHEMA CONTRACT — why opaque, not re-declared (Charter cmd 3 + 6)
// --------------------------------------------------------------------
// The store-tee mirrors each V1 append VERBATIM (identity codec) reusing the V1
// event_id. The V1 store is authoritative and ALREADY validated the event's
// concrete payload against its real V1 schema at emit time. The v2 mirror is a
// byte-faithful copy; the parity gate proves byte-equivalence of the
// {event_id, type, payload} tuple. The faithful v2-side schema for a verbatim
// mirror is therefore "an object, validated upstream" — `bucketCVerbatimSchema`
// (an opaque `Record<string, unknown>`). This is NOT a weakened assertion: it is
// the correct contract for a verbatim tee, and the byte-tuple parity gate is the
// hard backstop that catches any real divergence the moment data lands. The
// alternative (re-declaring 57 concrete schemas behind the no-v1-import boundary)
// would add ~1000 lines of drift-prone duplication with no extra safety over the
// byte-parity gate, since the payload is never re-shaped.
//
// PACKAGE BOUNDARY: inside `v2-core/` — MUST NOT import from any v1 code-line
// directory (`recon:v2-no-v1-import`). Only bare `zod` is imported.
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:bucket-c-batch1-non-load-bearing-substrate-types:2026-06-17.
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

/**
 * The faithful v2-side payload schema for a VERBATIM-mirrored control-plane
 * event: an opaque object, validated upstream by the authoritative V1 store.
 * See the module header for why this is the correct contract (not a weakened
 * assertion) for the verbatim tee path.
 */
export const bucketCVerbatimSchema: z.ZodType<Record<string, unknown>> = z.record(
  z.string(),
  z.unknown(),
);

/**
 * The 57 non-load-bearing bucket-C substrate types migrated in batch 1. The
 * registry rows and the parity gate derive from this single list.
 */
export const BUCKET_C_BATCH1_TYPES = [
  // --- C-3 agent-lifecycle / escalation / goal-loop (non-run-lifecycle) ---
  "AgentRegistered",
  "AgentRetired",
  "IdentityKeyRotated",
  "PermissionPolicyPublished",
  "AgentEscalation",
  "AgentEscalationAcknowledged",
  "AgentEscalationDecided",
  "AgentEscalationDelegated",
  "AgentEscalationOverdue",
  "AgentDecision",
  "AgentDecisionRequired",
  "AgentGoalEvaluated",
  "AgentGoalSelected",
  "AgentGoalDeferred",
  "BusDispatched",
  "LegacyFanoutShadowed",
  "RiskRaised",
  "RiskResolved",
  "RiskAccepted",
  "RiskMitigated",
  // --- C-4 governance-process ---
  "BankModePolicySet",
  "CeoDecision",
  "AuditFinding",
  "AuditFindingClosed",
  "ProvenanceReclassified",
  "EntityReclassified",
  "CitationGatePassed",
  "CitationGateFailed",
  "RasLineCalibrated",
  "MLROAttestation",
  "ObligationRegistered",
  "ObligationsRegisterSnapshot",
  "M1CitationTrancheRegistered",
  "GovernanceCyclePrep",
  "InboxHygieneSweep",
  "MarketsProjectionRegistered",
  "MarketsProjectionRefreshed",
  "DashboardProjectionRefreshed",
  "DataProjectionSnapshot",
  "SubstrateStateSnapshot",
  "SecuritySubstrateSnapshot",
  "ThreatModelDimensionRegistered",
  "SecurityGateRegistered",
  "SemanticLayerQuantityRegistered",
  "AccountingReadinessSnapshot",
  "AgentOpsReadinessSnapshot",
  // --- C-6 HR / agent-ops ---
  "HireConfirmed",
  "Termination",
  "LeaveGranted",
  "DisciplinaryActionRequested",
  "RoleBriefDelivered",
  "AgentCapabilityChanged",
  "PersonaSpecChanged",
  "TokenUsageRecorded",
  "MandateGapDetected",
  "RoleResearchRequested",
  "RoleResearchQueueSnapshot",
] as const;

export type BucketCBatch1Type = (typeof BUCKET_C_BATCH1_TYPES)[number];
