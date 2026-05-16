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

import { clock, eventStore } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { makeDecisionComment } from "../../platform/event-store/event-types";
import {
  type DecisionAuthority,
  type DecisionCategory,
  type DecisionPayload,
  type DecisionPhase,
  type DecisionTerminalPhase,
  type DispatchHint,
  decisionPayloadSchema,
  makeDecision,
} from "../../platform/event-store/event-types/decision";
import { PRODUCTION_CARVE_OUTS } from "../../platform/event-store/provenance";
import type { Event } from "../../platform/event-store/types";
import { validateDecisionSlug } from "./registry";

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
 * Append a CeoDecision event to the event store.
 *
 * @deprecated Slice B of `D-DECISIONS-FRAMEWORK-REDESIGN` introduces
 *   `recordDecision` as the canonical authoring API. This wrapper
 *   preserves byte-for-byte caller-visible behaviour during the
 *   transition: it emits BOTH the legacy `CeoDecision` event AND a
 *   matching unified `Decision` event so the projection sees the same
 *   decision from either entry path. Slice C removes the legacy emission
 *   after backfill. New call sites must use `recordDecision`.
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

  // D-DECISIONS-FRAMEWORK-REDESIGN Slice B — dual-emit a unified
  // `Decision` event so the projection observes this CeoDecision under
  // the new family too. The projection is idempotent on
  // (decisionId, phase) per Slice A; tied `asOf` causes the Decision
  // event to shadow the CeoDecision row at the head.
  try {
    const phase = mapCeoActionToPhase(input.action);
    const followOnDispatch: DispatchHint[] = (input.followOnRoutes ?? []).map((route) => ({
      route,
    }));
    const decisionEvent = makeDecision({
      asOf,
      entity: "BANK-ZA-001",
      actor: { type: "human", id: input.actor },
      citations: EVENT_CITATIONS,
      payload: {
        decisionId: input.decisionId,
        phase,
        authority: "CEO",
        authorityRef: input.actor,
        title: input.title,
        category: "governance",
        recommendation: input.outcome,
        rationale: input.comment ?? input.outcome,
        sourceDocHashes: [],
        citations: EVENT_CITATIONS,
        ...(followOnDispatch.length > 0 ? { followOnDispatch } : {}),
        recordedVia: normaliseRecordedVia(input.recordedVia ?? "unknown"),
      },
    });
    const decisionWithProvenance: Event = {
      ...decisionEvent,
      provenance: PRODUCTION_CARVE_OUTS.Decision,
    };
    eventStore.append(decisionWithProvenance);
  } catch {
    // The legacy CeoDecision path is the authoritative one in Slice B;
    // a Zod-rejected dual-emit must not block the caller. Slice C makes
    // `Decision` the only emission and tightens validation there.
  }

  return { event, eventId: event.event_id };
}

/**
 * `CeoDecision.action` → `Decision.phase`. Mirrors the legacy semantics
 * used by `projections/decisions.ts::mapCeoActionToPhase`:
 *   - approve / modify → approved
 *   - defer            → deferred
 *   - request-revision → requested
 */
function mapCeoActionToPhase(action: DecisionAction): DecisionPhase {
  switch (action) {
    case "approve":
    case "modify":
      return "approved";
    case "defer":
      return "deferred";
    case "request-revision":
      return "requested";
  }
}

/**
 * Coerce a free-form `recordedVia` into one of the values accepted by
 * the Decision payload schema. Legacy CeoDecision call sites set
 * literals like `"dashboard:/api/decide"`; the unified schema only
 * permits a fixed set or the `backfill:<slug>` / `scrooge:...:<suffix>`
 * forms. The CeoDecision event keeps the original literal; the
 * dual-emitted Decision event uses a normalised value so projection
 * downstreams stay schema-clean.
 */
function normaliseRecordedVia(raw: string): DecisionPayload["recordedVia"] {
  if (
    raw === "authoring-ui" ||
    raw === "scrooge:session-delegation" ||
    raw === "agent:autonomous" ||
    raw === "recon:repair" ||
    raw === "unknown"
  ) {
    return raw;
  }
  if (/^backfill:[a-z0-9][a-z0-9-]*$/.test(raw)) return raw;
  if (/^scrooge:session-delegation:[a-z0-9][a-z0-9-]*$/.test(raw)) return raw;
  // Map common legacy literals onto the closest canonical form.
  if (raw.startsWith("dashboard:")) return "authoring-ui";
  if (raw.startsWith("scrooge:")) return "scrooge:session-delegation";
  if (raw.startsWith("agent:")) return "agent:autonomous";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Unified Decision-event authoring path (D-DECISIONS-FRAMEWORK-REDESIGN
// Slice B). Only this function may call eventStore.append for Decision
// events from now on. Deprecated wrappers below funnel through here
// for the unified emission and keep their legacy CeoDecision emission
// alongside, until Slice C retires the legacy event family.
// ---------------------------------------------------------------------------

export interface RecordDecisionInput {
  readonly decisionId: string;
  readonly phase: DecisionPhase;
  readonly authority: DecisionAuthority;
  readonly authorityRef: string;
  readonly title: string;
  readonly category: DecisionCategory;
  readonly recommendation: string;
  readonly rationale: string;
  readonly sourceDocHashes?: readonly string[];
  readonly citations?: readonly string[];
  readonly supersedes?: readonly string[];
  readonly followOnDispatch?: readonly DispatchHint[];
  readonly deadline?: string;
  readonly recordedVia: DecisionPayload["recordedVia"];
  /** Optional actor override; defaults to `authorityRef` (typical case). */
  readonly actor?: { readonly type: "human" | "service" | "system"; readonly id: string };
}

export interface RecordDecisionResult {
  readonly event: Event;
  readonly eventId: string;
}

/**
 * Canonical authoring API for the unified `Decision` event family.
 * Emits exactly one `Decision` event. Validates the payload via the
 * Zod schema in `event-types/decision.ts`; throws on rejection.
 *
 * Authority: `D-DECISIONS-FRAMEWORK-REDESIGN` (CEO-approved 2026-05-16),
 * Slice B.
 */
export function recordDecision(input: RecordDecisionInput, asOf?: string): RecordDecisionResult {
  const slugCheck = validateDecisionSlug(input.decisionId);
  if (!slugCheck.ok) {
    throw new Error(`recordDecision: ${slugCheck.reason}`);
  }
  const ts = asOf ?? clock.now();
  const actor = input.actor ?? { type: "human" as const, id: input.authorityRef };

  // Zod parse via `decisionPayloadSchema` runs inside `makeDecision`.
  const event = makeDecision({
    asOf: ts,
    entity: "BANK-ZA-001",
    actor,
    citations: EVENT_CITATIONS,
    payload: decisionPayloadSchema.parse({
      decisionId: input.decisionId,
      phase: input.phase,
      authority: input.authority,
      authorityRef: input.authorityRef,
      title: input.title,
      category: input.category,
      recommendation: input.recommendation,
      rationale: input.rationale,
      sourceDocHashes: [...(input.sourceDocHashes ?? [])],
      citations: [...(input.citations ?? EVENT_CITATIONS)],
      ...(input.supersedes && input.supersedes.length > 0
        ? { supersedes: [...input.supersedes] }
        : {}),
      ...(input.followOnDispatch && input.followOnDispatch.length > 0
        ? { followOnDispatch: [...input.followOnDispatch] }
        : {}),
      ...(input.deadline ? { deadline: input.deadline } : {}),
      recordedVia: input.recordedVia,
    }),
  });
  const withProvenance: Event = {
    ...event,
    provenance: PRODUCTION_CARVE_OUTS.Decision,
  };
  eventStore.append(withProvenance);
  return { event: withProvenance, eventId: withProvenance.event_id };
}

/**
 * Convenience wrapper: emit a `Decision` event with `phase: 'requested'`.
 * Opens a new decisionId in the register.
 */
export function requestDecision(
  input: Omit<RecordDecisionInput, "phase">,
  asOf?: string,
): RecordDecisionResult {
  return recordDecision({ ...input, phase: "requested" }, asOf);
}

/**
 * Convenience wrapper: emit a `Decision` event at a terminal phase
 * (approved | rejected | deferred | superseded | withdrawn). The
 * unified register treats any terminal phase as the close event.
 */
export function resolveDecision(
  input: Omit<RecordDecisionInput, "phase"> & { readonly phase: DecisionTerminalPhase },
  asOf?: string,
): RecordDecisionResult {
  return recordDecision(input, asOf);
}

// ---------------------------------------------------------------------------
// Session-delegation path — Scrooge records Marc's in-session approval.
// ---------------------------------------------------------------------------

/**
 * Record a CEO decision delegated through Scrooge in-session.
 * Marc's explicit "y" / approval in a Scrooge session = CEO authorization.
 * Uses marc@tgv.co.za as the actor (Marc is the authorizing principal;
 * Scrooge is the recording instrument).
 *
 * @deprecated D-DECISIONS-FRAMEWORK-REDESIGN Slice B — thin wrapper
 *   over `recordCeoDecision` (which itself dual-emits a `Decision`
 *   event). Slice C migrates callers to `resolveDecision` and removes
 *   this entry point.
 */
export function recordDelegatedDecision(
  params: Omit<RecordCeoDecisionInput, "actor" | "recordedVia"> & {
    readonly recordedVia?: string;
  },
  asOf?: string,
): RecordCeoDecisionResult {
  return recordCeoDecision(
    {
      ...params,
      actor: "marc@tgv.co.za",
      recordedVia: params.recordedVia ?? "scrooge:session-delegation",
    },
    asOf ?? clock.now(),
  );
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
