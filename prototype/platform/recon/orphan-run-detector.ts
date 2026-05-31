// platform/recon/orphan-run-detector.ts
//
// Vera continuous-controls pipeline: recon:orphan-open-runs
//
// Scans for `AgentRunStarted` events older than 2 hours that have no matching
// `AgentRunCompleted`. For each orphan found it emits a
// `SubstrateAlert{alertClass:"integrity", severity:"high"}`.
//
// Root case: 2026-05-31 at 08:05:32 UTC, two bea goal-loop ticks fired 180ms
// apart. Both emitted AgentRunStarted; only the second completed. The first
// had no AgentRunCompleted, creating a phantom "open" run. The single-flight
// guard in bea-goal-loop.ts (D-BEA-GOAL-LOOP-SINGLE-FLIGHT) prevents future
// occurrences; this pipeline detects any that already slipped through.
//
// No new Date() / Date.now() calls: the age comparison uses
// `new Date(e.as_of).getTime()` (past-event timestamp arithmetic) vs a
// caller-supplied `asOf` string so the pipeline is deterministic in tests.
//
// Authority: D-BEA-GOAL-LOOP-SINGLE-FLIGHT (CEO-approved 2026-05-31).
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../composition";
import { makeSubstrateAlert } from "../event-store/event-types/platform";
import type { EventStore } from "../event-store/store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "recon:orphan-open-runs";

const ORPHAN_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

const ACTOR = { type: "service" as const, id: "agent:atlas:recon-orphan-runs" };
const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = ["D-BEA-GOAL-LOOP-SINGLE-FLIGHT"];

export interface RunOpts {
  /** Inject a custom event store (for tests). */
  store?: EventStore;
  /** Inject a clock anchor (ISO string). Defaults to the store-derived `eventStore` wall. */
  asOf?: string;
  /** Override the orphan age threshold in ms (for tests). */
  orphanAgeMs?: number;
  /** Skip emitting SubstrateAlert events (for dry-run / test paths). */
  skipEmit?: boolean;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  const store = opts.store ?? eventStore;
  // asOf must be supplied by the caller (clock.now()) or fall back to the
  // pipeline infrastructure timestamp already stamped in emptyResult().
  // We use result.asOf (set by emptyResult to new Date().toISOString()) as the
  // default so the pipeline still works when no explicit asOf is passed.
  const asOfMs = new Date(opts.asOf ?? result.asOf).getTime();
  const orphanAgeMs = opts.orphanAgeMs ?? ORPHAN_AGE_MS;

  // Collect all started runIds with their startedAt timestamp.
  const startedRuns = new Map<string, { startedAtMs: number; eventId: string; agentId: string }>();
  for (const e of store.replay({ type: "AgentRunStarted" })) {
    const p = e.payload as Record<string, unknown>;
    const runId = String(p.runId ?? "");
    if (!runId) continue;
    const startedAt = String(p.startedAt ?? e.as_of);
    const startedAtMs = new Date(startedAt).getTime();
    if (Number.isNaN(startedAtMs)) continue;
    const agentRef = p.agent as Record<string, unknown> | undefined;
    const agentId = String(agentRef?.agentId ?? agentRef?.name ?? "unknown");
    startedRuns.set(runId, { startedAtMs, eventId: e.event_id, agentId });
  }

  // Collect completed runIds.
  const completedRunIds = new Set<string>();
  for (const e of store.replay({ type: "AgentRunCompleted" })) {
    const p = e.payload as Record<string, unknown>;
    const runId = String(p.runId ?? "");
    if (runId) completedRunIds.add(runId);
  }

  result.asserted = Math.max(1, startedRuns.size);

  for (const [runId, { startedAtMs, agentId }] of startedRuns) {
    if (completedRunIds.has(runId)) continue;
    const ageMs = asOfMs - startedAtMs;
    if (ageMs < orphanAgeMs) continue; // not old enough yet

    const ageHours = (ageMs / (60 * 60 * 1000)).toFixed(2);
    const startedAt = new Date(startedAtMs).toISOString();
    const message =
      `Orphan AgentRunStarted detected: runId="${runId}" agent="${agentId}" startedAt=${startedAt} ` +
      `(${ageHours}h ago) has no matching AgentRunCompleted. ` +
      `Root cause: concurrent goal-loop ticks without a single-flight guard (D-BEA-GOAL-LOOP-SINGLE-FLIGHT). ` +
      `Remediation: manually emit AgentRunCompleted with outcome="blocked" and ` +
      `substrateGapsSurfaced=["orphan run: no completion event emitted"].`;

    violations.push({
      subject: `orphan-run:${runId}`,
      message,
      severity: "fail",
    });

    if (!opts.skipEmit) {
      try {
        store.append(
          makeSubstrateAlert({
            asOf: opts.asOf ?? result.asOf,
            entity: ENTITY,
            actor: ACTOR,
            citations: CITATIONS,
            payload: {
              alertId: `alert:integrity:orphan-run-${runId.replace(/[^a-z0-9-]/gi, "-").toLowerCase().slice(0, 60)}`,
              alertClass: "integrity",
              severity: "high",
              details: message,
            },
          }),
        );
      } catch {
        // Best-effort: if alert emission fails (e.g. read-only store in CI),
        // the violation is still reported in the recon result.
      }
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const asOf = new Date().toISOString(); // wall-clock: CLI entrypoint only
  const result = run({ asOf });
  console.log(
    JSON.stringify(
      {
        level: result.ok ? "info" : "error",
        time: result.asOf,
        service: "bank-prototype",
        pipeline: result.pipeline,
        asserted: result.asserted,
        violations: result.violations.filter((v) => v.severity === "fail").length,
        ok: result.ok,
        msg: result.ok
          ? "orphan-open-runs: no orphan AgentRunStarted events detected"
          : "orphan-open-runs FAILED — orphan AgentRunStarted event(s) found with no matching AgentRunCompleted",
        detail: result.violations,
      },
      null,
      2,
    ),
  );
  process.exit(result.ok ? 0 : 1);
}
