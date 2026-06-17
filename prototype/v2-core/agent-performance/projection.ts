// v2-core/agent-performance/projection.ts
//
// Agent-performance event-list projection — the canonical, store-independent view
// the bucket-C pilot parity gate folds over BOTH stores (the authoritative V1
// event store and the v2 control-plane store).
//
// WHY AN EVENT-LIST PROJECTION (not the per-agent register fold):
//   The store-tee mirrors every tee-enabled event VERBATIM and reuses the V1
//   `event_id` as the v2 idempotency key. The faithful invariant for a verbatim
//   mirror is therefore "the set of (event_id, type, payload) tuples is identical
//   on both sides". Folding to a sorted list of those tuples catches a dropped
//   mirror (gap), a spurious mirror (excess), AND any payload-byte divergence,
//   with no domain-specific fold logic to drift.
//
//   The V1 per-agent register (`agent-performance-projection.ts`) is a LOSSY fold
//   for parity purposes: it keeps only the latest-per-agent state and DROPS
//   AgentFeedbackIssued events that arrive before an evaluation. A mirror that
//   dropped exactly such a feedback event would still byte-match on the register
//   — a false green. The event-list tuple fold is therefore the correct,
//   complete verbatim invariant, and is the same shape posture / reference-data /
//   governance-attestation / batch-3 all converged on (no new bespoke per-agent
//   parity logic to maintain).
//
// DETERMINISM: rows are sorted by event_id so insertion / sequence order on the
// two stores never produces a false diff; the parity harness's `stableJson`
// additionally key-sorts nested payload objects.
//
// PACKAGE BOUNDARY: no v1 imports.
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC.
// Brief: brief:atlas:bucket-c-pilot-agent-performance-domain-to-v2:2026-06-17.
// Author: Atlas (Core banking platform architect, engineering).

/** A minimal envelope view sufficient for the event-list fold. */
export interface AgentPerformanceEventView {
  readonly event_id: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
}

/** One row of the comparable register: identity + type + verbatim payload. */
export interface AgentPerformanceRow {
  readonly event_id: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
}

/** The folded, deterministic register: sorted rows + a count. */
export interface AgentPerformanceRegister {
  readonly rows: readonly AgentPerformanceRow[];
  readonly eventCount: number;
}

/**
 * Fold an event-view stream into the comparable register. Only events whose
 * `type` is in `typeSet` are folded — both stores hold many other types, and the
 * pilot parity must scope to exactly the migrated set. Rows are sorted by
 * `event_id` for a stable, store-order-independent serialisation.
 *
 * The fold is pure and total: a malformed view (missing event_id) is skipped
 * rather than throwing — a structural anomaly surfaces as a count gap in the
 * parity gate, the intended loud signal, not a fold crash.
 */
export function foldAgentPerformanceRegister(
  views: Iterable<AgentPerformanceEventView>,
  typeSet: ReadonlySet<string>,
): AgentPerformanceRegister {
  const rows: AgentPerformanceRow[] = [];
  for (const v of views) {
    if (typeof v?.event_id !== "string" || v.event_id.length === 0) continue;
    if (!typeSet.has(v.type)) continue;
    rows.push({ event_id: v.event_id, type: v.type, payload: v.payload });
  }
  rows.sort((a, b) => a.event_id.localeCompare(b.event_id));
  return { rows, eventCount: rows.length };
}
