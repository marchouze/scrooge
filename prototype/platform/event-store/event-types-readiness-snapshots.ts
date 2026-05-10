// platform/event-store/event-types-readiness-snapshots.ts
//
// Per-persona "readiness snapshot" event types. Each readiness handler
// emits a typed snapshot weekly capturing (a) the persona-owned
// obligations roll-up from `Regulations/_obligations-register.md` and
// (b) persona-specific operational metrics. The snapshots feed
// Saskia's pre-licence go-live readiness gate, Devon's operational-
// resilience digest, and Vera's audit-trail.
//
// Distinct from `event-types.ts` per Vera F-020 (god-file finding,
// Owner Inbox/2026-05-10_vera_codebase-quality-review.md). One schema
// per readiness type — payload shapes diverge by persona; sharing a
// single schema would force a `z.record(...)` payload bag that adds
// no validation value.
//
// **F-032 partial close.** This PR closes:
//   - MLROAttestation              (Zara)
//   - AccountingReadinessSnapshot  (Bea)
//   - AgentOpsReadinessSnapshot    (Sade)
//
// The remaining 14 warns are deliberately deferred to a follow-on PR.
// Each persona's payload diverges (different obligation breakdowns,
// different operational counters, different snake-camel mixing) and
// the careful work to typify them is best done in tight per-persona
// slices rather than in one mass migration.
//
// Citations: Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md;
// Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032, F-020).
//
// Author: Atlas (D-AGENT-RUNTIME-AUTHORIZE — runtime-substrate hygiene).

import { z } from "zod";

import { newEventId } from "../core/types";
import { type Actor, type Event, eventSchema } from "./types";

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

/**
 * Per-persona obligations-register roll-up. Several readiness snapshots
 * share this shape. Counts are non-negative integers.
 */
export const obligationsCountsSchema = z.object({
  total: z.number().int().nonnegative(),
  inForce: z.number().int().nonnegative(),
  partial: z.number().int().nonnegative(),
  planned: z.number().int().nonnegative(),
  drafting: z.number().int().nonnegative(),
  nAyet: z.number().int().nonnegative(),
});

export type ObligationsCounts = z.infer<typeof obligationsCountsSchema>;

const obligationsBreakdownFields = {
  obligationsInForce: z.number().int().nonnegative(),
  obligationsPartial: z.number().int().nonnegative(),
  obligationsPlanned: z.number().int().nonnegative(),
  obligationsDrafting: z.number().int().nonnegative(),
  obligationsNAyet: z.number().int().nonnegative(),
};

const readinessEnvelope = {
  runTrigger: z.string().min(1),
};

// ---------------------------------------------------------------------------
// MLROAttestation — Zara's weekly attestation
// ---------------------------------------------------------------------------

export const mlroAttestationPayloadSchema = z
  .object({
    zaraOwnedObligations: z.number().int().nonnegative(),
    ...obligationsBreakdownFields,
    miraSnapshotsLast7d: z.number().int().nonnegative(),
    miraCitationGatePassedLast7d: z.number().int().nonnegative(),
    miraCitationGateFailedLast7d: z.number().int().nonnegative(),
    miraAuditFindingsLast7d: z.number().int().nonnegative(),
    strCandidatesLast7d: z.number().int().nonnegative(),
    sanctionsHitsLast7d: z.number().int().nonnegative(),
    pepMatchesLast7d: z.number().int().nonnegative(),
    conductBreachesLast7d: z.number().int().nonnegative(),
    regulatorInquiriesLast7d: z.number().int().nonnegative(),
    rmcpVersionApproved: z.boolean(),
    sanctionsListLastRefreshed: z.string().min(1).nullable(),
    ...readinessEnvelope,
  })
  // Forward-compat: producer may add additional counters before the
  // schema is updated. Tolerate unknown keys at the type-bag level —
  // the recon's value is having the *known* keys typed.
  .passthrough();

export type MlroAttestationPayload = z.infer<typeof mlroAttestationPayloadSchema>;

export function makeMLROAttestation(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MlroAttestationPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MLROAttestation",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: mlroAttestationPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AccountingReadinessSnapshot — Bea's weekly readiness
// ---------------------------------------------------------------------------

export const accountingReadinessSnapshotPayloadSchema = z
  .object({
    cycleCount: z.number().int().nonnegative(),
    readinessReady: z.number().int().nonnegative(),
    readinessDrafting: z.number().int().nonnegative(),
    readinessSpecified: z.number().int().nonnegative(),
    readinessUnspecified: z.number().int().nonnegative(),
    beaOwnedObligations: z.number().int().nonnegative(),
    ...obligationsBreakdownFields,
    ...readinessEnvelope,
  })
  .passthrough();

export type AccountingReadinessSnapshotPayload = z.infer<
  typeof accountingReadinessSnapshotPayloadSchema
>;

export function makeAccountingReadinessSnapshot(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AccountingReadinessSnapshotPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AccountingReadinessSnapshot",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: accountingReadinessSnapshotPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentOpsReadinessSnapshot — Sade's weekly readiness
// ---------------------------------------------------------------------------

export const agentOpsReadinessSnapshotPayloadSchema = z
  .object({
    registeredAgents: z.number().int().nonnegative(),
    latestRegistrationAsOf: z.string().min(1).nullable(),
    sadeOwnedObligations: z.number().int().nonnegative(),
    ...obligationsBreakdownFields,
    ...readinessEnvelope,
  })
  .passthrough();

export type AgentOpsReadinessSnapshotPayload = z.infer<
  typeof agentOpsReadinessSnapshotPayloadSchema
>;

export function makeAgentOpsReadinessSnapshot(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentOpsReadinessSnapshotPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentOpsReadinessSnapshot",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentOpsReadinessSnapshotPayloadSchema.parse(args.payload),
  });
}
