// runtime/decisions/record.ts
//
// Canonical authoring API for the unified `Decision` event family.
// D-DECISIONS-FRAMEWORK-REDESIGN (CEO-approved 2026-05-16):
//   - Slice A: Decision event type + projection.
//   - Slice B: recordDecision / requestDecision / resolveDecision API;
//     recordCeoDecision + recordDelegatedDecision kept as deprecated wrappers.
//   - Slice C: deprecated wrappers removed; all call sites migrated.
//
// The only sanctioned authoring surfaces are:
//   - recordDecision(input) — any authority / phase.
//   - requestDecision(input) — phase: 'requested'.
//   - resolveDecision(input) — terminal phases.
//
// Call sites still using recordCeoDecision / recordDelegatedDecision are
// historical one-shot scripts (scripts/record-*.ts, scripts/close-*.ts,
// scripts/backfill-*.ts). Those ran once; they carry a comment pointing
// here. New code must not use either wrapper.
//
// Author: Atlas (substrate) · Scrooge (handler caller)

import { clock, eventStore } from "../../platform/composition";
import { deterministicAggregateId, makeAggregateLabel } from "../../platform/event-store/aggregate";
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
import { provenanceForEmit } from "../../platform/event-store/provenance";
import type { Event } from "../../platform/event-store/types";
import { validateDecisionSlug } from "./registry";

const EVENT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"];

// ---------------------------------------------------------------------------
// Legacy input/result types — kept for backward compat with historical scripts.
// These ran once; they cannot be deleted without breaking typecheck.
// New code must use RecordDecisionInput / RecordDecisionResult.
// ---------------------------------------------------------------------------

// Legacy action vocabulary used by historical scripts (now inlined).
type LegacyCeoAction = "approve" | "defer" | "modify" | "request-revision";
const VALID_CEO_ACTIONS: readonly LegacyCeoAction[] = [
  "approve",
  "defer",
  "modify",
  "request-revision",
];
function isValidCeoAction(s: string): s is LegacyCeoAction {
  return (VALID_CEO_ACTIONS as readonly string[]).includes(s);
}

/** @deprecated Use RecordDecisionResult. */
export interface RecordCeoDecisionInput {
  readonly decisionId: string;
  readonly action: LegacyCeoAction;
  readonly title: string;
  readonly outcome: string;
  readonly actor: string;
  readonly comment?: string;
  readonly sourceDoc?: string;
  readonly followOnRoutes?: readonly string[];
  readonly recordedVia?: string;
}

/** @deprecated Use RecordDecisionResult. */
export interface RecordCeoDecisionResult {
  readonly event: Event;
  readonly eventId: string;
}

// ---------------------------------------------------------------------------
// recordCeoDecision — deprecated shim kept for 42 historical scripts.
//
// D-DECISIONS-FRAMEWORK-REDESIGN Slice C: these scripts ran once and are
// immutable historical artefacts. Deleting the shim breaks typecheck for
// all 42 of them. The shim re-routes through recordDecision so new events
// use the unified Decision type; no CeoDecision event is emitted.
//
// @deprecated Use `recordDecision` for all new authoring.
// ---------------------------------------------------------------------------

/**
 * @deprecated D-DECISIONS-FRAMEWORK-REDESIGN Slice C — historical scripts
 *   only. Use `recordDecision` for all new authoring. This shim translates
 *   the legacy `action` vocabulary to `Decision.phase` and emits a unified
 *   `Decision` event. No legacy `CeoDecision` event is emitted.
 */
export function recordCeoDecision(
  input: RecordCeoDecisionInput,
  asOf: string,
): RecordCeoDecisionResult {
  if (!input.decisionId) throw new Error("decisionId is required");
  if (!input.action) throw new Error("action is required");
  if (!isValidCeoAction(input.action)) {
    throw new Error(
      `Invalid action "${input.action}" — must be one of ${VALID_CEO_ACTIONS.join(" | ")}`,
    );
  }
  if (!input.title) throw new Error("title is required");
  if (!input.outcome) throw new Error("outcome is required");
  if (!input.actor) throw new Error("actor is required");

  const phaseMap: Record<LegacyCeoAction, DecisionPhase> = {
    approve: "approved",
    modify: "approved",
    defer: "deferred",
    "request-revision": "requested",
  };
  const phase = phaseMap[input.action] ?? "approved";
  const followOnDispatch: DispatchHint[] = (input.followOnRoutes ?? []).map((route) => ({
    route,
  }));

  const result = recordDecision(
    {
      decisionId: input.decisionId,
      phase,
      authority: "CEO",
      authorityRef: input.actor,
      title: input.title,
      category: "governance",
      recommendation: input.outcome,
      rationale: input.comment ?? input.outcome,
      ...(followOnDispatch.length > 0 ? { followOnDispatch } : {}),
      recordedVia: normaliseRecordedVia(input.recordedVia ?? "unknown"),
      actor: { type: "human", id: input.actor },
    },
    asOf,
  );

  return { event: result.event, eventId: result.eventId };
}

/**
 * Coerce a free-form `recordedVia` into one of the values accepted by
 * the Decision payload schema.
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
  if (raw.startsWith("dashboard:")) return "authoring-ui";
  if (raw.startsWith("scrooge:")) return "scrooge:session-delegation";
  if (raw.startsWith("agent:")) return "agent:autonomous";
  // Legacy test-suffixed values map to authoring-ui
  if (raw.startsWith("test:")) return "authoring-ui";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Unified Decision-event authoring path (D-DECISIONS-FRAMEWORK-REDESIGN
// Slice B onwards). Only this function may call eventStore.append for
// Decision events.
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
    entity: "LE-ZA-HOZ-BANK",
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
  const aggregateLabel = makeAggregateLabel("decision", input.decisionId);
  const withProvenance: Event = {
    ...event,
    // Policy-routed (PR6): under the default category policy 'Decision' is
    // governance → production with the registered carve-out lineage
    // 'decision-record' — byte-identical to the legacy PRODUCTION_CARVE_OUTS.Decision.
    provenance: provenanceForEmit("Decision"),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  };

  // Idempotency guard. Runs AFTER payload validation (so malformed inputs
  // still throw) but BEFORE append: if a Decision event with the identical
  // (decisionId, phase, as_of) triple already exists, return it instead of
  // appending a duplicate. Matches the dedup granularity used by
  // `scripts/migrate/backfill-all-decisions.ts` and protects against
  // accidental re-emission — e.g. a test suite or a backfill re-run
  // replaying the same fixed-timestamp decision. A *different* as_of is a
  // genuine new lifecycle event (a re-request after deferral, a fresh
  // re-affirmation), so it still appends normally.
  for (const existing of eventStore.replay({ type: "Decision" })) {
    const p = existing.payload as { decisionId?: string; phase?: string };
    if (p.decisionId === input.decisionId && p.phase === input.phase && existing.as_of === ts) {
      return { event: existing, eventId: existing.event_id };
    }
  }

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
 * Convenience over `resolveDecision` with authority='CEO', actor='marc@tgv.co.za',
 * and recordedVia='scrooge:session-delegation' defaults baked in.
 *
 * D-DECISIONS-FRAMEWORK-REDESIGN Slice C: migrated to call `recordDecision`
 * directly. No longer emits a legacy `CeoDecision` event.
 */
export function recordDelegatedDecision(
  params: {
    readonly decisionId: string;
    readonly title: string;
    readonly outcome: string;
    readonly comment?: string;
    readonly followOnRoutes?: readonly string[];
    readonly recordedVia?: string;
  },
  asOf?: string,
): RecordDecisionResult {
  const phase: DecisionPhase = "approved";
  const followOnDispatch: DispatchHint[] = (params.followOnRoutes ?? []).map((route) => ({
    route,
  }));
  return recordDecision(
    {
      decisionId: params.decisionId,
      phase,
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: params.title,
      category: "governance",
      recommendation: params.outcome,
      rationale: params.comment ?? params.outcome,
      ...(followOnDispatch.length > 0 ? { followOnDispatch } : {}),
      recordedVia:
        (params.recordedVia as DecisionPayload["recordedVia"]) ?? "scrooge:session-delegation",
      actor: { type: "human", id: "marc@tgv.co.za" },
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
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: input.actorType, id: input.actorId },
    citations: EVENT_CITATIONS,
    payload: {
      decisionId: input.decisionId,
      author: input.author,
      body: input.body,
      ...(input.inReplyToEventId ? { inReplyToEventId: input.inReplyToEventId } : {}),
    },
  });

  // D-DATA-PROVENANCE-SUBSTRATE Slice 1 — DecisionComment events thread
  // under the unified Decision audit trail; tag with the Decision lineage.
  const eventWithProvenance: Event = {
    ...event,
    // Policy-routed (PR6): 'DecisionComment' is governance → production; the
    // explicit lineage keeps the legacy Decision-family value 'decision-record'
    // (byte-identical to the retired PRODUCTION_CARVE_OUTS.Decision reference).
    provenance: provenanceForEmit("DecisionComment", { sourceLineage: "decision-record" }),
  };
  eventStore.append(eventWithProvenance);

  return { event, eventId: event.event_id };
}
