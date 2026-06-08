// platform/recon/liquidity-appetite-snapshot-coverage.ts
//
// Continuous-controls pipeline: liquidity-appetite snapshot coverage.
//
// Asserts that, after the Ravi wiring PR lands, every `RiskAppetiteSnapshot`
// event emitted by Helena's daily run carries a measured status for the
// `appetite:liquidity:lcr` and `appetite:liquidity:nsfr` appetite lines
// (i.e. NOT `unmeasured`). Build-phase status of `green` with substrate-gap
// note is acceptable — the requirement is that the status is *computed*,
// not absent.
//
// Why this pipeline exists:
//
//   Before the Ravi (Treasury and ALM engineer, engineering) wiring, the
//   LCR/NSFR appetite lines in Helena (Chief Risk Officer, governance)'s
//   `helena-risk-appetite-watch.ts` resolved to `unmeasured` — the daily
//   `RiskAppetiteSnapshot` event reported a measurement gap rather than
//   a position. With Ravi's ALM-positions projection
//   (`platform/projections/alm-positions.ts`) wired in, the lines must
//   resolve to a measured RAS §B3 status (green/amber/red) — even in
//   build phase where empty positions construct a green-with-gap result.
//
//   This pipeline is the gate that prevents regression. If a future
//   refactor reverts the wiring (e.g. handler swaps back to hardcoded
//   `unmeasured` for these lines), the recon fails.
//
// Independence note: this pipeline reads the event store via
// `eventStore.replay({type:"RiskAppetiteSnapshot"})` and inspects the
// `lineStatuses` payload field — added by Helena's handler in the same
// PR that introduces this gate. It does not import any agent runtime —
// recon is build-time-pure.
//
// Build-phase softening: when the event store contains zero
// `RiskAppetiteSnapshot` events (fresh bench / unseeded), the pipeline
// downgrades to `info` rather than `fail` — Helena's handler has not
// been run on this bench yet. Mirrors the pattern in
// `recon:ras-b2-calibration-coverage`.
//
// Principles:
//   P1 — events are the only source of truth (snapshot is the canonical
//        signal, not a flag in a register file).
//   P2 — single-graph discipline (the wiring traces RAS §B3 → ALM
//        projection → LCR/NSFR engine → snapshot in one walk).
//
// Authority: D-RAS (CEO-approved 2026-05-06); RAS §B3; RRTB Reg 26 (LCR);
//   RRTB Reg 26A (NSFR); brief
//   `brief:ravi:alm-position-substrate-and-helena-liquidity-line:2026-05-21`.
//
// Author: Ravi (Treasury and ALM engineer, engineering) ·
//         Vera (Internal audit engineer, third line of defence — recon shape).

import { eventStore } from "../composition";
import { requireRasAppetiteLine } from "../risk/ras-appetite-register";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "liquidity-appetite-snapshot-coverage";

// Line identities read from the canonical register (single source of truth).
const LCR_LINE_ID = requireRasAppetiteLine("appetite:liquidity:lcr").id;
const NSFR_LINE_ID = requireRasAppetiteLine("appetite:liquidity:nsfr").id;

const REQUIRED_LINE_IDS: readonly string[] = [LCR_LINE_ID, NSFR_LINE_ID];

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
  // `info` (mirrors RAS B2 calibration coverage pattern).
  result.asserted++;
  if (all.length === 0) {
    if (opts.events !== undefined) {
      // Synthetic empty is a hard failure — test-author asked.
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
        "No RiskAppetiteSnapshot events in the store — Helena's daily appetite-watch handler has not been run on this bench. Run the handler (or `bun run prototype/scripts/...`) to seed the snapshot locally. Recon skipped.",
      severity: "info",
    });
    result.violations = violations;
    result.ok = true;
    return result;
  }

  // Assertion 2: the most-recent snapshot carries a `lineStatuses` map.
  // (Snapshots emitted before the Ravi wiring lack the field — those
  // pre-date the gate and are tolerated; we only check the latest.)
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
      message: `Latest RiskAppetiteSnapshot at ${latest.as_of} lacks a \`lineStatuses\` payload map. The Ravi wiring PR (brief:ravi:alm-position-substrate-and-helena-liquidity-line:2026-05-21) requires Helena's handler to record per-line status. Re-run \`runtime/agents/helena-risk-appetite-watch.ts\` to emit a snapshot with the new shape.`,
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

  // Assertion 3: each required appetite line (LCR + NSFR) is present and
  // carries a measured status (green / amber / red / n/a-build-phase).
  // The `unmeasured` value is the failure mode the gate catches.
  const map = lineStatuses as Record<string, unknown>;
  for (const lineId of REQUIRED_LINE_IDS) {
    result.asserted++;
    const status = map[lineId];
    if (status === undefined) {
      violations.push({
        subject: `RiskAppetiteSnapshot:${latest.event_id}:${lineId}`,
        message: `Appetite line \`${lineId}\` is missing from the latest snapshot's \`lineStatuses\` map. Helena's handler must include every APPETITE_LINES entry; this line is required by RAS §B3 and brief:ravi:alm-position-substrate-and-helena-liquidity-line:2026-05-21.`,
        severity: "fail",
      });
      continue;
    }
    if (typeof status !== "string") {
      violations.push({
        subject: `RiskAppetiteSnapshot:${latest.event_id}:${lineId}`,
        message: `Status for \`${lineId}\` is not a string (typeof = ${typeof status}). Expected one of: green, amber, red, unmeasured, n/a-build-phase.`,
        severity: "fail",
      });
      continue;
    }
    if (!MEASURED_STATUSES.has(status)) {
      violations.push({
        subject: `RiskAppetiteSnapshot:${latest.event_id}:${lineId}`,
        message: `Appetite line \`${lineId}\` has status="${status}" — the Ravi wiring PR requires a measured status (green/amber/red/n/a-build-phase), not unmeasured. RAS §B3 thresholds: LCR green ≥120% / amber 110-120% / red <110% / critical <105%; NSFR green ≥115% / amber 108-115% / red <108% / critical <103%. Source projection: platform/projections/alm-positions.ts.`,
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
        ? "Liquidity appetite snapshot coverage passed (LCR + NSFR lines measured in latest snapshot)."
        : "Liquidity appetite snapshot coverage FAILED — see violations.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
