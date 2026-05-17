// platform/event-store/event-types/governance-snapshots.ts
//
// Zod payload schemas for high-volume governance and audit snapshot event
// types that previously had no schema (envelope-only).
//
// Covers:
//   - CeoDecision    — legacy CEO-approval event (superseded by Decision;
//                      kept for backward-compat append and projection replay)
//   - ReconResult    — continuous-controls pipeline execution result
//   - SubstrateStateSnapshot — periodic substrate telemetry snapshot
//   - GovernanceCyclePrep   — periodic governance-cycle preparation record
//   - DataProjectionSnapshot — derived data-projection state cache
//   - InboxHygieneSweep     — inbox hygiene sweep audit record
//   - ObligationsRegisterSnapshot — obligations register health snapshot
//   - SecuritySubstrateSnapshot   — security posture snapshot
//
// Authority: brief:atlas:zod-schemas-at-emit-site-substrate-gap-2-f-032:2026-05-17
// Citations: P1-EVENTS-AS-TRUTH, F-032
//
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

// ---------------------------------------------------------------------------
// CeoDecision
//
// Legacy governance-approval event. Per D-DECISIONS-FRAMEWORK-REDESIGN
// (Slice C), CeoDecision is a deprecated alias for Decision; both event
// types share effectively the same payload shape. Schema is purposely
// permissive on fields that varied in the historical backfill corpus.
// ---------------------------------------------------------------------------

export const ceoDecisionActionSchema = z.enum([
  "approve",
  "defer",
  "modify",
  "request-revision",
]);
export type CeoDecisionAction = z.infer<typeof ceoDecisionActionSchema>;

export const ceoDecisionPayloadSchema = z
  .object({
    /** Stable decision identifier — e.g. "D-LICENCE-TYPE". */
    decisionId: z.string().min(1),
    /** Human-readable title of the decision. */
    title: z.string().min(1),
    /** CEO action applied to this decision. */
    action: ceoDecisionActionSchema,
    /** Outcome summary (may be a backfill marker). */
    outcome: z.string().min(1),
    /** How the event was recorded — e.g. "scrooge:session-delegation". */
    recordedVia: z.string().min(1),
    /** Optional actor who authorised (email or URN). */
    authorityRef: z.string().optional(),
    /** Optional free-text comment from the authority. */
    comment: z.string().optional(),
    /** Optional list of follow-on routing routes. */
    followOnRoutes: z.array(z.string()).optional(),
  })
  .passthrough(); // allow legacy fields from backfill corpus

export type CeoDecisionLegacyPayload = z.infer<typeof ceoDecisionPayloadSchema>;

// ---------------------------------------------------------------------------
// ReconResult
//
// Emitted by any recon pipeline after its run. Fields mirror
// `platform/recon/types.ts` ReconResult interface.
// ---------------------------------------------------------------------------

export const reconResultViolationSchema = z.object({
  subject: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warn", "fail"]),
});

export const reconResultPayloadSchema = z
  .object({
    /** Pipeline name — e.g. "event-type-registry-coverage". */
    pipeline: z.string().min(1),
    /** Whether the pipeline passed (no fail-severity violations). */
    ok: z.boolean(),
    /** Total assertions made. */
    asserted: z.number().int().nonnegative(),
    /** Total violations count (all severities). */
    violationsTotal: z.number().int().nonnegative().optional(),
    /** Count of fail-severity violations. */
    failViolations: z.number().int().nonnegative().optional(),
    /** Count of warn-severity violations. */
    warnViolations: z.number().int().nonnegative().optional(),
    /** ISO-8601 timestamp of the pipeline run (may differ from event as_of). */
    asOfPipeline: z.string().optional(),
    /** Trigger that initiated the run — e.g. "overnight-recon", "ci". */
    runTrigger: z.string().optional(),
    /** Inline violations (older payloads may omit this). */
    violations: z.array(reconResultViolationSchema).optional(),
  })
  .passthrough();

export type ReconResultPayload = z.infer<typeof reconResultPayloadSchema>;

// ---------------------------------------------------------------------------
// SubstrateStateSnapshot
//
// Periodic substrate telemetry snapshot. Fields observed from the corpus;
// kept permissive because Atlas may add new fields between snapshots.
// ---------------------------------------------------------------------------

export const substrateStateSnapshotPayloadSchema = z
  .object({
    /** Total event count in the store at snapshot time. */
    totalEvents: z.number().int().nonnegative().optional(),
    /** Count of distinct event types. */
    eventTypeCount: z.number().int().nonnegative().optional(),
    /** Persona coverage object. */
    personaCoverage: z
      .object({
        total: z.number().int().nonnegative(),
        withSpec: z.number().int().nonnegative(),
        withoutSpec: z.number().int().nonnegative(),
      })
      .optional(),
    /** Count of registered runtime handlers. */
    runtimeHandlerCount: z.number().int().nonnegative().optional(),
    /** Count of open substrate gaps. */
    substrateGapCount: z.number().int().nonnegative().optional(),
    /** Trigger that initiated the snapshot. */
    runTrigger: z.string().optional(),
  })
  .passthrough();

export type SubstrateStateSnapshotPayload = z.infer<typeof substrateStateSnapshotPayloadSchema>;

// ---------------------------------------------------------------------------
// GovernanceCyclePrep
//
// Emitted when a periodic governance-cycle preparation run completes.
// ---------------------------------------------------------------------------

export const governanceCyclePrepPayloadSchema = z
  .object({
    /** Count of open decisions awaiting CEO action. */
    decisionsOpen: z.number().int().nonnegative().optional(),
    /** Count of open governance seats. */
    openSeats: z.number().int().nonnegative().optional(),
    /** Count of decisions in the last 7 days. */
    recentDecisions7d: z.number().int().nonnegative().optional(),
    /** Trigger that initiated the prep. */
    runTrigger: z.string().optional(),
  })
  .passthrough();

export type GovernanceCyclePrepPayload = z.infer<typeof governanceCyclePrepPayloadSchema>;

// ---------------------------------------------------------------------------
// DataProjectionSnapshot
//
// Emitted when the dashboard-data projection cache is refreshed.
// ---------------------------------------------------------------------------

export const dataProjectionSnapshotPayloadSchema = z
  .object({
    /** Counts of key entities in the projection. */
    counts: z
      .object({
        principlesInClaudeMd: z.number().int().nonnegative().optional(),
        personaFiles: z.number().int().nonnegative().optional(),
        procedureFiles: z.number().int().nonnegative().optional(),
        obligationsRegisterRows: z.number().int().nonnegative().optional(),
        regulationsTotal: z.number().int().nonnegative().optional(),
        regulationsPopulated: z.number().int().nonnegative().optional(),
        ownerInboxFiles: z.number().int().nonnegative().optional(),
        teamInboxOpen: z.number().int().nonnegative().optional(),
        teamInboxActioned: z.number().int().nonnegative().optional(),
      })
      .passthrough()
      .optional(),
    /** Whether the cache was reachable. */
    cacheReachable: z.boolean().optional(),
    /** ISO-8601 timestamp of the cache's as-of date. */
    cacheAsOf: z.string().optional(),
    /** Count of drift items detected. */
    driftCount: z.number().int().nonnegative().optional(),
    /** Trigger that initiated the snapshot. */
    runTrigger: z.string().optional(),
  })
  .passthrough();

export type DataProjectionSnapshotPayload = z.infer<typeof dataProjectionSnapshotPayloadSchema>;

// ---------------------------------------------------------------------------
// InboxHygieneSweep
//
// Emitted after an inbox hygiene sweep run.
// ---------------------------------------------------------------------------

export const inboxHygieneSweepPayloadSchema = z
  .object({
    /** Count of open Team Inbox items. */
    teamInboxOpen: z.number().int().nonnegative().optional(),
    /** Count of actioned Team Inbox items. */
    teamInboxActioned: z.number().int().nonnegative().optional(),
    /** Count of Owner Inbox items. */
    ownerInboxCount: z.number().int().nonnegative().optional(),
    /** Count of items moved during the sweep. */
    moved: z.number().int().nonnegative().optional(),
    /** Count of items reported-only (not moved). */
    reportOnly: z.number().int().nonnegative().optional(),
    /** Trigger that initiated the sweep. */
    runTrigger: z.string().optional(),
  })
  .passthrough();

export type InboxHygieneSweepPayload = z.infer<typeof inboxHygieneSweepPayloadSchema>;

// ---------------------------------------------------------------------------
// ObligationsRegisterSnapshot
//
// Emitted when the obligations register is snapshotted.
// ---------------------------------------------------------------------------

export const obligationsRegisterSnapshotPayloadSchema = z
  .object({
    /** Total count of obligation rows. */
    obligationsCount: z.number().int().nonnegative().optional(),
    /** Count of regulator instrument rows. */
    regulatorInstrumentsCount: z.number().int().nonnegative().optional(),
    /** Count of populated (non-stub) regulator instruments. */
    regulatorInstrumentsPopulated: z.number().int().nonnegative().optional(),
    /** Trigger that initiated the snapshot. */
    runTrigger: z.string().optional(),
  })
  .passthrough();

export type ObligationsRegisterSnapshotPayload = z.infer<
  typeof obligationsRegisterSnapshotPayloadSchema
>;

// ---------------------------------------------------------------------------
// SecuritySubstrateSnapshot
//
// Emitted when the security posture is snapshotted.
// ---------------------------------------------------------------------------

export const securitySubstrateSnapshotPayloadSchema = z
  .object({
    /** Count of active CI security gates. */
    ciGates: z.number().int().nonnegative().optional(),
    /** Count of active recon pipelines. */
    reconPipelines: z.number().int().nonnegative().optional(),
    /** Count of threat models. */
    threatModels: z.number().int().nonnegative().optional(),
    /** Count of SBOMs registered. */
    sboms: z.number().int().nonnegative().optional(),
    /** Count of security incidents in last 7 days. */
    incidentsLast7d: z.number().int().nonnegative().optional(),
    /** Count of key rotations in last 7 days. */
    keyRotationsLast7d: z.number().int().nonnegative().optional(),
    /** Count of threat model decisions in last 7 days. */
    threatModelDecisionsLast7d: z.number().int().nonnegative().optional(),
    /** Trigger that initiated the snapshot. */
    runTrigger: z.string().optional(),
  })
  .passthrough();

export type SecuritySubstrateSnapshotPayload = z.infer<typeof securitySubstrateSnapshotPayloadSchema>;

// ---------------------------------------------------------------------------
// Typed event type registry for this module
// ---------------------------------------------------------------------------

export const GOVERNANCE_SNAPSHOTS_TYPED_EVENT_TYPES = [
  "CeoDecision",
  "ReconResult",
  "SubstrateStateSnapshot",
  "GovernanceCyclePrep",
  "DataProjectionSnapshot",
  "InboxHygieneSweep",
  "ObligationsRegisterSnapshot",
  "SecuritySubstrateSnapshot",
] as const;

export type GovernanceSnapshotsEventType = (typeof GOVERNANCE_SNAPSHOTS_TYPED_EVENT_TYPES)[number];
