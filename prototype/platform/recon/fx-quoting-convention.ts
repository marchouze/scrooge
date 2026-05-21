// platform/recon/fx-quoting-convention.ts
//
// Vera advisory recon: walks every `FxTradeExecuted` event in the
// production event store, parses each payload through
// `fxTradeExecutedPayloadSchema`, and emits a finding per Zod issue.
//
// The schema's `.superRefine` already enforces the D-FX-QUOTING-CONVENTION
// invariant at write-time (every new event is asserted before persistence).
// This recon catches LEGACY persisted events that pre-date the refinement —
// most notably the sim-generator events whose inverted-rate convention will
// be repaired by Slice 3b (Devon).
//
// Severity: P2 (advisory). `ok = true` even when violations > 0, with
// `mode: "advisory"`. CI does not block on this gate today; Vera will
// upgrade advisory → strict once Slice 3b lands and the legacy backlog is
// repaired (mirrors the persona-attribution-coherence advisory→strict
// transition pattern).
//
// Empty-state correctness: zero events → asserted=0, ok=true.
//
// Sources walked:
//   1. Every `FxTradeExecuted` payload in the live event store.
//
// Authority:
//   - D-FX-QUOTING-CONVENTION (CEO-approved 2026-05-21)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   - PR #654 (pair-direction precedent — ACI Model Code §2)
//
// Author: Kai (trading systems engineer)

import { eventStore } from "../composition";
import { fxTradeExecutedPayloadSchema } from "../markets/cdm/fx";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-quoting-convention";

// ---------------------------------------------------------------------------
// Source loader (injectable for tests).
// ---------------------------------------------------------------------------

interface MinimalFxEvent {
  readonly event_id: string;
  readonly as_of: string;
  readonly payload: unknown;
}

export interface RunOpts {
  /** Override the event source — used by tests to feed synthetic events. */
  fxTradeEvents?: Iterable<MinimalFxEvent>;
}

function loadFxTradeEvents(opts: RunOpts): MinimalFxEvent[] {
  if (opts.fxTradeEvents) return [...opts.fxTradeEvents];
  const out: MinimalFxEvent[] = [];
  for (const e of eventStore.replay({ type: "FxTradeExecuted" })) {
    out.push({ event_id: e.event_id, as_of: e.as_of, payload: e.payload });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-event assertion.
// ---------------------------------------------------------------------------

function assertEvent(ev: MinimalFxEvent, violations: ReconViolation[]): void {
  const parsed = fxTradeExecutedPayloadSchema.safeParse(ev.payload);
  if (parsed.success) return;
  for (const issue of parsed.error.issues) {
    const path = issue.path.map(String).join(".") || "<root>";
    violations.push({
      subject: `FxTradeExecuted:${ev.event_id}:${path}`,
      severity: "warn",
      message: `${issue.message} (D-FX-QUOTING-CONVENTION; legacy event awaiting Slice 3b sim-generator repair)`,
    });
  }
}

// ---------------------------------------------------------------------------
// Pipeline run.
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const events = loadFxTradeEvents(opts);
  for (const ev of events) {
    result.asserted++;
    assertEvent(ev, violations);
  }

  result.violations = violations;
  // Advisory P2 — warn-only violations do not flip ok=false.
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point.
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  const warnCount = r.violations.filter((v) => v.severity === "warn").length;
  console.log(
    JSON.stringify({
      level: r.ok ? (warnCount > 0 ? "warn" : "info") : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      mode: "advisory",
      msg: r.ok
        ? warnCount > 0
          ? `fx-quoting-convention passed with ${warnCount} advisory warning(s) — legacy events fail the D-FX-QUOTING-CONVENTION refinement (expected pending Slice 3b).`
          : "fx-quoting-convention passed — every FxTradeExecuted event satisfies the quoting-convention invariant."
        : "fx-quoting-convention FAILED — see violations.",
      detail: r.violations,
    }),
  );
  // P2 advisory — exit 0 even on warn-only violations.
  process.exit(r.ok ? 0 : 1);
}
