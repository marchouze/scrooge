// platform/recon/position-revalued-cites-mark.ts
//
// Advisory recon pipeline: every FxPositionRevalued event should have a
// corresponding OfficialMarkAdopted event for the same instrument in the
// same MTM run window (±1 hour of revaluedAt).
//
// Slice B.1 of D-EVENT-VIEW-BOUNDARY-WIRE. Advisory (warn severity) in
// this slice — the FxPositionRevalued schema still carries rateSource as a
// plain string. Gating (fail severity + schema field officialMarkRef) is
// deferred to Slice D when PositionRevalued events are reclassified as
// projection rows and the coupling is enforced in the schema.
//
// Assertions:
//   A1. For each FxPositionRevalued event in the store, at least one
//       OfficialMarkAdopted event exists for the same instrumentKey
//       (= currencyPair) within ±1 hour of revaluedAt.
//   A2. Advisory only: result.ok is always true in this slice regardless
//       of violation count. The presence of violations in the log drives
//       operational awareness; CI does not gate on them until Slice D.
//
// Authority:
//   D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20, PR #620).
//   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved).
//   Policies/valuation-policy-v1.md §4.3 (Helena (Chief Risk Officer,
//     governance)).
//
// Author: Vera (Internal audit / continuous-assurance engineer, engineering)

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "position-revalued-cites-mark";
const WINDOW_MS = 60 * 60 * 1000; // ±1 hour

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function run(): ReconResult & { checkedPositions: number; matchedPositions: number } {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  let checkedPositions = 0;
  let matchedPositions = 0;

  // Build an index of OfficialMarkAdopted events by instrumentKey → sorted
  // markAsOf timestamps for efficient window lookup.
  const markIndex = new Map<string, string[]>(); // instrumentKey → markAsOf[]

  for (const e of eventStore.replay({ type: "OfficialMarkAdopted" })) {
    const p = e.payload as { instrumentKey: string; markAsOf: string };
    const key = p.instrumentKey;
    if (!markIndex.has(key)) markIndex.set(key, []);
    (markIndex.get(key) as string[]).push(p.markAsOf);
  }

  // Walk FxPositionRevalued events and check each has a matching mark.
  for (const e of eventStore.replay({ type: "FxPositionRevalued" })) {
    const p = e.payload as { currencyPair: string; revaluedAt: string };
    const { currencyPair, revaluedAt } = p;
    checkedPositions++;

    const markTimes = markIndex.get(currencyPair) ?? [];
    const revalMs = new Date(revaluedAt).getTime();
    const hasMatch = markTimes.some((t) => Math.abs(new Date(t).getTime() - revalMs) <= WINDOW_MS);

    if (hasMatch) {
      matchedPositions++;
    } else {
      violations.push({
        subject: `FxPositionRevalued:${e.event_id}`,
        message: `No OfficialMarkAdopted found for instrument="${currencyPair}" within ±1h of revaluedAt=${revaluedAt}. Advisory in Slice B.1; gating deferred to Slice D. Ensure the MTM run runs after backfill:policy-activations. Citations: D-EVENT-VIEW-BOUNDARY-WIRE, Policies/valuation-policy-v1.md §4.3.`,
        severity: "warn",
      });
    }
  }

  result.asserted = checkedPositions;
  result.violations = violations;
  // Advisory: ok is always true in Slice B.1 regardless of violation count.
  result.ok = true;

  return { ...result, checkedPositions, matchedPositions };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  const warnCount = r.violations.filter((v) => v.severity === "warn").length;
  if (warnCount === 0) {
    console.log(
      JSON.stringify({
        level: "info",
        pipeline: PIPELINE,
        ok: true,
        asserted: r.checkedPositions,
        matched: r.matchedPositions,
        warnings: 0,
        msg: "position-revalued-cites-mark passed (all FxPositionRevalued events have a matching OfficialMarkAdopted)",
      }),
    );
  } else {
    console.log(
      JSON.stringify({
        level: "warn",
        pipeline: PIPELINE,
        ok: true,
        asserted: r.checkedPositions,
        matched: r.matchedPositions,
        warnings: warnCount,
        msg: `position-revalued-cites-mark advisory: ${warnCount} FxPositionRevalued event(s) lack a matching OfficialMarkAdopted (Slice D will gate this)`,
      }),
    );
    for (const v of r.violations) {
      console.warn(`  [${v.severity.toUpperCase()}] ${v.subject}: ${v.message}`);
    }
  }
}
