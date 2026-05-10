// runtime/decisions/record.ts
//
// Canonical CEO-decision-recording function. Used by:
//   1. The runtime handler `runtime/agents/scrooge-ceo-decision-record.ts`
//      (CLI / on-request invocation via env var).
//   2. The dashboard server's POST /api/decide endpoint (in-page modal).
//
// Before this module landed (2026-05-07), the dashboard's
// `/api/decide` and the runtime handler emitted CeoDecision events
// through two parallel code paths. They drifted on citations,
// followOnRoutes support, and request-revision semantics. Marc
// surfaced the resulting decisions-log instability; this module
// converges both paths.
//
// Author: Atlas (substrate) · Scrooge (handler caller)

import { eventStore } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { makeDecisionComment } from "../../platform/event-store/event-types";
import { PRODUCTION_CARVE_OUTS } from "../../platform/event-store/provenance";
import type { Event } from "../../platform/event-store/types";

/** Valid CEO actions. Mirrors `dashboard/types.ts` DecisionAction. */
export type DecisionAction = "approve" | "defer" | "modify" | "request-revision";
export const VALID_DECISION_ACTIONS: readonly DecisionAction[] = [
  "approve",
  "defer",
  "modify",
  "request-revision",
];

export interface RecordCeoDecisionInput {
  readonly decisionId: string;
  readonly action: DecisionAction;
  readonly title: string;
  readonly outcome: string;
  readonly actor: string;
  readonly comment?: string;
  readonly sourceDoc?: string;
  readonly followOnRoutes?: readonly string[];
  /** Free-form descriptor of where the call came from — "dashboard:/api/decide", "chat:scrooge", "cli:bun-run", etc. Logged for audit. */
  readonly recordedVia?: string;
}

export interface RecordCeoDecisionResult {
  readonly event: Event;
  readonly eventId: string;
}

const EVENT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"];

/**
 * Validate the action against the canonical set.
 * Returns true if valid; false otherwise.
 */
export function isValidDecisionAction(s: string): s is DecisionAction {
  return (VALID_DECISION_ACTIONS as readonly string[]).includes(s);
}

/**
 * Append a CeoDecision event to the event store. Single canonical path.
 *
 * The event-driven fan-out wired in `runtime/run.ts` will dispatch to
 * `anya:projection-refresh` (cache regen) and `scrooge:follow-on-router`
 * (auto-fire on approve) when this is called from a runtime context;
 * when called from the dashboard server (HTTP request, no parent
 * runtime wrapper), the dashboard refreshes its own cache via the
 * existing watcher path.
 *
 * Throws if the action is invalid (caller propagates as 400 / non-zero).
 */
export function recordCeoDecision(
  input: RecordCeoDecisionInput,
  asOf: string,
): RecordCeoDecisionResult {
  if (!input.decisionId) throw new Error("decisionId is required");
  if (!input.action) throw new Error("action is required");
  if (!isValidDecisionAction(input.action)) {
    throw new Error(
      `Invalid action "${input.action}" — must be one of ${VALID_DECISION_ACTIONS.join(" | ")}`,
    );
  }
  if (!input.title) throw new Error("title is required");
  if (!input.outcome) throw new Error("outcome is required");
  if (!input.actor) throw new Error("actor is required");

  const event: Event = {
    event_id: newEventId(),
    type: "CeoDecision",
    as_of: asOf,
    entity: "BANK-ZA-001",
    actor: { type: "human", id: input.actor },
    citations: EVENT_CITATIONS,
    payload: {
      decisionId: input.decisionId,
      title: input.title,
      action: input.action,
      outcome: input.outcome,
      ...(input.comment ? { comment: input.comment } : {}),
      ...(input.sourceDoc ? { sourceDoc: input.sourceDoc } : {}),
      ...(input.followOnRoutes && input.followOnRoutes.length > 0
        ? { followOnRoutes: input.followOnRoutes }
        : {}),
      recordedVia: input.recordedVia ?? "unknown",
    },
    // D-DATA-PROVENANCE-SUBSTRATE Slice 1 — CEO decisions are real
    // architectural commitments with binding force; tagged production
    // (Q-PROV-NEW-2 carve-out per the spec). The store also auto-applies
    // this carve-out at append time if absent, but setting it explicitly
    // here keeps the audit trail self-describing.
    provenance: PRODUCTION_CARVE_OUTS.CeoDecision,
  };

  eventStore.append(event);

  return { event, eventId: event.event_id };
}

// ---------------------------------------------------------------------------
// Decision comments — append-only thread on a decisionId.
// ---------------------------------------------------------------------------

export interface RecordDecisionCommentInput {
  readonly decisionId: string;
  readonly author: string; // display name, e.g. "Marc", "Atlas"
  readonly actorType: "human" | "service" | "system";
  readonly actorId: string; // strong identity, e.g. "marc@tgv.co.za", "agent:atlas"
  readonly body: string;
  readonly inReplyToEventId?: string;
}

export interface RecordDecisionCommentResult {
  readonly event: Event;
  readonly eventId: string;
}

/**
 * Append a DecisionComment event. Append-only audit — comments don't
 * edit / delete; corrections land as a new comment that quotes the
 * original.
 */
export function recordDecisionComment(
  input: RecordDecisionCommentInput,
  asOf: string,
): RecordDecisionCommentResult {
  if (!input.decisionId) throw new Error("decisionId is required");
  if (!input.author) throw new Error("author is required");
  if (!input.actorId) throw new Error("actorId is required");
  if (!input.body || input.body.trim().length === 0) {
    throw new Error("body is required and must be non-empty");
  }

  const event = makeDecisionComment({
    asOf,
    entity: "BANK-ZA-001",
    actor: { type: input.actorType, id: input.actorId },
    citations: EVENT_CITATIONS,
    payload: {
      decisionId: input.decisionId,
      author: input.author,
      body: input.body,
      ...(input.inReplyToEventId ? { inReplyToEventId: input.inReplyToEventId } : {}),
    },
  });

  // D-DATA-PROVENANCE-SUBSTRATE Slice 1 — DecisionComment events live in the
  // CEO-decision audit trail; tag production with the same `ceo-decision-record`
  // lineage as the parent CeoDecision they thread under.
  const eventWithProvenance: Event = {
    ...event,
    provenance: PRODUCTION_CARVE_OUTS.CeoDecision,
  };
  eventStore.append(eventWithProvenance);

  return { event, eventId: event.event_id };
}
