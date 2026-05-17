// platform/recon/rms-event-projection-parity.ts
//
// Continuous-controls pipeline: RMS event → projection parity.
//
// Phase 1 spec §14 #1 ("projection ↔ event-store parity"): for each of the
// seven RMS register projections, a naive replay from event_id zero must
// produce the same row-set as the live projection path used by the
// dashboard (`buildRmsRegistersFold`, which includes the snapshot-aware
// path for the decisions register). Any drift between the two paths is a
// substrate bug — either the snapshot codec lost information (F-007
// boundary), the projection's `reduce` is non-deterministic (Principle 1
// violation), or the live cache is stale (5s TTL races with appends in a
// way the projection cannot recover from).
//
// Authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09);
//            D-RMS-PHASE-2-4-AUTHORSHIP (Owen + Atlas, 2026-05-16).
// Atlas's PR #465 gap #2 — this recon closes it.
//
// Author: Atlas (Core banking platform architect, engineering)

import { buildRmsRegistersFold } from "../../dashboard/rms-view";
import type { RmsRegistersFold } from "../../dashboard/rms-view";
import { eventStore } from "../composition";
import type { EventStore } from "../event-store/store";
import { LocalProjector } from "../projections";
import {
  agentRunsRegisterProjection,
  agentRunsRegisterRows,
  briefsRegisterProjection,
  briefsRegisterRows,
  correspondenceRegisterProjection,
  correspondenceRegisterRows,
  decisionsRegisterProjection,
  decisionsRegisterRows,
  documentRegisterProjection,
  documentRegisterRows,
  feedbackRegisterProjection,
  feedbackRegisterRows,
  workstreamsRegisterProjection,
  workstreamsRegisterRows,
} from "../rms-registers";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const CITATIONS = ["D-RMS-PHASE-1", "D-RMS-PHASE-2-4-AUTHORSHIP"];

export interface RunOpts {
  /** Override the event store (used by tests with a fresh sqlite). */
  readonly store?: EventStore;
}

interface ProjectionPair {
  readonly name: keyof FoldRowsByName;
  // asOf is threaded from the live fold so both paths use the same temporal
  // boundary — events with as_of > asOf are excluded from both replays.
  readonly naiveRows: (store: EventStore, asOf: string) => readonly unknown[];
}

type FoldRowsByName = {
  readonly decisions: RmsRegistersFold["decisions"];
  readonly correspondence: RmsRegistersFold["correspondence"];
  readonly "agent-runs": RmsRegistersFold["agentRuns"];
  readonly document: RmsRegistersFold["document"];
  readonly feedback: RmsRegistersFold["feedback"];
  readonly "briefs-dispatches": RmsRegistersFold["briefsDispatches"];
  readonly workstreams: RmsRegistersFold["workstreams"];
};

const PAIRS: ProjectionPair[] = [
  {
    name: "decisions",
    naiveRows: (s, asOf) =>
      decisionsRegisterRows(new LocalProjector(s).build(decisionsRegisterProjection, { asOf })),
  },
  {
    name: "correspondence",
    naiveRows: (s, asOf) =>
      correspondenceRegisterRows(
        new LocalProjector(s).build(correspondenceRegisterProjection, { asOf }),
      ),
  },
  {
    name: "agent-runs",
    naiveRows: (s, asOf) =>
      agentRunsRegisterRows(new LocalProjector(s).build(agentRunsRegisterProjection, { asOf })),
  },
  {
    name: "document",
    naiveRows: (s, asOf) =>
      documentRegisterRows(new LocalProjector(s).build(documentRegisterProjection, { asOf })),
  },
  {
    name: "feedback",
    naiveRows: (s, asOf) =>
      feedbackRegisterRows(new LocalProjector(s).build(feedbackRegisterProjection, { asOf })),
  },
  {
    name: "briefs-dispatches",
    naiveRows: (s, asOf) =>
      briefsRegisterRows(new LocalProjector(s).build(briefsRegisterProjection, { asOf })),
  },
  {
    name: "workstreams",
    naiveRows: (s, asOf) =>
      workstreamsRegisterRows(new LocalProjector(s).build(workstreamsRegisterProjection, { asOf })),
  },
];

function liveRowsForRegister(
  fold: RmsRegistersFold,
  name: ProjectionPair["name"],
): readonly unknown[] {
  switch (name) {
    case "decisions":
      return fold.decisions;
    case "correspondence":
      return fold.correspondence;
    case "agent-runs":
      return fold.agentRuns;
    case "document":
      return fold.document;
    case "feedback":
      return fold.feedback;
    case "briefs-dispatches":
      return fold.briefsDispatches;
    case "workstreams":
      return fold.workstreams;
  }
}

/**
 * Canonical-JSON serialisation for diff comparison. Sorts object keys
 * recursively so two semantically-equal objects with different key order
 * still compare equal. Arrays preserve order (their order is semantic in
 * the register-row outputs — sorted by firstSeenAt / issuedAt).
 */
function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalise(value));
}

function canonicalise(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalise);
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const out: Record<string, unknown> = {};
  for (const [k, v] of entries) out[k] = canonicalise(v);
  return out;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("rms-event-projection-parity");
  const violations: ReconViolation[] = [];
  const store = opts.store ?? eventStore;

  // Build the live fold once (snapshot-aware decisions path + naive
  // replay for the other six). This is the surface the dashboard reads
  // via /api/rms/:register. Parity = replay-from-zero produces the
  // same row-set as this fold.
  let live: RmsRegistersFold;
  try {
    live = buildRmsRegistersFold(store);
  } catch (err) {
    result.violations = [
      {
        subject: "rms-register:fold",
        message: `buildRmsRegistersFold threw during live fold: ${String(err)}. Citations: ${CITATIONS.join(", ")}.`,
        severity: "fail",
      },
    ];
    result.ok = false;
    return result;
  }

  // Use the same asOf anchor for naive replays as the live fold so that
  // future-dated events (as_of > now) are excluded from both paths equally.
  const foldAsOf = live.asOf;

  for (const pair of PAIRS) {
    result.asserted++;
    let naive: readonly unknown[];
    let naiveB: readonly unknown[];
    try {
      // Two independent naive replays — guards Principle 1 purity.
      naive = pair.naiveRows(store, foldAsOf);
      naiveB = pair.naiveRows(store, foldAsOf);
    } catch (err) {
      violations.push({
        subject: `rms-register:${pair.name}`,
        message: `Projection \`${pair.name}\` threw during replay: ${String(err)}. Citations: ${CITATIONS.join(", ")}.`,
        severity: "fail",
      });
      continue;
    }

    // Determinism check — two independent naive replays must match.
    if (canonicalJson(naive) !== canonicalJson(naiveB)) {
      violations.push({
        subject: `rms-register:${pair.name}`,
        message: `Projection \`${pair.name}\` is non-deterministic: two independent replays of the same store produced different row-sets. The reduce function must be pure (Principle 1). Citations: ${CITATIONS.join(", ")}.`,
        severity: "fail",
      });
      continue;
    }

    // Parity check — naive replay vs live cache. Drift here means the
    // snapshot path lost or invented data (decisions register is the
    // only register that uses snapshots today; the other six should
    // match by construction).
    const liveRows = liveRowsForRegister(live, pair.name);
    if (canonicalJson(naive) !== canonicalJson(liveRows)) {
      // Find the first row that differs for a useful error message.
      let firstDiff = -1;
      const maxLen = Math.max(naive.length, liveRows.length);
      for (let i = 0; i < maxLen; i++) {
        if (canonicalJson(naive[i]) !== canonicalJson(liveRows[i])) {
          firstDiff = i;
          break;
        }
      }
      violations.push({
        subject: `rms-register:${pair.name}`,
        message: `Projection \`${pair.name}\` drifts between naive replay (${naive.length} rows) and live fold (${liveRows.length} rows); first diff at index ${firstDiff}. The snapshot path or live cache has lost or invented data — Principle 1 boundary. Citations: ${CITATIONS.join(", ")}.`,
        severity: "fail",
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "RMS event-projection parity passed — all 7 registers fold deterministically"
        : "RMS event-projection parity FAILED — projection drift detected",
      detail: r.violations,
    }),
  );
  if (!r.ok) process.exit(1);
}
