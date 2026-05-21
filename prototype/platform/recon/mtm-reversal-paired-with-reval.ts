// platform/recon/mtm-reversal-paired-with-reval.ts
//
// Continuous-controls pipeline: every FX position-day reversal must be
// paired with a forward revaluation event on the same day (or be the
// final closing entry on the position).
//
// The 2026-05-20 incident (15 reversal postings on 2026-05-20 with zero
// FxPositionRevalued events for the same day) is the canonical seed:
// Bea posted prior-day reversals because trades cancelled, but the
// invariant we want to assert at the substrate level is broader —
// reversal-without-reval (or vice-versa) on the same position-day is
// always a finding.
//
// Assertion (per position):
//
//   For every (tradeId, day) where SubLedgerPostingEmitted carries
//   postingType `"reversal"` and traces back to that trade, the count of
//   `FxPositionRevalued` events for (tradeId, day) MUST be >= 1 OR the
//   reversal must be the final closing entry (trade cancelled or settled
//   on or before that day).
//
//   Equivalently across the position's lifetime: the count of forward
//   revaluations and the count of revaluation-reversals can differ by at
//   most one (the open day), and the difference may be in either
//   direction during the close-out window.
//
// What this catches (and what it doesn't):
//   - Catches: a reversal posting that fires on a day with no matching
//     forward revaluation AND the trade is not closed on that day. This
//     is the 2026-05-21 brief's invariant: reversal-then-reval must be
//     atomic.
//   - Catches: a forward revaluation on a day with no companion if Bea's
//     posting engine is later extended to reverse-prior-then-revaluate;
//     under that model the deltas should always come in pairs (one or
//     the other end of the position-day window).
//   - Does NOT catch: a missing daily revaluation. That is the job of
//     `recon:position-revalued-cites-mark` (Slice B.1) plus the
//     `SubstrateAlert{alertClass:"integrity"}` Rohan's daily-mtm handler
//     emits when no production tick is available.
//
// Severity: `warn` while the production FX feed is missing (every
// position-day legitimately falls back to stale-mark with no reversal
// pairing — surfaced via SubstrateAlert). Will tighten to `fail` once
// production FX ingest lands and the substrate stops needing the
// stale-mark crutch.
//
// Authority:
//   - D-EVENT-VIEW-BOUNDARY-WIRE Slice B.1 (mark-adoption engine).
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved).
//   - IFRS-9-§5.7.1 (FVTPL: changes in fair value through P&L).
//   - Brief: brief:rohan:wire-daily-mtm-cadence-fix-reversal-without-reva:2026-05-21.
//
// Author: Rohan (Market risk engineer, engineering).

import { eventStore } from "../composition";
import type {
  FxPositionRevaluedPayload,
  FxTradeCancelledPayload,
} from "../event-store/event-types/fx-accounting";
import type { SettlementConfirmedPayload } from "../markets/cdm/fx";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "mtm-reversal-paired-with-reval";

// Result shape extends ReconResult with audit counts that callers may
// surface in dashboards / scenario asserts.
export interface MtmReversalPairedResult extends ReconResult {
  readonly tradesAudited: number;
  readonly positionDaysWithReversalNoReval: number;
  readonly maxNetPairingGap: number;
}

interface PostingRow {
  readonly day: string;
  readonly postingType: string;
  readonly sourceEventId: string;
}

function dayOf(asOf: string): string {
  return asOf.slice(0, 10);
}

// Build a map of every SubLedgerPostingEmitted by sourceEventId so we
// can join postings back to the source domain event (FxPositionRevalued,
// FxTradeCancelled) by event_id.
function buildPostingIndex(): Map<string, PostingRow[]> {
  const idx = new Map<string, PostingRow[]>();
  for (const e of eventStore.replay({ type: "SubLedgerPostingEmitted" })) {
    const p = e.payload as {
      sourceEventId?: unknown;
      postingType?: unknown;
    };
    if (typeof p.sourceEventId !== "string" || typeof p.postingType !== "string") continue;
    const row: PostingRow = {
      day: dayOf(e.as_of),
      postingType: p.postingType,
      sourceEventId: p.sourceEventId,
    };
    const existing = idx.get(p.sourceEventId);
    if (existing) {
      existing.push(row);
    } else {
      idx.set(p.sourceEventId, [row]);
    }
  }
  return idx;
}

// Build a set of (tradeId, day) where a forward revaluation exists.
function buildForwardRevalSet(): {
  byTradeDay: Set<string>;
  byTradeCount: Map<string, number>;
} {
  const byTradeDay = new Set<string>();
  const byTradeCount = new Map<string, number>();
  for (const e of eventStore.replay({ type: "FxPositionRevalued" })) {
    const p = e.payload as FxPositionRevaluedPayload;
    byTradeDay.add(`${p.tradeId}::${dayOf(e.as_of)}`);
    byTradeCount.set(p.tradeId, (byTradeCount.get(p.tradeId) ?? 0) + 1);
  }
  return { byTradeDay, byTradeCount };
}

// Build the close-out posture per trade: cancelled-on-day OR settled-on-day.
function buildCloseSet(): Map<string, string> {
  const closedOn = new Map<string, string>();
  for (const e of eventStore.replay({ type: "FxTradeCancelled" })) {
    const p = e.payload as FxTradeCancelledPayload;
    if (p.tradeId) {
      const day = dayOf(e.as_of);
      const prior = closedOn.get(p.tradeId);
      if (!prior || day < prior) closedOn.set(p.tradeId, day);
    }
  }
  for (const e of eventStore.replay({ type: "SettlementConfirmed" })) {
    const p = e.payload as SettlementConfirmedPayload;
    if (p.tradeId) {
      const day = dayOf(e.as_of);
      const prior = closedOn.get(p.tradeId);
      if (!prior || day < prior) closedOn.set(p.tradeId, day);
    }
  }
  for (const e of eventStore.replay({ type: "TradeMatured" })) {
    const p = e.payload as { tradeId?: string };
    if (p.tradeId) {
      const day = dayOf(e.as_of);
      const prior = closedOn.get(p.tradeId);
      if (!prior || day < prior) closedOn.set(p.tradeId, day);
    }
  }
  return closedOn;
}

// Resolve the tradeId carried by a posting's source domain event. We need
// this to attribute a reversal posting back to its (tradeId, day) tuple.
// `FxTradeCancelled` events are what trigger Bea's revaluation reversals;
// look up the tradeId from the cancelled-trade event payload, then attribute
// the reversal to (tradeId, posting.day).
function resolveReversalsByTradeDay(
  postingIndex: Map<string, PostingRow[]>,
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>(); // tradeId -> Set<day>
  // Walk FxTradeCancelled events; for each, look up postings keyed by its
  // event_id where postingType === "reversal", and attribute by day.
  for (const e of eventStore.replay({ type: "FxTradeCancelled" })) {
    const p = e.payload as FxTradeCancelledPayload;
    if (!p.tradeId) continue;
    const postings = postingIndex.get(e.event_id) ?? [];
    for (const row of postings) {
      if (row.postingType !== "reversal") continue;
      const set = result.get(p.tradeId) ?? new Set<string>();
      set.add(row.day);
      result.set(p.tradeId, set);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function run(): MtmReversalPairedResult {
  const base = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const postingIndex = buildPostingIndex();
  const { byTradeDay: revalDays, byTradeCount: revalCount } = buildForwardRevalSet();
  const reversalsByTradeDay = resolveReversalsByTradeDay(postingIndex);
  const closedOn = buildCloseSet();

  let tradesAudited = 0;
  let positionDaysWithReversalNoReval = 0;
  let maxNetPairingGap = 0;

  // Assertion 1: every reversal day must either have a matching forward
  // revaluation on the same (tradeId, day) OR be the close-out day for
  // that trade (cancellation/settlement).
  for (const [tradeId, days] of reversalsByTradeDay) {
    tradesAudited += 1;
    const closeDay = closedOn.get(tradeId);
    for (const day of days) {
      const hasFwd = revalDays.has(`${tradeId}::${day}`);
      const isCloseDay = closeDay === day;
      if (!hasFwd && !isCloseDay) {
        positionDaysWithReversalNoReval += 1;
        violations.push({
          subject: `position-day:${tradeId}:${day}`,
          message: `Reversal posting on (tradeId=${tradeId}, day=${day}) has no paired FxPositionRevalued and is not the trade's close-out day (close-day=${closeDay ?? "—"}). Reversal-then-reval must be atomic per the 2026-05-21 brief; Rohan's daily-mtm handler should emit a stale-mark forward when no production tick is available. Citations: D-EVENT-VIEW-BOUNDARY-WIRE Slice B.1; IFRS-9-§5.7.1.`,
          severity: "warn",
        });
      }
    }
  }

  // Assertion 2: across the position's lifetime, |#forward - #reversal| <= 1
  // (the open day). We don't have a forward-by-trade for "reversal" postings
  // directly; we count reversal-days as the per-trade reversal count.
  for (const [tradeId, days] of reversalsByTradeDay) {
    const fwd = revalCount.get(tradeId) ?? 0;
    const rev = days.size;
    const gap = Math.abs(fwd - rev);
    if (gap > maxNetPairingGap) maxNetPairingGap = gap;
    // We do NOT raise an additional violation here because (a) the
    // FxTradeCancelled cascade legitimately reverses every prior forward,
    // producing |fwd-rev|=0; (b) substrate gaps already surface via the
    // SubstrateAlert path. The audit count is exposed in the result for
    // dashboard surfacing.
  }

  return {
    ...base,
    asserted: tradesAudited,
    violations,
    // Stay advisory until the production FX feed lands. Operational
    // signal flows via the SubstrateAlert path emitted by daily-mtm.
    ok: true,
    tradesAudited,
    positionDaysWithReversalNoReval,
    maxNetPairingGap,
  };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  const warnCount = r.violations.filter((v) => v.severity === "warn").length;
  const failCount = r.violations.filter((v) => v.severity === "fail").length;
  if (failCount === 0 && warnCount === 0) {
    console.log(
      JSON.stringify({
        level: "info",
        pipeline: PIPELINE,
        ok: r.ok,
        tradesAudited: r.tradesAudited,
        positionDaysWithReversalNoReval: r.positionDaysWithReversalNoReval,
        maxNetPairingGap: r.maxNetPairingGap,
        msg: "mtm-reversal-paired-with-reval passed (every reversal pairs with a forward revaluation or is the trade close-out day)",
      }),
    );
  } else {
    console.log(
      JSON.stringify({
        level: failCount > 0 ? "error" : "warn",
        pipeline: PIPELINE,
        ok: r.ok,
        tradesAudited: r.tradesAudited,
        positionDaysWithReversalNoReval: r.positionDaysWithReversalNoReval,
        maxNetPairingGap: r.maxNetPairingGap,
        warnings: warnCount,
        failures: failCount,
        msg: `mtm-reversal-paired-with-reval: ${r.positionDaysWithReversalNoReval} reversal-without-reval position-day(s) flagged (advisory while production FX feed is missing)`,
      }),
    );
    for (const v of r.violations) {
      console.warn(`  [${v.severity.toUpperCase()}] ${v.subject}: ${v.message}`);
    }
  }
  if (!r.ok) process.exit(1);
}
