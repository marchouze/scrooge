// platform/escalation/channel.ts
//
// A3.1 — Escalation channel.
//
// Typed channel from agents to human (and inter-agent) overseers. Replaces
// the side-channel escalation pattern (chat, ad-hoc Owner Inbox files) with
// an event-typed lifecycle: open → acknowledge(s) → delegate(s) → decide,
// with substrate-emitted Overdue when a deadline lapses.
//
// Per Atlas spec §3.5 (Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md):
//
//   "Acknowledgement — the overseer's response is itself an event:
//    AgentEscalationAcknowledged (overseer has seen it),
//    AgentEscalationDecided (overseer has chosen an option),
//    AgentEscalationDelegated (overseer has reassigned to a different
//    overseer). The agent's run resumes (or its next run consumes the
//    decision) on AgentEscalationDecided."
//
// Per Principle 1: status is NOT stored. Status is computed by folding
// the event log for a given escalationId. The fold rule (registry.ts):
//
//   AgentEscalation                 → "open"
//   + AgentEscalationAcknowledged   → "acknowledged" (open + seen)
//   + AgentEscalationDelegated      → "delegated" (still open, new owner)
//   + AgentEscalationDecided        → "decided" (terminal)
//   + AgentEscalationOverdue        → "overdue" decoration on whichever
//                                      pre-decision state holds
//
// Sealed-escalation routing (Atlas spec §3.5): when the AgentEscalation
// payload carries `sealed.reason`, the channel's `open` method overrides
// the caller-supplied `routedTo` with the seat list mandated by the
// reason. Today every seat resolves to `human:marc@tgv.co.za` (Marc
// wears every governance hat in the build phase); the channel records
// the *intended* routing in the event payload — substrate-level routing
// resolution is a downstream concern.
//
// Author: Atlas + Senna + Iris (A3.1)

import {
  type AgentEscalationPayload,
  makeAgentEscalation,
  makeAgentEscalationAcknowledged,
  makeAgentEscalationDecided,
  makeAgentEscalationDelegated,
  makeAgentEscalationOverdue,
} from "../event-store/event-types";
import type { EventStore } from "../event-store/store";
import type { Actor, Event } from "../event-store/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Computed status of an escalation. Derived by folding the event log;
 * never persisted.
 *
 * - `open`: AgentEscalation present, no Acknowledged / Delegated / Decided.
 * - `acknowledged`: at least one Acknowledged, no Delegated / Decided.
 * - `delegated`: at least one Delegated, no Decided.
 * - `decided`: a Decided event landed (terminal).
 *
 * `overdue` is a separate boolean decoration, not a status — an
 * escalation can be `acknowledged` AND `overdue` simultaneously.
 */
export type EscalationStatus = "open" | "acknowledged" | "delegated" | "decided";

export interface EscalationView {
  readonly escalationId: string;
  readonly raisedBy: string;
  readonly question: string;
  readonly options: readonly string[];
  readonly severity: AgentEscalationPayload["severity"];
  readonly deadline: string | undefined;
  readonly routedTo: string;
  readonly sealed: AgentEscalationPayload["sealed"];
  readonly status: EscalationStatus;
  readonly overdue: boolean;
  /** Most recent Decided/Delegated/Acknowledged actor, or the original raiser. */
  readonly currentResponsible: string;
  /** Number of acknowledgements received. */
  readonly acknowledgementCount: number;
  /** Number of delegations in the chain. */
  readonly delegationCount: number;
  /** event_id of the AgentEscalation that opened this id (the canonical handle). */
  readonly openedEventId: string;
}

export interface OpenArgs {
  readonly asOf: string;
  readonly entity: string;
  readonly actor: Actor;
  readonly citations: string[];
  readonly payload: AgentEscalationPayload;
  readonly eventId?: string;
}

export interface OpenResult {
  readonly eventId: string;
  readonly escalationId: string;
  /** Resolved routing — equals payload.routedTo for unsealed; sealed-overridden for sealed. */
  readonly routedTo: string;
}

export interface AckResult {
  readonly eventId: string;
  readonly escalationId: string;
  readonly acknowledgedBy: string;
}

export interface DecideArgs {
  readonly asOf: string;
  readonly entity: string;
  readonly actor: Actor;
  readonly citations: string[];
  readonly escalationId: string;
  readonly decidedBy: string;
  readonly chosenOption: string;
  readonly rationale: string;
  readonly eventId?: string;
}

export interface DecideResult {
  readonly eventId: string;
  readonly escalationId: string;
  /** True if a SubstrateAlert (alertClass: integrity) was also emitted because
   *  this is a duplicate Decided. */
  readonly integrityAlertEmitted: boolean;
}

export interface DelegateArgs {
  readonly asOf: string;
  readonly entity: string;
  readonly actor: Actor;
  readonly citations: string[];
  readonly escalationId: string;
  readonly delegatedBy: string;
  readonly delegatedTo: string;
  readonly reason: string;
  readonly eventId?: string;
}

export interface DelegateResult {
  readonly eventId: string;
  readonly escalationId: string;
}

export interface OverdueResult {
  /** Escalation ids for which an Overdue event was emitted on this sweep. */
  readonly emitted: readonly string[];
  /** Escalation ids that were past deadline but already had an Overdue event (idempotent). */
  readonly skipped: readonly string[];
  /** Total number of currently-open escalations walked. */
  readonly walked: number;
}

export interface EscalationChannel {
  /** Open a new escalation. Sealed escalations have routing overridden by reason. */
  open(args: OpenArgs): OpenResult;
  /** Acknowledge — overseer says "I see it". Multiple acknowledgements OK. */
  acknowledge(args: {
    asOf: string;
    entity: string;
    actor: Actor;
    citations: string[];
    escalationId: string;
    acknowledgedBy: string;
    eventId?: string;
  }): AckResult;
  /** Decide — overseer chose an option. Resolves the escalation. */
  decide(args: DecideArgs): DecideResult;
  /** Delegate — overseer reassigns to a different overseer. */
  delegate(args: DelegateArgs): DelegateResult;
  /** Walk overdue: open AgentEscalation past deadline w/o resolution → emit Overdue. Idempotent. */
  enforceOverdue(now: Date): OverdueResult;
  /** Query: list escalations matching a status (and/or `overdue` decoration). */
  list(opts: { status: EscalationStatus | "overdue" }): readonly EscalationView[];
}

// ---------------------------------------------------------------------------
// Sealed-routing table (Atlas spec §3.5)
// ---------------------------------------------------------------------------

/**
 * Build-phase resolution of sealed-escalation routing seats. Today every
 * seat resolves to Marc; the channel records the *intended* seat list in
 * the routedTo string so the audit trail captures the design intent.
 */
const SEALED_ROUTING: Record<NonNullable<AgentEscalationPayload["sealed"]>["reason"], string> = {
  fraud: "human:cae+human:ceo+human:cosec",
  whistleblowing: "human:cae",
  "popia-incident": "human:io+human:ceo",
};

/**
 * Resolve the routedTo for a sealed escalation. Pure function so callers
 * (and tests) can pre-compute the expected routing without going through
 * the event store.
 */
export function resolveSealedRouting(
  sealed: NonNullable<AgentEscalationPayload["sealed"]>,
): string {
  return SEALED_ROUTING[sealed.reason];
}

// ---------------------------------------------------------------------------
// LocalEscalationChannel — folds the EventStore's stream
// ---------------------------------------------------------------------------

interface OpenedEvent {
  readonly eventId: string;
  readonly payload: AgentEscalationPayload;
  /** ISO timestamp from the event envelope. */
  readonly asOf: string;
  /** Legal entity from the event envelope (P5 — every event carries entity). */
  readonly entity: string;
}

interface AckEvent {
  readonly escalationId: string;
  readonly acknowledgedBy: string;
  readonly acknowledgedAt: string;
}

interface DecidedEvent {
  readonly escalationId: string;
  readonly decidedBy: string;
  readonly chosenOption: string;
  readonly rationale: string;
  readonly asOf: string;
}

interface DelegatedEvent {
  readonly escalationId: string;
  readonly delegatedBy: string;
  readonly delegatedTo: string;
  readonly reason: string;
  readonly asOf: string;
}

interface OverdueEvent {
  readonly escalationId: string;
}

/**
 * Per-escalation fold of the event log. Internal — exported only for
 * test convenience.
 */
export interface EscalationFold {
  readonly opened: OpenedEvent;
  readonly acks: readonly AckEvent[];
  readonly delegations: readonly DelegatedEvent[];
  readonly decided: DecidedEvent | undefined;
  readonly decidedExtras: readonly DecidedEvent[];
  readonly overdue: OverdueEvent | undefined;
}

function foldOne(opened: OpenedEvent, events: readonly Event[]): EscalationFold {
  const acks: AckEvent[] = [];
  const delegations: DelegatedEvent[] = [];
  let decided: DecidedEvent | undefined;
  const decidedExtras: DecidedEvent[] = [];
  let overdue: OverdueEvent | undefined;

  const id = opened.payload.escalationId;
  for (const e of events) {
    const payload = e.payload as Record<string, unknown>;
    if (payload.escalationId !== id) continue;
    switch (e.type) {
      case "AgentEscalationAcknowledged":
        acks.push({
          escalationId: id,
          acknowledgedBy: String(payload.acknowledgedBy ?? ""),
          acknowledgedAt: String(payload.acknowledgedAt ?? e.as_of),
        });
        break;
      case "AgentEscalationDelegated":
        delegations.push({
          escalationId: id,
          delegatedBy: String(payload.delegatedBy ?? ""),
          delegatedTo: String(payload.delegatedTo ?? ""),
          reason: String(payload.reason ?? ""),
          asOf: e.as_of,
        });
        break;
      case "AgentEscalationDecided": {
        const d: DecidedEvent = {
          escalationId: id,
          decidedBy: String(payload.decidedBy ?? ""),
          chosenOption: String(payload.chosenOption ?? ""),
          rationale: String(payload.rationale ?? ""),
          asOf: e.as_of,
        };
        if (decided === undefined) decided = d;
        else decidedExtras.push(d);
        break;
      }
      case "AgentEscalationOverdue":
        overdue = { escalationId: id };
        break;
      default:
        break;
    }
  }

  return { opened, acks, delegations, decided, decidedExtras, overdue };
}

function viewOf(fold: EscalationFold): EscalationView {
  const status: EscalationStatus = fold.decided
    ? "decided"
    : fold.delegations.length > 0
      ? "delegated"
      : fold.acks.length > 0
        ? "acknowledged"
        : "open";

  const currentResponsible: string = fold.decided
    ? fold.decided.decidedBy
    : fold.delegations.length > 0
      ? // last delegation winning
        (fold.delegations[fold.delegations.length - 1] as DelegatedEvent).delegatedTo
      : fold.acks.length > 0
        ? (fold.acks[fold.acks.length - 1] as AckEvent).acknowledgedBy
        : fold.opened.payload.routedTo;

  return {
    escalationId: fold.opened.payload.escalationId,
    raisedBy: fold.opened.payload.raisedBy,
    question: fold.opened.payload.question,
    options: fold.opened.payload.options,
    severity: fold.opened.payload.severity,
    deadline: fold.opened.payload.deadline,
    routedTo: fold.opened.payload.routedTo,
    sealed: fold.opened.payload.sealed,
    status,
    overdue: fold.overdue !== undefined,
    currentResponsible,
    acknowledgementCount: fold.acks.length,
    delegationCount: fold.delegations.length,
    openedEventId: fold.opened.eventId,
  };
}

/**
 * Builds the per-escalation fold map from the event store.
 *
 * O(N) over the AgentEscalation* event types — acceptable for the
 * build-phase volume (single-digit escalations / day); production
 * volume will warrant an indexed projection (Anya's substrate work).
 */
function buildFolds(eventStore: EventStore): Map<string, EscalationFold> {
  // First pass: collect openings keyed by escalationId.
  const openings = new Map<string, OpenedEvent>();
  for (const e of eventStore.replay({ type: "AgentEscalation" })) {
    const p = e.payload as unknown as AgentEscalationPayload;
    // First-wins on duplicate id (the channel's open() guards against
    // duplicates, but a hostile-or-legacy emitter might violate this;
    // first event sets the canonical opening).
    if (!openings.has(p.escalationId)) {
      openings.set(p.escalationId, {
        eventId: e.event_id,
        payload: p,
        asOf: e.as_of,
        entity: e.entity,
      });
    }
  }

  // Second pass: pull all lifecycle events into one batch we walk per id.
  const lifecycle: Event[] = [];
  for (const t of [
    "AgentEscalationAcknowledged",
    "AgentEscalationDelegated",
    "AgentEscalationDecided",
    "AgentEscalationOverdue",
  ] as const) {
    for (const e of eventStore.replay({ type: t })) {
      lifecycle.push(e);
    }
  }

  const folds = new Map<string, EscalationFold>();
  for (const [id, opened] of openings) {
    folds.set(id, foldOne(opened, lifecycle));
  }
  return folds;
}

// ---------------------------------------------------------------------------
// SubstrateAlert helper (integrity finding)
// ---------------------------------------------------------------------------

const SUBSTRATE_ALERT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-04"];

function emitIntegrityAlert(
  eventStore: EventStore,
  args: {
    asOf: string;
    entity: string;
    actor: Actor;
    escalationId: string;
    detail: string;
  },
): void {
  // SubstrateAlert is typed (A2.1 schema): alertId / alertClass /
  // details / severity required. The escalationId is embedded in the
  // alertId for traceability.
  const safeId = args.escalationId.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  eventStore.append({
    event_id: crypto.randomUUID(),
    type: "SubstrateAlert",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: SUBSTRATE_ALERT_CITATIONS,
    payload: {
      alertId: `alert:integrity:escalation-${safeId}`,
      alertClass: "integrity" as const,
      details: `${args.detail} (escalationId: ${args.escalationId}; source: platform/escalation/channel.ts)`,
      severity: "high" as const,
    },
  });
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/** Default Overdue routing — Marc wears every governance hat in build phase. */
const DEFAULT_OVERDUE_ROUTE = "human:marc@tgv.co.za";

export interface LocalEscalationChannelOpts {
  /**
   * Where the substrate routes Overdue notices. Defaults to
   * `human:marc@tgv.co.za`. Future: read the issuing agent's reports-to
   * chain from the persona spec.
   */
  readonly overdueRouteFor?: (fold: EscalationFold) => string;
  /**
   * Actor identity the substrate uses when emitting Overdue events.
   * Defaults to a service identity for the channel itself.
   */
  readonly substrateActor?: Actor;
}

export class LocalEscalationChannel implements EscalationChannel {
  private readonly eventStore: EventStore;
  private readonly overdueRouteFor: (fold: EscalationFold) => string;
  private readonly substrateActor: Actor;

  constructor(eventStore: EventStore, opts: LocalEscalationChannelOpts = {}) {
    this.eventStore = eventStore;
    this.overdueRouteFor = opts.overdueRouteFor ?? (() => DEFAULT_OVERDUE_ROUTE);
    this.substrateActor = opts.substrateActor ?? {
      type: "service",
      id: "platform:escalation:channel",
    };
  }

  open(args: OpenArgs): OpenResult {
    // Sealed-routing override (Atlas §3.5). The caller's routedTo is
    // replaced when sealed.reason is set, so the audit trail reflects
    // the substrate's intended routing rather than caller intent.
    const payload: AgentEscalationPayload = args.payload.sealed
      ? { ...args.payload, routedTo: resolveSealedRouting(args.payload.sealed) }
      : args.payload;

    const event = makeAgentEscalation({
      asOf: args.asOf,
      entity: args.entity,
      actor: args.actor,
      citations: args.citations,
      payload,
      ...(args.eventId !== undefined ? { eventId: args.eventId } : {}),
    });
    this.eventStore.append(event);

    return {
      eventId: event.event_id,
      escalationId: payload.escalationId,
      routedTo: payload.routedTo,
    };
  }

  acknowledge(args: {
    asOf: string;
    entity: string;
    actor: Actor;
    citations: string[];
    escalationId: string;
    acknowledgedBy: string;
    eventId?: string;
  }): AckResult {
    // Multiple acknowledgements are explicitly permitted per Atlas
    // spec §3.5 ("a CoSec or CRO may acknowledge before the CEO").
    // We do not check that the escalation exists — the typed payload
    // and Vera's Wave-4 #14 reconciliation are the integrity gate.
    const event = makeAgentEscalationAcknowledged({
      asOf: args.asOf,
      entity: args.entity,
      actor: args.actor,
      citations: args.citations,
      payload: {
        escalationId: args.escalationId,
        acknowledgedBy: args.acknowledgedBy,
        acknowledgedAt: args.asOf,
      },
      ...(args.eventId !== undefined ? { eventId: args.eventId } : {}),
    });
    this.eventStore.append(event);

    return {
      eventId: event.event_id,
      escalationId: args.escalationId,
      acknowledgedBy: args.acknowledgedBy,
    };
  }

  decide(args: DecideArgs): DecideResult {
    // Validate chosenOption against the original options list, when
    // the original AgentEscalation enumerated options. (Empty options
    // = caller-supplied free-form decision is accepted.)
    const folds = buildFolds(this.eventStore);
    const fold = folds.get(args.escalationId);
    if (fold && fold.opened.payload.options.length > 0) {
      if (!fold.opened.payload.options.includes(args.chosenOption)) {
        throw new Error(
          `EscalationChannel.decide: chosenOption "${args.chosenOption}" is not in the AgentEscalation's options [${fold.opened.payload.options.join(", ")}]`,
        );
      }
    }

    // Channel-level invariant: at most one Decided per escalationId.
    // Subsequent Decided events are still emitted (the event log is
    // append-only and the audit trail must capture what happened),
    // but a SubstrateAlert with alertClass: integrity is also emitted
    // so the duplicate is loud, not silent.
    const isDuplicate = fold?.decided !== undefined;

    const event = makeAgentEscalationDecided({
      asOf: args.asOf,
      entity: args.entity,
      actor: args.actor,
      citations: args.citations,
      payload: {
        escalationId: args.escalationId,
        decidedBy: args.decidedBy,
        chosenOption: args.chosenOption,
        rationale: args.rationale,
      },
      ...(args.eventId !== undefined ? { eventId: args.eventId } : {}),
    });
    this.eventStore.append(event);

    if (isDuplicate) {
      emitIntegrityAlert(this.eventStore, {
        asOf: args.asOf,
        entity: args.entity,
        actor: this.substrateActor,
        escalationId: args.escalationId,
        detail: `Duplicate AgentEscalationDecided event for escalation "${args.escalationId}" — only one Decided per escalation is permitted by the channel contract.`,
      });
    }

    return {
      eventId: event.event_id,
      escalationId: args.escalationId,
      integrityAlertEmitted: isDuplicate,
    };
  }

  delegate(args: DelegateArgs): DelegateResult {
    // Multiple delegations are permitted (a chain — A delegates to B,
    // B delegates to C). The view's currentResponsible folds to the
    // most recent delegation.
    const event = makeAgentEscalationDelegated({
      asOf: args.asOf,
      entity: args.entity,
      actor: args.actor,
      citations: args.citations,
      payload: {
        escalationId: args.escalationId,
        delegatedBy: args.delegatedBy,
        delegatedTo: args.delegatedTo,
        reason: args.reason,
      },
      ...(args.eventId !== undefined ? { eventId: args.eventId } : {}),
    });
    this.eventStore.append(event);

    return {
      eventId: event.event_id,
      escalationId: args.escalationId,
    };
  }

  enforceOverdue(now: Date): OverdueResult {
    const folds = buildFolds(this.eventStore);
    const emitted: string[] = [];
    const skipped: string[] = [];
    let walked = 0;

    for (const fold of folds.values()) {
      walked++;

      // Resolution short-circuit: a Decided escalation cannot be
      // overdue (the deadline is moot once the decision lands).
      if (fold.decided !== undefined) continue;

      // No deadline → no overdue concept.
      const deadline = fold.opened.payload.deadline;
      if (!deadline) continue;

      // Future deadline → not overdue yet.
      const deadlineMs = new Date(deadline).getTime();
      if (Number.isNaN(deadlineMs)) continue;
      if (deadlineMs > now.getTime()) continue;

      // Past deadline. Idempotent: don't re-emit if Overdue already lands.
      if (fold.overdue !== undefined) {
        skipped.push(fold.opened.payload.escalationId);
        continue;
      }

      const event = makeAgentEscalationOverdue({
        asOf: now.toISOString(),
        entity: fold.opened.entity,
        actor: this.substrateActor,
        citations: ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-04"],
        payload: {
          escalationId: fold.opened.payload.escalationId,
          deadline,
          detectedAt: now.toISOString(),
          escalatedTo: this.overdueRouteFor(fold),
        },
      });
      this.eventStore.append(event);
      emitted.push(fold.opened.payload.escalationId);
    }

    return { emitted, skipped, walked };
  }

  list(opts: { status: EscalationStatus | "overdue" }): readonly EscalationView[] {
    const folds = buildFolds(this.eventStore);
    const all = [...folds.values()].map(viewOf);
    if (opts.status === "overdue") return all.filter((v) => v.overdue);
    return all.filter((v) => v.status === opts.status);
  }
}
