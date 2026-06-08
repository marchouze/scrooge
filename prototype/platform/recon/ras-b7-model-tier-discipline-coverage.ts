// platform/recon/ras-b7-model-tier-discipline-coverage.ts
//
// Continuous-controls pipeline: RAS §B7 model-tier discipline coverage.
//
// Asserts that the most-recent `RiskAppetiteSnapshot` event emitted by
// Helena's daily run carries a *measured* status (green/amber/red) — NOT
// `unmeasured` — for the `appetite:model:tier-discipline` appetite line.
//
// Why this pipeline exists:
//
//   Before the Atlas model-tier-discipline wiring, the line in Helena's
//   `helena-risk-appetite-watch.ts` resolved to `unmeasured` — the daily
//   `RiskAppetiteSnapshot` event reported a measurement gap rather than a
//   computed status. With the `platform/projections/model-tier-discipline.ts`
//   projection wired in, the line must resolve to a measured status
//   (green/amber/red — `no-models` maps to green by the wiring code) — even
//   in build phase where an empty model registry constructs a green result.
//
//   This pipeline is the gate that prevents regression. If a future refactor
//   reverts the wiring (e.g. handler swaps back to hardcoded `unmeasured` for
//   this line), the recon fails.
//
// Independence note: this pipeline reads the event store via
// `eventStore.replay({type:"RiskAppetiteSnapshot"})` and inspects the
// `lineStatuses` payload field. It does not import any agent runtime —
// recon is build-time-pure.
//
// Build-phase softening: when the event store contains zero
// `RiskAppetiteSnapshot` events (fresh bench / unseeded), the pipeline
// downgrades to `info` rather than `fail` — Helena's handler has not been
// run on this bench yet. Mirrors the pattern in
// `recon:liquidity-appetite-snapshot-coverage`.
//
// Principles:
//   P1 — events are the only source of truth (snapshot is the canonical
//        signal, not a flag in a register file).
//   P2 — single-graph discipline (the wiring traces RAS §B7 → model-tier
//        discipline projection → model registry → snapshot in one walk).
//
// Authority: D-RAS (CEO-approved 2026-05-06); RAS §B7;
//   brief:atlas:build-model-tier-discipline-measurement-substrat:2026-06-01.
// Author: Atlas (Core banking platform architect, engineering) ·
//         Vera (Internal audit engineer, third line of defence — recon shape).

import { eventStore } from "../composition";
import { requireRasAppetiteLine } from "../risk/ras-appetite-register";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ras-b7-model-tier-discipline-coverage";

// Line identity read from the canonical register (single source of truth).
const MODEL_TIER_LINE_ID = requireRasAppetiteLine("appetite:model:tier-discipline").id;

/**
 * Statuses that count as "measured" — RAG plus the build-phase `n/a-build-phase`
 * carve-out. `unmeasured` is the failure mode the pipeline catches.
 */
const MEASURED_STATUSES = new Set(["green", "amber", "red", "n/a-build-phase"]);

interface RiskAppetiteSnapshotLike {
  readonly event_id: string;
  readonly type: string;
  readonly as_of: string;
  readonly payload: {
    readonly lineStatuses?: unknown;
  };
}

export interface RunOpts {
  /**
   * Override the event source — used by tests to feed synthetic events
   * without touching the live event store. When supplied, the pipeline
   * reads from this iterable instead of the global event store.
   */
  events?: Iterable<RiskAppetiteSnapshotLike>;
}

function loadSnapshotEvents(opts: RunOpts): RiskAppetiteSnapshotLike[] {
  if (opts.events) {
    return [...opts.events];
  }
  const out: RiskAppetiteSnapshotLike[] = [];
  for (const e of eventStore.replay({ type: "RiskAppetiteSnapshot" })) {
    out.push({
      event_id: e.event_id,
      type: e.type,
      as_of: e.as_of,
      payload: e.payload as RiskAppetiteSnapshotLike["payload"],
    });
  }
  return out;
}

/**
 * Pick the most-recent snapshot by `as_of` (ISO string compare — sortable
 * for UTC ISO 8601 timestamps).
 */
function latestByAsOf(
  events: readonly RiskAppetiteSnapshotLike[],
): RiskAppetiteSnapshotLike | null {
  let latest: RiskAppetiteSnapshotLike | null = null;
  for (const e of events) {
    if (latest === null || e.as_of > latest.as_of) {
      latest = e;
    }
  }
  return latest;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const all = loadSnapshotEvents(opts);

  // Assertion 1: at least one snapshot exists. Empty-store softening to
  // `info` (mirrors liquidity-appetite-snapshot-coverage pattern).
  result.asserted++;
  if (all.length === 0) {
    if (opts.events !== undefined) {
      // Synthetic empty-array is a hard failure — test-author asked for
      // assertion against a known-empty set.
      violations.push({
        subject: "RiskAppetiteSnapshot",
        message:
          "No RiskAppetiteSnapshot events provided (synthetic mode). Pipeline requires at least one snapshot to assert against.",
        severity: "fail",
      });
      result.violations = violations;
      result.ok = false;
      return result;
    }
    violations.push({
      subject: "RiskAppetiteSnapshot",
      message:
        "No RiskAppetiteSnapshot events in the store — Helena's daily appetite-watch handler has not been run on this bench. Run the handler (or `bun run run:helena-appetite-watch`) to seed the snapshot locally. Recon skipped.",
      severity: "info",
    });
    result.violations = violations;
    result.ok = true;
    return result;
  }

  // Assertion 2: the most-recent snapshot carries a `lineStatuses` map.
  result.asserted++;
  const latest = latestByAsOf(all);
  if (latest === null) {
    // Defensive — unreachable given assertion-1.
    result.violations = violations;
    result.ok = false;
    return result;
  }

  const lineStatuses = latest.payload.lineStatuses;
  if (lineStatuses === undefined || lineStatuses === null) {
    violations.push({
      subject: `RiskAppetiteSnapshot:${latest.event_id}`,
      message: `Latest RiskAppetiteSnapshot at ${latest.as_of} lacks a \`lineStatuses\` payload map. The Atlas model-tier-discipline wiring requires Helena's handler to record per-line status. Re-run \`runtime/agents/helena-risk-appetite-watch.ts\` to emit a snapshot with the new shape.`,
      severity: "fail",
    });
    result.violations = violations;
    result.ok = false;
    return result;
  }
  if (typeof lineStatuses !== "object") {
    violations.push({
      subject: `RiskAppetiteSnapshot:${latest.event_id}`,
      message: `\`lineStatuses\` payload field is not an object (typeof = ${typeof lineStatuses}). Expected a Record<appetiteLineId, status>.`,
      severity: "fail",
    });
    result.violations = violations;
    result.ok = false;
    return result;
  }

  // Assertion 3: the model-tier-discipline appetite line is present and
  // carries a measured status (green / amber / red / n/a-build-phase).
  // The `unmeasured` value is the failure mode the gate catches.
  result.asserted++;
  const map = lineStatuses as Record<string, unknown>;
  const status = map[MODEL_TIER_LINE_ID];

  if (status === undefined) {
    violations.push({
      subject: `RiskAppetiteSnapshot:${latest.event_id}:${MODEL_TIER_LINE_ID}`,
      message: `Appetite line \`${MODEL_TIER_LINE_ID}\` is missing from the latest snapshot's \`lineStatuses\` map. Helena's handler must include every APPETITE_LINES entry. This line is required by RAS §B7 and brief:atlas:build-model-tier-discipline-measurement-substrat:2026-06-01.`,
      severity: "fail",
    });
    result.violations = violations;
    result.ok = false;
    return result;
  }

  if (typeof status !== "string") {
    violations.push({
      subject: `RiskAppetiteSnapshot:${latest.event_id}:${MODEL_TIER_LINE_ID}`,
      message: `Status for \`${MODEL_TIER_LINE_ID}\` is not a string (typeof = ${typeof status}). Expected one of: green, amber, red, unmeasured, n/a-build-phase.`,
      severity: "fail",
    });
    result.violations = violations;
    result.ok = false;
    return result;
  }

  if (!MEASURED_STATUSES.has(status)) {
    violations.push({
      subject: `RiskAppetiteSnapshot:${latest.event_id}:${MODEL_TIER_LINE_ID}`,
      message: `Appetite line \`${MODEL_TIER_LINE_ID}\` has status="${status}" — the Atlas model-tier-discipline wiring requires a measured status (green/amber/red/n/a-build-phase), not unmeasured. RAS §B7: model-risk tier discipline; production-use gated on validation status. Source projection: platform/projections/model-tier-discipline.ts.`,
      severity: "fail",
    });
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
        ? "RAS §B7 model-tier discipline coverage passed (appetite:model:tier-discipline line is measured in latest snapshot)."
        : "RAS §B7 model-tier discipline coverage FAILED — see violations.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
