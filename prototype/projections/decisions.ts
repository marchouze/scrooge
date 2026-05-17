// projections/decisions.ts
//
// The single events-only decisions register. Folds `Decision` and
// (transition-period) `CeoDecision` events into one `DecisionsRegister`
// with `open`, `resolved`, and `byId` history.
//
// Slice A scope (D-DECISIONS-FRAMEWORK-REDESIGN, CEO-approved 2026-05-16):
// projection is read by the dashboard; existing `CeoDecision` events
// continue to be the dominant input. Slices B/C migrate authoring and
// backfill historical IDs.
//
// Spec: `/Users/marc/.claude/plans/the-current-setup-for-polymorphic-pie.md`
// §"Target design / 3. Projection: one register, derived from events only".
//
// Pure: no I/O beyond `eventStore.replay`. No filesystem scans, no
// curated JSON. Principle 1 — events are the only source of truth.
//
// Author: Atlas (Core banking platform architect, engineering)

import type {
  DecisionAuthority,
  DecisionCategory,
  DecisionPayload,
  DecisionPhase,
} from "../platform/event-store/event-types/decision";
import {
  DECISION_TERMINAL_PHASES,
  isTerminalPhase,
} from "../platform/event-store/event-types/decision";
import type { Event } from "../platform/event-store/types";

// ---------------------------------------------------------------------------
// Output shapes
// ---------------------------------------------------------------------------

/** One row in the decisions register — the head (latest) state per decisionId. */
export interface DecisionRow {
  readonly decisionId: string;
  readonly title: string;
  readonly authority: DecisionAuthority;
  readonly authorityRef: string;
  readonly category: DecisionCategory;
  readonly phase: DecisionPhase;
  readonly recommendation: string;
  readonly rationale: string;
  /** Phase emission timestamp (ISO 8601 UTC). */
  readonly asOf: string;
  /** When the decisionId was first opened (earliest `requested` event). */
  readonly openedAt: string;
  /** When the decisionId reached a terminal phase, if it has. */
  readonly resolvedAt?: string;
  readonly sourceDocHashes: readonly string[];
  readonly citations: readonly string[];
  readonly supersedes?: readonly string[];
  readonly deadline?: string;
  readonly recordedVia: string;
}

/** Full per-decisionId history — every phase event preserved, in append order. */
export interface DecisionHistory {
  readonly decisionId: string;
  readonly events: readonly DecisionRow[];
  readonly head: DecisionRow;
}

export interface DecisionsRegister {
  readonly open: readonly DecisionRow[];
  readonly resolved: readonly DecisionRow[];
  readonly byId: ReadonlyMap<string, DecisionHistory>;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Minimal source interface — anything that yields events of types
 * `Decision` and `CeoDecision` (transition-period). Production wires
 * this from `EventStore.replay({ type })`; tests pass an array.
 */
export interface DecisionsEventSource {
  decisionEvents(): Iterable<Event>;
  ceoDecisionEvents(): Iterable<Event>;
}

// ---------------------------------------------------------------------------
// Build helpers
// ---------------------------------------------------------------------------

/**
 * CeoDecision action → Decision phase. Mirrors the legacy semantic:
 *   - approve / modify → approved (action carried out)
 *   - defer            → deferred
 *   - request-revision → reopens the decision; mapped to `requested`
 *
 * `request-revision` deliberately does NOT close the decision — it
 * returns it to the open queue.
 */
function mapCeoActionToPhase(action: string): DecisionPhase {
  switch (action) {
    case "approve":
    case "modify":
      return "approved";
    case "defer":
      return "deferred";
    case "request-revision":
      return "requested";
    default:
      // Unknown action — treat as approved (matches legacy default).
      return "approved";
  }
}

function ceoCategoryFallback(): DecisionCategory {
  // Legacy CeoDecision payloads carry no `category`; the register
  // shows them as `governance` for now. Slice B's `recordDecision`
  // requires category explicitly.
  return "governance";
}

function ceoAuthorityRef(e: Event): string {
  return e.actor.id || "unknown";
}

/** Row built from a `Decision` event. */
function rowFromDecisionEvent(e: Event): DecisionRow {
  const p = e.payload as DecisionPayload;
  return {
    decisionId: p.decisionId,
    title: p.title,
    authority: p.authority,
    authorityRef: p.authorityRef,
    category: p.category,
    phase: p.phase,
    recommendation: p.recommendation,
    rationale: p.rationale,
    asOf: e.as_of,
    openedAt: e.as_of, // refined in the fold (earliest requested wins)
    ...(isTerminalPhase(p.phase) ? { resolvedAt: e.as_of } : {}),
    sourceDocHashes: [...p.sourceDocHashes],
    citations: [...p.citations],
    ...(p.supersedes ? { supersedes: [...p.supersedes] } : {}),
    ...(p.deadline ? { deadline: p.deadline } : {}),
    recordedVia: p.recordedVia,
  };
}

/** Row built from a legacy `CeoDecision` event — synthesised into the unified shape. */
function rowFromCeoEvent(e: Event): DecisionRow {
  const p = e.payload as Record<string, unknown>;
  const action = String(p.action ?? "approve");
  const phase = mapCeoActionToPhase(action);
  const decisionId = String(p.decisionId ?? "");
  const recordedVia = typeof p.recordedVia === "string" ? p.recordedVia : "unknown";
  return {
    decisionId,
    title: String(p.title ?? decisionId),
    authority: "CEO",
    authorityRef: ceoAuthorityRef(e),
    category: ceoCategoryFallback(),
    phase,
    recommendation: String(p.outcome ?? ""),
    rationale: typeof p.comment === "string" ? p.comment : "",
    asOf: e.as_of,
    openedAt: e.as_of,
    ...(isTerminalPhase(phase) ? { resolvedAt: e.as_of } : {}),
    sourceDocHashes: [],
    citations: Array.isArray(e.citations) ? [...e.citations] : [],
    recordedVia,
  };
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/**
 * Build the decisions register from an event source.
 *
 * Fold rule (per spec §"Target design / 1"): events sharing one
 * `decisionId` are folded; the head row is the latest by `asOf`, with
 * earliest `openedAt` preserved. A decision is open iff its head phase
 * is `requested`; otherwise resolved (terminal phase).
 *
 * Events are processed in append order; ties on `asOf` resolve by
 * source-order (Decision events shadow legacy CeoDecision events when
 * both share an id — Slice C will alias / dedupe properly).
 */
export function buildDecisionsRegister(source: DecisionsEventSource): DecisionsRegister {
  const allRows: DecisionRow[] = [];

  for (const e of source.ceoDecisionEvents()) {
    const row = rowFromCeoEvent(e);
    if (row.decisionId) allRows.push(row);
  }
  for (const e of source.decisionEvents()) {
    const row = rowFromDecisionEvent(e);
    if (row.decisionId) allRows.push(row);
  }

  // Sort by asOf ascending. Decision events tied with CeoDecision events
  // sort after (later in the input order), giving them precedence at the
  // head when the timestamps match — Slice B's migration path.
  allRows.sort((a, b) => (a.asOf < b.asOf ? -1 : a.asOf > b.asOf ? 1 : 0));

  const groups = new Map<string, DecisionRow[]>();
  for (const row of allRows) {
    const arr = groups.get(row.decisionId) ?? [];
    arr.push(row);
    groups.set(row.decisionId, arr);
  }

  const byId = new Map<string, DecisionHistory>();
  for (const [decisionId, events] of groups.entries()) {
    const earliest = events[0];
    if (!earliest) continue;
    const head = events[events.length - 1];
    if (!head) continue;
    const terminal = [...events].reverse().find((r) => isTerminalPhase(r.phase));
    const refined: DecisionRow = {
      ...head,
      openedAt: earliest.asOf,
      ...(terminal ? { resolvedAt: terminal.asOf } : {}),
    };
    byId.set(decisionId, {
      decisionId,
      events,
      head: refined,
    });
  }

  const open: DecisionRow[] = [];
  const resolved: DecisionRow[] = [];
  for (const history of byId.values()) {
    if (isTerminalPhase(history.head.phase)) {
      resolved.push(history.head);
    } else {
      open.push(history.head);
    }
  }

  // Stable, newest-first ordering for both lists (matches dashboard convention).
  open.sort((a, b) => (a.asOf < b.asOf ? 1 : a.asOf > b.asOf ? -1 : 0));
  resolved.sort((a, b) => {
    const ar = a.resolvedAt ?? a.asOf;
    const br = b.resolvedAt ?? b.asOf;
    return ar < br ? 1 : ar > br ? -1 : 0;
  });

  return { open, resolved, byId };
}

// ---------------------------------------------------------------------------
// Convenience source builder for EventStore (no I/O until iterated).
// ---------------------------------------------------------------------------

interface ReplayableStore {
  replay(opts: { type: string }): Iterable<Event>;
}

export function decisionsSourceFromStore(store: ReplayableStore): DecisionsEventSource {
  return {
    decisionEvents: () => store.replay({ type: "Decision" }),
    ceoDecisionEvents: () => store.replay({ type: "CeoDecision" }),
  };
}

// Re-export the terminal-phase set for downstream consumers that need
// to mirror the close rule (the dashboard tile, recon scripts).
export { DECISION_TERMINAL_PHASES };
