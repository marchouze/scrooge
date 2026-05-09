// platform/event-store/event-types.ts
//
// Typed event-payload schemas. Closes Atlas substrate-gap #2:
// AgentEscalation, AgentDecision, WorkstreamRegistered, RiskRaised
// previously had no schema, so consumers (Vera pipelines #14/#15, the
// dashboard's curated-seed retirement) were gated on the substrate
// existing.
//
// Convention:
//   - Each event type has a Zod schema for its payload, exported as
//     `<type>PayloadSchema`.
//   - Each has a typed factory `make<Type>` that takes the payload + the
//     usual envelope fields (event_id, as_of, entity, actor, citations)
//     and returns a fully-validated `Event`.
//   - The base envelope still validates via `eventSchema`; the per-type
//     schema is layered on top, so a payload that fails its type schema
//     fails *before* the event hits the store.
//
// Other event types (CeoDecision, WorkstreamCompleted, WorkstreamStarted,
// SubstrateStateSnapshot, ReconResult, AuditFinding, etc.) currently
// remain string-typed; we add typed schemas for them when there is a
// reason — a new consumer or a recon-pipeline assertion that benefits
// from compile-time guarantees.
//
// Author: Atlas

import { z } from "zod";

import { newEventId } from "../core/types";
import { type Actor, type Event, eventSchema } from "./types";

// ---------------------------------------------------------------------------
// AgentEscalation
//
// Emitted when an agent encounters a decision it is *not* in scope to make
// autonomously and routes the question to a human (today: Marc as CEO,
// via Scrooge). Vera pipeline #14 reconciles AgentEscalation events to
// resolved decisions in the dashboard registry — escalations without a
// matching CEO decision are reportable findings.
// ---------------------------------------------------------------------------

export const agentEscalationPayloadSchema = z.object({
  /**
   * Stable ID for this escalation. Resolves to a CeoDecision event when
   * the human responds. Convention: `escalation:<agent>:<short-slug>`.
   */
  escalationId: z.string().min(1),
  /** Agent that raised the escalation (matches /Team/<Name>.md). */
  raisedBy: z.string().min(1),
  /** One-line description of what's being escalated. */
  question: z.string().min(1),
  /** Options the agent considered. Empty array = "no options enumerated". */
  options: z.array(z.string()),
  /** Why the agent could not decide autonomously. */
  blockedBy: z.string().min(1),
  /** ISO 8601 deadline by which a decision is needed, or undefined for "no deadline". */
  deadline: z.string().optional(),
  /** Severity hint for routing. */
  severity: z.enum(["low", "medium", "high", "blocking"]),
  /**
   * Who the agent is escalating to. Today this is always `human:marc@tgv.co.za`
   * (the CEO). A future Board AC adds `human:board-ac` etc.
   */
  routedTo: z.string().min(1),
  /**
   * Optional confidentiality wrapper (Atlas substrate spec §3.5). When
   * set, the escalation channel overrides `routedTo` with the seat list
   * mandated by the reason — `fraud` routes to CAE+CEO+CoSec,
   * `whistleblowing` to CAE only, `popia-incident` to IO+CEO. The
   * channel records the resolved routing in this same payload so the
   * audit trail captures both the seal and the routing.
   */
  sealed: z
    .object({
      reason: z.enum(["fraud", "whistleblowing", "popia-incident"]),
    })
    .optional(),
});

export type AgentEscalationPayload = z.infer<typeof agentEscalationPayloadSchema>;

export function makeAgentEscalation(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentEscalationPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentEscalation",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentEscalationPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentEscalationAcknowledged
//
// Emitted when an overseer (human or delegated agent) signals "I see this
// escalation". Acknowledgement does NOT resolve the escalation — it just
// marks that the routing landed and a responsible party has eyes on it.
// Multiple acknowledgements are permitted (a CEO may acknowledge before a
// CoSec acknowledges), so the channel never enforces a single-ack
// invariant.
//
// Atlas substrate spec §3.5; A0 freeze §4 #11.
// ---------------------------------------------------------------------------

export const agentEscalationAcknowledgedPayloadSchema = z.object({
  /** Matches the `escalationId` of the AgentEscalation being acknowledged. */
  escalationId: z.string().min(1),
  /** Strong identity of the acknowledger. Convention: `human:<email>` or `agent:<name>`. */
  acknowledgedBy: z.string().min(1),
  /** ISO 8601 timestamp at which the overseer signalled acknowledgement. */
  acknowledgedAt: z.string().min(1),
});

export type AgentEscalationAcknowledgedPayload = z.infer<
  typeof agentEscalationAcknowledgedPayloadSchema
>;

export function makeAgentEscalationAcknowledged(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentEscalationAcknowledgedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentEscalationAcknowledged",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentEscalationAcknowledgedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentEscalationDecided
//
// Terminal lifecycle event for an escalation. The overseer chose one of
// the options the issuing agent enumerated (or, when `options` was empty,
// declared a free-form decision). Per Atlas spec §3.5, the issuing agent's
// next run consumes this event; Vera Wave-4 #14 reconciles open
// AgentEscalation events to their AgentEscalationDecided counterpart.
//
// Channel-level invariant: at most one Decided per escalationId. A second
// Decided is a substrate-integrity finding (the channel emits a
// SubstrateAlert with alertClass: integrity).
// ---------------------------------------------------------------------------

export const agentEscalationDecidedPayloadSchema = z.object({
  /** Matches the `escalationId` of the AgentEscalation being resolved. */
  escalationId: z.string().min(1),
  /** Strong identity of the deciding overseer. `human:<email>` or `agent:<name>`. */
  decidedBy: z.string().min(1),
  /**
   * Option chosen. When the originating AgentEscalation enumerated
   * options, this must match one of them; the channel enforces that
   * check at decide time. When the AgentEscalation had an empty options
   * array, any non-empty string is accepted.
   */
  chosenOption: z.string().min(1),
  /** Why this option, in the overseer's voice. */
  rationale: z.string().min(1),
});

export type AgentEscalationDecidedPayload = z.infer<typeof agentEscalationDecidedPayloadSchema>;

export function makeAgentEscalationDecided(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentEscalationDecidedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentEscalationDecided",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentEscalationDecidedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentEscalationDelegated
//
// Overseer A reassigns the escalation to overseer B. Multiple
// delegations are permitted (a chain of reassignment); the most recent
// delegation determines the current responsible overseer. Delegation does
// NOT resolve the escalation — the deadline still applies, and a
// subsequent AgentEscalationDecided is still required.
//
// Atlas substrate spec §3.5; A0 freeze §4 #13.
// ---------------------------------------------------------------------------

export const agentEscalationDelegatedPayloadSchema = z.object({
  /** Matches the `escalationId` of the AgentEscalation being delegated. */
  escalationId: z.string().min(1),
  /** Strong identity of the overseer who is delegating. `human:<email>` or `agent:<name>`. */
  delegatedBy: z.string().min(1),
  /** Strong identity of the new responsible overseer. */
  delegatedTo: z.string().min(1),
  /** Why the original overseer is reassigning. */
  reason: z.string().min(1),
});

export type AgentEscalationDelegatedPayload = z.infer<typeof agentEscalationDelegatedPayloadSchema>;

export function makeAgentEscalationDelegated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentEscalationDelegatedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentEscalationDelegated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentEscalationDelegatedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentEscalationOverdue
//
// Substrate-emitted (not agent-emitted) when a channel sweep observes an
// open AgentEscalation past its declared deadline that has no matching
// AgentEscalationDecided / AgentEscalationDelegated yet. The channel
// emits at most one Overdue per escalationId — a second sweep is a
// no-op (idempotent).
//
// `escalatedTo` records the human or agent the substrate routed the
// overdue notice to. Today this defaults to `human:marc@tgv.co.za` (Marc
// wears every governance hat in the build phase); future: read the
// issuing agent's reports-to chain from the persona spec.
//
// Atlas substrate spec §3.5; A0 freeze §4 #14.
// ---------------------------------------------------------------------------

export const agentEscalationOverduePayloadSchema = z.object({
  /** Matches the `escalationId` of the AgentEscalation that missed its deadline. */
  escalationId: z.string().min(1),
  /** ISO 8601 — the deadline that was missed. */
  deadline: z.string().min(1),
  /** ISO 8601 — when the substrate observed the miss. */
  detectedAt: z.string().min(1),
  /** Where the overdue notice was routed. `human:<email>` or `agent:<name>`. */
  escalatedTo: z.string().min(1),
});

export type AgentEscalationOverduePayload = z.infer<typeof agentEscalationOverduePayloadSchema>;

export function makeAgentEscalationOverdue(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentEscalationOverduePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentEscalationOverdue",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentEscalationOverduePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentDecision
//
// Emitted when an agent makes a decision *in scope* per its operating spec
// (i.e. autonomously). Distinct from CeoDecision (which records a human
// decision). Vera pipeline #15 reconciles AgentDecision events to the
// agent's declared decision-scope: an AgentDecision outside scope is a
// reportable finding (procedure violation under Principle 6).
// ---------------------------------------------------------------------------

export const agentDecisionPayloadSchema = z.object({
  /** Stable ID for this decision. Convention: `decision:<agent>:<short-slug>`. */
  decisionId: z.string().min(1),
  /** Agent that decided (matches /Team/<Name>.md). */
  decidedBy: z.string().min(1),
  /** One-line description of the decision. */
  what: z.string().min(1),
  /** The decision-scope clause from the agent's operating spec that authorises this. */
  inScopeBy: z.string().min(1),
  /** Options the agent considered. */
  options: z.array(z.string()),
  /** The option chosen (must be one of `options` if `options` is non-empty). */
  chosen: z.string().min(1),
  /** Why this option vs the alternatives. */
  rationale: z.string().min(1),
});

export type AgentDecisionPayload = z.infer<typeof agentDecisionPayloadSchema>;

export function makeAgentDecision(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentDecisionPayload;
  eventId?: string;
}): Event {
  const payload = agentDecisionPayloadSchema.parse(args.payload);
  if (payload.options.length > 0 && !payload.options.includes(payload.chosen)) {
    throw new Error(
      `AgentDecision: chosen "${payload.chosen}" is not in options [${payload.options.join(", ")}]`,
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentDecision",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload,
  });
}

// ---------------------------------------------------------------------------
// WorkstreamRegistered
//
// Emitted when a new workstream enters the bank's registry. Pairs with
// the existing WorkstreamStarted / WorkstreamCompleted shape: registered
// is "the workstream exists in the plan"; started is "work has begun";
// completed is "the deliverable shipped".
//
// Closes the dashboard's curated-seed retirement gate: today the curated
// seed lists planned workstreams in prose; once Registered events flow,
// the dashboard can derive the workstream list from the event stream and
// retire the prose seed.
// ---------------------------------------------------------------------------

export const workstreamRegisteredPayloadSchema = z.object({
  /** Stable ID. Convention: `workstream:<short-slug>` (e.g. `workstream:fsca-odp-readiness`). */
  workstreamId: z.string().min(1),
  /** Human-readable title. */
  title: z.string().min(1),
  /** Owning agent (matches /Team/<Name>.md). */
  owner: z.string().min(1),
  /**
   * Optional citation to a /Owner Inbox/ deliverable that scoped the
   * workstream (e.g. a CEO decision brief or an architecture note).
   */
  scopedBy: z.string().optional(),
  /**
   * Status at registration. Most workstreams enter `planned`; a few
   * register simultaneously with starting (`in-flight`).
   */
  status: z.enum(["planned", "in-flight", "blocked"]),
  /** Free-form one-line summary. */
  summary: z.string().min(1),
});

export type WorkstreamRegisteredPayload = z.infer<typeof workstreamRegisteredPayloadSchema>;

export function makeWorkstreamRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: WorkstreamRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "WorkstreamRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: workstreamRegisteredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RiskRaised
//
// Emitted when any pipeline (Vera recon, Senna threat-model, Rohan limit
// breach, Helena RAS appetite touch, etc.) identifies a risk. Distinct
// from `AuditFinding` (which is a procedural finding, not a risk) and
// from `SecurityIncidentRaised` (which is an actualised security event,
// not a forward risk). The risk taxonomy is Helena's domain; Vera
// pipeline #14 uses RiskRaised as input to risk-cycle reconciliation.
// ---------------------------------------------------------------------------

export const riskRaisedPayloadSchema = z.object({
  /** Stable ID. Convention: `risk:<agent>:<short-slug>`. */
  riskId: z.string().min(1),
  /** Agent that raised it. */
  raisedBy: z.string().min(1),
  /** One-line description. */
  description: z.string().min(1),
  /**
   * Risk category in Helena's risk taxonomy. The taxonomy itself is
   * authored at `Owner Inbox/2026-05-06_policy-register.md` and the
   * detailed RAS bundle; we accept a free-form string here and let
   * Vera's pipeline reconcile to the canonical taxonomy.
   */
  category: z.string().min(1),
  /** Inherent severity assessment. */
  severity: z.enum(["low", "medium", "high", "critical"]),
  /** Inherent likelihood assessment. */
  likelihood: z.enum(["unlikely", "possible", "likely", "almost-certain"]),
  /**
   * Mitigation status at point of raising. `none` means no mitigation
   * exists; `partial` means a mitigation exists but residual is non-zero;
   * `accepted` means the residual is within appetite.
   */
  mitigation: z.enum(["none", "partial", "accepted"]),
  /** Optional pointer to the procedure / policy / control the risk relates to. */
  relatedTo: z.string().optional(),
});

export type RiskRaisedPayload = z.infer<typeof riskRaisedPayloadSchema>;

export function makeRiskRaised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RiskRaisedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RiskRaised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: riskRaisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentRegistered
//
// Emitted when Atlas's registry component validates a `/Team/<Name>.md`
// agent operating spec and admits the agent into the runtime fleet
// (Principle 7; Atlas substrate spec §3.1, §4 row #1). The runtime's
// authoritative state is the event log — `AgentRegistry.list()` and
// `lookup()` are queries that fold this stream.
//
// Replay-fold rule: latest-wins-per-key, keyed on `agentUrn`. A second
// AgentRegistered with the same urn but a different specHash supersedes
// the prior; identical specHash on re-registration is a no-op (the
// registry is idempotent — see `prototype/platform/agent-runtime/registry.ts`).
//
// Subscribers: Vera (Wave-4 #10 agent-spec-integrity), Anya (semantic
// layer + dashboard projections), Iris (POPIA — agent-as-actor records).
// ---------------------------------------------------------------------------

export const agentRegisteredPayloadSchema = z.object({
  /** Stable URN: `agent:<lowercased-persona-name>`. The registry's primary key. */
  agentUrn: z
    .string()
    .min(1)
    .regex(/^agent:[a-z0-9-]+$/, {
      message: "agentUrn must be `agent:<lowercased-persona-name>` (a-z, 0-9, -)",
    }),
  /** Persona name as it appears on /Team/<Name>.md (mixed-case allowed). */
  personaName: z.string().min(1),
  /**
   * Governance-line owner per spec §1 ("Reports to"). Free-form because
   * personas express this differently (e.g. "Devon (COO)" vs "CEO (Marc),
   * with direct line of access to the Board Risk Committee"); the
   * structured top-of-house mapping is in CLAUDE.md and reconciled by
   * Vera Wave-4 #10.
   */
  reportsTo: z.string().min(1),
  /** Free-text summary of §6 (Cadence) — typically the "Mode:" line. */
  cadenceMode: z.string().min(1),
  /** Number of trigger rows the agent declares in §7. */
  triggerCount: z.number().int().nonnegative(),
  /** Number of decision rows the agent declares in §9 (its authority surface). */
  decisionsInScopeCount: z.number().int().nonnegative(),
  /** Number of escalation rows the agent declares in §10. */
  decisionsEscalateCount: z.number().int().nonnegative(),
  /**
   * `@platform/<x>` capability tokens parsed from §12. Used by Atlas's
   * permission-policy generator (A2) to derive capability allow-lists,
   * and by Vera Wave-5 to assert no capability-creep.
   */
  systemCapabilities: z.array(z.string().min(1)),
  /**
   * Typed event names parsed from §11 ("Events emitted"). The
   * runtime's emit-allow-list is derived from this; cross-referenced by
   * Vera against the event-type registry (`platform/event-store/registry.ts`).
   */
  eventsEmitted: z.array(z.string().min(1)),
  /** Procedure paths parsed from §13. Reconciled to `/Procedures/_index.md`. */
  proceduresOwned: z.array(z.string().min(1)),
  /**
   * Spec version from §17's first change-log row, or `v1.0` when the
   * change log is absent / unparseable. The bump rule is the persona's
   * own convention; the registry only uses this for human display.
   */
  specVersion: z.string().min(1),
  /**
   * SHA-256 of the persona file's raw contents at registration time.
   * The registry's idempotency check compares this against the current
   * latest-wins value — equal hash → no-op; different hash → new event.
   */
  specHash: z
    .string()
    .min(1)
    .regex(/^[0-9a-f]{64}$/, {
      message: "specHash must be a lowercase hex sha256 (64 chars)",
    }),
});

export type AgentRegisteredPayload = z.infer<typeof agentRegisteredPayloadSchema>;

export function makeAgentRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentRegisteredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// DecisionComment
//
// Append-only thread of comments / notes on a decisionId. Used for the
// dashboard's per-decision discussion surface. Author can be a human
// (`human:<email>`) or an agent (`agent:<name>`); the actor field on
// the event envelope carries the strong identity, the payload carries
// the human-readable display name and threading metadata.
//
// No edit / delete in V1 — append-only audit. Corrections land as a
// new comment that references the original via inReplyToEventId.
// ---------------------------------------------------------------------------

export const decisionCommentPayloadSchema = z.object({
  /** The decision being commented on. Must match an existing decisionId. */
  decisionId: z.string().min(1),
  /** Display name of the author (e.g. "Marc", "Atlas", "Vera"). The actor envelope is the strong identity. */
  author: z.string().min(1),
  /** Comment body. Markdown allowed. */
  body: z.string().min(1),
  /** Optional event_id of a parent comment, for threaded replies. */
  inReplyToEventId: z.string().optional(),
});

export type DecisionCommentPayload = z.infer<typeof decisionCommentPayloadSchema>;

export function makeDecisionComment(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DecisionCommentPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DecisionComment",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: decisionCommentPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ScheduledTrigger
//
// Emitted by the scheduler substrate (A2.1; Atlas spec §3.2, §4 row #5)
// when a registered agent's cron schedule is due. Carries observability
// metadata (delayMs) so downstream consumers (Atlas substrate-state,
// Vera Wave-4 #13 inactivity reconciliation) can surface scheduler
// drift without inspecting wall-clock differences themselves.
//
// Today the scheduler emits the event but does NOT dispatch the agent
// handler — the GH Actions cron files keep the dispatch responsibility
// during A2.1; A2.2 brings the in-process bus that fans events to
// handlers. ScheduledTrigger events are therefore an audit-trail record
// + a stepping stone for A2.2.
// ---------------------------------------------------------------------------

export const scheduledTriggerPayloadSchema = z.object({
  /** URN of the agent whose schedule fired. Matches A1.1's AgentUrn. */
  agentUrn: z
    .string()
    .min(1)
    .regex(/^agent:[a-z0-9-]+$/, {
      message: "agentUrn must be `agent:<lowercased-persona-name>` (a-z, 0-9, -)",
    }),
  /**
   * Trigger id from the persona spec § 7. Today derived from the
   * `runtime/handlers-metadata.ts` (agent, trigger) key — the spec's §7
   * trigger column is free-text, so the metadata key is canonical.
   */
  triggerId: z.string().min(1),
  /** Cron expression that produced this fire time. */
  cronExpression: z.string().min(1),
  /** ISO 8601 — the cron-due timestamp the scheduler computed. */
  scheduledFor: z.string().min(1),
  /** ISO 8601 — when the scheduler actually emitted the event. */
  firedAt: z.string().min(1),
  /** firedAt - scheduledFor in milliseconds; for observability. May be 0. */
  delayMs: z.number().int().nonnegative(),
  /** P5 — calendar context (e.g. "ZA"). */
  jurisdiction: z.string().min(1),
  /**
   * If a holiday-skip shifted the cron-due timestamp, the original
   * unshifted timestamp. Undefined when no shift happened.
   */
  holidayShiftedFrom: z.string().optional(),
});

export type ScheduledTriggerPayload = z.infer<typeof scheduledTriggerPayloadSchema>;

export function makeScheduledTrigger(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ScheduledTriggerPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ScheduledTrigger",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: scheduledTriggerPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SubstrateAlert
//
// Emitted by the substrate (Atlas / scheduler / event-trigger bus) when
// a runtime invariant is breached: an inactivity SLA elapses without
// the expected event, a per-agent capacity threshold trips, a latency
// budget burns through, or an integrity check (e.g. spec-hash drift)
// fails.
//
// Atlas spec §4 row #15 names the type; A2.1 adds the typed payload so
// the scheduler's inactivity-SLA emitter has a strong contract.
// Subscribers: Devon (operational resilience), Atlas (substrate-state
// rollup), Vera (Wave-4 #13 — inactivity-reconciliation).
// ---------------------------------------------------------------------------

export const substrateAlertPayloadSchema = z.object({
  /** Stable id; convention: `alert:<class>:<short-slug>`. */
  alertId: z
    .string()
    .min(1)
    .regex(/^alert:[a-z]+:[a-z0-9-]+$/, {
      message: "alertId must match `alert:<class>:<short-slug>` (a-z, 0-9, -)",
    }),
  /** Alert classification. Drives routing + dashboard grouping. */
  alertClass: z.enum(["inactivity", "capacity", "latency", "integrity"]),
  /** When the alert is agent-scoped, the URN of the affected agent. */
  agentUrn: z.string().optional(),
  /** Human-readable description of what tripped. */
  details: z.string().min(1),
  /** Severity hint for routing. */
  severity: z.enum(["low", "medium", "high"]),
});

export type SubstrateAlertPayload = z.infer<typeof substrateAlertPayloadSchema>;

export function makeSubstrateAlert(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SubstrateAlertPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SubstrateAlert",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: substrateAlertPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IdentityKeyRotated
//
// Emitted when Atlas's identity issuer mints a new signing key for an
// agent — either at first issuance or on rotation (Atlas spec §3.1; A0
// freeze §4 #3). Subscribers: Senna + Rashida (cyber-resilience posture
// — the rotation cadence is part of the zero-trust envelope).
//
// Replay-fold: latest-wins-per-key on `agentUrn` — the latest event for
// an agent is the active key. Older events remain in the log for audit
// (rotation history is reconstructible).
// ---------------------------------------------------------------------------

export const identityKeyRotatedPayloadSchema = z.object({
  /** The agent whose key was rotated. Matches AgentRegistered.agentUrn. */
  agentUrn: z
    .string()
    .min(1)
    .regex(/^agent:[a-z0-9-]+$/, {
      message: "agentUrn must be `agent:<lowercased-persona-name>` (a-z, 0-9, -)",
    }),
  /**
   * Monotonic version of this key. Starts at 1 on first issuance;
   * increments on each rotation. The substrate refuses non-monotonic
   * reissuance to prevent replay of older keys.
   */
  keyVersion: z.number().int().positive(),
  /** Public key in base64url (Ed25519, 32 bytes). The private half stays at the issuer. */
  publicKey: z.string().min(1),
  /** Signing algorithm. Today: Ed25519. Cloud (M8): same algo, HSM-backed. */
  algorithm: z.literal("Ed25519"),
  /**
   * Why the key was rotated. `initial` for first issuance; `scheduled`
   * for cadence-based rotation; `compromise` for incident response;
   * `spec-change` when the agent spec changed and a fresh key supersedes
   * the prior one.
   */
  reason: z.enum(["initial", "scheduled", "compromise", "spec-change"]),
  /** ISO 8601 timestamp at which the previous key (if any) is treated as revoked. */
  previousKeyRevokedAt: z.string().optional(),
});

export type IdentityKeyRotatedPayload = z.infer<typeof identityKeyRotatedPayloadSchema>;

export function makeIdentityKeyRotated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IdentityKeyRotatedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IdentityKeyRotated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: identityKeyRotatedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PermissionPolicyPublished
//
// Emitted when Atlas's permission-policy generator derives a fresh policy
// from an agent's spec (§12 capabilities, §11 outputs, §7 triggers, §11
// registers maintained) and publishes it (Atlas spec §3.1; A0 freeze §4
// #4). The event-store permission-gate consumes the latest policy per
// agent at append time.
//
// Replay-fold: latest-wins-per-key on `agentUrn`. Idempotent on
// `policyHash` — re-publishing an unchanged policy is a no-op.
// ---------------------------------------------------------------------------

export const permissionPolicyPublishedPayloadSchema = z.object({
  /** The agent the policy applies to. */
  agentUrn: z
    .string()
    .min(1)
    .regex(/^agent:[a-z0-9-]+$/, {
      message: "agentUrn must be `agent:<lowercased-persona-name>` (a-z, 0-9, -)",
    }),
  /**
   * Capability tokens (`@platform/<x>`) the agent is allowed to call.
   * Derived from spec §12. The runtime asserts every capability call's
   * target is in this list.
   */
  capabilityAllowList: z.array(z.string().min(1)),
  /**
   * Event types the agent is allowed to emit. Derived from spec §11
   * "Events emitted:". The event-store permission-gate rejects appends
   * whose type is outside this list when the gate is enabled.
   */
  eventEmitAllowList: z.array(z.string().min(1)),
  /**
   * Event types the agent is allowed to subscribe to (event-trigger bus,
   * A2). Derived from spec §7 "Triggers" — typed event names appearing
   * in backticks within the trigger rows.
   */
  eventSubscribeAllowList: z.array(z.string().min(1)),
  /**
   * Registers the agent is allowed to write to. Derived from spec §11
   * "Registers maintained:" — list of register names the agent owns.
   */
  registerWriteAllowList: z.array(z.string().min(1)),
  /**
   * SHA-256 hex digest of the canonicalised policy contents. The policy
   * publisher uses this for idempotency: equal hash → no-op.
   */
  policyHash: z
    .string()
    .min(1)
    .regex(/^[0-9a-f]{64}$/, {
      message: "policyHash must be a lowercase hex sha256 (64 chars)",
    }),
  /**
   * Hash of the agent spec the policy was derived from. Lets auditors
   * reconcile policy ↔ spec versions at any point in time.
   */
  derivedFromSpecHash: z
    .string()
    .min(1)
    .regex(/^[0-9a-f]{64}$/, {
      message: "derivedFromSpecHash must be a lowercase hex sha256 (64 chars)",
    }),
});

export type PermissionPolicyPublishedPayload = z.infer<
  typeof permissionPolicyPublishedPayloadSchema
>;

export function makePermissionPolicyPublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PermissionPolicyPublishedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PermissionPolicyPublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: permissionPolicyPublishedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BusDispatched
//
// Emitted by the event-trigger bus (A2.2; Atlas spec §3.3) every time it
// invokes an event-driven handler in response to an event the handler
// subscribes to. The pair `(eventId, handlerKey)` is the bus's idempotency
// key — before invoking a handler, the bus reads the BusDispatched stream
// and skips any pair already recorded.
//
// `handlerKey` is the canonical `<lowercased-agent>:<trigger>` from
// `runtime/handlers-metadata.ts` so the audit trail joins cleanly to the
// metadata registry. `eventId` is the source event's `event_id`, not the
// store-internal sequence — sequence numbers aren't exposed on the Event
// envelope, but `event_id` is globally unique and stable.
//
// Replay-fold: append-only-audit. The pair is the idempotency key; we
// never overwrite a prior dispatch record. A failed handler invocation
// still records a BusDispatched (the dispatch happened — outcome is on
// the AgentRunStarted/Failed lifecycle events the runtime emits).
// ---------------------------------------------------------------------------

export const busDispatchedPayloadSchema = z.object({
  /**
   * The source event's `event_id` (UUID). The bus's dedup key is
   * `(eventId, handlerKey)`; using event_id rather than sequence means
   * the dedup key is stable across stores that re-key on import.
   */
  eventId: z.string().min(1),
  /** Source event's `type`. Recorded for audit / dashboard grouping. */
  eventType: z.string().min(1),
  /**
   * The handler that was invoked. Convention: `<lowercased-agent>:<trigger>`
   * matching `runtime/handlers-metadata.ts`'s composite key.
   */
  handlerKey: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+:[a-z0-9-]+$/, {
      message: "handlerKey must match `<lowercased-agent>:<trigger>` (a-z, 0-9, -)",
    }),
  /** ISO 8601 — when the bus invoked the handler. */
  dispatchedAt: z.string().min(1),
  /**
   * Outcome flag. `ok` when the handler returned without throwing;
   * `failed` when the handler threw (the bus emits a SubstrateAlert
   * separately; this flag is for downstream audit-counting convenience).
   */
  outcome: z.enum(["ok", "failed"]),
});

export type BusDispatchedPayload = z.infer<typeof busDispatchedPayloadSchema>;

export function makeBusDispatched(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BusDispatchedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BusDispatched",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: busDispatchedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LegacyFanoutShadowed
//
// Emitted by the legacy in-process fan-out in `runtime/run.ts` once the
// A2.2 cutover (D-A22-RETIRE-LEGACY Phase 1) puts the legacy path in
// shadow mode. Phase 1 topology: the LocalEventTriggerBus is the canonical
// dispatcher; the legacy fan-out is preserved but does NOT invoke its
// computed handlers — instead it records, per (parent run, triggered
// handler key) row, what it *would* have dispatched. The shadow event is
// the substrate's own evidence that the legacy path *would* have fired,
// recorded for divergence assertion against `BusDispatched`.
//
// Vera's Wave-4 #13b parallel-dispatch-divergence pipeline reconciles
// this stream against `BusDispatched` and asserts the two paths agree
// on the same (eventId, handlerKey) set. When the gating window passes
// green, Phase 2 deletes both the legacy fan-out and this event type.
//
// Authority:
//   - D-A22-RETIRE-LEGACY Phase 1 (CeoDecision, 2026-05-08)
//   - D-AGENT-RUNTIME-AUTHORIZE (resolved 2026-05-07)
//   - Principle 1 (events as truth — shadow dispatch is recorded)
//
// Replay-fold: append-only-audit. Short-lived — disappears at Phase 2.
// ---------------------------------------------------------------------------

export const legacyFanoutShadowedPayloadSchema = z.object({
  /**
   * Composite key of the parent run that emitted the trigger event.
   * Convention: `<lowercased-agent>:<trigger>` (e.g. `atlas:substrate-state`).
   */
  parentAgent: z.string().min(1),
  /** Parent's trigger id — second half of the parent's handler key. */
  parentTrigger: z.string().min(1),
  /**
   * The handler the legacy fan-out *would* have dispatched. Convention:
   * `<lowercased-agent>:<trigger>` matching `runtime/handlers-metadata.ts`.
   */
  triggeredHandlerKey: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+:[a-z0-9-]+$/, {
      message: "triggeredHandlerKey must match `<lowercased-agent>:<trigger>` (a-z, 0-9, -)",
    }),
  /**
   * The event types the parent run appended that the triggered handler
   * subscribes to (intersection of `subscribesTo` and `newEventTypes`).
   * Recorded so divergence-recon can compare against the bus's
   * `eventType` column on `BusDispatched`.
   */
  triggeringEventTypes: z.array(z.string().min(1)).min(1),
  /**
   * Event-store sequence number captured *before* the parent run started.
   * The fan-out walks `[suppressedAtSequence + 1 ..]` to find new events.
   * Recorded so divergence-recon can correlate windows precisely.
   */
  suppressedAtSequence: z.number().int().nonnegative(),
});

export type LegacyFanoutShadowedPayload = z.infer<typeof legacyFanoutShadowedPayloadSchema>;

export function makeLegacyFanoutShadowed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LegacyFanoutShadowedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LegacyFanoutShadowed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: legacyFanoutShadowedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ModelSubmitted
//
// Emitted by Rohan (the model builder, first line) when a new model
// version is submitted to the registry for validation. Distinct from
// Rohan's broader `ModelVersionPublished` event — `ModelSubmitted` is
// the validation-flow trigger that opens a registry entry for Nadia's
// review; `ModelVersionPublished` records the underlying methodology /
// version artefact at Rohan's side.
//
// Replay-fold: latest-wins-per-key on `modelId` for the latest version;
// the `methodologyHash` is the idempotency key — re-submitting the
// identical hash for the same model is a no-op.
//
// Co-owner: Rohan (submits) + Nadia (validates). Spec authority:
// `Team/Nadia.md` §11; `Team/Rohan.md` §11; the model-registry skeleton
// at `prototype/platform/model-registry/registry.ts`.
// ---------------------------------------------------------------------------

export const modelSubmittedPayloadSchema = z.object({
  /** Stable id for the model. Convention: `model:<short-slug>` (e.g. `model:var-historical-99`). */
  modelId: z.string().min(1),
  /** Strong identity of the submitter. Convention: `agent:<name>` or `human:<email>`. */
  submittedBy: z.string().min(1),
  /** Submitter's version label (e.g. `v1.0`, `2026.05-q2`). */
  version: z.string().min(1),
  /**
   * Tier the submitter is proposing per RAS § B7:
   *   1 = regulatory-capital / IFRS 9 / AML core (Tier-1, annual revalidation)
   *   2 = pricing engines / risk sensitivities / behavioural-deposit (Tier-2, 18-month revalidation)
   *   3 = operational analytics / segmentation / non-decisioning (Tier-3, on material-change)
   * Nadia may override via `ModelTierClassified`.
   */
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /**
   * SHA-256 of the methodology / spec contents at submission. Idempotency
   * key — re-submitting the identical hash for the same modelId emits no
   * new event.
   */
  methodologyHash: z
    .string()
    .min(1)
    .regex(/^[0-9a-f]{64}$/, {
      message: "methodologyHash must be a lowercase hex sha256 (64 chars)",
    }),
  /** One-line description of the model's purpose. */
  description: z.string().min(1),
});

export type ModelSubmittedPayload = z.infer<typeof modelSubmittedPayloadSchema>;

export function makeModelSubmitted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ModelSubmittedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ModelSubmitted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: modelSubmittedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ModelTierClassified
//
// Emitted by Nadia when she classifies (or reclassifies) a model's tier.
// May agree with the submitter's `tier` or override it; either way, the
// classified tier is the binding one for validation cadence.
//
// Replay-fold: latest-wins-per-key on `modelId` — Nadia's most recent
// classification supersedes earlier ones.
// ---------------------------------------------------------------------------

export const modelTierClassifiedPayloadSchema = z.object({
  modelId: z.string().min(1),
  /** Strong identity of the classifier. Convention: `agent:nadia` or `human:<email>`. */
  classifiedBy: z.string().min(1),
  /** Tier per RAS § B7 (see ModelSubmitted). */
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Why this tier — references RAS § B7 dimensions (regulatory-capital, IFRS 9, etc.). */
  rationale: z.string().min(1),
});

export type ModelTierClassifiedPayload = z.infer<typeof modelTierClassifiedPayloadSchema>;

export function makeModelTierClassified(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ModelTierClassifiedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ModelTierClassified",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: modelTierClassifiedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ModelValidationApproved
//
// Emitted by Nadia when she approves production use of a specific
// version. The `expiryDate` aligns with tier-cycle revalidation
// cadence (Tier-1: ~12 months; Tier-2: ~18 months; Tier-3: open).
//
// Approval is rejected (in `LocalModelRegistry.approveValidation`) if
// the model has any open `severity: blocking` finding — Nadia's
// independence boundary (Team/Nadia.md §15) is enforced at the registry
// level, not as a soft signal.
//
// Replay-fold: latest-wins-per-key on `modelId` for the production-eligible
// query; old approvals supersede on a fresh approval. `validationFindingsResolved`
// is a list of finding ids the approval explicitly closed.
// ---------------------------------------------------------------------------

export const modelValidationApprovedPayloadSchema = z.object({
  modelId: z.string().min(1),
  /** Version being approved — must match a version the registry already holds for this model. */
  version: z.string().min(1),
  /** Strong identity of the approver. Convention: `agent:nadia` or `human:<email>`. */
  approvedBy: z.string().min(1),
  /** Finding ids resolved as part of this approval. Empty array = no findings to resolve. */
  validationFindingsResolved: z.array(z.string().min(1)),
  /**
   * ISO 8601 date by which the approval lapses (next revalidation due).
   * Past-expiry models are excluded from `productionEligible()`.
   */
  expiryDate: z.string().min(1),
});

export type ModelValidationApprovedPayload = z.infer<typeof modelValidationApprovedPayloadSchema>;

export function makeModelValidationApproved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ModelValidationApprovedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ModelValidationApproved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: modelValidationApprovedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ModelValidationWithheld
//
// Emitted by Nadia when she withholds production approval. The model
// stays in the registry but is not production-eligible; the `findings`
// list captures the reasoned objections.
//
// Replay-fold: latest-wins-per-key on `modelId` — a subsequent approval
// supersedes; a subsequent withhold updates the latest reason.
// ---------------------------------------------------------------------------

export const modelValidationWithheldPayloadSchema = z.object({
  modelId: z.string().min(1),
  /** Version the withhold applies to. */
  version: z.string().min(1),
  /** Strong identity of the withholder. Convention: `agent:nadia` or `human:<email>`. */
  withheldBy: z.string().min(1),
  /** One-line summary of why approval is withheld. */
  reason: z.string().min(1),
  /** Finding ids that drive the withhold (typically severity high/blocking). */
  findings: z.array(z.string().min(1)),
});

export type ModelValidationWithheldPayload = z.infer<typeof modelValidationWithheldPayloadSchema>;

export function makeModelValidationWithheld(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ModelValidationWithheldPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ModelValidationWithheld",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: modelValidationWithheldPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ValidationFindingRaised
//
// Emitted by Nadia when she raises a validation finding. Findings are
// the unit currency of validation: blocking severity prevents production
// approval; lower severities are tracked but advisory.
//
// Replay-fold: cumulative-fold over `findingId`. A `ValidationFindingClosed`
// for the same id closes the finding.
// ---------------------------------------------------------------------------

export const validationFindingRaisedPayloadSchema = z.object({
  /** Stable id for the finding. Convention: `finding:<model>:<short-slug>`. */
  findingId: z.string().min(1),
  /** The model the finding pertains to. */
  modelId: z.string().min(1),
  /** Strong identity of the raiser. Convention: `agent:nadia` or `human:<email>`. */
  raisedBy: z.string().min(1),
  /**
   * Severity. `blocking` prevents production approval until the finding
   * closes; `high` / `medium` / `low` are tracked but advisory.
   */
  severity: z.enum(["low", "medium", "high", "blocking"]),
  /** One-line description of the finding. */
  description: z.string().min(1),
});

export type ValidationFindingRaisedPayload = z.infer<typeof validationFindingRaisedPayloadSchema>;

export function makeValidationFindingRaised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ValidationFindingRaisedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ValidationFindingRaised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: validationFindingRaisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ValidationFindingClosed
//
// Emitted when a finding is closed (remediation evidence verified). Only
// the original raiser, or another authorised validator, may close. The
// registry's `closeFinding` enforces that the finding exists and is not
// already closed; a duplicate close throws.
//
// Replay-fold: pair-coupled with `ValidationFindingRaised` on `findingId`.
// ---------------------------------------------------------------------------

export const validationFindingClosedPayloadSchema = z.object({
  findingId: z.string().min(1),
  /** Strong identity of the closer. Convention: `agent:nadia` or `human:<email>`. */
  closedBy: z.string().min(1),
  /** One-line description of the resolution. */
  resolution: z.string().min(1),
  /** ISO 8601 timestamp at which the finding was closed. */
  closedAt: z.string().min(1),
});

export type ValidationFindingClosedPayload = z.infer<typeof validationFindingClosedPayloadSchema>;

export function makeValidationFindingClosed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ValidationFindingClosedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ValidationFindingClosed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: validationFindingClosedPayloadSchema.parse(args.payload),
  });
}

// ===========================================================================
// Backtest family — gates Rohan's S7-Targeted #4 backtest harness.
//
// Schemas per `Owner Inbox/2026-05-09_rohan_backtest-harness-v0-scoping.md`
// §4.1 + §4.2. Co-evolved with Nadia's validation-event family (`Team/Nadia.md`
// §11, §16) — `BacktestRun` is exactly the input to `BacktestBreachDisposed`,
// so field names align. Both fold latest-wins-per-key on the model's stream
// for "most recent backtest" queries; the full history stays append-only in
// the log (Principle 1).
// ===========================================================================

// ---------------------------------------------------------------------------
// BacktestRequested
//
// Emitted when a backtest cycle is initiated against a model version. The
// `methodologyHash` locks the methodology version under test — re-running
// with the same hash + window is idempotent at the harness level.
//
// Authority:
//   - SR-11-7-2011 — model-risk-management framework (US Federal Reserve / OCC)
//   - SS-1-23-2023 — PRA Model Risk Management Principles (esp. Principle 4 Validation)
//   - BANKS-ACT-94-1990 — § 70(2A)(b) risk-management process
//   - The model's own methodology citation chain (resolved via methodologyHash)
//
// Replay-fold: latest-wins-per-key on `(modelId, version)` for "most recent
// backtest request". Full history is append-only.
// ---------------------------------------------------------------------------

export const backtestPredictionGranularitySchema = z.enum(["daily", "monthly", "per-event"]);

export const backtestOutcomeMetricSchema = z.enum([
  "kupiec",
  "christoffersen",
  "traffic-light",
  "staging-stability",
  "migration-matrix",
  "coverage-test",
  "custom",
]);

export const backtestRequestedPayloadSchema = z.object({
  /** Stable model id — must resolve in the model registry. */
  modelId: z.string().min(1),
  /** Version label — must match a registered version for `modelId`. */
  version: z.string().min(1),
  /** ISO 8601 — start of the backtest observation window. */
  windowStart: z.string().min(1),
  /** ISO 8601 — end of the backtest observation window. */
  windowEnd: z.string().min(1),
  /** Cadence of predictions inside the window. */
  predictionGranularity: backtestPredictionGranularitySchema,
  /** Outcome metric the run will compute. */
  outcomeMetric: backtestOutcomeMetricSchema,
  /** Strong identity of the requester. Convention: `agent:rohan`, `agent:nadia`, `substrate:scheduler`. */
  requestedBy: z.string().min(1),
  /** SHA-256 (lowercase hex) of the methodology spec at submission. */
  methodologyHash: z
    .string()
    .min(1)
    .regex(/^[0-9a-f]{64}$/, {
      message: "methodologyHash must be a lowercase hex sha256 (64 chars)",
    }),
});

export type BacktestRequestedPayload = z.infer<typeof backtestRequestedPayloadSchema>;

export function makeBacktestRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BacktestRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BacktestRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: backtestRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BacktestRun
//
// Emitted when a backtest run completes. The `severity` traffic-light maps
// the metric's bands per Basel BCBS-VAR-BACKTEST-1996 / Kupiec / Christoffersen
// thresholds. Failed runs (severity = red) become inputs to Nadia's
// `BacktestBreachDisposed` (the validator's decision surface — auto-suspend
// would violate the model-builder/validator separation in `Team/Nadia.md` §15).
//
// Authority:
//   - SR-11-7-2011, SS-1-23-2023, BANKS-ACT-94-1990 — see BacktestRequested
//   - BCBS-VAR-BACKTEST-1996 — Basel Committee VaR backtesting traffic-light
//   - Comparison-metric-specific references (e.g. KUPIEC-1995, CHRISTOFFERSEN-1998)
//
// Replay-fold: latest-wins-per-key on `(modelId, version, comparisonMetric)`
// for "most recent run"; full history append-only.
// ---------------------------------------------------------------------------

export const backtestSeveritySchema = z.enum(["within-tolerance", "amber", "red"]);

export const backtestRunPayloadSchema = z.object({
  /** Stable id for this run. Convention: `backtest:<modelId>:<short-slug>`. */
  backtestRunId: z.string().min(1),
  /** Model under test. */
  modelId: z.string().min(1),
  /** Version under test. */
  version: z.string().min(1),
  /** ISO 8601 — start of the observation window the run covered. */
  windowStart: z.string().min(1),
  /** ISO 8601 — end of the observation window the run covered. */
  windowEnd: z.string().min(1),
  /** Same enum as BacktestRequested.outcomeMetric. */
  comparisonMetric: backtestOutcomeMetricSchema,
  /** Expected exception count under the null per metric (non-negative). */
  expectedExceptions: z.number().nonnegative(),
  /** Observed exception count over the window (non-negative integer). */
  observedExceptions: z.number().int().nonnegative(),
  /** Traffic-light band per metric. */
  severity: backtestSeveritySchema,
  /** SHA-256 (lowercase hex) — must match the BacktestRequested that opened this run. */
  methodologyHash: z
    .string()
    .min(1)
    .regex(/^[0-9a-f]{64}$/, {
      message: "methodologyHash must be a lowercase hex sha256 (64 chars)",
    }),
  /** Number of prediction observations in the window — drives test power. */
  predictionCount: z.number().int().nonnegative(),
  /** Wall-clock duration of the run, milliseconds. Observability. */
  runDurationMs: z.number().nonnegative(),
  /** event_id of the BacktestRequested that opened this run. */
  sourceRequestEventId: z.string().min(1),
});

export type BacktestRunPayload = z.infer<typeof backtestRunPayloadSchema>;

export function makeBacktestRun(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BacktestRunPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BacktestRun",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: backtestRunPayloadSchema.parse(args.payload),
  });
}

// ===========================================================================
// Pre-trade gateway family — gates Saskia+Kai's S7-Targeted #5 envelope.
//
// Schemas per `Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md`
// §3 (architecture sketch) + §5.1 (registry gaps). Six event types running on
// the bus-canonical runtime (D-A22-RETIRE-LEGACY Phase 1, landed 2026-05-08).
// Each check handler is separately-registered under runtime/handlers-metadata.ts;
// per A1.2 permission-policy each handler's identity scopes its event-stream
// access (Principle 4 — zero trust + least privilege applied to internal handlers).
// ===========================================================================

// ---------------------------------------------------------------------------
// OrderProposed
//
// Emitted by an upstream order-source (sales agent, market-making engine,
// internal client, treasurer HQLA turnover, Saskia auto-quote). Picked up by
// the pre-trade gateway, which fans out K parallel GatewayCheckRequested events.
//
// Authority:
//   - JSE-RULES-EQUITIES — exchange listing & trading rules
//   - FMA-S5 — Financial Markets Act § 5 market integrity
//   - Team/Kai.md §11 (markets-events catalogue)
//
// Replay-fold: latest-wins-per-key on `orderId` (an order may be re-proposed
// after revision); the full proposal history is append-only.
// ---------------------------------------------------------------------------

export const orderSideSchema = z.enum(["buy", "sell"]);

export const orderProposedPayloadSchema = z.object({
  /** Correlation id for the order across the gateway → OMS → fill chain. */
  orderId: z.string().min(1),
  /** Counterparty LEI (20-char ISO 17442). */
  counterpartyLei: z
    .string()
    .min(1)
    .regex(/^[A-Z0-9]{20}$/, { message: "counterpartyLei must be a 20-char ISO 17442 LEI" }),
  /**
   * Instrument identifier (CDM-typed; v0 carries an opaque string keyed to
   * the per-product CDM variant under `platform/markets/cdm/`).
   */
  instrument: z.string().min(1),
  /** Buy or sell. */
  side: orderSideSchema,
  /** Order quantity (positive). */
  quantity: z.number().positive(),
  /** Limit / indicative price (positive). */
  price: z.number().positive(),
  /** ISO 4217 currency of `price`. */
  priceCurrency: z
    .string()
    .min(3)
    .regex(/^[A-Z]{3}$/, { message: "priceCurrency must be ISO 4217 (3-char uppercase)" }),
  /** Booking entity (legal-entity-tree node). Convention: `entity:<short-slug>`. */
  bookingEntity: z.string().min(1),
  /** Strong identity of the requesting actor. Convention: `agent:<name>` or `human:<email>`. */
  requestedActor: z.string().min(1),
});

export type OrderProposedPayload = z.infer<typeof orderProposedPayloadSchema>;

export function makeOrderProposed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OrderProposedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OrderProposed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: orderProposedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// GatewayCheckRequested
//
// Emitted by the pre-trade gateway, one per check per OrderProposed. Each
// check handler subscribes to its own check kind via @platform/runtime/bus
// (permission-policy gate scopes each handler's event-stream access).
//
// Replay-fold: pair-coupled with GatewayCheckCompleted on `(orderId, checkKind)`.
// ---------------------------------------------------------------------------

export const gatewayCheckKindSchema = z.enum([
  "identity",
  "sanctions",
  "suitability",
  "surveillance",
  "credit-limit",
  "market-risk",
  "capital-impact",
  "funding",
  "documentation",
  "jurisdiction",
]);

export const gatewayCheckRequestedPayloadSchema = z.object({
  /** Order under check; correlates back to OrderProposed.orderId. */
  orderId: z.string().min(1),
  /** Which check this dispatch is for. */
  checkKind: gatewayCheckKindSchema,
  /** event_id of the OrderProposed that opened this check. */
  sourceOrderEventId: z.string().min(1),
  /** ISO 8601 — when the gateway dispatched the check. Drives the timeout window. */
  requestedAt: z.string().min(1),
  /**
   * Optional per-check timeout, milliseconds. Per Team/Kai.md §7, the binding
   * gateway latency budget is 50ms for pre-trade evaluation; individual
   * checks may set their own ceiling (e.g. capital-impact). Undefined =
   * inherit gateway default.
   */
  timeoutMs: z.number().int().positive().optional(),
});

export type GatewayCheckRequestedPayload = z.infer<typeof gatewayCheckRequestedPayloadSchema>;

export function makeGatewayCheckRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: GatewayCheckRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "GatewayCheckRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: gatewayCheckRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// GatewayCheckCompleted
//
// Emitted by a check handler when its evaluation finishes. The aggregator
// (Kai-owned) collects K of K results and applies the rule:
// any reject → reject; all approve → approve; timeout → §6 Q2 default.
//
// Replay-fold: pair-coupled with GatewayCheckRequested on `(orderId, checkKind)`.
// ---------------------------------------------------------------------------

export const gatewayCheckOutcomeSchema = z.enum(["approve", "reject", "timeout"]);

export const gatewayCheckCompletedPayloadSchema = z.object({
  /** Order under check. */
  orderId: z.string().min(1),
  /** Which check completed. */
  checkKind: gatewayCheckKindSchema,
  /** Outcome of this individual check. */
  outcome: gatewayCheckOutcomeSchema,
  /** event_id of the GatewayCheckRequested that opened this completion. */
  sourceCheckRequestEventId: z.string().min(1),
  /** ISO 8601 — when the check returned. */
  completedAt: z.string().min(1),
  /** Wall-clock duration, milliseconds. Observability for the 50ms budget. */
  durationMs: z.number().nonnegative(),
  /**
   * Reject-only: typed reason. Required when outcome = reject; ignored
   * otherwise. The aggregator surfaces this in OrderRejectedAtGateway.
   */
  rejectionReason: z.string().optional(),
  /**
   * Reject-only: citation to the rule that drove the reject. e.g. a FIC
   * sanctions-list URN, a RAS § B-credit headroom row. Required for the
   * Saskia-flagged "rejections are first-class business events" semantics.
   */
  citationToRule: z.string().optional(),
});

export type GatewayCheckCompletedPayload = z.infer<typeof gatewayCheckCompletedPayloadSchema>;

export function makeGatewayCheckCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: GatewayCheckCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "GatewayCheckCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: gatewayCheckCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// OrderApprovedAtGateway
//
// Emitted by the aggregator when all K checks return approve. The order
// then routes to OMS/EMS (Kai's substrate) — TradeProposed follows when
// the counterparty acknowledges per `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §6.
//
// Replay-fold: pair-coupled with OrderProposed on `orderId` (mutually
// exclusive with OrderRejectedAtGateway).
// ---------------------------------------------------------------------------

export const orderApprovedAtGatewayPayloadSchema = z.object({
  /** Order that passed the gateway. */
  orderId: z.string().min(1),
  /**
   * Citations that backed the approval — the union of every check's
   * approval citation. Used by Vera's continuous-controls recon to
   * reconstruct the gateway-decision audit trail per order.
   */
  approvalCitations: z.array(z.string().min(1)),
  /** ISO 8601 — when the aggregator concluded approve. */
  passedAt: z.string().min(1),
});

export type OrderApprovedAtGatewayPayload = z.infer<typeof orderApprovedAtGatewayPayloadSchema>;

export function makeOrderApprovedAtGateway(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OrderApprovedAtGatewayPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OrderApprovedAtGateway",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: orderApprovedAtGatewayPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// OrderRejectedAtGateway
//
// Emitted when any check returns reject (or a configurable timeout-default
// kicks in). Per Saskia (§3 brief): rejections are first-class business
// events — the desk needs to see them, surveillance consumes them, the
// soft-franchise pipeline (Niko + Imani) feeds documentation gaps back.
// They are signal, not failure-to-suppress.
//
// Replay-fold: pair-coupled with OrderProposed on `orderId` (mutually
// exclusive with OrderApprovedAtGateway).
// ---------------------------------------------------------------------------

export const orderRejectedAtGatewayPayloadSchema = z.object({
  /** Order that failed the gateway. */
  orderId: z.string().min(1),
  /** Typed rejection reason — surfaced from the rejecting check. */
  rejectionReason: z.string().min(1),
  /** Which check drove the reject (the first reject wins under the aggregation rule). */
  rejectingCheck: gatewayCheckKindSchema,
  /** Citation to the rule the rejecting check enforced. */
  citationToRule: z.string().min(1),
  /** ISO 8601 — when the aggregator concluded reject. */
  rejectedAt: z.string().min(1),
});

export type OrderRejectedAtGatewayPayload = z.infer<typeof orderRejectedAtGatewayPayloadSchema>;

export function makeOrderRejectedAtGateway(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OrderRejectedAtGatewayPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OrderRejectedAtGateway",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: orderRejectedAtGatewayPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PreTradeLimitChanged
//
// Emitted when a pre-trade gateway limit is changed (raised, lowered, or
// reshaped). Per Team/Kai.md §15: Kai cannot disable the gateway and Rohan
// cannot raise limits without Saskia citing Helena's RAS envelope. Helena's
// authority is the appetite line; Saskia's is the franchise scope; Rohan's
// is the engine; Kai's is the substrate. This event records the chain.
//
// Authority:
//   - RAS-B-CREDIT / RAS-B-MARKET / RAS-B-CAPITAL — appetite-line citations
//   - GOV-FRAMEWORK-CEO-RESERVED — when the change escalates
//   - Team/Kai.md §11, §15 (limit-change protocol)
//
// Replay-fold: latest-wins-per-key on `limitId` for the current value;
// full history append-only.
// ---------------------------------------------------------------------------

export const preTradeLimitKindSchema = z.enum([
  "credit",
  "market-risk",
  "capital-impact",
  "funding",
  "concentration",
  "instrument-eligibility",
  "counterparty-eligibility",
]);

export const preTradeLimitChangedPayloadSchema = z.object({
  /** Stable id for the limit. Convention: `limit:<kind>:<short-slug>`. */
  limitId: z.string().min(1),
  /** Which dimension this limit governs. */
  limitKind: preTradeLimitKindSchema,
  /** Previous numeric value, if applicable. Undefined for first issue or non-numeric limits. */
  previousValue: z.number().optional(),
  /** New numeric value, if applicable. Undefined for purely qualitative reshapes. */
  newValue: z.number().optional(),
  /** ISO 4217 currency for value fields, if applicable. */
  valueCurrency: z
    .string()
    .min(3)
    .regex(/^[A-Z]{3}$/, { message: "valueCurrency must be ISO 4217 (3-char uppercase)" })
    .optional(),
  /** Strong identity of the changer. Convention: `agent:<name>` or `human:<email>`. */
  changedBy: z.string().min(1),
  /**
   * Reference to the RAS envelope citation Saskia attaches to authorise
   * the change (per the four-way protocol). Required — the change cannot
   * land without one.
   */
  rasEnvelopeCitation: z.string().min(1),
  /** One-line rationale for the change. */
  rationale: z.string().min(1),
  /** ISO 8601 — when the new value takes effect. */
  effectiveFrom: z.string().min(1),
});

export type PreTradeLimitChangedPayload = z.infer<typeof preTradeLimitChangedPayloadSchema>;

export function makePreTradeLimitChanged(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PreTradeLimitChangedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PreTradeLimitChanged",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: preTradeLimitChangedPayloadSchema.parse(args.payload),
  });
}

// ===========================================================================
// Validation / methodology family — gates Nadia's S7-Targeted #3 methodology
// library.
//
// Schemas per `Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md`
// §5.3 + §6 (gaps #3 and #5), and `Team/Nadia.md` §11 (Outputs catalogue).
// `BacktestBreachDisposed` field set is named in
// `Owner Inbox/2026-05-09_rohan_backtest-harness-v0-scoping.md` §7 Q3 + Q5.
// ===========================================================================

// ---------------------------------------------------------------------------
// ValidationMethodologyPublished
//
// Emitted by Nadia when a validation methodology version is published
// (Tier-1 / Tier-2 / Tier-3). Methodology versions are the authority surface
// the validation cycle references — `BacktestRequested.methodologyHash`
// resolves through this stream.
//
// Authority:
//   - SR-11-7-2011 — model-risk-management framework
//   - SS-1-23-2023 — PRA Model Risk Management Principles
//   - RAS-B7 — model-risk tier discipline
//   - Team/Nadia.md §11 (issuer)
//
// Replay-fold: latest-wins-per-key on `(tier, methodologyId)` for the
// current published version; full version history append-only.
// ---------------------------------------------------------------------------

export const validationMethodologyTierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const validationMethodologyPublishedPayloadSchema = z.object({
  /** Stable id for the methodology. Convention: `methodology:<tier>:<short-slug>`. */
  methodologyId: z.string().min(1),
  /** Tier per RAS § B7. */
  tier: validationMethodologyTierSchema,
  /** Version label. Convention: `v0.1`, `v1.0`, `2026.05-q2`. */
  version: z.string().min(1),
  /** Strong identity of the publisher. Convention: `agent:nadia` or `human:<email>`. */
  publishedBy: z.string().min(1),
  /**
   * SHA-256 (lowercase hex) of the methodology contents at publication.
   * `BacktestRequested.methodologyHash` resolves to this value.
   */
  methodologyHash: z
    .string()
    .min(1)
    .regex(/^[0-9a-f]{64}$/, {
      message: "methodologyHash must be a lowercase hex sha256 (64 chars)",
    }),
  /** ISO 8601 — when this methodology version becomes the cycle authority. */
  effectiveFrom: z.string().min(1),
  /** One-line summary of what this version changes vs. the prior version. */
  summary: z.string().min(1),
});

export type ValidationMethodologyPublishedPayload = z.infer<
  typeof validationMethodologyPublishedPayloadSchema
>;

export function makeValidationMethodologyPublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ValidationMethodologyPublishedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ValidationMethodologyPublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: validationMethodologyPublishedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BacktestBreachDisposed
//
// Emitted by Nadia when she dispositions a failed `BacktestRun` (severity
// = red, or amber per `Team/Nadia.md` §9). The disposition is one of
// `tolerate`, `remediate-by-deadline`, `withdraw-validation`. The
// withdraw-validation disposition propagates automatically to the model
// registry (production-eligibility flips to false); Nadia's authoring of the
// disposition is the human-in-the-loop step. Auto-suspend on red would be a
// Rohan→production-state edit, which violates the model-builder/validator
// separation (Team/Nadia.md §15).
//
// Authority:
//   - SR-11-7-2011, SS-1-23-2023 — validation framework
//   - Team/Nadia.md §9, §11, §15
//
// Replay-fold: pair-coupled with the source BacktestRun on `backtestRunId`.
// ---------------------------------------------------------------------------

export const backtestBreachDispositionSchema = z.enum([
  "tolerate",
  "remediate-by-deadline",
  "withdraw-validation",
]);

export const backtestBreachDisposedPayloadSchema = z.object({
  /** Matches BacktestRun.backtestRunId of the breaching run. */
  backtestRunId: z.string().min(1),
  /** Model under disposition. */
  modelId: z.string().min(1),
  /** Version under disposition. */
  version: z.string().min(1),
  /** Strong identity of the disposing validator. Convention: `agent:nadia` or `human:<email>`. */
  disposedBy: z.string().min(1),
  /** The disposition itself. */
  disposition: backtestBreachDispositionSchema,
  /** One-line rationale citing the methodology / finding context. */
  rationale: z.string().min(1),
  /**
   * For `remediate-by-deadline`: ISO 8601 deadline by which remediation
   * must complete or the disposition escalates. Required for that
   * disposition; undefined for `tolerate` and `withdraw-validation`.
   */
  remediationDeadline: z.string().optional(),
  /**
   * Finding ids the disposition opens (or references). e.g. for
   * `withdraw-validation` the disposition typically references the
   * blocking finding it crystallises.
   */
  linkedFindings: z.array(z.string().min(1)),
});

export type BacktestBreachDisposedPayload = z.infer<typeof backtestBreachDisposedPayloadSchema>;

export function makeBacktestBreachDisposed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BacktestBreachDisposedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BacktestBreachDisposed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: backtestBreachDisposedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ModelDriftDetected
//
// Emitted when a model's behaviour drifts from its validated envelope
// (input distribution shift, output distribution shift, performance
// degradation outside the backtest cadence). Distinct from a backtest
// breach — drift is the early-warning signal that may precede a breach.
//
// Authority:
//   - SR-11-7-2011 — model-risk framework (ongoing monitoring)
//   - SS-1-23-2023 — Principle 5 (Monitoring)
//   - Team/Nadia.md §11
//
// Replay-fold: append-only-audit (each detection is a fresh observation).
// ---------------------------------------------------------------------------

export const modelDriftKindSchema = z.enum([
  "input-distribution-shift",
  "output-distribution-shift",
  "performance-degradation",
  "feature-stability",
  "concept-drift",
]);

export const modelDriftDetectedPayloadSchema = z.object({
  /** Model the drift was observed on. */
  modelId: z.string().min(1),
  /** Version observed (the production-eligible one at observation time). */
  version: z.string().min(1),
  /** Which kind of drift was detected. */
  driftKind: modelDriftKindSchema,
  /** Strong identity of the detector. Convention: `agent:nadia`, `agent:anya`, `substrate:monitor`. */
  detectedBy: z.string().min(1),
  /** Quantitative metric value at detection (e.g. PSI, KS-stat, AUC delta). */
  metricValue: z.number(),
  /** Threshold the metric crossed to trigger detection. */
  metricThreshold: z.number(),
  /** Severity hint — drives whether the detection auto-escalates. */
  severity: z.enum(["low", "medium", "high", "blocking"]),
  /** ISO 8601 — when the drift was observed. */
  observedAt: z.string().min(1),
  /** One-line description of the drift signal. */
  description: z.string().min(1),
});

export type ModelDriftDetectedPayload = z.infer<typeof modelDriftDetectedPayloadSchema>;

export function makeModelDriftDetected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ModelDriftDetectedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ModelDriftDetected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: modelDriftDetectedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ProductionUseRequested
//
// Emitted when a model owner requests production use of a (model, version)
// — typically following a successful validation cycle. Distinct from
// `ModelSubmitted` (which opens the validation flow) and from
// `ModelValidationApproved` (which is Nadia's sign-off): this event is the
// *request* that the production-use boundary applies. Nadia's response is
// either an approval (already typed as `ModelValidationApproved`) or a
// withhold. The pre-trade gateway envelope (S7-Targeted #5) consumes this
// event when boundary enforcement lands.
//
// Authority:
//   - SR-11-7-2011, SS-1-23-2023
//   - Team/Nadia.md §11, §16 (production-use boundary)
//
// Replay-fold: latest-wins-per-key on `(modelId, version)` for the current
// request; pair-coupled with `ModelValidationApproved` / `ModelValidationWithheld`.
// ---------------------------------------------------------------------------

export const productionUseRequestedPayloadSchema = z.object({
  /** Model under request. */
  modelId: z.string().min(1),
  /** Version under request. */
  version: z.string().min(1),
  /** Strong identity of the requester. Convention: `agent:rohan`, `agent:saskia`, `agent:eitan`. */
  requestedBy: z.string().min(1),
  /**
   * Description of the production-use envelope being requested — asset
   * class, portfolio scope, scenario range. Free-form prose at v0; types
   * to a `ProductionUseBoundary` schema when slice #5 lands per Nadia §5.4.
   */
  envelopeDescription: z.string().min(1),
  /** ISO 8601 — when the requester wants production use to begin. */
  requestedFrom: z.string().min(1),
  /** One-line business rationale. */
  rationale: z.string().min(1),
});

export type ProductionUseRequestedPayload = z.infer<typeof productionUseRequestedPayloadSchema>;

export function makeProductionUseRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductionUseRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductionUseRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productionUseRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// MethodologyChangeRequested
//
// Emitted when a request to change a published validation methodology is
// raised (typically by Nadia, occasionally by Rohan or Helena). Opens the
// methodology-change cycle — the response is either a new
// `ValidationMethodologyPublished` (the change was adopted) or a withhold
// finding the change was not warranted.
//
// Authority:
//   - SR-11-7-2011, SS-1-23-2023
//   - Team/Nadia.md §11
//
// Replay-fold: pair-coupled with the next `ValidationMethodologyPublished`
// for the same `methodologyId`.
// ---------------------------------------------------------------------------

export const methodologyChangeRequestedPayloadSchema = z.object({
  /** Stable id for this change request. Convention: `methodology-change:<short-slug>`. */
  changeRequestId: z.string().min(1),
  /** The methodology under request. */
  methodologyId: z.string().min(1),
  /** Tier of the methodology being changed. */
  tier: validationMethodologyTierSchema,
  /** Version this change supersedes (the currently-published version). */
  fromVersion: z.string().min(1),
  /** Strong identity of the requester. Convention: `agent:nadia`, `agent:rohan`, `agent:helena`. */
  requestedBy: z.string().min(1),
  /** One-line description of the proposed change. */
  proposedChange: z.string().min(1),
  /** Rationale citing the trigger (drift, regulator update, breach pattern). */
  rationale: z.string().min(1),
  /** ISO 8601 — target date the requester wants the change effective. */
  targetEffectiveFrom: z.string().optional(),
});

export type MethodologyChangeRequestedPayload = z.infer<
  typeof methodologyChangeRequestedPayloadSchema
>;

export function makeMethodologyChangeRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MethodologyChangeRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MethodologyChangeRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: methodologyChangeRequestedPayloadSchema.parse(args.payload),
  });
}

// ===========================================================================
// CRM — counterparty institutional-eligibility screening (Niko, v0)
//
// D-FSP-LICENCE-NECESSITY (CEO resolution `confirm-A-no-research`,
// 2026-05-09; PR #62) binds Posture A: every counterparty onboarded
// must clear an institutional-eligibility test that anchors the FAIS
// scope-of-services to the institutional product set. The three event
// types below carry the typed contract for the screening lifecycle:
//
//   • CounterpartyEligibilityScreened — initial / cycle screening.
//   • CounterpartyEligibilityRevalidated — periodic re-eligibility.
//   • CounterpartyEligibilityBreached — ongoing-monitoring drift signal.
//
// Authority chain:
//   - D-FSP-LICENCE-NECESSITY → D-THIN-HUMAN-LAYER-MINIMUM →
//     D-MARKETS-SCHEMA-FOUNDATION; strategic-foundation memory
//     (institutional-only / wholesale).
//   - FAIS Act 37/2002 + Subordinate Legislation s.45 (institutional /
//     professional-counterparty exemption — counsel ratifies the
//     precise sub-section refs at the licence-application gate; until
//     then citations carry `[citation: TBC pending counsel]`).
//   - Mira (Compliance / RegTech engineer) Posture A FAIS-record-keeping
//     URN cluster (PR #70 — `urn:obligation:bank:fais:*`).
//
// Procedure: `Procedures/by-policy/counterparty-institutional-eligibility-screening.md`
// (PROC-CRM-CIE-01).
//
// Substrate gaps named (NOT built in this PR):
//   - `prototype/platform/lifecycle/counterparty-eligibility.ts` — the
//     classification module that performs the test and emits the
//     events. Atlas (Core banking platform architect) + Niko (Sales /
//     CRM engineer) joint follow-on.
//   - Vera (Internal-audit / continuous-assurance engineer) Wave-4
//     finding-pipeline for the `Order*`-without-current-eligibility
//     recon. Vera planning task.
//   - Institutional-eligibility-criteria-as-code (the typed criteria
//     taxonomy) — Niko + Imani (Legal-as-code engineer) joint follow-on.
//
// Author: Niko (Sales / CRM engineer)
// ===========================================================================

/** Outcome of an institutional-eligibility screening. */
export const counterpartyEligibilityOutcomeSchema = z.enum([
  "institutional-eligible",
  "ineligible",
  "indeterminate",
]);

export type CounterpartyEligibilityOutcome = z.infer<
  typeof counterpartyEligibilityOutcomeSchema
>;

// ---------------------------------------------------------------------------
// CounterpartyEligibilityScreened
//
// Emitted at counterparty onboarding (and at each scheduled re-eligibility
// cycle that produces a fresh screening). Records which institutional-
// eligibility criteria were applied, the resulting outcome, the evidence
// references that justify the outcome, and the citations binding the
// criteria to FAIS s.45 + Subordinate Legislation.
//
// Authority:
//   - FAIS Act 37/2002; Subordinate Legislation s.45 (institutional /
//     professional-counterparty exemption — `[citation: TBC]` on the
//     precise sub-section refs).
//   - Decision record: PR #62 (D-FSP-LICENCE-NECESSITY confirm-A).
//   - Mira (Compliance / RegTech engineer) PR #70 FAIS Posture A URN cluster.
//
// Replay-fold: `latest-wins-per-key` keyed on `counterpartyId` for the
// "current eligibility outcome" projection; the full sequence is also
// available via `cumulative-fold` for audit replay.
// ---------------------------------------------------------------------------

export const counterpartyEligibilityScreenedPayloadSchema = z.object({
  /** Stable id for the counterparty (FK into the counterparty-master-data domain). */
  counterpartyId: z.string().min(1),
  /**
   * Stable id for this screening run. Convention:
   * `cp-eligibility:<counterpartyId>:<isoDate>`.
   */
  screeningId: z.string().min(1),
  /**
   * Criteria applied. Free-form strings at v0; the typed criteria
   * taxonomy lands with the criteria-as-code substrate gap (Niko +
   * Imani follow-on). Must be non-empty — a screening with zero
   * criteria is meaningless.
   */
  criteria: z.array(z.string().min(1)).min(1),
  /** Outcome of the screening. */
  outcome: counterpartyEligibilityOutcomeSchema,
  /**
   * References to the evidence supporting the outcome. Examples:
   * FSCA-licence number, SARB-licence number, SAIA registration, CIS
   * manager number, board resolution, regulator-confirmation letter,
   * or `Owner Inbox/<counterpartyId>/eligibility-screening-<screeningId>.md`
   * for the screening rationale. Must be non-empty per the
   * reconciliation rule in PROC-CRM-CIE-01.
   */
  evidenceRefs: z.array(z.string().min(1)).min(1),
  /** ISO 8601 — the as-of timestamp the screening was performed at. */
  asOf: z.string().min(1),
});

export type CounterpartyEligibilityScreenedPayload = z.infer<
  typeof counterpartyEligibilityScreenedPayloadSchema
>;

export function makeCounterpartyEligibilityScreened(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CounterpartyEligibilityScreenedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CounterpartyEligibilityScreened",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: counterpartyEligibilityScreenedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CounterpartyEligibilityRevalidated
//
// Emitted when the periodic re-eligibility cycle (annual default; or
// trigger-based — counterparty material-change signal) runs and confirms
// or restates the eligibility outcome. Pairs to the prior screening via
// `priorScreeningId` so the audit trail forms a chain.
//
// Authority: same as `CounterpartyEligibilityScreened` (re-validation is
// a re-application of the same s.45 test).
// ---------------------------------------------------------------------------

export const counterpartyEligibilityRevalidatedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  screeningId: z.string().min(1),
  /**
   * The prior screening this revalidation supersedes. Must resolve to a
   * `CounterpartyEligibilityScreened` (or earlier
   * `CounterpartyEligibilityRevalidated`) for the same counterparty.
   * Required — without it the chain is broken.
   */
  priorScreeningId: z.string().min(1),
  criteria: z.array(z.string().min(1)).min(1),
  outcome: counterpartyEligibilityOutcomeSchema,
  evidenceRefs: z.array(z.string().min(1)).min(1),
  asOf: z.string().min(1),
});

export type CounterpartyEligibilityRevalidatedPayload = z.infer<
  typeof counterpartyEligibilityRevalidatedPayloadSchema
>;

export function makeCounterpartyEligibilityRevalidated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CounterpartyEligibilityRevalidatedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CounterpartyEligibilityRevalidated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: counterpartyEligibilityRevalidatedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CounterpartyEligibilityBreached
//
// Emitted when ongoing-monitoring detects a counterparty has drifted out
// of institutional-eligibility — examples include the entity changing
// status (e.g. FSP licence withdrawn), a business-model change that
// removes them from the s.45 categories, or a regulatory-classification
// change. The breach forces a re-screening and gates further `Order*`
// activity for the counterparty.
//
// Authority: same as the screening events; `recommendedAction` cites the
// procedure step that should fire (suspend trading, escalate to Zara +
// counsel, run a fresh screening, etc.).
// ---------------------------------------------------------------------------

export const counterpartyEligibilityBreachedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  /**
   * The screening this breach invalidates. Must resolve to the most-
   * recent `CounterpartyEligibilityScreened` /
   * `CounterpartyEligibilityRevalidated` for the counterparty.
   */
  priorScreeningId: z.string().min(1),
  /** One-line description of the breach trigger. Required — no breach is
   * recorded without a reason. */
  breachReason: z.string().min(1),
  /** Recommended action — typed enum at v0; widens as the criteria-as-code
   * substrate lands. */
  recommendedAction: z.enum([
    "suspend-trading-and-rescreen",
    "escalate-to-zara-and-counsel",
    "run-fresh-screening",
    "no-action-monitor",
  ]),
  /** ISO 8601 — when the breach was detected. */
  asOf: z.string().min(1),
});

export type CounterpartyEligibilityBreachedPayload = z.infer<
  typeof counterpartyEligibilityBreachedPayloadSchema
>;

export function makeCounterpartyEligibilityBreached(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CounterpartyEligibilityBreachedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CounterpartyEligibilityBreached",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: counterpartyEligibilityBreachedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Type registry — single place for downstream consumers to enumerate all
// typed events. Add to this when a new typed event is defined.
// ---------------------------------------------------------------------------

export const TYPED_EVENT_TYPES = [
  "AgentEscalation",
  "AgentEscalationAcknowledged",
  "AgentEscalationDecided",
  "AgentEscalationDelegated",
  "AgentEscalationOverdue",
  "AgentDecision",
  "WorkstreamRegistered",
  "RiskRaised",
  "AgentRegistered",
  "DecisionComment",
  "ScheduledTrigger",
  "SubstrateAlert",
  "IdentityKeyRotated",
  "PermissionPolicyPublished",
  "BusDispatched",
  "LegacyFanoutShadowed",
  "ModelSubmitted",
  "ModelTierClassified",
  "ModelValidationApproved",
  "ModelValidationWithheld",
  "ValidationFindingRaised",
  "ValidationFindingClosed",
  "BacktestRequested",
  "BacktestRun",
  "OrderProposed",
  "GatewayCheckRequested",
  "GatewayCheckCompleted",
  "OrderApprovedAtGateway",
  "OrderRejectedAtGateway",
  "PreTradeLimitChanged",
  "ValidationMethodologyPublished",
  "BacktestBreachDisposed",
  "ModelDriftDetected",
  "ProductionUseRequested",
  "MethodologyChangeRequested",
  "CounterpartyEligibilityScreened",
  "CounterpartyEligibilityRevalidated",
  "CounterpartyEligibilityBreached",
] as const;

export type TypedEventType = (typeof TYPED_EVENT_TYPES)[number];
