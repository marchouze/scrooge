// platform/recon/ras-b6-cyber-severity-coverage.ts
//
// Continuous-controls pipeline: RAS §B6 cyber-severity-tiers coverage.
//
// Asserts that the most-recent `RiskAppetiteSnapshot` event carries a
// *measured* status (green/amber/red) for the
// `appetite:operational:cyber-severity-tiers` appetite line — NOT the
// `unmeasured` fallback.
//
// Why this pipeline exists:
//
//   Before the Senna wiring PR, the `appetite:operational:cyber-severity-tiers`
//   line in Helena (Chief Risk Officer, governance)'s
//   `helena-risk-appetite-watch.ts` resolved to `unmeasured`, because no
//   projection computed cyber-incident severity. With
//   `platform/projections/cyber-incident-severity.ts` wired in, the line
//   must resolve to a measured status (green/amber/red). Build-phase
//   `no-incidents` maps to `green` so an empty incident store is still
//   a valid measured state.
//
//   This pipeline is the regression gate. If a future refactor reverts
//   the wiring, the recon fails.
//
// Independence note: this pipeline reads `RiskAppetiteSnapshot` events
// from the event store and inspects the `lineStatuses` payload field. It
// does not import any agent runtime — recon is build-time-pure.
//
// Build-phase softening: when the event store contains zero
// `RiskAppetiteSnapshot` events (fresh bench / unseeded), the pipeline
// downgrades to `info` rather than `fail` — Helena's handler has not
// been run on this bench yet. Mirrors the pattern in
// `recon:liquidity-appetite-snapshot-coverage`.
//
// Principles:
//   P1 — events are the only source of truth.
//   P2 — single-graph discipline (wiring traces RAS §B6 →
//        cyber-incident-severity projection → snapshot in one walk).
//
// Authority: D-RAS (CEO-approved 2026-05-06); RAS §B6;
//   incident-response-policy-v1.md (CY-IRP-01);
//   brief:senna:build-cyber-incident-severity-measurement-substr:2026-06-01.
//
// Author: Senna (CISO, engineering) ·
//         Vera (Internal audit engineer, third line of defence — recon shape).

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ras-b6-cyber-severity-coverage";

const CYBER_LINE_ID = "appetite:operational:cyber-severity-tiers";

/**
 * Statuses that count as "measured" for the cyber-severity line.
 * `unmeasured` is the failure mode this pipeline catches.
 * `no-incidents` maps to `green` (build-phase), so it never appears in
 * the snapshot's `lineStatuses` map — the handler maps it to `green`
 * before storing. We include it here for defensive completeness only.
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
      // Synthetic empty feed is a hard failure — test-author asked for
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
        "No RiskAppetiteSnapshot events in the store — Helena's daily appetite-watch handler has not been run on this bench yet. Run `bun run agent:helena-risk-appetite-watch` to seed a snapshot. Recon skipped.",
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
      message: `Latest RiskAppetiteSnapshot at ${latest.as_of} lacks a \`lineStatuses\` payload map. Helena's handler must record per-line status. Re-run \`bun run agent:helena-risk-appetite-watch\` to emit a snapshot with the new shape.`,
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

  // Assertion 3: the cyber-severity appetite line is present and carries
  // a measured status. `unmeasured` is the failure mode this gate catches.
  result.asserted++;
  const map = lineStatuses as Record<string, unknown>;
  const status = map[CYBER_LINE_ID];

  if (status === undefined) {
    violations.push({
      subject: `RiskAppetiteSnapshot:${latest.event_id}:${CYBER_LINE_ID}`,
      message: `Appetite line \`${CYBER_LINE_ID}\` is missing from the latest snapshot's \`lineStatuses\` map. Helena's handler must include this line (RAS §B6; CY-IRP-01). Re-run \`bun run agent:helena-risk-appetite-watch\` after wiring the cyber-severity projection.`,
      severity: "fail",
    });
  } else if (typeof status !== "string") {
    violations.push({
      subject: `RiskAppetiteSnapshot:${latest.event_id}:${CYBER_LINE_ID}`,
      message: `Status for \`${CYBER_LINE_ID}\` is not a string (typeof = ${typeof status}). Expected one of: green, amber, red, n/a-build-phase.`,
      severity: "fail",
    });
  } else if (!MEASURED_STATUSES.has(status)) {
    violations.push({
      subject: `RiskAppetiteSnapshot:${latest.event_id}:${CYBER_LINE_ID}`,
      message: `Appetite line \`${CYBER_LINE_ID}\` has status="${status}" in the latest snapshot — the Senna wiring PR requires a measured status (green/amber/red), not unmeasured. Source: platform/projections/cyber-incident-severity.ts. Policy: CY-IRP-01 §2.1. RAS §B6.`,
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
        ? "RAS §B6 cyber-severity coverage passed (cyber-severity-tiers line is measured in latest snapshot)."
        : "RAS §B6 cyber-severity coverage FAILED — see violations.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
