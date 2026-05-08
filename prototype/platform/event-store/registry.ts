// platform/event-store/registry.ts
//
// A1 — Event-type registry.
//
// The single canonical authoring location for every event type the
// substrate emits or accepts. Closes the gap from A0 where event-type
// metadata (issuer, subscribers, replay rule, citation hint) lived only
// in `Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md` as
// prose. The freeze is the spec; this is the runtime substrate.
//
// What it does:
//   - Names every event type in one place.
//   - Holds the typed payload schema where one exists (today: 4 typed
//     events from event-types.ts; the rest are "envelope-only" and will
//     gain typed schemas as their producers wire up — see A0 §11 "What
//     this freeze does *not* do" — Zod schemas land per type as the
//     consumer needs the contract).
//   - Records the issuer, subscriber agents, replay-fold rule, and
//     citation-set hint per type. Atlas's permission-policy generator
//     (A2 work) will publish per-agent allow-lists from this matrix.
//   - Provides `validatePayload(type, payload)` that the EventStore's
//     append path calls to enforce the typed contract at the boundary.
//   - Validation is fail-open for unknown types (keeps build-phase
//     forward compat); fail-closed for known types whose schema rejects
//     the payload (loud, immediate).
//
// What it does NOT do (deferred):
//   - Cross-language schema export (Python/Java consumers don't exist).
//   - Schema-version migration runtime — A0 §8 says corrections land as
//     `…Corrected` events; this registry doesn't yet enumerate the
//     `…Corrected` shapes.
//   - Permission-policy publication — A2.
//
// Author: Atlas

import type { z } from "zod";

import {
  agentDecisionPayloadSchema,
  agentEscalationAcknowledgedPayloadSchema,
  agentEscalationDecidedPayloadSchema,
  agentEscalationDelegatedPayloadSchema,
  agentEscalationOverduePayloadSchema,
  agentEscalationPayloadSchema,
  agentRegisteredPayloadSchema,
  busDispatchedPayloadSchema,
  decisionCommentPayloadSchema,
  identityKeyRotatedPayloadSchema,
  legacyFanoutShadowedPayloadSchema,
  modelSubmittedPayloadSchema,
  modelTierClassifiedPayloadSchema,
  modelValidationApprovedPayloadSchema,
  modelValidationWithheldPayloadSchema,
  permissionPolicyPublishedPayloadSchema,
  riskRaisedPayloadSchema,
  scheduledTriggerPayloadSchema,
  substrateAlertPayloadSchema,
  validationFindingClosedPayloadSchema,
  validationFindingRaisedPayloadSchema,
  workstreamRegisteredPayloadSchema,
} from "./event-types";

/**
 * Replay-fold rule the substrate's projections obey for this event type.
 * Mirrors A0 freeze §6 ("folding rules").
 */
export type ReplayFold =
  /** Once present, fixes the projection; later events on the same subject
   * are recorded but don't change state. e.g. TradeMatured. */
  | "idempotent-terminal"
  /** Latest event with the same key supersedes earlier values; replay at
   * as-of < latest yields the earlier value. e.g. MarkToMarketObserved. */
  | "latest-wins-per-key"
  /** Projection accumulates the full sequence; value at as-of is the
   * fold of all events ≤ as-of. e.g. Reset, BarrierObservation. */
  | "cumulative-fold"
  /** Open-until-paired; projections track open/closed state. e.g.
   * AgentEscalation ↔ AgentEscalationDecided. */
  | "pair-coupled"
  /** Append-only audit observation; projections aggregate but don't
   * compute current-state. e.g. RiskRaised, AuditFinding. */
  | "append-only-audit";

export interface EventTypeMetadata {
  /** Canonical type name. Matches the `event.type` literal at append. */
  readonly type: string;
  /** Class — agent-runtime substrate or markets lifecycle. Mirrors A0 §4 / §5. */
  readonly class: "runtime" | "markets" | "governance" | "audit";
  /**
   * Zod schema for the payload, when one exists. When undefined the
   * append path validates only the envelope (event_id / type / as_of /
   * entity / actor / citations / payload-as-Record<string,unknown>) and
   * waits for the producer to land its typed schema.
   */
  readonly payloadSchema?: z.ZodType<Record<string, unknown>>;
  /**
   * Who emits this event. "any-agent" means any registered agent may
   * emit it (e.g. AgentEscalation). Specific agent names match the
   * /Team/<Name>.md persona file. "substrate" means the runtime emits
   * it without an agent in the loop (e.g. ScheduledTrigger).
   */
  readonly issuer: "any-agent" | "substrate" | string;
  /**
   * Agents (and "external" / "audit") that read this event type. Used by
   * Atlas's permission-policy generator (A2) to publish event-subscribe
   * allow-lists, and by Vera's audit pipelines to know what to expect.
   */
  readonly subscribers: readonly string[];
  /** Replay-fold rule this type's payload obeys (A0 §6). */
  readonly replay: ReplayFold;
  /**
   * Citation-set hint — a starter list of obligation URNs / governance
   * tokens the producer is expected to cite. Not enforced by this
   * registry (the P2 gate is content-of-citations agnostic; it just
   * requires non-empty); used as a documentation aid and as input to
   * Mira's URN-coverage recon.
   */
  readonly citationsHint?: readonly string[];
  /** Source-spec reference (A0 freeze entry, persona spec section, etc.). */
  readonly source: string;
}

// ---------------------------------------------------------------------------
// Registry — every event type the substrate currently knows about.
//
// Adding a new type: append a row here AND, if a payload schema exists,
// import it from the appropriate _schemas/ module. Vera's planned
// agent-spec-integrity recon (Wave-4 #10) will assert the registry stays
// in sync with each persona's §11 (Outputs) declared event types.
// ---------------------------------------------------------------------------

const RUNTIME_EVENT_TYPES: readonly EventTypeMetadata[] = [
  // The four typed events that already have Zod schemas.
  {
    type: "AgentEscalation",
    class: "runtime",
    payloadSchema: agentEscalationPayloadSchema,
    issuer: "any-agent",
    subscribers: ["overseer", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    source: "A0 freeze §4 #10",
  },
  {
    type: "AgentDecision",
    class: "runtime",
    payloadSchema: agentDecisionPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Vera", "Anya"],
    replay: "latest-wins-per-key",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    source: "A0 freeze §4 #9",
  },
  {
    type: "WorkstreamRegistered",
    class: "runtime",
    payloadSchema: workstreamRegisteredPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Anya", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    source: "A0 freeze (markets-side coordinator); Atlas runtime spec §11",
  },
  {
    type: "RiskRaised",
    class: "runtime",
    payloadSchema: riskRaisedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Helena", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    source: "Helena risk-cycle spec; Atlas substrate-state",
  },
  // The remaining 11 runtime types from A0 §4 — registered without
  // typed payload schemas yet. They flow today via the envelope-only
  // path; typed schemas land as producers need them.
  {
    type: "AgentRegistered",
    class: "runtime",
    payloadSchema: agentRegisteredPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Vera", "Anya", "Iris"],
    replay: "latest-wins-per-key",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-01"],
    source: "A0 freeze §4 #1; A1.1 registry — platform/agent-runtime/registry.ts",
  },
  {
    type: "AgentRetired",
    class: "runtime",
    issuer: "Atlas",
    subscribers: ["Vera", "Anya", "Iris"],
    replay: "latest-wins-per-key",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-01"],
    source: "A0 freeze §4 #2",
  },
  {
    type: "IdentityKeyRotated",
    class: "runtime",
    payloadSchema: identityKeyRotatedPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Senna", "Rashida"],
    replay: "latest-wins-per-key",
    citationsHint: ["ORG-CY-01", "ORG-CY-09", "ORG-PR-17"],
    source: "A0 freeze §4 #3; A1.2 issuer — platform/agent-identity/issuer.ts",
  },
  {
    type: "PermissionPolicyPublished",
    class: "runtime",
    payloadSchema: permissionPolicyPublishedPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Vera", "Senna"],
    replay: "latest-wins-per-key",
    citationsHint: ["ORG-CY-01", "ORG-CY-09"],
    source: "A0 freeze §4 #4; A1.2 policy — platform/agent-identity/permission-policy.ts",
  },
  {
    type: "ScheduledTrigger",
    class: "runtime",
    payloadSchema: scheduledTriggerPayloadSchema,
    issuer: "substrate",
    subscribers: ["target-agent", "Atlas", "Vera"],
    replay: "cumulative-fold",
    citationsHint: ["ORG-CY-01"],
    source: "A0 freeze §4 #5; A2.1 scheduler — platform/scheduler/scheduler.ts",
  },
  {
    type: "AgentRunStarted",
    class: "runtime",
    issuer: "substrate",
    subscribers: ["Vera", "Anya"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    source: "A0 freeze §4 #6",
  },
  {
    type: "AgentRunCompleted",
    class: "runtime",
    issuer: "substrate",
    subscribers: ["Vera", "Anya"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    source: "A0 freeze §4 #7",
  },
  {
    type: "AgentRunFailed",
    class: "runtime",
    issuer: "substrate",
    subscribers: ["Vera", "Devon"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-PR-17"],
    source: "A0 freeze §4 #8",
  },
  {
    type: "AgentEscalationAcknowledged",
    class: "runtime",
    payloadSchema: agentEscalationAcknowledgedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["issuing-agent"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    source: "A0 freeze §4 #11; A3.1 — platform/escalation/channel.ts",
  },
  {
    type: "AgentEscalationDecided",
    class: "runtime",
    payloadSchema: agentEscalationDecidedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["issuing-agent"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"],
    source: "A0 freeze §4 #12; A3.1 — platform/escalation/channel.ts",
  },
  {
    type: "AgentEscalationDelegated",
    class: "runtime",
    payloadSchema: agentEscalationDelegatedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["overseer-chain"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    source: "A0 freeze §4 #13; A3.1 — platform/escalation/channel.ts",
  },
  {
    type: "AgentEscalationOverdue",
    class: "runtime",
    payloadSchema: agentEscalationOverduePayloadSchema,
    issuer: "substrate",
    subscribers: ["Vera", "governance-chain"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-04"],
    source: "A0 freeze §4 #14; A3.1 — platform/escalation/channel.ts",
  },
  {
    type: "SubstrateAlert",
    class: "runtime",
    payloadSchema: substrateAlertPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Devon", "Atlas", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["ORG-CY-01", "ORG-PR-18"],
    source: "A0 freeze §4 #15; A2.1 scheduler — platform/scheduler/scheduler.ts",
  },
  {
    type: "BusDispatched",
    class: "runtime",
    payloadSchema: busDispatchedPayloadSchema,
    issuer: "substrate",
    subscribers: ["Atlas", "Vera"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-01"],
    source: "Atlas runtime spec §3.3; A2.2 bus — platform/event-trigger-bus/bus.ts",
  },
  {
    // Short-lived event introduced for D-A22-RETIRE-LEGACY Phase 1
    // (bus-canonical, legacy-shadow). The legacy in-process fan-out
    // emits this per (parent run, triggered handler key) row instead
    // of invoking the handler. Phase 2 deletes both the legacy
    // fan-out and this event type. Vera's Wave-4 #13b
    // parallel-dispatch-divergence pipeline reconciles
    // LegacyFanoutShadowed against BusDispatched during Phase 1.
    type: "LegacyFanoutShadowed",
    class: "runtime",
    payloadSchema: legacyFanoutShadowedPayloadSchema,
    issuer: "substrate",
    subscribers: ["Atlas", "Vera"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-01"],
    source:
      "Owner Inbox/2026-05-09_atlas_a22-dispatcher-retire-legacy-spec.md §3.1; D-A22-RETIRE-LEGACY Phase 1",
  },
];

// Model-registry event types. The skeleton lives in
// `platform/model-registry/registry.ts`; co-curated by Rohan (submits)
// and Nadia (validates). See `Team/Nadia.md` §11 / §12 / §15 for the
// independence boundary; `Team/Rohan.md` §11 for the model-builder side.
const MODEL_REGISTRY_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "ModelSubmitted",
    class: "runtime",
    payloadSchema: modelSubmittedPayloadSchema,
    issuer: "Rohan",
    subscribers: ["Nadia", "Helena", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["RAS-B7", "SR-11-7"],
    source: "Team/Nadia.md §11; Team/Rohan.md §11; platform/model-registry/registry.ts",
  },
  {
    type: "ModelTierClassified",
    class: "runtime",
    payloadSchema: modelTierClassifiedPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["RAS-B7", "SR-11-7"],
    source: "Team/Nadia.md §9; platform/model-registry/registry.ts",
  },
  {
    type: "ModelValidationApproved",
    class: "runtime",
    payloadSchema: modelValidationApprovedPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera", "Camille"],
    replay: "latest-wins-per-key",
    citationsHint: ["RAS-B7", "SR-11-7", "SS-1-23"],
    source: "Team/Nadia.md §9; platform/model-registry/registry.ts",
  },
  {
    type: "ModelValidationWithheld",
    class: "runtime",
    payloadSchema: modelValidationWithheldPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["RAS-B7", "SR-11-7", "SS-1-23"],
    source: "Team/Nadia.md §9; platform/model-registry/registry.ts",
  },
  {
    type: "ValidationFindingRaised",
    class: "runtime",
    payloadSchema: validationFindingRaisedPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "cumulative-fold",
    citationsHint: ["SR-11-7", "SS-1-23"],
    source: "Team/Nadia.md §9; platform/model-registry/registry.ts",
  },
  {
    type: "ValidationFindingClosed",
    class: "runtime",
    payloadSchema: validationFindingClosedPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["SR-11-7", "SS-1-23"],
    source: "Team/Nadia.md §9; platform/model-registry/registry.ts",
  },
];

// Markets lifecycle event types from A0 §5. Today only TradeExecuted
// is registered; the remaining 23 land as Kai's M4 / M5 work and the
// other product families (M1 listed equity, M2 SAGB, M3 corporate
// bonds, M5 IRS) build out.
//
// Per-product variants of these payloads live under
// `platform/markets/cdm/events/` (e.g. TradeExecuted-FxSpot.ts).
// `payloadSchema` here is left undefined because the registry holds
// one schema per type and these events are polymorphic on the
// embedded `contract` shape — the per-product variant validates at
// the factory, and Vera's planned cross-validator (Wave-4) will
// reconcile the registry view to the per-variant schemas.
const MARKETS_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "TradeExecuted",
    class: "markets",
    issuer: "any-agent",
    subscribers: ["Position", "Bea", "Rohan", "Mira", "Tomas"],
    replay: "latest-wins-per-key",
    citationsHint: ["JSE-RULES-EQUITIES", "FMA-S5", "ORG-FC-13"],
    source: "A0 freeze §5 #2; per-product variants in platform/markets/cdm/events/",
  },
];

// Governance / audit / observation event types currently in flight.
// These predate A0 (already emitted by handlers); registered here for
// completeness so the registry covers what the event store actually
// contains.
const GOVERNANCE_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "CeoDecision",
    class: "governance",
    issuer: "human",
    subscribers: ["Owen", "dashboard", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"],
    source: "Procedures/by-policy/ceo-decision-review.md",
  },
  {
    type: "WorkstreamStarted",
    class: "governance",
    issuer: "any-agent",
    subscribers: ["dashboard"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    source: "Workstream lifecycle (pre-A0)",
  },
  {
    type: "WorkstreamCompleted",
    class: "governance",
    issuer: "any-agent",
    subscribers: ["dashboard"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    source: "Workstream lifecycle (pre-A0)",
  },
];

const AUDIT_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "AuditFinding",
    class: "audit",
    issuer: "any-agent",
    subscribers: ["Thandiwe", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    source: "Vera continuous-controls programme; Mira citation-gate",
  },
  {
    type: "ReconResult",
    class: "audit",
    issuer: "Vera",
    subscribers: ["Thandiwe", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    source: "platform/recon/types.ts",
  },
  {
    type: "CitationGatePassed",
    class: "audit",
    issuer: "Mira",
    subscribers: ["Thandiwe", "Vera"],
    replay: "append-only-audit",
    citationsHint: ["P2-CITATION-DISCIPLINE", "FIC-ACT-38-2001"],
    source: "runtime/agents/mira-citation-gate.ts",
  },
  {
    type: "CitationGateFailed",
    class: "audit",
    issuer: "Mira",
    subscribers: ["Thandiwe", "Vera", "Atlas"],
    replay: "append-only-audit",
    citationsHint: ["P2-CITATION-DISCIPLINE", "FIC-ACT-38-2001"],
    source: "runtime/agents/mira-citation-gate.ts",
  },
  {
    type: "SubstrateStateSnapshot",
    class: "runtime",
    issuer: "Atlas",
    subscribers: ["Devon", "dashboard", "Anya"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    source: "runtime/agents/atlas-substrate-state.ts",
  },
  {
    type: "DashboardProjectionRefreshed",
    class: "audit",
    issuer: "Anya",
    subscribers: ["Atlas", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    source: "runtime/agents/anya-projection-refresh.ts",
  },
  {
    type: "DataProjectionSnapshot",
    class: "audit",
    issuer: "Anya",
    subscribers: ["Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    source: "runtime/agents/anya-projection-drift.ts",
  },
  {
    type: "DecisionComment",
    class: "governance",
    payloadSchema: decisionCommentPayloadSchema,
    issuer: "any-agent",
    subscribers: ["dashboard"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    source: "dashboard decision-comments thread (Phase 1 slice 2)",
  },
  {
    type: "GovernanceCyclePrep",
    class: "governance",
    issuer: "Owen",
    subscribers: ["dashboard"],
    replay: "append-only-audit",
    citationsHint: ["COMPANIES-ACT-71-2008", "GOV-FRAMEWORK-CEO-RESERVED"],
    source: "runtime/agents/owen-governance-cycle-prep.ts",
  },
  {
    type: "ObligationsRegisterSnapshot",
    class: "governance",
    issuer: "Mira",
    subscribers: ["Zara", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["FIC-ACT-38-2001", "FAIS-ACT-37-2002", "BANKS-ACT-94-1990"],
    source: "runtime/agents/mira-obligations-snapshot.ts",
  },
  {
    type: "SecuritySubstrateSnapshot",
    class: "audit",
    issuer: "Senna",
    subscribers: ["Rashida", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["JOINT-STANDARD-1-2024", "POPIA-S19-22"],
    source: "runtime/agents/senna-security-substrate-state.ts",
  },
  {
    type: "InboxHygieneSweep",
    class: "audit",
    issuer: "Scrooge",
    subscribers: ["dashboard"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    source: "runtime/agents/scrooge-inbox-hygiene.ts",
  },
];

/**
 * Full registry — flat list. Keep RUNTIME / GOVERNANCE / AUDIT split
 * above for readability; the consumer-facing surface is this combined
 * array.
 */
export const EVENT_TYPE_REGISTRY: readonly EventTypeMetadata[] = [
  ...RUNTIME_EVENT_TYPES,
  ...MODEL_REGISTRY_EVENT_TYPES,
  ...MARKETS_EVENT_TYPES,
  ...GOVERNANCE_EVENT_TYPES,
  ...AUDIT_EVENT_TYPES,
];

const REGISTRY_BY_TYPE: ReadonlyMap<string, EventTypeMetadata> = new Map(
  EVENT_TYPE_REGISTRY.map((m) => [m.type, m]),
);

/**
 * Look up a type's registered metadata. Returns undefined for types
 * that aren't in the registry (which is fine in build phase — the
 * envelope-only path still validates and appends them).
 */
export function lookupEventType(type: string): EventTypeMetadata | undefined {
  return REGISTRY_BY_TYPE.get(type);
}

/**
 * Validate a payload against the registered schema for `type`.
 *
 * Behaviour:
 *   - Type registered with payloadSchema → schema.parse() throws on bad
 *     payload (caller propagates as append failure).
 *   - Type registered without payloadSchema → no-op (envelope-only).
 *   - Type not in registry → no-op (build-phase forward compat). Will
 *     tighten to fail-closed once Vera's #11 / #12 pipelines assert
 *     the registry is complete.
 *
 * The top-level `eventSchema` envelope is validated separately by the
 * EventStore's append; this is the type-dispatched layer on top.
 */
export function validatePayload(type: string, payload: Record<string, unknown>): void {
  const meta = REGISTRY_BY_TYPE.get(type);
  if (!meta || !meta.payloadSchema) return;
  meta.payloadSchema.parse(payload);
}

/**
 * Issuer/subscriber matrix view — used by the dashboard health page,
 * Atlas's permission-policy generator (A2), and Vera's coverage recon.
 *
 * Returns an array of {issuer, eventTypes} groups. Stable sort: issuer
 * name then event-type name.
 */
export function issuerMatrix(): ReadonlyArray<{
  readonly issuer: string;
  readonly eventTypes: readonly string[];
}> {
  const grouped = new Map<string, string[]>();
  for (const m of EVENT_TYPE_REGISTRY) {
    const arr = grouped.get(m.issuer) ?? [];
    arr.push(m.type);
    grouped.set(m.issuer, arr);
  }
  return [...grouped.entries()]
    .map(([issuer, eventTypes]) => ({ issuer, eventTypes: eventTypes.slice().sort() }))
    .sort((a, b) => a.issuer.localeCompare(b.issuer));
}

/**
 * Per-subscriber view — every event type a given subscriber agent (or
 * "external" / "audit" / "dashboard") consumes. Symmetric to
 * issuerMatrix(); needed for permission-policy event-subscribe
 * allow-lists.
 */
export function subscriberMatrix(): ReadonlyArray<{
  readonly subscriber: string;
  readonly eventTypes: readonly string[];
}> {
  const grouped = new Map<string, string[]>();
  for (const m of EVENT_TYPE_REGISTRY) {
    for (const s of m.subscribers) {
      const arr = grouped.get(s) ?? [];
      arr.push(m.type);
      grouped.set(s, arr);
    }
  }
  return [...grouped.entries()]
    .map(([subscriber, eventTypes]) => ({ subscriber, eventTypes: eventTypes.slice().sort() }))
    .sort((a, b) => a.subscriber.localeCompare(b.subscriber));
}
