// v2-core/money-free-batch-3/projection.ts
//
// Money-free batch-3 event-list projection — the canonical, store-independent
// view the Wave 2 batch-3 parity gate folds over BOTH stores (the authoritative
// V1 event store and the v2 control-plane store).
//
// WHY AN EVENT-LIST PROJECTION (not per-domain registers):
//   The store-tee mirrors every tee-enabled event VERBATIM and reuses the V1
//   `event_id` as the v2 idempotency key. The faithful invariant for a verbatim
//   mirror is therefore "the set of (event_id, type, payload) tuples is identical
//   on both sides". Folding to a sorted list of those tuples catches a dropped
//   mirror (gap), a spurious mirror (excess), AND any payload-byte divergence,
//   with no domain-specific fold logic to drift. The batch's domains are
//   heterogeneous (intranet, sla-approval, model-risk, banking, eval, …) with no
//   shared register semantics, so a per-domain register would add surface without
//   adding fidelity.
//
// This is structurally identical to the batch-1 `foldReferenceDataRegister` and
// batch-2 `foldGovernanceAttestationRegister` — the same verbatim-mirror
// invariant, re-stated for the batch-3 type set so the batches stay independent.
//
// DETERMINISM: rows are sorted by event_id so insertion / sequence order on the
// two stores never produces a false diff; the parity harness's `stableJson`
// additionally key-sorts nested payload objects.
//
// PACKAGE BOUNDARY: no v1 imports.
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC.
// Brief: brief:atlas:wave-2-batch-3-remaining-money-free-domains:2026-06-16.
// Author: Atlas (Core banking platform architect, engineering).

/** A minimal envelope view sufficient for the event-list fold. */
export interface MoneyFreeBatch3EventView {
  readonly event_id: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
}

/** One row of the comparable register: identity + type + verbatim payload. */
export interface MoneyFreeBatch3Row {
  readonly event_id: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
}

/** The folded, deterministic register: sorted rows + a count. */
export interface MoneyFreeBatch3Register {
  readonly rows: readonly MoneyFreeBatch3Row[];
  readonly eventCount: number;
}

/**
 * Fold an event-view stream into the comparable register. Only events whose
 * `type` is in `typeSet` are folded — both stores hold many other types, and the
 * batch parity must scope to exactly the migrated set. Rows are sorted by
 * `event_id` for a stable, store-order-independent serialisation.
 *
 * The fold is pure and total: a malformed view (missing event_id) is skipped
 * rather than throwing, mirroring the batch-1/batch-2 projections — a structural
 * anomaly surfaces as a count gap in the parity gate, which is the intended loud
 * signal, not a fold crash.
 */
export function foldMoneyFreeBatch3Register(
  views: Iterable<MoneyFreeBatch3EventView>,
  typeSet: ReadonlySet<string>,
): MoneyFreeBatch3Register {
  const rows: MoneyFreeBatch3Row[] = [];
  for (const v of views) {
    if (typeof v?.event_id !== "string" || v.event_id.length === 0) continue;
    if (!typeSet.has(v.type)) continue;
    rows.push({ event_id: v.event_id, type: v.type, payload: v.payload });
  }
  rows.sort((a, b) => a.event_id.localeCompare(b.event_id));
  return { rows, eventCount: rows.length };
}
