// dashboard/v2-fx-open-book.ts
//
// D-FX-LIVE-VIEW-PROVENANCE-LEAK-FIX — the ONE canonical "open FX book" read.
//
// PROBLEM (root cause, brief id brief:kai:fix-fx-live-view-provenance-leak-cost-
// basis-mark:2026-06-29):
//   The FX V2 surface (`/api/v2/markets/fx/*`) folded the FIL FX instance family
//   with NO provenance filter and NO settlement-lifecycle bound. Two structural
//   defects fell out of that single helper (`liveFxInstances` in
//   `v2-markets-fx-view.ts`):
//
//   1. PROVENANCE LEAK — simulated (`kind:simulated`, CP-SIM-*) and seed-harness
//      (`build-phase-fixture`) FX instances surfaced in a view the route LABELLED
//      `production-only`. The GL (the domain-truth oracle) is honestly EMPTY in
//      the build phase (no real pre-licence trades), so a `production-only` FX
//      view that shows trades is sourcing non-production data — it cannot
//      reconcile to the GL.
//
//   2. SETTLEMENT-LIFECYCLE STALL — a simulated FX spot settling 2026-02-05 that
//      never received an explicit `FilInstrumentTerminated` stayed `stage:active`
//      and counted as an OPEN position on 2026-06-29, accruing an open-position
//      charge + MTM months after it settled.
//
// FIX (explicit, fail-closed — Engineering Charter cmd 1 root-cause, cmd 2
// fail-closed, cmd 4 source-don't-hardcode):
//   - Provenance is an EXPLICIT `ProvenanceFilter` threaded from the route, never
//     an implicit default (the 2026-06-22 incident — an `includeSimulated`
//     widening painting R300m sim into Prod — was fixed by an EXPLICIT filter, not
//     implicit defaults; same lesson here).
//   - "Open" means BOTH `isLiveStage(stage)` (active/proposed, not a terminal
//     cancelled/settled/matured/terminated) AND `settlementDate > asOf` (a spot
//     past its settlement date is no longer an open position regardless of whether
//     a termination event was emitted). The settlement-date bound is the
//     fail-closed backstop for the missing-termination case.
//
// Every "live FX" panel (summary / blotter / risk / counterparties / headroom /
// daily-P&L) reads through THIS module so the provenance + lifecycle semantics
// cannot drift between panels (the single-source-of-truth that was missing).
//
// Authority: D-FX-LIVE-VIEW-PROVENANCE-LEAK-FIX (CEO-approved 2026-06-29);
//   D-DATA-PROVENANCE-SUBSTRATE; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE.
// Author: Kai (Trading systems engineer, engineering).

import type { EventStore } from "../platform/event-store/store";
import {
  type ProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../platform/projections/filter";
import {
  type FilInstanceRow,
  foldFilInstances,
  isLiveStage,
} from "../v2-core/fil-instances/projection";

const FX_LIFECYCLE_EVENT_TYPES = [
  "FilInstrumentCreated",
  "FilInstrumentAmended",
  "FilInstrumentTerminated",
] as const;

/**
 * True iff a FIL FX instance is an OPEN position as of `asOf`:
 *   - its lifecycle stage is live (active / proposed — not a terminal stage), AND
 *   - its settlement date is strictly AFTER `asOf`.
 *
 * The settlement-date bound is the fail-closed backstop (Charter cmd 2): a
 * simulated spot whose `FilInstrumentTerminated` was never emitted stays
 * `stage:active`, but a position past its settlement date is NOT open — it has
 * settled by the passage of time. Excluding it prevents a stale settled trade
 * from accruing an open-position charge / MTM indefinitely.
 *
 * A missing / unparseable settlement date is treated as NOT open (fail-closed):
 * an instance we cannot prove is still pre-settlement is excluded from the open
 * book rather than silently counted.
 */
export function isOpenFxAsOf(row: FilInstanceRow, asOf: string): boolean {
  if (!isLiveStage(row.stage)) return false;
  const settlement = row.economicTerms.settlementDate;
  const settlementMs = Date.parse(settlement);
  const asOfMs = Date.parse(asOf);
  if (!Number.isFinite(settlementMs) || !Number.isFinite(asOfMs)) return false;
  return settlementMs > asOfMs;
}

/**
 * The ONE canonical open-FX-book read. Folds the FIL FX lifecycle family from the
 * store under the EXPLICIT provenance `filter`, then keeps only the FX-asset-class
 * instances that are OPEN as of `asOf` (`isOpenFxAsOf`).
 *
 * Replay-derived (Principle 1). Provenance-filtered at the ENVELOPE level
 * (`eventMatchesProvenanceFilter(e, filter)` reads `e.provenance`, NOT
 * `e.payload`) so `production-only` admits ONLY production (+ build-phase-fixture
 * during build phase, per the filter's lifecycle-aware semantics) — simulated
 * CP-SIM-* instances are excluded.
 */
export function openFxInstances(
  store: Pick<EventStore, "replay">,
  filter: ProvenanceFilter,
  asOf: string,
): FilInstanceRow[] {
  const payloads: unknown[] = [];
  for (const type of FX_LIFECYCLE_EVENT_TYPES) {
    try {
      for (const e of store.replay({ type })) {
        if (!eventMatchesProvenanceFilter(e, filter)) continue;
        payloads.push(e.payload);
      }
    } catch {
      // Family not registered in this store — fold what we have (conservative).
    }
  }
  const register = foldFilInstances(payloads as never);
  const out: FilInstanceRow[] = [];
  for (const row of register.values()) {
    if (row.economicTerms.assetClass !== "fx") continue;
    if (!isOpenFxAsOf(row, asOf)) continue;
    out.push(row);
  }
  return out;
}
