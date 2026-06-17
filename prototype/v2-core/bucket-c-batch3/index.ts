// v2-core/bucket-c-batch3/index.ts
//
// Bucket C — bulk batch 3 (FINAL non-load-bearing): the remainder +
// deferred self-reference / runtime-emitted substrate types.
//
// WHAT THIS IS
// ------------
// The single source of truth for the 29 money-free, NON-load-bearing bucket-C
// substrate types migrated to the v2 control-plane store via the proven
// store-tee verbatim path (D-BANK-WIDE-V2-MIGRATION). The registry rows
// (`v2-core/registry/index.ts`) and the batch parity gate
// (`platform/recon/bucket-c-batch3-v2-parity.ts`) both derive their type set
// from `BUCKET_C_BATCH3_TYPES` here, so the two can never drift. Direct
// continuation of bucket-C batch 1 (#1408, ratchet 460→403) + batch 2
// (#1409, ratchet 403→335); identical pattern.
//
// AFTER THIS BATCH, the ONLY bucket-C types left `v1-only` are the 14
// load-bearing dispatch / run-lifecycle / RMS types (held for the separate
// CEO checkpoint; the dispatch CLIs stay V1-authoritative). See scope §1.2.
//
// Domain grouping (scope §1.1 / appendix §7, the remaining non-load-bearing
// set):
//   - C-3 agent-lifecycle / runtime remainder (6): DecisionComment, the three
//     runtime-emitted SubstrateAgentRun* lifecycle events, ScheduledTrigger,
//     and SubstrateAlert.
//   - C-9 audit-process / readiness / regulator-process (21). NOTE:
//     `ReconciliationBreak` (a C-9 appendix entry) is EXCLUDED — it is a single
//     payments-domain (PROC-PAY-RBH-01) reconciliation event flagged in scope §0
//     as a de-dup hazard and sits on the C/B (substrate/financial) boundary;
//     per the "if ANY doubt, exclude and report" discipline it is held for a
//     dedicated slice rather than forced into this verbatim batch.
//   - C-10 agent-performance remainder (2): AgentEfficiencyAdvisoryIssued,
//     AgentPromptOptimizationApplied (the pilot pair AgentPerformanceEvaluated
//     + AgentFeedbackIssued already migrated).
//
// ★ SubstrateAlert — STORE-TEE SELF-REFERENCE HAZARD (scope §4.3): RESOLVED,
// INCLUDED. SubstrateAlert is the event the store-tee itself emits on a mirror
// divergence (`alertClass:"integrity", severity:"high"`). Migrating it through
// the same tee is verified NON-recursive:
//   1. A NORMAL SubstrateAlert appended via the teed store is mirrored once by
//      `mirror()` directly into the v2 control-plane store
//      (`cpStore.append(...)`). That append touches ONLY the separate v2 SQLite
//      store — it never re-enters the V1 `EventStore`, so it cannot trigger a
//      new V1 append nor a new tee pass. A SUCCESSFUL mirror cannot recurse.
//   2. The DIVERGENCE alert (`emitMirrorFailureAlert`) is emitted via the RAW
//      UNDERLYING `store.append(...)` (NOT the teed `wrapped.append`), so the
//      alert is NOT itself teed/mirrored — it cannot produce a second
//      mirror-failure alert. The per-type `alertedFailureTypes` dedup set
//      further bounds it to one alert per type per process.
// Net: mirroring SubstrateAlert is safe; the alert's own mirror cannot trigger
// a new SubstrateAlert. See `platform/event-store/v2-store-tee.ts` lines
// 197-199 (the explicit "we do NOT re-tee the alert" comment) and `mirror()`.
//
// EXPLICITLY EXCLUDED (held for the separate CEO checkpoint — the 14
// load-bearing dispatch types; the dispatch CLIs stay V1-authoritative):
//   AgentBriefIssued, AgentRunStarted, AgentRunCompleted, AgentRunFailed,
//   RecordFiled, Decision, DecisionRequested, DocumentRegistered, Feedback,
//   BriefSuperseded, ReconResult, WorkstreamRegistered, WorkstreamStarted,
//   WorkstreamCompleted.
//   Also already done: batch-1 (56), batch-2 (68), the agent-performance pilot
//   pair (AgentPerformanceEvaluated + AgentFeedbackIssued).
//
// THE SCHEMA CONTRACT — why opaque, not re-declared (Charter cmd 3 + 6)
// --------------------------------------------------------------------
// The store-tee mirrors each V1 append VERBATIM (identity codec) reusing the V1
// event_id. The V1 store is authoritative and ALREADY validated the event's
// concrete payload against its real V1 schema at emit time. The v2 mirror is a
// byte-faithful copy; the parity gate proves byte-equivalence of the
// {event_id, type, payload} tuple. The faithful v2-side schema for a verbatim
// mirror is therefore "an object, validated upstream" — the SHARED opaque
// `bucketCVerbatimSchema` (a `Record<string, unknown>`) reused from batch 1.
// This is NOT a weakened assertion: it is the correct contract for a verbatim
// tee, and the byte-tuple parity gate is the hard backstop that catches any real
// divergence the moment data lands. Re-declaring 29 concrete schemas behind the
// no-v1-import boundary would add drift-prone duplication with no extra safety
// over the byte-parity gate, since the payload is never re-shaped.
//
// PACKAGE BOUNDARY: inside `v2-core/` — MUST NOT import from any v1 code-line
// directory (`recon:v2-no-v1-import`). Only re-exports the batch-1 opaque schema
// (itself a bare-zod construct).
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:bucket-c-batch3-remainder-and-runtime-substrate-types:2026-06-17.
// Author: Atlas (Core banking platform architect, engineering).

export { bucketCVerbatimSchema } from "../bucket-c-batch1";

/**
 * The 29 non-load-bearing bucket-C substrate types migrated in batch 3 (the
 * FINAL non-load-bearing batch). The registry rows and the parity gate derive
 * from this single list.
 */
export const BUCKET_C_BATCH3_TYPES = [
  // --- C-3 agent-lifecycle / runtime remainder (6) ---
  "DecisionComment",
  "SubstrateAgentRunStarted",
  "SubstrateAgentRunCompleted",
  "SubstrateAgentRunFailed",
  "ScheduledTrigger",
  "SubstrateAlert",
  // --- C-9 audit-process / readiness / regulator-process (21) ---
  "IncidentRaised",
  "ResilienceTestResult",
  "WhistleblowingDisclosure",
  "ExternalAuditorInquiry",
  "AuditCommitteePackPrepped",
  "PolicyChange",
  "RiskPolicyChange",
  "RiskPolicyChangeProposal",
  "RegulatorRequest",
  "RegulatorInquiry",
  "SupervisoryLetterReceived",
  "RegulatoryInstrumentUpdate",
  "SARSGuidanceUpdate",
  "SchemeRuleChange",
  "CSPAttestationDue",
  "ALMReadinessSnapshot",
  "MarketsReadinessSnapshot",
  "PaymentsReadinessSnapshot",
  "LegalReadinessSnapshot",
  "TaxReadinessSnapshot",
  "CutOffBreach",
  // --- C-10 agent-performance remainder (2) ---
  "AgentEfficiencyAdvisoryIssued",
  "AgentPromptOptimizationApplied",
] as const;

export type BucketCBatch3Type = (typeof BUCKET_C_BATCH3_TYPES)[number];
