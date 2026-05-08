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
// Type registry — single place for downstream consumers to enumerate all
// typed events. Add to this when a new typed event is defined.
// ---------------------------------------------------------------------------

export const TYPED_EVENT_TYPES = [
  "AgentEscalation",
  "AgentDecision",
  "WorkstreamRegistered",
  "RiskRaised",
  "AgentRegistered",
  "DecisionComment",
] as const;

export type TypedEventType = (typeof TYPED_EVENT_TYPES)[number];
