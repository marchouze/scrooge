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
// reportable finding (procedure violation under Principle 2).
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
// (Principle 6; Atlas substrate spec §3.1, §4 row #1). The runtime's
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
  /**
   * First-column row labels from §9's decisions-in-scope table. The goal-loop
   * validates `AgentGoalSelected.mandateCitations` against this closed set.
   */
  decisionsInScope: z.array(z.string().min(1)),
  /** Number of escalation rows the agent declares in §10. */
  decisionsEscalateCount: z.number().int().nonnegative(),
  /**
   * First-column row labels from §10's escalation table. The goal-loop
   * validates an escalation class against this closed set before emitting
   * `AgentGoalEscalation` (T-05 threat-model mitigation).
   */
  escalationClasses: z.array(z.string().min(1)),
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
// SubstrateAgentRunStarted / SubstrateAgentRunCompleted / SubstrateAgentRunFailed
//
// Substrate-emitted run lifecycle. Distinct from RMS's `AgentRunStarted` /
// `AgentRunCompleted` (which require a `briefId` and govern brief-coupled
// records-of-agent-runs). These three primitives wrap *every* `runAgent`
// invocation — scheduled tick, event-driven dispatch, on-request CLI — and
// are the substrate's own evidence that an agent run happened.
//
// Authority: D-AGENT-RUNTIME-AUTHORIZE / S8 (CEO-approved 2026-05-08).
// Spec: `Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md` §3.4.
// Assessment: `Owner Inbox/2026-05-10_atlas_s8-substrate-state-and-next-slice.md`.
//
// S8/RMS overlap (Scrooge ruling, 2026-05-10): RMS owns the brief-coupled
// `AgentRunStarted` / `AgentRunCompleted`; S8 owns the substrate primitives
// `SubstrateAgentRun*`. Distinct event-type names so the disposition test in
// `tests/rms-event-types.test.ts` continues to pass and the two streams can
// be folded independently. Pair-coupling via `runId`.
//
// Replay-fold: pair-coupled on `runId`. `SubstrateAgentRunStarted` opens the
// pair; exactly one of `SubstrateAgentRunCompleted` / `SubstrateAgentRunFailed`
// closes it. A `Started` without a closer is an in-flight run; the scheduler's
// inactivity-SLA recon (Vera Wave-4 #13) will assert closure within the SLA.
// ---------------------------------------------------------------------------

/**
 * `runId` shape. Convention: `run:<lowercased-agent>:<iso-utc-no-punct>:<short-rand>`.
 * The substrate runner mints the id; handlers receive it on `AgentRunContext`
 * and tag domain events / decisions for traceback. Format-validated for
 * stability — the recon harness assumes the prefix.
 */
const substrateRunIdSchema = z
  .string()
  .min(1)
  .regex(
    /^run:[a-z0-9-]+:[0-9TZ-]+:[a-z0-9]+$/,
    "runId must match `run:<lowercased-agent>:<iso-utc-no-punct>:<short-rand>`",
  );

export const substrateAgentRunStartedPayloadSchema = z.object({
  /** Stable run identifier; pair-couples Started/Completed/Failed. */
  runId: substrateRunIdSchema,
  /** Persona name as it appears in `/Team/<Name>.md`. */
  agent: z.string().min(1),
  /** Trigger that fired this run. */
  trigger: z.object({
    kind: z.enum(["scheduled", "event-driven", "on-request"]),
    /** Trigger id, e.g. `overnight-recon`, `weekly-pipeline-state`. */
    id: z.string().min(1),
  }),
  /** ISO 8601 — when the substrate runner began the run. */
  startedAt: z.string().min(1),
  /** Whether this is a dry-run (no side-effects). Dry-runs are still recorded for audit. */
  dryRun: z.boolean(),
  /**
   * Substrate carrying the run. Distinguishes a fully-autonomous substrate
   * run from a Scrooge-coordinated in-session run while the substrate gap
   * is still open (P7 — surface gaps, do not hide).
   */
  substrate: z.enum(["agent-runtime", "scrooge-coordinated-in-session"]),
  /**
   * Sequence number snapshot at run start. The closing `…Completed`/`…Failed`
   * carries the count of new events appended (snapshot at close − this).
   */
  sequenceAtStart: z.number().int().nonnegative(),
});

export type SubstrateAgentRunStartedPayload = z.infer<typeof substrateAgentRunStartedPayloadSchema>;

export function makeSubstrateAgentRunStarted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SubstrateAgentRunStartedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SubstrateAgentRunStarted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: substrateAgentRunStartedPayloadSchema.parse(args.payload),
  });
}

export const substrateAgentRunCompletedPayloadSchema = z.object({
  /** Same shape as Started.runId; must match a prior `…Started` payload. */
  runId: substrateRunIdSchema,
  /** Persona name (denormalised for fold convenience). */
  agent: z.string().min(1),
  /** ISO 8601 — when the substrate runner observed handler completion. */
  completedAt: z.string().min(1),
  /** Wall-clock duration in milliseconds. */
  durationMs: z.number().int().nonnegative(),
  /**
   * Whether the handler reported `ok: true`. A `false` value with a
   * Completed (rather than Failed) closer means the handler returned
   * a structured failure but did not throw.
   */
  ok: z.boolean(),
  /** Number of events appended to the store during this run. */
  eventsEmitted: z.number().int().nonnegative(),
  /** Number of `AgentDecision` events appended during this run. */
  decisionsEmitted: z.number().int().nonnegative(),
  /** Number of `AgentEscalation` events appended during this run. */
  escalationsEmitted: z.number().int().nonnegative(),
  /** Sequence number snapshot at run close (one past the last appended). */
  sequenceAtCompletion: z.number().int().nonnegative(),
  /** Path of the deliverable produced (relative to repoRoot), if any. */
  deliverable: z.string().min(1).optional(),
  /** Brief one-line summary the handler returned. */
  summary: z.string().min(1),
});

export type SubstrateAgentRunCompletedPayload = z.infer<
  typeof substrateAgentRunCompletedPayloadSchema
>;

export function makeSubstrateAgentRunCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SubstrateAgentRunCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SubstrateAgentRunCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: substrateAgentRunCompletedPayloadSchema.parse(args.payload),
  });
}

export const substrateAgentRunFailedPayloadSchema = z.object({
  /** Same shape as Started.runId; pair-couples to the prior `…Started`. */
  runId: substrateRunIdSchema,
  /** Persona name. */
  agent: z.string().min(1),
  /** ISO 8601 — when the failure was observed. */
  failedAt: z.string().min(1),
  /** Wall-clock duration in milliseconds (from start to failure). */
  durationMs: z.number().int().nonnegative(),
  /**
   * Coarse failure class for fold-tally — the runtime distinguishes thrown
   * errors (`exception`) from clean-return-with-ok-false (`structured`).
   * `timeout` reserved for future scheduler-driven cancellation; `unknown`
   * is the catch-all for envelope failures (e.g. context build failed).
   */
  errorClass: z.enum(["exception", "structured", "timeout", "unknown"]),
  /**
   * Truncated error message. Capped at 1024 chars at construction time —
   * audit-grade, not stack-trace-grade. Stack-trace hashes deferred (spec §3.4).
   */
  errorMessage: z.string().min(1).max(1024),
  /** Sequence number snapshot at failure. */
  sequenceAtFailure: z.number().int().nonnegative(),
});

export type SubstrateAgentRunFailedPayload = z.infer<typeof substrateAgentRunFailedPayloadSchema>;

export function makeSubstrateAgentRunFailed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SubstrateAgentRunFailedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SubstrateAgentRunFailed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: substrateAgentRunFailedPayloadSchema.parse(args.payload),
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

export type CounterpartyEligibilityOutcome = z.infer<typeof counterpartyEligibilityOutcomeSchema>;

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

// ===========================================================================
// FX correspondent-routing — switch-test event family
// ===========================================================================

// ---------------------------------------------------------------------------
// SwitchTestActivated
//
// Opens a switch-test window — for the duration of the window, a
// configurable fraction (0–100%) of `primary`-tagged FX settlement
// routing intents is routed via the backup correspondent. Quarterly
// default 0.05–0.10 per Devon (COO, governance) + Tomas (Operations &
// payments engineer) named-correspondent-pair proposal §4.
//
// Authority:
//   - D-FX-CORRESPONDENT-PAIR-NAMING (CEO approved 2026-05-09; PR #59)
//   - PR #58 — named-correspondent-pair proposal §4
//
// Replay-fold: pair-coupled with the next `SwitchTestEnded` for the same
// `windowId`; consumed by the correspondent-routing projection at
// `prototype/platform/markets/correspondent-routing.ts`.
// ---------------------------------------------------------------------------

export const switchTestActivatedPayloadSchema = z.object({
  /** Stable id for the switch-test window. Convention: `switch-test:<yyyyqn>:<short-slug>`. */
  windowId: z.string().min(1),
  /** ISO-8601 — when the window opened. */
  openedAt: z.string().min(1),
  /**
   * Fraction of `primary`-intent traffic to route via the backup, in
   * [0, 1]. Quarterly default 0.05–0.10 per proposal §4. 0 = no
   * override (sanity test); 1 = full failover (allowed per §4
   * trigger 1).
   */
  fraction: z.number().min(0).max(1),
  /** Free-text rationale citing the trigger (quarterly cadence / failover trigger). */
  rationale: z.string().min(1),
  /** Strong identity of the activator. Convention: `agent:tomas` / `agent:devon`. */
  activatedBy: z.string().min(1),
});

export type SwitchTestActivatedPayload = z.infer<typeof switchTestActivatedPayloadSchema>;

export function makeSwitchTestActivated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SwitchTestActivatedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SwitchTestActivated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: switchTestActivatedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SwitchTestEnded
//
// Closes the switch-test window opened by a prior `SwitchTestActivated`
// with the same `windowId`. After this event folds, the routing
// projection treats `primary`-intent traffic as straight `primary`
// again.
// ---------------------------------------------------------------------------

export const switchTestEndedPayloadSchema = z.object({
  /** windowId that this end-event closes. Pairs with `SwitchTestActivated.windowId`. */
  windowId: z.string().min(1),
  /** ISO-8601 — when the window closed. */
  closedAt: z.string().min(1),
  /**
   * One-line reason — usually `quarterly-cycle-complete`, `failover-resolved`,
   * `manual-close`. Free-form at v0; types to an enum when slice #2 lands.
   */
  reason: z.string().min(1),
  /** Strong identity of the closer. Convention: `agent:tomas` / `agent:devon`. */
  closedBy: z.string().min(1),
});

export type SwitchTestEndedPayload = z.infer<typeof switchTestEndedPayloadSchema>;

export function makeSwitchTestEnded(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SwitchTestEndedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SwitchTestEnded",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: switchTestEndedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SwitchTestReport
//
// Emitted at window-end with the observed fraction, leg counts, latency
// stats, and any breach indicators. Consumed by Vera's continuous-controls
// recon to assert the switch-test was performed at the declared
// fraction-band, and by Helena (CRO) + Rohan (Risk engineer) for RAS
// appetite-line checks (per proposal §4).
// ---------------------------------------------------------------------------

export const switchTestReportPayloadSchema = z.object({
  /** windowId reported on. */
  windowId: z.string().min(1),
  /** Total `primary`-intent legs observed during the window. */
  primaryIntentCount: z.number().int().nonnegative(),
  /** Total legs actually routed via backup during the window. */
  routedViaBackupCount: z.number().int().nonnegative(),
  /** Observed override fraction, computed at report time. */
  observedFraction: z.number().min(0).max(1),
  /** Configured override fraction the window opened at. */
  configuredFraction: z.number().min(0).max(1),
  /**
   * True iff `observedFraction` strayed outside the appetite band
   * (quarterly default 0.05–0.10). The breach test itself is owned by
   * Helena (Chief Risk Officer, governance) + Rohan (Risk engineer);
   * v0 records the indicator on the report so the breach test has its
   * input.
   */
  appetiteBandBreached: z.boolean(),
  /** Free-text notes — exceptions, operator interventions, tooling gaps. */
  notes: z.string().min(1),
});

export type SwitchTestReportPayload = z.infer<typeof switchTestReportPayloadSchema>;

export function makeSwitchTestReport(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SwitchTestReportPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SwitchTestReport",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: switchTestReportPayloadSchema.parse(args.payload),
  });
}

// ===========================================================================
// LEGAL-ENTITY EVENT FAMILY (D-LEGAL-ENTITY-TREE-V0 + D-REGULATORY-PERIMETER)
//
// Three typed events that materialise the v0 legal-entity tree (Hoz Group
// Limited / Hoz Bank Limited / Hoz Securities Limited) into the event log
// per Principle 1 (events are the source of truth) and Principle 5
// (multi-entity from day one).
//
// Substrate gap closed by this section:
//   - The Imani (Legal-as-code engineer) + Owen (Company Secretary,
//     governance) joint v0 spec at
//     `Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md` (§6)
//     sketched the payload shape; this is the runtime substrate.
//   - The CEO-resolved D-REGULATORY-PERIMETER decision (PR #85) named
//     three regulatoryRegimes (PA / JSE / none-companies-act-only); the
//     `regulatoryRegime` field on `LegalEntityRegistered` carries that
//     designation in a typed enum.
//
// Authors of the substantive content:
//   - Imani (Legal-as-code engineer; reports to Devon, COO, governance)
//   - Owen (Company Secretary, governance; reports to CEO)
// Substrate author:
//   - Atlas (Core banking platform architect; reports to Devon, COO)
//
// Citation classes (Principle 2):
//   - `LegalEntityRegistered` — Companies Act 71 of 2008, Banks Act 94
//     of 1990 § 7 / § 60, FAIS Act 37 of 2002, JSE Rules.
//   - `LegalEntityChanged` — Companies Act § 16 (MOI amendments), § 71
//     (director removals), Banks Act § 60 (controlling-company changes).
//   - `IntraGroupArrangementSigned` — Companies Act § 75 (director
//     conflicts), IAS 24 (related-party disclosures), Banks Act § 73
//     (large-exposure limits, intra-group), OECD TP Guidelines.
//
// Sibling event `RegulatoryLicenceStatusChanged` is sketched in the spec
// but deferred to the licence-application work (out of scope for v0;
// licence-day is far enough out that the typed schema waits for the
// producer to land).
// ===========================================================================

// ---------------------------------------------------------------------------
// LegalEntityRegistered
//
// Emitted when a new legal entity enters the bank's perimeter — at v0,
// the three Hoz entities seeded from `Regulations/_legal-entity-tree.md`
// via `prototype/seeds/legal-entity-tree.json`. The eventual auto-emit
// path is "CIPC reservation completes → registrar substrate emits
// LegalEntityRegistered". Until that path lands, the seed-loader is the
// emitter (substrate gap captured in the completion note).
// ---------------------------------------------------------------------------

export const legalEntityRegisteredPayloadSchema = z.object({
  /**
   * Stable URN. Convention: `urn:legal-entity:<group-slug>:<entity-slug>:v1`.
   * The version suffix is for forward-compat with re-registrations
   * (e.g. a change of legal name that issues a new entity-id rather than
   * a `LegalEntityChanged`).
   */
  entityId: z.string().min(1),
  /** Full registered name. e.g. "Hoz Group Limited". */
  legalName: z.string().min(1),
  /**
   * Companies Act registered form. `Ltd` (public), `RF` (ring-fenced
   * variant), `Pty` (private). Banks Act § 11 requires the bank entity
   * to be `Ltd`; the registry asserts that downstream.
   */
  registeredForm: z.enum(["Ltd", "RF", "Pty"]),
  /**
   * ISO 3166-1 alpha-2 country code. v0 expects "ZA" for the three Hoz
   * entities; multi-jurisdiction is in scope per Principle 5.
   */
  jurisdiction: z.string().length(2),
  /** Registered office address. v0 carries street-level placeholders. */
  registeredOffice: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    country: z.string().length(2),
  }),
  /**
   * URN of the parent entity, or null for the top-of-tree group. The
   * registrar substrate enforces tree-shape (no cycles, single parent
   * per child) at append time; v0 ships the invariant in the seed and
   * defers the runtime enforcement to the entity-tree projection.
   */
  parentEntityId: z.string().min(1).nullable(),
  /**
   * Regulatory-perimeter designation per D-REGULATORY-PERIMETER (PR #85).
   * `primaryRegulator` is the seat that signs the licence; `regimeAnchor`
   * is the ordered list of statutory / regulatory anchors that bind the
   * entity. `none-companies-act-only` is the parent-of-bank holdco
   * designation under Banks Act § 60 consolidated supervision (the
   * group is not separately licensed; the bank's licence and the
   * controlling-company designation between them establish the regime).
   */
  regulatoryRegime: z.object({
    primaryRegulator: z.enum(["PA", "JSE", "FSCA", "none-companies-act-only", "other"]),
    regimeAnchor: z.array(z.string().min(1)).min(1),
  }),
  /**
   * Director roster at registration. Each entry references a fit-and-
   * proper file (Sade's HR substrate at v0; Owen reviews per-entity
   * submissions). v0 permits an empty array because shared-board
   * appointments may post-date entity registration — the
   * `LegalEntityChanged` `director-added` change-type fills the gap.
   */
  directors: z.array(
    z.object({
      name: z.string().min(1),
      fitAndProperFileId: z.string().min(1),
      appointmentDate: z.string().min(1),
    }),
  ),
  /** ISO 8601 date the entity was registered with CIPC (or equivalent). */
  registrationDate: z.string().min(1),
});

export type LegalEntityRegisteredPayload = z.infer<typeof legalEntityRegisteredPayloadSchema>;

export function makeLegalEntityRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LegalEntityRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LegalEntityRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: legalEntityRegisteredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LegalEntityChanged
//
// Emitted on any change to a registered entity — renames, parent-of
// changes, director-additions / removals, regulatory-regime updates,
// registered-office moves. Each event records both the prior value and
// the new value so the entity-tree projection can replay-fold to any
// as-of without re-walking the whole history.
// ---------------------------------------------------------------------------

export const legalEntityChangedPayloadSchema = z.object({
  /** URN of the entity being changed. Must match a prior `LegalEntityRegistered`. */
  entityId: z.string().min(1),
  /**
   * Typed change discriminator. The projection dispatches on this to
   * decide which field to update.
   */
  changeType: z.enum([
    "renamed",
    "parent-changed",
    "director-added",
    "director-removed",
    "regulatory-regime-updated",
    "registered-office-changed",
  ]),
  /**
   * The value before the change. Untyped at the envelope level — the
   * projection knows how to interpret it given `changeType`. Required
   * (a change-event without a prior value is a registration, not a
   * change).
   */
  priorValue: z.unknown().refine((v) => v !== undefined, {
    message: "priorValue is required (use null for explicit absence; undefined is rejected)",
  }),
  /** The value after the change. Required for symmetric reasons. */
  newValue: z.unknown().refine((v) => v !== undefined, {
    message: "newValue is required (use null for explicit absence; undefined is rejected)",
  }),
  /** ISO 8601 date the change took effect. */
  effectiveDate: z.string().min(1),
});

export type LegalEntityChangedPayload = z.infer<typeof legalEntityChangedPayloadSchema>;

export function makeLegalEntityChanged(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LegalEntityChangedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LegalEntityChanged",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: legalEntityChangedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IntraGroupArrangementSigned
//
// Emitted when an inter-company arrangement (services / IP licensing /
// capital injection / intra-group exposure / other related-party) is
// executed between two entities in the group. Discharges the IAS 24
// related-party disclosure substrate and the Companies Act § 75
// director-conflict register; Yael (Tax engineer; reports to Camille,
// CFO, governance) consumes the stream for transfer-pricing analysis.
// ---------------------------------------------------------------------------

export const intraGroupArrangementSignedPayloadSchema = z
  .object({
    /**
     * Stable ID for the arrangement. Convention:
     * `arrangement:<from-slug>:<to-slug>:<arrangement-type>:<v>`.
     */
    arrangementId: z.string().min(1),
    /**
     * Typed arrangement-class. Mirrors the IAS 24 + Companies Act
     * § 75 + Banks Act § 73 categorisation in the v0 spec §2.
     */
    arrangementType: z.enum([
      "services",
      "ip-licensing",
      "capital-injection",
      "intra-group-exposure",
      "other-related-party",
    ]),
    /** URN of the providing / paying entity. */
    fromEntityId: z.string().min(1),
    /** URN of the receiving / billed entity. */
    toEntityId: z.string().min(1),
    /** ISO 8601 effective date. */
    effectiveDate: z.string().min(1),
    /**
     * Optional ISO 8601 termination date. Null / undefined =
     * evergreen-until-superseded; many intra-group arrangements (the
     * services agreement, the IP licence) are open-ended.
     */
    terminationDate: z.string().min(1).optional(),
    /**
     * Free-text rationale for arm's-length pricing. v0 carries
     * `[citation: TBC pending Yael TP analysis]` placeholders; the
     * substantive contracts land closer to licence-day.
     */
    armsLengthRationale: z.string().min(1),
    /**
     * Reference to the IAS 24 related-party disclosure that captures
     * this arrangement in the consolidated AFS. Convention:
     * `disclosure:<entity-slug>:<period>:ias24:<arrangement-id>`.
     */
    "IAS24-disclosure-ref": z.string().min(1),
  })
  .refine((p) => p.fromEntityId !== p.toEntityId, {
    message: "fromEntityId and toEntityId must differ (no self-arrangements)",
    path: ["toEntityId"],
  });

export type IntraGroupArrangementSignedPayload = z.infer<
  typeof intraGroupArrangementSignedPayloadSchema
>;

export function makeIntraGroupArrangementSigned(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IntraGroupArrangementSignedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IntraGroupArrangementSigned",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: intraGroupArrangementSignedPayloadSchema.parse(args.payload),
  });
}

// ===========================================================================
// Product-lifecycle event family (12 events).
//
// Authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2 (CEO approved
// 2026-05-10). Source brief §4 — typed-event surface; the 12 events
// that govern a Product's lifecycle from proposal through retirement.
//
// All twelve are `append-only-audit` per §4 of the source brief: the
// Product's *current state* (lifecycle stage, conditions, gates
// cleared) is a projection over this stream — never stored as
// authoritative.
//
// Per Q2 resolution: per-dimension agent emits its own
// `ProductDimensionAttested`; the orchestrator only sequences and
// assembles into `ProductDueDiligenceCompleted`. The emitting agent
// is recorded in the standard envelope's `actor` field — no separate
// `producedBy` field is added at v1 (the prompt specifies "do not
// invent fields beyond what the brief specifies").
//
// Per Q3 resolution: `ProductDimensionAttested.result` carries
// `"design-attested"` vs `"implementation-attested"` distinction.
//
// Author: Atlas (substrate) · Kai (markets engineering; co-author).
// ===========================================================================

/** Product family — mirrors `productFamilySchema` in
 * `@platform/markets/products/types`. Re-declared here as a small
 * literal to avoid a runtime cycle between event-store and markets. */
const productFamilyForEventSchema = z.enum([
  "listed-equity",
  "listed-bond",
  "repo",
  "otc-ird",
  "fx",
  "structured",
]);

// ---------------------------------------------------------------------------
// 1. ProductProposalRegistered — `{productId, family, proposedBy, asOf}`
// ---------------------------------------------------------------------------

export const productProposalRegisteredPayloadSchema = z.object({
  productId: z.string().min(1),
  family: productFamilyForEventSchema,
  /** Agent or human ref that proposed the product (e.g. "agent:Saskia"). */
  proposedBy: z.string().min(1),
  /** ISO-8601 of the proposal moment. Distinct from envelope as_of for traceability. */
  asOf: z.string().min(1),
});

export type ProductProposalRegisteredPayload = z.infer<
  typeof productProposalRegisteredPayloadSchema
>;

export function makeProductProposalRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductProposalRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductProposalRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productProposalRegisteredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 2. ProductConceptualised — `{productId, version, cdmComposition, lifecycleEventFamily}`
// ---------------------------------------------------------------------------

export const productConceptualisedPayloadSchema = z.object({
  productId: z.string().min(1),
  /** Semver. */
  version: z.string().min(1),
  /**
   * The CDM-composition snapshot at conceptualisation. Free-shape
   * record at v1 (the canonical typed shape lives in
   * `@platform/markets/products/types.cdmCompositionSchema`); this
   * event records the snapshot rather than re-validating to keep the
   * event-store layer free of a downward dependency on the markets
   * package.
   */
  cdmComposition: z.record(z.unknown()),
  /** Per-trade lifecycle event types this product produces. */
  lifecycleEventFamily: z.array(z.string().min(1)),
});

export type ProductConceptualisedPayload = z.infer<typeof productConceptualisedPayloadSchema>;

export function makeProductConceptualised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductConceptualisedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductConceptualised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productConceptualisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 3. ProductDueDiligenceCompleted — `{productId, gatesCleared[], gatesFailed[]}`
// ---------------------------------------------------------------------------

export const productDueDiligenceCompletedPayloadSchema = z.object({
  productId: z.string().min(1),
  /** Dimension names that cleared. */
  gatesCleared: z.array(z.string().min(1)),
  /** Dimension names that failed. Per Q4 resolution, gatesFailed[] non-empty
   *  lifts a Decisions-for-CEO card and waits — it does NOT auto-progress. */
  gatesFailed: z.array(z.string().min(1)),
});

export type ProductDueDiligenceCompletedPayload = z.infer<
  typeof productDueDiligenceCompletedPayloadSchema
>;

export function makeProductDueDiligenceCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductDueDiligenceCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductDueDiligenceCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productDueDiligenceCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 4. ProductDueDiligenceWithheld — `{productId, gatesFailed[], remediation}`
// ---------------------------------------------------------------------------

export const productDueDiligenceWithheldPayloadSchema = z.object({
  productId: z.string().min(1),
  gatesFailed: z.array(z.string().min(1)).min(1),
  /** Remediation plan (narrative). */
  remediation: z.string().min(1),
});

export type ProductDueDiligenceWithheldPayload = z.infer<
  typeof productDueDiligenceWithheldPayloadSchema
>;

export function makeProductDueDiligenceWithheld(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductDueDiligenceWithheldPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductDueDiligenceWithheld",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productDueDiligenceWithheldPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 5. ProductDimensionAttested — `{productId, dimension, result, citationChain}`
//
// Per Q2 resolution: per-dimension agent emits this; the orchestrator
// only sequences. The emitting agent is recorded via the envelope's
// `actor` field.
//
// Per Q3 resolution: `result` distinguishes "design-attested" (substrate
// not yet built; the gate is design-clear) from "implementation-attested"
// (substrate built, gate runtime-clear). The schema also tolerates
// "failed" for completeness — pairs into ProductDueDiligenceWithheld.
// ---------------------------------------------------------------------------

export const productDimensionAttestedResultSchema = z.enum([
  "design-attested",
  "implementation-attested",
  "failed",
]);

export type ProductDimensionAttestedResult = z.infer<typeof productDimensionAttestedResultSchema>;

export const productDimensionAttestedPayloadSchema = z.object({
  productId: z.string().min(1),
  /** Dimension name — e.g. "market-risk", "accounting", "AML". */
  dimension: z.string().min(1),
  result: productDimensionAttestedResultSchema,
  /** Citation chain — Principle 2 anchor for the attestation. Non-empty. */
  citationChain: z.array(z.string().min(1)).min(1),
});

export type ProductDimensionAttestedPayload = z.infer<typeof productDimensionAttestedPayloadSchema>;

export function makeProductDimensionAttested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductDimensionAttestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductDimensionAttested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productDimensionAttestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 6. ProductApproved — `{productId, version, conditions[], approvedBy}`
// ---------------------------------------------------------------------------

export const productApprovedPayloadSchema = z.object({
  productId: z.string().min(1),
  version: z.string().min(1),
  /** Conditions imposed at approval (open list). */
  conditions: z.array(z.string().min(1)),
  /** Agent or human ref that approved (e.g. "human:marc@tgv.co.za" pre-Board). */
  approvedBy: z.string().min(1),
});

export type ProductApprovedPayload = z.infer<typeof productApprovedPayloadSchema>;

export function makeProductApproved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductApprovedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductApproved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productApprovedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 7. ProductWithheld — `{productId, version, reason}`
// ---------------------------------------------------------------------------

export const productWithheldPayloadSchema = z.object({
  productId: z.string().min(1),
  version: z.string().min(1),
  reason: z.string().min(1),
});

export type ProductWithheldPayload = z.infer<typeof productWithheldPayloadSchema>;

export function makeProductWithheld(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductWithheldPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductWithheld",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productWithheldPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 8. ProductLaunched — `{productId, version, controlledLaunchLimits, launchedAt}`
// ---------------------------------------------------------------------------

export const productLaunchedPayloadSchema = z.object({
  productId: z.string().min(1),
  version: z.string().min(1),
  /** Controlled-launch limits, free-shape record (limit-name -> value). */
  controlledLaunchLimits: z.record(z.unknown()),
  /** ISO-8601 launch moment. */
  launchedAt: z.string().min(1),
});

export type ProductLaunchedPayload = z.infer<typeof productLaunchedPayloadSchema>;

export function makeProductLaunched(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductLaunchedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductLaunched",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productLaunchedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 9. ProductPostImplementationReviewCompleted — `{productId, verdict, amendedConditions[]}`
// ---------------------------------------------------------------------------

export const productPostImplementationReviewCompletedPayloadSchema = z.object({
  productId: z.string().min(1),
  verdict: z.enum(["passed", "passed-with-conditions", "remediation-required", "withdrawn"]),
  amendedConditions: z.array(z.string().min(1)),
});

export type ProductPostImplementationReviewCompletedPayload = z.infer<
  typeof productPostImplementationReviewCompletedPayloadSchema
>;

export function makeProductPostImplementationReviewCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductPostImplementationReviewCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductPostImplementationReviewCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productPostImplementationReviewCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 10. ProductReviewCompleted — `{productId, cycle, verdict}` (annual)
// ---------------------------------------------------------------------------

export const productReviewCompletedPayloadSchema = z.object({
  productId: z.string().min(1),
  /** Review cycle ref — e.g. "2026-annual". */
  cycle: z.string().min(1),
  verdict: z.enum(["passed", "passed-with-conditions", "remediation-required", "retire"]),
});

export type ProductReviewCompletedPayload = z.infer<typeof productReviewCompletedPayloadSchema>;

export function makeProductReviewCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductReviewCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductReviewCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productReviewCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 11. ProductRetired — `{productId, reason, migrationPath}`
// ---------------------------------------------------------------------------

export const productRetiredPayloadSchema = z.object({
  productId: z.string().min(1),
  reason: z.string().min(1),
  /** Migration path for open positions (narrative; binds to Imani's clause library). */
  migrationPath: z.string().min(1),
});

export type ProductRetiredPayload = z.infer<typeof productRetiredPayloadSchema>;

export function makeProductRetired(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductRetiredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductRetired",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productRetiredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 12. ProductVersionPublished — `{productId, oldVersion, newVersion, materialChanges[]}`
//
// Per Q5 resolution: material changes increment version on the same
// productId; new productId is reserved for genuinely new products.
// ---------------------------------------------------------------------------

export const productVersionPublishedPayloadSchema = z.object({
  productId: z.string().min(1),
  oldVersion: z.string().min(1),
  newVersion: z.string().min(1),
  /** List of material-change descriptions (narrative). */
  materialChanges: z.array(z.string().min(1)).min(1),
});

export type ProductVersionPublishedPayload = z.infer<typeof productVersionPublishedPayloadSchema>;

export function makeProductVersionPublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductVersionPublishedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductVersionPublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productVersionPublishedPayloadSchema.parse(args.payload),
  });
}

// ===========================================================================
// RMS Phase 1 Slice 2 — seven typed event payload schemas.
//
// Authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09); slice authorisation
// D-RMS-PHASE-1-SLICE-2. Spec at
// `Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`
// §3 (Event type definitions).
//
// S8/RMS overlap disposition (Scrooge ruling, 2026-05-10): RMS owns the seven
// records-of-agent-runs event types below — `AgentBriefIssued`,
// `AgentRunStarted`, `AgentRunCompleted`, `DecisionRequested`, `Feedback`,
// `BriefSuperseded`, `RecordFiled`. They are agent-run *records*, not
// agent-runtime *primitives*. S8 keeps the runtime primitives
// (`AgentRegistered`, `AgentRetired`, `IdentityKeyRotated`,
// `PermissionPolicyPublished`, `AgentDecision`, plus the AgentEscalation
// family). `AgentRunStarted` / `AgentRunCompleted` previously sat in the
// registry as envelope-only rows under the runtime class — Slice 2 adds typed
// payload schemas without changing class / issuer / subscribers.
//
// Each event payload references stored documents by `documentHash` (or its
// `…Hashes` plural) — the BLAKE3 hex strings the document-store from Slice 1
// returns. The payload schemas validate the format prefix; the document store
// itself is the source of truth for whether the bytes resolve.
//
// Every event also carries an `agent` ref pairing `name` + `position` per the
// identity-discipline rule (CLAUDE.md "Dispatch discipline").
//
// Author: Owen (Company Secretary, governance) +
//         Atlas (Core banking platform architect, engineering)
// ===========================================================================

/**
 * Reusable agent reference shape — `{ name, position, agentId? }`. The
 * identity-discipline rule (CLAUDE.md "Dispatch discipline") requires every
 * agent reference to pair name + position on first mention; this schema
 * enforces it at the payload boundary.
 */
export const rmsAgentRefSchema = z.object({
  /** Display name, e.g. "Scrooge", "Owen", "Atlas". Matches /Team/<Name>.md. */
  name: z.string().min(1),
  /** Seat / role on first mention, e.g. "Chief of Staff / Orchestrator". */
  position: z.string().min(1),
  /** Optional strong identity, e.g. `agent:scrooge` or `urn:agent:bank:scrooge`. */
  agentId: z.string().min(1).optional(),
});
export type RmsAgentRef = z.infer<typeof rmsAgentRefSchema>;

/**
 * BLAKE3 document-hash string. Format: `blake3:<64-hex-chars>`. Matches the
 * `DocumentHash` shape returned by `platform/document-store/hash.ts`. The
 * payload schema validates the format prefix; the document store is the
 * source of truth for whether the bytes resolve.
 */
const documentHashSchema = z
  .string()
  .regex(/^blake3:[0-9a-f]{64}$/, "documentHash must match `blake3:<64-hex-chars>`");

// ---------------------------------------------------------------------------
// RMS-1 — AgentBriefIssued
//
// Scrooge dispatches a brief to an agent. The brief body is content-addressed
// in the document store (`directiveDocumentHash`). Reduces into the Briefs /
// Dispatches register; status derives from downstream `AgentRunStarted` /
// `AgentRunCompleted` / `BriefSuperseded`.
//
// Spec §3.1.
// ---------------------------------------------------------------------------

export const agentBriefIssuedPayloadSchema = z.object({
  /** Stable brief identifier. Convention: `brief:<agent>:<short-slug>`. */
  briefId: z.string().min(1),
  /** Agent the brief is dispatched to. */
  issuedTo: rmsAgentRefSchema,
  /** Agent issuing the brief — typically Scrooge (Chief of Staff / Orchestrator). */
  issuedBy: rmsAgentRefSchema,
  /** One-line title of the brief. */
  title: z.string().min(1),
  /** BLAKE3 hash of the directive body (markdown). */
  directiveDocumentHash: documentHashSchema,
  /** Optional workstream this brief belongs to. */
  workstreamId: z.string().min(1).optional(),
  /** Dispatch priority. */
  priority: z.enum(["now", "next-tick", "scheduled"]),
  /** ISO 8601; required when `priority === "scheduled"`. */
  scheduledFor: z.string().min(1).optional(),
  /** Prior briefId this supersedes, if any. */
  supersedes: z.string().min(1).optional(),
  /** Expected outputs the brief targets. */
  expectedOutputs: z
    .array(
      z.object({
        kind: z.enum(["decision-card", "deliverable-document", "register-row", "code-pr"]),
        description: z.string().min(1),
      }),
    )
    .min(1),
});

export type AgentBriefIssuedPayload = z.infer<typeof agentBriefIssuedPayloadSchema>;

export function makeAgentBriefIssued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentBriefIssuedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentBriefIssued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentBriefIssuedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RMS-2 — AgentRunStarted
//
// The agent runtime — or Scrooge in-session as the P7 fallback — opens an
// agent run against a brief. Pair-coupled with `AgentRunCompleted` via
// `runId`. Reduces into Records-of-agent-runs (lifecycle row); updates the
// Briefs register status to `in-flight`.
//
// Pre-existing envelope-only registry row (registry §RUNTIME #6); Slice 2
// adds the typed payload schema without changing class / replay rule.
//
// Spec §3.2.
// ---------------------------------------------------------------------------

export const agentRunStartedPayloadSchema = z.object({
  /** Stable run identifier. Convention: `run:<agent>:<iso-utc>:<short>`. */
  runId: z.string().min(1),
  /** Brief this run is executing. */
  briefId: z.string().min(1),
  /** Agent executing the run. */
  agent: rmsAgentRefSchema,
  /** ISO 8601 — when the agent began work. */
  startedAt: z.string().min(1),
  /** Substrate carrying the run. */
  substrate: z.enum(["agent-runtime", "scrooge-coordinated-in-session"]),
  /** Optional worktree path when the run is isolated (CLAUDE.md "Dispatch discipline"). */
  worktree: z.string().min(1).optional(),
});

export type AgentRunStartedPayload = z.infer<typeof agentRunStartedPayloadSchema>;

export function makeAgentRunStarted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentRunStartedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentRunStarted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentRunStartedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RMS-3 — AgentRunCompleted
//
// Closes the run lifecycle. Records the deliverable document hashes, the
// substrate gaps the run surfaced (Principle 6 — surface, do not hide),
// citations, and any follow-on routes the agent fans out (downstream briefs,
// decisions, register updates). Reduces into Records-of-agent-runs (closes
// the row); each `deliverableDocumentHash` becomes a Document Register row;
// `followOnRoutes` fan into `AgentBriefIssued` / `DecisionRequested`.
//
// Pre-existing envelope-only registry row (registry §RUNTIME #7); Slice 2
// adds the typed payload schema without changing class / replay rule.
//
// Spec §3.3.
// ---------------------------------------------------------------------------

export const agentRunCompletedFollowOnRouteSchema = z.object({
  kind: z.enum(["agent", "decision", "register-update"]),
  /** Agent ref string, decisionId, or register key. */
  target: z.string().min(1),
  /** Free-form directive the upstream agent attaches. */
  directive: z.string().min(1),
});

export type AgentRunCompletedFollowOnRoute = z.infer<typeof agentRunCompletedFollowOnRouteSchema>;

export const agentRunCompletedPayloadSchema = z.object({
  runId: z.string().min(1),
  briefId: z.string().min(1),
  agent: rmsAgentRefSchema,
  /** ISO 8601 — when the agent finished. */
  completedAt: z.string().min(1),
  /** Outcome of the run. `delivered` / `blocked` / `withdrawn`. */
  outcome: z.enum(["delivered", "blocked", "withdrawn"]),
  /** BLAKE3 hashes of the run's deliverable documents. May be empty for `withdrawn`. */
  deliverableDocumentHashes: z.array(documentHashSchema),
  /**
   * Substrate gaps the run surfaced (Principle 6 — surface gaps, do not hide).
   * Free-form sentences naming what blocked a fully-autonomous run.
   */
  substrateGapsSurfaced: z.array(z.string().min(1)),
  /** Citations the deliverable rests on (Principle 2). */
  citations: z.array(z.string().min(1)),
  /** Follow-on routes the agent fans out. */
  followOnRoutes: z.array(agentRunCompletedFollowOnRouteSchema),
});

export type AgentRunCompletedPayload = z.infer<typeof agentRunCompletedPayloadSchema>;

export function makeAgentRunCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentRunCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentRunCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentRunCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RMS-4 — DecisionRequested
//
// Any agent or process surfaces a decision needing CEO / Board / governance-
// committee call. Pair-coupled with `CeoDecision` via `decisionId`. Reduces
// into the Decisions register (status `open` until a matching `CeoDecision`
// resolves it).
//
// Spec §3.4.
// ---------------------------------------------------------------------------

export const decisionRequestedPayloadSchema = z.object({
  /** Stable decision identifier. Convention: `D-<SHORT-NAME>`. */
  decisionId: z.string().min(1),
  /** One-line title of the decision. */
  title: z.string().min(1),
  /** Decision category for routing / pacing. */
  category: z.enum([
    "pacing",
    "near-term",
    "second-order",
    "medium-term",
    "long-horizon",
    "substrate-foundational",
  ]),
  /** Proposing agent. */
  owner: rmsAgentRefSchema,
  /** Whose decision this is. */
  forActor: z.enum(["CEO", "Board", "AC", "ALCO", "BRC"]),
  /** The question the decider must answer, in their voice. */
  decisionForActor: z.string().min(1),
  /** Recommendation from the proposing agent. */
  recommendation: z.object({
    stance: z.string().min(1),
    reasoning: z.string().min(1),
  }),
  /** Source / supporting documents (BLAKE3 hashes). May be empty. */
  sourceDocumentHashes: z.array(documentHashSchema),
  /** Citations constraining the decision. */
  citations: z.array(z.string().min(1)),
  /** ISO 8601 deadline, or undefined for "no deadline". */
  deadline: z.string().min(1).optional(),
  /** Options the decider may pick from. Empty = free-form decision. */
  options: z
    .array(
      z.object({
        label: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .optional(),
});

export type DecisionRequestedPayload = z.infer<typeof decisionRequestedPayloadSchema>;

export function makeDecisionRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DecisionRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DecisionRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: decisionRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RMS-5 — Feedback
//
// Captures human (CEO chat-message) or recon feedback on an agent output. The
// most novel event type in RMS — see spec §17. Reduces into the Feedback
// register; `directive` classifications auto-fan into `AgentBriefIssued`.
//
// Spec §3.6.
// ---------------------------------------------------------------------------

export const feedbackPayloadSchema = z.object({
  /** Stable feedback identifier. Convention: `feedback:<short-slug>`. */
  feedbackId: z.string().min(1),
  /** Where the feedback comes from. */
  from: z.object({
    actor: z.enum(["CEO", "Board", "Agent"]),
    /** Strong identity, e.g. `human:marc@tgv.co.za` or `agent:scrooge`. */
    identity: z.string().min(1),
    /** Optional agent ref when actor === "Agent". */
    agent: rmsAgentRefSchema.optional(),
  }),
  /** Channel the feedback arrived on. */
  channel: z.enum([
    "chat",
    "decisions-desk-comment",
    "register-annotation",
    "review-meeting-record",
  ]),
  /** ISO 8601 — when the feedback was intaked. */
  intakeAt: z.string().min(1),
  /** What the feedback is about. */
  subject: z.object({
    kind: z.enum(["decision", "brief", "run", "register", "policy", "principle", "operating-rule"]),
    /** Reference to the subject — decisionId, briefId, runId, register key, etc. */
    ref: z.string().min(1),
  }),
  /** Short body. Long-form bodies live in the document store via `bodyDocumentHash`. */
  body: z.string().min(1),
  /** Optional BLAKE3 hash of the long-form body. */
  bodyDocumentHash: documentHashSchema.optional(),
  /** Classifications. */
  classifications: z
    .array(z.enum(["directive", "preference", "correction", "question", "praise", "concern"]))
    .min(1),
  /** Optional fan-out targets. */
  routedTo: z.array(rmsAgentRefSchema).optional(),
});

export type FeedbackPayload = z.infer<typeof feedbackPayloadSchema>;

export function makeFeedback(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FeedbackPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "Feedback",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: feedbackPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RMS-6 — BriefSuperseded
//
// An older brief is withdrawn or replaced by a newer one. Append-only audit
// (no edit-in-place); the supersession chain is the audit trail. Reduces
// into the Briefs register (marks the row `superseded`); flags any in-flight
// run on the original brief.
//
// Spec §3.7.
// ---------------------------------------------------------------------------

export const briefSupersededPayloadSchema = z.object({
  /** The brief being superseded. */
  originalBriefId: z.string().min(1),
  /** The brief replacing it. */
  supersededBy: z.string().min(1),
  /** Why the supersession. */
  reason: z.enum(["withdrawn", "merged", "scope-changed", "actioned-out-of-band"]),
  /** Agent authorising the supersession. */
  authorisedBy: rmsAgentRefSchema,
});

export type BriefSupersededPayload = z.infer<typeof briefSupersededPayloadSchema>;

export function makeBriefSuperseded(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BriefSupersededPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BriefSuperseded",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: briefSupersededPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RMS-7 — RecordFiled
//
// An artefact has been filed into the document store as a *record*
// (governance sense — not a draft). Carries the BLAKE3 document hash,
// register classification, and retention regime. Owen's note (spec §3.8):
// this is the event that turns a markdown into a *record*.
//
// Reduces into the Document Register; the named register's row gains the
// `recordId`.
//
// Spec §3.8.
// ---------------------------------------------------------------------------

export const recordFiledPayloadSchema = z.object({
  /** Stable record identifier. Convention: `record:<register>:<short-slug>`. */
  recordId: z.string().min(1),
  /** Which register this record belongs to. */
  registerKey: z.enum([
    "decisions",
    "correspondence",
    "agent-runs",
    "documents",
    "feedback",
    "briefs",
    "workstreams",
  ]),
  /** BLAKE3 hash of the canonical document body. */
  documentHash: documentHashSchema,
  /** Classification — drives access controls + dashboard visibility. */
  classification: z.enum([
    "ceo-only",
    "governance-seat",
    "engineering-seat",
    "agent-internal",
    "public-disclosure",
  ]),
  /** Retention regime (POPIA / Companies Act / Banks Act / FIC / records-management policy). */
  retention: z.object({
    /** Obligations-register URN or `ORG-<DOMAIN>-<NN>` identifier. */
    citationRef: z.string().min(1),
    /** Minimum retention horizon in years (regulator-mandated floor). */
    minimumYears: z.number().int().positive(),
    /** Archival tier (matches event-store retention `archivalTier` taxonomy). */
    archivalTier: z.enum(["hot", "cool", "archive"]),
  }),
  /** Prior record this one supersedes, if any. */
  supersedes: z.string().min(1).optional(),
  /** True iff this record corrects errors in the prior `supersedes` record. */
  correctsOriginalErrors: z.boolean().optional(),
});

export type RecordFiledPayload = z.infer<typeof recordFiledPayloadSchema>;

export function makeRecordFiled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RecordFiledPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RecordFiled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: recordFiledPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CeoDecision payload — RMS additive extension.
//
// Per spec §3.5 + the S8/RMS overlap disposition (Scrooge ruling, 2026-05-10):
// the existing `CeoDecision` event remains substantively complete; RMS
// extends it minimally with three optional / additive fields:
//
//   - `requestEventId`            — the `DecisionRequested` event this CeoDecision resolves.
//   - `recordDocumentHashes`      — BLAKE3 hashes of the typed CEO-decision-record artefacts.
//   - `modifiedRecommendation`    — present when `action === "modify"`, captures the modified stance.
//
// Backwards compatible: events without these fields continue to work; the
// dashboard's resolved-decision derivation is unchanged for legacy events.
// `recordCeoDecision()` in `runtime/decisions/record.ts` continues to author
// CeoDecision events without these fields; the typed Zod payload schema
// here is the contract for future writers (RMS Slice 3 + dashboard /api/decide
// pickup) and is published so consumers can validate against it.
//
// This schema is *not* yet wired into `eventSchema` envelope-validation for
// `CeoDecision` (the existing append path in `recordCeoDecision()` does not
// use a typed payload schema); Slice 3 will wire it through the registry.
// Today it is the documented surface for the new fields.
// ---------------------------------------------------------------------------

export const ceoDecisionRmsExtendedPayloadSchema = z.object({
  // pre-existing fields (unchanged):
  decisionId: z.string().min(1),
  action: z.enum(["approve", "defer", "modify", "request-revision"]),
  title: z.string().min(1),
  outcome: z.string().min(1),
  comment: z.string().optional(),
  /** Legacy markdown-path field — deprecated under RMS, retained for back-compat. */
  sourceDoc: z.string().optional(),
  followOnRoutes: z.array(z.string().min(1)).optional(),
  recordedVia: z.string().min(1),

  // new in RMS Slice 2 (additive, all optional):
  /** EventId of the `DecisionRequested` event this `CeoDecision` resolves. */
  requestEventId: z.string().min(1).optional(),
  /** BLAKE3 hashes of the typed CEO-decision-record artefacts. */
  recordDocumentHashes: z.array(documentHashSchema).optional(),
  /** Present when `action === "modify"`; captures the modified stance + reasoning. */
  modifiedRecommendation: z
    .object({
      stance: z.string().min(1),
      reasoning: z.string().min(1),
    })
    .optional(),
});

export type CeoDecisionRmsExtendedPayload = z.infer<typeof ceoDecisionRmsExtendedPayloadSchema>;

// ===========================================================================
// Bank-account event family — D-BANK-ACCOUNT-SUBSTRATE.
//
// Standing authority: D-FIRST-DRY-RUN-SCENARIO (CEO-approved 2026-05-10),
// which adopted D-BANK-ACCOUNT-SUBSTRATE as a net-new sub-decision under its
// umbrella (per pack §6 brief #A1). No new CEO approval required.
//
// Three event types govern the lifecycle of a bank account (the bank's own
// nostro / vostro / capital / clearing accounts at correspondent banks and at
// SARB; not — yet — customer accounts, which are Niko's licence-day surface):
//
//   - BankAccountOpened       — new account opened. Carries entity / currency
//                               / accountType / chart-of-accounts mapping /
//                               counterparty / openedAt.
//   - BankAccountConfigured   — limits, restrictions, sub-classifications
//                               applied to an already-open account. Append-
//                               only audit trail of configuration changes.
//   - BankAccountClosed       — terminal lifecycle event. Append-only; no
//                               re-open. A new account is required to resume
//                               activity at the same external bank.
//
// Two projections under `prototype/platform/projections/accounts/` consume
// this stream:
//
//   - `accounts.master`       — current state per accountId (open + closed +
//                               most-recent configuration). Per-entity, per-
//                               currency, per-chart-of-accounts-leaf; the
//                               account-master register the dashboard reads
//                               and downstream postings dispatch against.
//   - `accounts.balance`      — sum of postings per account, fold over the
//                               existing M1 sub-ledger projection rows
//                               (`SubLedgerRow.cashAmountMinor` joined to
//                               accountId via the account-master). The
//                               projection is the typed input every BA-return
//                               cell + AFS line ultimately decomposes into
//                               via the `Balance` semantic-layer entry.
//
// Provenance discipline (D-DATA-PROVENANCE-SUBSTRATE Slice 1):
// dry-run-scenario callers attach `simulatedTag({ scenario:
// 'first-dry-run-2026-Q1', sourceLineage: 'agent:tomas:bank-account' })`
// when constructing these events. The substrate-active flag is currently
// false, so untagged appends are tolerated; the constructors below accept
// an optional `provenance` field already so callers are forward-compatible
// for the flag flip (Slice 2 emitter migration).
//
// Schema layering: each event-type schema is layered on top of the envelope
// (`eventSchema`), so a payload that fails its type schema fails *before*
// the event hits the store — same convention as every other typed event in
// this file.
//
// Authors: Tomas (Operations & payments engineer, engineering — reports to
//   Devon COO; lead) · Atlas (Core banking platform architect, engineering
//   — substrate consult) · Bea (Accounting & financial reporting engineer,
//   engineering — reports to Camille CFO; chart-of-accounts integration).
// ===========================================================================

/**
 * Account-type taxonomy. Mirrors the GL families on the chart-of-accounts:
 *
 *   - `nostro`              — the bank's account at a correspondent bank, in
 *                             a foreign or domestic currency. Asset side.
 *   - `vostro`              — a counterparty's account at the bank. Liability
 *                             side. (Not used in first dry-run; included for
 *                             completeness so the substrate doesn't need a
 *                             reshape when correspondent relationships open
 *                             in the other direction.)
 *   - `capital`             — equity / capital account holding share capital,
 *                             share premium, retained earnings. Equity side.
 *   - `sarb-operational`    — operational account at the South African Reserve
 *                             Bank (the chart-of-accounts row `ACC-1100-001`
 *                             feeds this account-type). Asset side; LCR
 *                             HQLA Level 1.
 *   - `clearing`            — settlement-account at a market infrastructure
 *                             (CLS sponsor, JSE clearing member, Strate). Asset
 *                             or liability depending on net direction.
 *   - `internal-suspense`   — the bank's own suspense / clearing-in-transit
 *                             account. Asset side. Net-zero target at period
 *                             close.
 */
export const bankAccountTypeSchema = z.enum([
  "nostro",
  "vostro",
  "capital",
  "sarb-operational",
  "clearing",
  "internal-suspense",
]);

export type BankAccountType = z.infer<typeof bankAccountTypeSchema>;

/**
 * A single chart-of-accounts mapping anchored to the GL leaf account ID
 * (`ACC-NNNN-NNN`) defined in `prototype/platform/accounting/_chart-of-
 * accounts.md`. Stored as a typed reference rather than denormalised
 * (Principle 2 — single graph; account-master cites the leaf, never copies
 * its classification fields). Downstream consumers resolve the leaf via
 * Anya's semantic-layer registry (see PR #156 — `Balance` /
 * `CashAndBalancesAtSARB` entries' `formula` strings cite this same leaf).
 */
export const chartOfAccountsRefSchema = z.object({
  /** GL leaf account ID, e.g. `ACC-1100-001`. */
  leafAccountId: z.string().regex(/^ACC-[0-9]{4}-[0-9]{3}$/, {
    message:
      "ChartOfAccountsRef.leafAccountId must match `ACC-NNNN-NNN` per chart-of-accounts.schema.json",
  }),
  /** Free-form note for human reviewers (e.g. "operational ZAR at SARB"). */
  note: z.string().optional(),
});

export type ChartOfAccountsRef = z.infer<typeof chartOfAccountsRefSchema>;

// ---------------------------------------------------------------------------
// BankAccountOpened
//
// Lifecycle-start event for a bank-owned account. After this event lands,
// the account is live: postings may flow against it and the master /
// balance projections include it in their state.
//
// Idempotency: (accountId) is unique. A second BankAccountOpened with the
// same accountId is a substrate-integrity violation; the master projection
// keeps the first and ignores the second (asserted by tests).
// ---------------------------------------------------------------------------

export const bankAccountOpenedPayloadSchema = z.object({
  /**
   * Stable account identifier. Convention: `account:<entity-short>:<account-
   * type>:<currency>:<short-slug>` — e.g. `account:hoz-bank:nostro:usd:01`
   * or `account:hoz-bank:capital:zar:share-capital`.
   */
  accountId: z.string().min(1),
  /** Account type per `bankAccountTypeSchema`. */
  accountType: bankAccountTypeSchema,
  /**
   * ISO 4217 currency. Single-currency per account (Principle 5 — no implicit
   * multi-currency accounts; FX exposure must be visible at the account level).
   */
  currency: z.string().length(3),
  /**
   * Counterparty the account is held at, when applicable. `null` for accounts
   * held at the bank itself (e.g. `internal-suspense`, `capital` accounts on
   * the bank's own balance sheet). Convention: LEI or `CP-<short-slug>` — the
   * counterparty registry resolves the reference.
   */
  counterpartyId: z.string().min(1).nullable(),
  /** Chart-of-accounts mapping. Resolves to a GL leaf the postings dispatch against. */
  chartOfAccounts: chartOfAccountsRefSchema,
  /** ISO 8601 — when the account opened (business time, not processing time). */
  openedAt: z.string().min(1),
  /** Optional free-form descriptive name for human reviewers / dashboards. */
  displayName: z.string().min(1).optional(),
});

export type BankAccountOpenedPayload = z.infer<typeof bankAccountOpenedPayloadSchema>;

export function makeBankAccountOpened(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BankAccountOpenedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BankAccountOpened",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bankAccountOpenedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// BankAccountConfigured
//
// Append-only audit trail of configuration changes against an already-open
// account: limits, restrictions, sub-classifications. The master projection
// applies the most-recent configuration over the initial-opened state
// (latest-wins per `(accountId, configKey)` pair).
//
// `configKey` is a free-form slug (e.g. `daily-debit-limit`, `restriction:
// outbound-suspended`, `sub-classification:hqla-level-1`) — the substrate
// does not enumerate the keys; downstream consumers (limit-checks, BA-return
// classifiers) recognise the slugs they care about.
// ---------------------------------------------------------------------------

export const bankAccountConfiguredPayloadSchema = z.object({
  /** Account being configured. Must match an existing BankAccountOpened.accountId. */
  accountId: z.string().min(1),
  /** Free-form configuration key. */
  configKey: z.string().min(1),
  /**
   * Configuration value. `unknown` shape so the substrate doesn't constrain
   * downstream-specific schemas (limit values, restriction toggles, sub-
   * classification slugs all flow through the same audit trail).
   */
  configValue: z.unknown(),
  /** ISO 8601 — when the configuration takes effect. */
  effectiveAt: z.string().min(1),
  /** Why the configuration changed; mandatory so the audit trail is readable. */
  rationale: z.string().min(1),
});

export type BankAccountConfiguredPayload = z.infer<typeof bankAccountConfiguredPayloadSchema>;

export function makeBankAccountConfigured(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BankAccountConfiguredPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BankAccountConfigured",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bankAccountConfiguredPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// BankAccountClosed
//
// Terminal lifecycle event. Append-only; no re-open. Postings against a
// closed account are a substrate-integrity violation (Vera follow-on recon
// — substrate gap noted in the decision record).
//
// Closure-cascade rules (e.g. zero-balance precondition, outstanding-
// commitment unwind) are downstream policy; this event records the closure
// fact only. The decision record names this gap explicitly.
// ---------------------------------------------------------------------------

export const bankAccountClosedPayloadSchema = z.object({
  /** Account being closed. Must match an existing BankAccountOpened.accountId. */
  accountId: z.string().min(1),
  /** ISO 8601 — when the account closed. */
  closedAt: z.string().min(1),
  /** Why the account was closed. */
  reason: z.enum([
    "counterparty-relationship-ended",
    "consolidation",
    "regulatory-direction",
    "operational-cleanup",
    "incorrectly-opened",
  ]),
  /** Free-form note for human reviewers. */
  note: z.string().optional(),
});

export type BankAccountClosedPayload = z.infer<typeof bankAccountClosedPayloadSchema>;

export function makeBankAccountClosed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BankAccountClosedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BankAccountClosed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bankAccountClosedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ===========================================================================
// Period-close event family — D-REPORTING-CAPABILITY-SLICE-2.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10). Pack §6 Slice 2 lists this slice as a sub-decision under
// the standing umbrella; no new CEO approval required.
//
// Three event types govern the accounting-period close lifecycle. Period
// close is the unit of all subsequent prudential / IFRS reports — pack
// §6 Slice 2 calls it "the unit of all subsequent prudential / IFRS
// reports". The substrate is per-entity (each Hoz legal entity closes
// independently — pack §6 Q2 — Hoz Bank, Hoz Securities, and the Group
// consolidated rollup all run their own AccountingPeriodOpened →
// AccountingPeriodClosed → TrialBalanceSnapshotted chain) and provenance-
// aware (close events inherit the provenance discipline of D-DATA-
// PROVENANCE-SUBSTRATE — production close vs simulated close, with
// per-entity stream-key isolation).
//
//   - AccountingPeriodOpened    — start of an accounting period for a given
//                                 entity. Carries entity / periodId /
//                                 periodKind (year/quarter/month) /
//                                 periodStart / periodEnd / openedAt /
//                                 functionalCurrency. Idempotent-terminal
//                                 on (entity, periodId): the same period
//                                 may not be opened twice without a close
//                                 in between.
//   - AccountingPeriodClosed    — end of an accounting period. Triggers
//                                 trial-balance snapshot via the
//                                 EvSS Slice 2 snapshot APIs (per pack
//                                 §6 Slice 2 — "snapshots the trial balance
//                                 to the RMS document store"). Idempotent-
//                                 terminal on (entity, periodId).
//   - TrialBalanceSnapshotted   — the close-event's by-product: the per-
//                                 entity trial balance frozen as of the
//                                 period-end, content-hashed via the RMS
//                                 document store (BLAKE3 per RMS Slice 1).
//                                 Append-only-audit; one event per
//                                 (entity, periodId, snapshotKind) where
//                                 snapshotKind is "close" (default) or
//                                 "interim" (for in-period checkpoints).
//
// Reopen handling. Pack §6 Slice 2 does NOT specify a separate
// `PeriodReopened` event; per Principle 1 (events are truth, append-only-
// audit) a corrections-after-close flow appends a NEW
// AccountingPeriodOpened with a `reopenOf` reference to the prior
// AccountingPeriodClosed event_id. The audit trail is forensic — the
// close event is never overwritten. The `reopenOf` discipline is enforced
// at construction (not at the store envelope) so the reopen reason is
// always typed.
//
// Manual journal entries during close are NOT modelled as a new event
// type — they reuse the existing `SubLedgerPostingEmitted` (M1) with a
// `closeAdjustment: true` flag carried in the existing payload's
// `postingMemo` field plus a citation linking to the open period. This
// avoids duplicating the sub-ledger event family and keeps the GL-
// projection's fold a single function over `SubLedgerPostingEmitted`.
//
// Two trial-balance snapshot kinds:
//   - `close`  — emitted automatically by the close orchestration when
//                AccountingPeriodClosed is appended. The snapshot is
//                durable; the AccountingPeriodClosed event references the
//                snapshot's document hash.
//   - `interim`— ad-hoc operational snapshots during a period (debug,
//                dashboard refresh). No close event; no document-store
//                anchor required (the snapshot lives in the snapshot
//                substrate only).
//
// Provenance: pack §6 Slice 2 inherits the D-DATA-PROVENANCE-SUBSTRATE
// discipline — production-close events tagged
// `productionTag({sourceLineage: 'agent:bea:period-close'})`; simulated-
// close events (dry-run scenarios) tagged
// `simulatedTag({scenario, sourceLineage: 'agent:bea:period-close'})`.
// The constructors below accept an optional `provenance` field —
// substrate-active flag-flip is forward-compatible.
//
// Retention: Companies Act 71/2008 s.24 — accounting-records retention,
// 7-year minimum. Mapped to RETENTION_ACCOUNTING_7Y in the registry.
// Principle 1's indefinite log preserves the append-only chain regardless
// of the regulatory-floor minimum.
//
// Stream-key convention (per pack §6 Q2 + D-EVENT-STORE-SCALING Slice 2
// Q4): close events partition on `<entity>|accounting-period`, e.g.
// `LE-ZA-HOZ-BANK|accounting-period`. Trial-balance snapshots partition
// per-entity on the same stream-key — every close-snapshot for an entity
// flows through one logical stream so loadSnapshot(streamKey, asOf)
// resolves the latest period-end snapshot ≤ asOf.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; close orchestration + accounting-rule owner)
//   · Atlas (Core banking platform architect, engineering — substrate
//   consult; registry rows + retention metadata).
// ===========================================================================

/**
 * Accounting period kind. Mirrors the IAS 1 § presentation-period taxonomy
 * + the bank's policy on interim close cadence (monthly close per
 * `Owner Inbox/2026-05-06_core-policies-finance.md` §3 — "monthly close +
 * quarterly attestation + annual audited AFS"). Quarterly and annual are
 * regulatory-significant (BA-return cadence + AFS); monthly is internal.
 */
export const accountingPeriodKindSchema = z.enum(["month", "quarter", "half-year", "year"]);

export type AccountingPeriodKind = z.infer<typeof accountingPeriodKindSchema>;

/** Trial-balance snapshot kind. See header comment §"Two trial-balance snapshot kinds". */
export const trialBalanceSnapshotKindSchema = z.enum(["close", "interim"]);

export type TrialBalanceSnapshotKind = z.infer<typeof trialBalanceSnapshotKindSchema>;

// ---------------------------------------------------------------------------
// AccountingPeriodOpened
//
// Lifecycle-start event for an accounting period at a given entity.
// Idempotency: (entity, periodId) is unique while the period is open;
// re-opening after close requires a `reopenOf` reference to the prior
// close event_id (creates a forensic chain: open → close → reopen).
// ---------------------------------------------------------------------------

export const accountingPeriodOpenedPayloadSchema = z
  .object({
    /**
     * Stable period identifier. Convention: `period:<entity-short>:<kind>:
     * <iso-period>` — e.g. `period:hoz-bank:month:2026-05`,
     * `period:hoz-bank:quarter:2026-Q2`, `period:hoz-group:year:2026`.
     */
    periodId: z.string().min(1),
    /** Period kind per `accountingPeriodKindSchema`. */
    periodKind: accountingPeriodKindSchema,
    /** ISO 8601 — first business-time instant the period covers (inclusive). */
    periodStart: z.string().min(1),
    /** ISO 8601 — last business-time instant the period covers (inclusive). */
    periodEnd: z.string().min(1),
    /** ISO 8601 — when the period was opened (processing time). */
    openedAt: z.string().min(1),
    /**
     * Functional currency for this period (per IAS 21 §9). Single-currency
     * per period (Principle 5 — FX exposure flows through translation, not
     * through period-functional-currency variation). ISO 4217 3-letter.
     */
    functionalCurrency: z.string().length(3),
    /**
     * Optional reopen-reference. Present when this open-event is a
     * corrections-after-close reopen of a previously-closed period; the
     * value is the `event_id` of the prior `AccountingPeriodClosed`.
     * Append-only audit chain — the prior close is not overwritten.
     */
    reopenOf: z.string().min(1).optional(),
    /**
     * Why the period was reopened. Required when `reopenOf` is set;
     * forbidden otherwise. Audit-sensitive — every reopen carries a
     * typed reason.
     */
    reopenReason: z
      .enum([
        "post-close-adjustment",
        "audit-finding",
        "regulator-direction",
        "restatement-prior-period-error",
        "operational-correction",
      ])
      .optional(),
  })
  .superRefine((p, ctx) => {
    // periodEnd must be > periodStart (no zero-length / inverted periods).
    const start = Date.parse(p.periodStart);
    const end = Date.parse(p.periodEnd);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AccountingPeriodOpened.periodEnd must be after periodStart",
        path: ["periodEnd"],
      });
    }
    // reopenOf and reopenReason are paired: both or neither.
    if (p.reopenOf !== undefined && p.reopenReason === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "AccountingPeriodOpened.reopenReason is required when reopenOf is set (every reopen needs a typed reason)",
        path: ["reopenReason"],
      });
    }
    if (p.reopenOf === undefined && p.reopenReason !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "AccountingPeriodOpened.reopenReason is forbidden without reopenOf (reason has no referent)",
        path: ["reopenReason"],
      });
    }
  });

export type AccountingPeriodOpenedPayload = z.infer<typeof accountingPeriodOpenedPayloadSchema>;

export function makeAccountingPeriodOpened(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AccountingPeriodOpenedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AccountingPeriodOpened",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: accountingPeriodOpenedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// AccountingPeriodClosed
//
// Lifecycle-end event for an accounting period. Idempotent-terminal on
// (entity, periodId) — a closed period cannot be closed again without a
// reopen-and-reclose chain. References the trial-balance snapshot
// captured at close via `trialBalanceSnapshotEventId` (the
// TrialBalanceSnapshotted event the close orchestration emitted as part
// of the close transaction).
// ---------------------------------------------------------------------------

export const accountingPeriodClosedPayloadSchema = z.object({
  /** Period being closed. Must match a prior AccountingPeriodOpened.periodId for the same entity. */
  periodId: z.string().min(1),
  /** ISO 8601 — when the period was closed (processing time, ≥ periodEnd). */
  closedAt: z.string().min(1),
  /**
   * `event_id` of the `TrialBalanceSnapshotted` event captured at close.
   * Required: every close emits a snapshot; the close event references the
   * snapshot for downstream consumers (BA-return generators, AFS, recon).
   */
  trialBalanceSnapshotEventId: z.string().min(1),
  /**
   * Document-store hash of the trial-balance JSON. Present when the
   * close-orchestration wrote the trial-balance to the RMS document
   * store (BLAKE3 per RMS Slice 1). Format: `<algo>:<hex-digest>`.
   * Optional during build-phase — RMS Slice 1 lands the document store
   * separately; closes that pre-date the doc-store omit this field.
   */
  trialBalanceDocumentHash: z.string().min(1).optional(),
  /**
   * Sub-ledger projection upto-sequence at close. Used by the close
   * orchestration to assert that no new postings landed between trial-
   * balance compute and the AccountingPeriodClosed append.
   */
  uptoSequence: z.number().int().nonnegative(),
});

export type AccountingPeriodClosedPayload = z.infer<typeof accountingPeriodClosedPayloadSchema>;

export function makeAccountingPeriodClosed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AccountingPeriodClosedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AccountingPeriodClosed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: accountingPeriodClosedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// TrialBalanceSnapshotted
//
// The close orchestration's by-product. Records that a per-entity trial
// balance was frozen at a given as-of, identified by content-addressed
// hash in the RMS document store. Append-only-audit: every snapshot is a
// new event; corrections post a new snapshot, never overwrite.
//
// The trial-balance JSON shape is documented separately in
// `prototype/platform/accounting/period-close.ts` — the event references
// the hash, not the bytes (Principle 1 — events cite documents by hash).
// ---------------------------------------------------------------------------

export const trialBalanceSnapshotRowSchema = z.object({
  /**
   * GL leaf account ID. Strict form is `ACC-NNNN-NNN` per
   * `chart-of-accounts.schema.json`; the slice-2 substrate also accepts
   * legacy M1 stub forms (`ACC-<slug>`) since the M1 sub-ledger
   * postings emitted before chart-of-accounts is fully populated use
   * `ACC-equity-position-stub` etc. (per Bea M1 substrate-gap §3, chart
   * population lands at M2). The trial-balance recon at semantic-layer
   * resolution time enforces the strict form on the GL-projection side.
   */
  leafAccountId: z.string().regex(/^ACC-[A-Za-z0-9-]+$/, {
    message:
      "TrialBalanceSnapshotted.row.leafAccountId must start with `ACC-` (chart-of-accounts leaf or M1 stub form)",
  }),
  /** ISO 4217 currency this row sits in (Principle 5 — every row has a currency). */
  currency: z.string().length(3),
  /** Signed cash amount in minor units. Positive = debit; negative = credit. */
  amountMinor: z.number().int(),
});

export type TrialBalanceSnapshotRow = z.infer<typeof trialBalanceSnapshotRowSchema>;

export const trialBalanceSnapshottedPayloadSchema = z
  .object({
    /** Period this snapshot belongs to. Must match an open or just-closed AccountingPeriodOpened. */
    periodId: z.string().min(1),
    /** Snapshot kind per `trialBalanceSnapshotKindSchema`. */
    snapshotKind: trialBalanceSnapshotKindSchema,
    /** ISO 8601 — business-time the trial balance was computed at. */
    snapshotAsOf: z.string().min(1),
    /** Sub-ledger projection upto-sequence the snapshot folded. */
    uptoSequence: z.number().int().nonnegative(),
    /**
     * Trial-balance rows — one per (leafAccountId, currency) where the
     * fold produced a non-zero balance. Stored inline in the event for
     * forensic reproducibility. The corresponding RMS-doc-store hash
     * (when present) is a denormalised cache of `JSON.stringify(rows)`.
     */
    rows: z.array(trialBalanceSnapshotRowSchema),
    /**
     * Document-store hash of the canonical trial-balance JSON. Present
     * when the snapshot was persisted to the RMS document store
     * (BLAKE3 per RMS Slice 1). Optional during build-phase — RMS Slice 1
     * lands the document store separately.
     */
    documentHash: z.string().min(1).optional(),
    /**
     * Per-currency debit/credit totals. Asserted equal at construction
     * (debits = credits per currency); the substrate guarantees a
     * balanced trial balance or rejects the event.
     */
    perCurrencyTotals: z.array(
      z.object({
        currency: z.string().length(3),
        debitMinor: z.number().int().nonnegative(),
        creditMinor: z.number().int().nonnegative(),
      }),
    ),
  })
  .superRefine((p, ctx) => {
    // Per-currency debits MUST equal credits (the trial-balance invariant).
    for (const total of p.perCurrencyTotals) {
      if (total.debitMinor !== total.creditMinor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `TrialBalanceSnapshotted.perCurrencyTotals[${total.currency}] unbalanced: debits=${total.debitMinor} credits=${total.creditMinor}`,
          path: ["perCurrencyTotals"],
        });
      }
    }
    // The rows MUST sum to the perCurrencyTotals (forensic consistency).
    const rowTotals = new Map<string, { debit: number; credit: number }>();
    for (const r of p.rows) {
      const t = rowTotals.get(r.currency) ?? { debit: 0, credit: 0 };
      if (r.amountMinor >= 0) t.debit += r.amountMinor;
      else t.credit += -r.amountMinor;
      rowTotals.set(r.currency, t);
    }
    for (const total of p.perCurrencyTotals) {
      const rt = rowTotals.get(total.currency) ?? { debit: 0, credit: 0 };
      if (rt.debit !== total.debitMinor || rt.credit !== total.creditMinor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `TrialBalanceSnapshotted.rows for currency ${total.currency} (debit=${rt.debit}, credit=${rt.credit}) do not match perCurrencyTotals (debit=${total.debitMinor}, credit=${total.creditMinor})`,
          path: ["rows"],
        });
      }
    }
  });

export type TrialBalanceSnapshottedPayload = z.infer<typeof trialBalanceSnapshottedPayloadSchema>;

export function makeTrialBalanceSnapshotted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TrialBalanceSnapshottedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TrialBalanceSnapshotted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: trialBalanceSnapshottedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// RasLineCalibrated
//
// Records that a Risk Appetite Statement (RAS) line has had its
// quantitative calibration ratified — i.e. moved from "framework declares
// this line exists" to "framework declares this line exists AND the
// numerical thresholds are signed off". The event lifts the matching
// obligations-register row out of `PARTIAL` status.
//
// First instance: RAS B2 (CET1 management buffer ≥ +1.5pp above PA min +
// Pillar 2A + capital conservation buffer) per `ORG-PR-04`. Lands under
// W2 Slice 2 of `D-REGULATORY-READINESS-GATE-PLAN`.
//
// Idempotency: (entity, lineId) is unique per active calibration. A
// recalibration emits a new event with `supersedesCalibrationEventId`
// pointing at the prior calibration; the prior is not overwritten.
// ---------------------------------------------------------------------------

export const rasLineCalibratedPayloadSchema = z
  .object({
    /**
     * RAS line identifier. Convention is `<section>` (e.g. `B2`, `B3`,
     * `B8a-1`). Cross-references the RAS section that defines the line.
     * Free-form to accommodate the RAS's own section numbering.
     */
    lineId: z.string().min(1),
    /**
     * RAS section reference, e.g. `RAS §B3`. Human-readable; the citation
     * chain in `calibrationCitations` carries the strict citations.
     */
    rasSection: z.string().min(1),
    /**
     * Free-form one-line description of what was calibrated — included
     * in the event so the audit trail is readable without resolving the
     * citation chain. Example: "CET1 management buffer ≥ +1.5pp above
     * PA min + Pillar 2A + capital conservation buffer".
     */
    calibrationDescription: z.string().min(1),
    /**
     * Strict citation references for the calibration. Includes the
     * external standards (Banks Act, Reg 38, BCBS Basel III/IV), the
     * RAS section, and the obligations-register row that the
     * calibration lifts to IN FORCE. At least one citation is required
     * (Principle 2).
     */
    calibrationCitations: z.array(z.string().min(1)).min(1),
    /**
     * Authoring source — the deliverable / record that documents the
     * calibration. Path-style, e.g.
     * `Owner Inbox/2026-05-10_helena-rohan-bea_w2-slice-2-ras-b2-calibration.md`.
     */
    calibrationSource: z.string().min(1),
    /**
     * Standing CEO authority under which the calibration is recorded.
     * Convention: a `D-` decision id, e.g.
     * `D-REGULATORY-READINESS-GATE-PLAN`. Per the no-pause rule
     * (CLAUDE.md "Operating procedures"), downstream slices of an
     * approved decision dispatch without per-item CEO confirmation.
     */
    standingAuthority: z.string().min(1),
    /**
     * Obligations-register row this calibration discharges. The
     * calibration lifts the row from `PARTIAL` to `IN FORCE`.
     */
    obligationRowId: z.string().min(1),
    /**
     * Optional reference to a prior `RasLineCalibrated` event-id that
     * this calibration supersedes. Present on recalibrations; absent
     * on initial calibrations. Append-only audit chain — the prior
     * calibration is not overwritten.
     */
    supersedesCalibrationEventId: z.string().min(1).optional(),
    /**
     * Optional structured calibration parameters, free-form per line.
     * For RAS B2 this carries the calibration result (target ratio,
     * trigger, escalate, fixture inputs). Renderers may use this to
     * surface the numerical posture without re-running the calibration
     * function.
     */
    calibrationParameters: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((p, ctx) => {
    if (p.supersedesCalibrationEventId !== undefined && p.supersedesCalibrationEventId === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "RasLineCalibrated.supersedesCalibrationEventId must be non-empty when set",
        path: ["supersedesCalibrationEventId"],
      });
    }
  });

export type RasLineCalibratedPayload = z.infer<typeof rasLineCalibratedPayloadSchema>;

export function makeRasLineCalibrated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RasLineCalibratedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RasLineCalibrated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: rasLineCalibratedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ===========================================================================
// --- Party (D-PARTY-REGISTER) ---
//
// PR 1 of D-PARTY-REGISTER (CEO-approved 2026-05-11). The unified Party
// event family lives in its own domain at `prototype/domains/party/` —
// schemas and factories are authored there to keep this god-file from
// growing further (F-020). We re-export them here for two reasons:
//   1. Registry consumers (`registry.ts`) import schemas from this module
//      by convention; preserving that surface keeps the wiring uniform.
//   2. The recon at `platform/recon/event-type-registry-coverage.ts`
//      scans `event-types.ts` plus sibling `event-types-*.ts` for
//      `make<Type>` factory definitions; re-exporting the factories from
//      here keeps the recon symmetric without bypassing the per-domain
//      authoring location.
//
// Out of scope for PR 1: backfill (PR 2, Imani — Legal-as-code engineer);
// party-projection read-model (PR 2); register markdown (PR 2); customer
// field-tightening (PR 4); deprecation flags on legacy registration event
// types (PR 4).
// ===========================================================================

export type {
  AgentAttrs as PartyAgentAttrs,
  BeneficialOwnerChainAssertedPayload,
  CounterpartyAttrs as PartyCounterpartyAttrs,
  KindAttributes as PartyKindAttributes,
  LegalEntityAttrs as PartyLegalEntityAttrs,
  NaturalPersonAttrs as PartyNaturalPersonAttrs,
  PartyAttributeChangedPayload,
  PartyClassifiedPayload,
  PartyDeactivatedPayload,
  PartyDeclassifiedPayload,
  PartyEventType,
  PartyId,
  PartyKind,
  PartyRegisteredPayload,
  PartyRelationshipAssertedPayload,
  PartyRelationshipChangedPayload,
  PartyRelationshipRevokedPayload,
  PartyScreeningCompletedPayload,
  RelationshipKind,
} from "../../domains/party";

export {
  PARTY_EVENT_TYPES,
  PARTY_KINDS,
  RELATIONSHIP_KINDS,
  RELATIONSHIP_KIND_CONSTRAINTS,
  beneficialOwnerChainAssertedPayloadSchema,
  kindAttributesSchema,
  makeBeneficialOwnerChainAsserted,
  makePartyAttributeChanged,
  makePartyClassified,
  makePartyDeactivated,
  makePartyDeclassified,
  makePartyRegistered,
  makePartyRelationshipAsserted,
  makePartyRelationshipChanged,
  makePartyRelationshipRevoked,
  makePartyScreeningCompleted,
  partyAttributeChangedPayloadSchema,
  partyClassifiedPayloadSchema,
  partyDeactivatedPayloadSchema,
  partyDeclassifiedPayloadSchema,
  partyId,
  partyIdSchema,
  partyKindSchema,
  partyRegisteredPayloadSchema,
  partyRelationshipAssertedPayloadSchema,
  partyRelationshipChangedPayloadSchema,
  partyRelationshipRevokedPayloadSchema,
  partyScreeningCompletedPayloadSchema,
  relationshipKindSchema,
} from "../../domains/party";

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
  "SwitchTestActivated",
  "SwitchTestEnded",
  "SwitchTestReport",
  "LegalEntityRegistered",
  "LegalEntityChanged",
  "IntraGroupArrangementSigned",
  // Product-lifecycle event family — D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2.
  "ProductProposalRegistered",
  "ProductConceptualised",
  "ProductDueDiligenceCompleted",
  "ProductDueDiligenceWithheld",
  "ProductDimensionAttested",
  "ProductApproved",
  "ProductWithheld",
  "ProductLaunched",
  "ProductPostImplementationReviewCompleted",
  "ProductReviewCompleted",
  "ProductRetired",
  "ProductVersionPublished",
  // Records Management Substrate event family — D-RMS-PHASE-1 Slice 2.
  // S8/RMS overlap disposition (Scrooge ruling, 2026-05-10): RMS owns these
  // seven records-of-agent-runs types; S8 keeps the agent-runtime primitives.
  // `AgentRunStarted` / `AgentRunCompleted` were envelope-only registry rows
  // already; Slice 2 adds typed payload schemas without changing class.
  "AgentBriefIssued",
  "AgentRunStarted",
  "AgentRunCompleted",
  "DecisionRequested",
  "Feedback",
  "BriefSuperseded",
  "RecordFiled",
  // Bank-account event family — D-BANK-ACCOUNT-SUBSTRATE (under standing
  // authority of D-FIRST-DRY-RUN-SCENARIO, CEO-approved 2026-05-10).
  "BankAccountOpened",
  "BankAccountConfigured",
  "BankAccountClosed",
  // Period-close event family — D-REPORTING-CAPABILITY-SLICE-2 (under
  // standing authority of D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN, CEO-
  // approved 2026-05-10). Pack §6 Slice 2.
  "AccountingPeriodOpened",
  "AccountingPeriodClosed",
  "TrialBalanceSnapshotted",
  // Risk Appetite Statement calibration event — D-REGULATORY-READINESS-
  // W2-SLICE-2 (under standing authority of D-REGULATORY-READINESS-GATE-
  // PLAN, CEO-approved 2026-05-10). Pack §3 W2 Slice 2.
  "RasLineCalibrated",
  // Party event family — D-PARTY-REGISTER + D-PARTY-RELATIONSHIP-KINDS-V0
  // (both CEO-approved 2026-05-11). Schemas + factories live in
  // `prototype/domains/party/`; re-exported above. PR 1 of D-PARTY-REGISTER
  // — substrate only (backfill / projection / register markdown land in
  // PR 2 with Imani — Legal-as-code engineer).
  "PartyRegistered",
  "PartyAttributeChanged",
  "PartyClassified",
  "PartyDeclassified",
  "PartyScreeningCompleted",
  "PartyRelationshipAsserted",
  "PartyRelationshipChanged",
  "PartyRelationshipRevoked",
  "BeneficialOwnerChainAsserted",
  "PartyDeactivated",
  // Goal-loop planning-trace event family — D-AGENT-AUTONOMY-OPERATIONAL
  // (CEO-approved 2026-05-11) Slice 3. Three planning-trace event shapes
  // emitted at every goal-loop iteration, joining the existing
  // AgentDecision / AgentEscalation event families (they do not replace them).
  // Spec: Owner Inbox/2026-05-11_atlas_per-persona-goal-loop-substrate-spec.md §3.3.
  "AgentGoalEvaluated",
  "AgentGoalSelected",
  "AgentGoalDeferred",
] as const;

export type TypedEventType = (typeof TYPED_EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// AgentGoalEvaluated
//
// Emitted at the START of every goal-loop iteration, regardless of outcome.
// Pairs with exactly one of: AgentGoalSelected, AgentGoalDeferred, or an
// AgentEscalation raised in the same iteration. The `iterationId` (ULID-
// shaped) is the pairing key Vera Wave-5 recon uses to assert the pairing
// invariant.
//
// Spec: Owner Inbox/2026-05-11_atlas_per-persona-goal-loop-substrate-spec.md §3.3.
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// ---------------------------------------------------------------------------

export const agentGoalEvaluatedPayloadSchema = z.object({
  /** URN of the agent running the goal loop. */
  agentUrn: z.string().min(1),
  /** Unique per goal-loop invocation. Form: `iter:<ts36>:<rand12>`. */
  iterationId: z.string().min(1),
  /** SHA-256 hex of the world-state snapshot consumed by this iteration. */
  worldStateSnapshotHash: z.string().min(1),
  /** Number of recent runs visible to the deriver. */
  recentRunCount: z.number().int().nonnegative(),
  /** Candidates the deriver evaluated before selecting / deferring. */
  candidateGoals: z.array(
    z.object({
      label: z.string(),
      mandateRowKey: z.string(),
      weight: z.number().optional(),
    }),
  ),
  /** The goal that was chosen, if any (absent when deferring). */
  chosen: z.string().optional(),
  /** Why the deriver chose / deferred. Max 2000 chars. */
  reason: z.string().max(2000),
});
export type AgentGoalEvaluatedPayload = z.infer<typeof agentGoalEvaluatedPayloadSchema>;

export function makeAgentGoalEvaluated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentGoalEvaluatedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentGoalEvaluated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentGoalEvaluatedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentGoalSelected
//
// Emitted when the deriver has chosen a goal and all validations pass:
//   - chosen goal is in the spec's closed-set §9 / §11 / §13 row labels (T-NEW).
//   - mandateCitations is non-empty (P2).
//   - procedureCitations is non-empty (P2).
//   - planned event types ⊆ agent's eventAppendAllowList (permission-gate pre-check).
//
// Does NOT mean the planned events have been emitted — those are emitted by
// the persona's run-handler once the goal is approved/executed.
//
// Spec: Owner Inbox/2026-05-11_atlas_per-persona-goal-loop-substrate-spec.md §3.3.
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// ---------------------------------------------------------------------------

export const agentGoalSelectedPayloadSchema = z.object({
  agentUrn: z.string().min(1),
  /** Matches the `iterationId` of the paired AgentGoalEvaluated. */
  iterationId: z.string().min(1),
  /** The chosen goal — matches AgentGoalEvaluated.chosen. */
  goal: z.string().min(1),
  /** P2 — at least one mandate citation required. */
  mandateCitations: z
    .array(
      z.object({
        section: z.enum(["9-decisions-in-scope", "11-outputs", "13-procedures-owned"]),
        rowKey: z.string().min(1),
        specHash: z.string().min(1),
      }),
    )
    .min(1, "P2 violation: AgentGoalSelected requires at least one mandate citation"),
  /** P2 — at least one procedure citation required. */
  procedureCitations: z
    .array(
      z.object({
        procedurePath: z.string().min(1),
        stepId: z.string().min(1),
        procedureHash: z.string().min(1),
      }),
    )
    .min(1, "P2 violation: AgentGoalSelected requires at least one procedure citation"),
  /** Event types the agent intends to emit if its goal is executed. */
  plannedEvents: z.array(
    z.object({
      type: z.string().min(1),
      payloadPreview: z.record(z.unknown()).optional(),
    }),
  ),
});
export type AgentGoalSelectedPayload = z.infer<typeof agentGoalSelectedPayloadSchema>;

export function makeAgentGoalSelected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentGoalSelectedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentGoalSelected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentGoalSelectedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentGoalDeferred
//
// Emitted when no goal is justified (safe default), when the goal-loop
// deriver throws, when a goal fails a validation check, or when the cadence
// floor is not yet met. Pairs with an AgentGoalEvaluated via `iterationId`.
//
// Spec: Owner Inbox/2026-05-11_atlas_per-persona-goal-loop-substrate-spec.md §3.3.
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// ---------------------------------------------------------------------------

export const agentGoalDeferredPayloadSchema = z.object({
  agentUrn: z.string().min(1),
  /** Matches the `iterationId` of the paired AgentGoalEvaluated. */
  iterationId: z.string().min(1),
  /** Why no action was taken. Max 2000 chars. */
  reason: z.string().max(2000),
  /** Optional ISO-8601 instant after which the agent should retry. */
  retryAfter: z.string().optional(),
  /** Goals the deriver considered but rejected (for Vera Wave-5 defer-ratio sanity). */
  consideredAndRejected: z
    .array(
      z.object({
        label: z.string(),
        rejectionReason: z.string(),
      }),
    )
    .optional(),
});
export type AgentGoalDeferredPayload = z.infer<typeof agentGoalDeferredPayloadSchema>;

export function makeAgentGoalDeferred(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentGoalDeferredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentGoalDeferred",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentGoalDeferredPayloadSchema.parse(args.payload),
  });
}
