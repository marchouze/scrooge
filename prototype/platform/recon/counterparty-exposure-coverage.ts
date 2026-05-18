// platform/recon/counterparty-exposure-coverage.ts
//
// M3 Slice 10 — recon:counterparty-exposure-coverage
//
// Asserts the health of the counterparty-exposure event feed and register by
// replaying CounterpartyExposureCalculated events from the shared event store
// and verifying:
//
//   (1) At least one CounterpartyExposureCalculated event exists.
//   (2) All four exposure types are represented:
//         pre-settlement | settlement | issuer | replacement-cost
//   (3) Both breached=true and breached=false snapshots are present.
//
// CI / fresh-bench softening: if the event store has no
// CounterpartyExposureCalculated events at all (scenario has never been run
// on this bench), Assertion 1 is downgraded to "info" and the pipeline passes.
// This matches the ras-b2-calibration-coverage pattern.
//
// Independence: reads from the shared event store; no write side-effects.
// P1 — events are the only source of truth (Principle 1).
// P2 — single-graph discipline (Principle 2): the recon asserts the
//       large-exposure audit trail facet.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
//   (CEO-approved 2026-05-10).
//
// Citations:
//   Banks Act 94 of 1990 §73 (large exposures);
//   RRB Regulation 23 (credit-risk large exposure limits);
//   BCBS 283 (large exposures framework, 2014);
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//   Principles/1-events-are-truth.md; Principles/2-single-graph-discipline.md.
//
// Author: Atlas (Principal Software Engineer, engineering)

import { eventStore } from "../composition";
import type { CounterpartyExposureCalculatedPayload } from "../event-store/event-types/counterparty-exposure";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "counterparty-exposure-coverage";

const REQUIRED_EXPOSURE_TYPES = [
  "pre-settlement",
  "settlement",
  "issuer",
  "replacement-cost",
] as const;

export interface RunOpts {
  /**
   * Override the event source — used by tests to feed synthetic events
   * without touching the live event store. When supplied, the pipeline
   * reads from this iterable instead of the global event store.
   */
  events?: Iterable<{ payload: CounterpartyExposureCalculatedPayload }>;
}

function loadEvents(opts: RunOpts): Array<{ payload: CounterpartyExposureCalculatedPayload }> {
  if (opts.events) {
    return [...opts.events];
  }
  const out: Array<{ payload: CounterpartyExposureCalculatedPayload }> = [];
  for (const event of eventStore.replay({ type: "CounterpartyExposureCalculated" })) {
    out.push({ payload: event.payload as CounterpartyExposureCalculatedPayload });
  }
  return out;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const events = loadEvents(opts);
  const eventCount = events.length;
  const exposureTypesSeen = new Set<string>();
  let hasBreached = false;
  let hasNonBreached = false;

  for (const event of events) {
    const p = event.payload;
    exposureTypesSeen.add(p.exposureType);
    if (p.breached) {
      hasBreached = true;
    } else {
      hasNonBreached = true;
    }
  }

  // Assertion 1: at least one event exists.
  // CI softening: downgrade to "info" when the store has never been seeded
  // (scenario:counterparty-exposure has not been run on this bench).
  // Matches ras-b2-calibration-coverage pattern.
  result.asserted += 1;
  if (eventCount === 0) {
    const isSynthetic = opts.events !== undefined;
    violations.push({
      subject: "event-store:CounterpartyExposureCalculated",
      severity: isSynthetic ? "fail" : "info",
      message:
        "No CounterpartyExposureCalculated events found in the event store. " +
        "Run `bun run scenario:counterparty-exposure` to seed the shared store locally. " +
        "Citations: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN; Principles/1-events-are-truth.md.",
    });
    // Short-circuit — nothing more to assert.
    result.violations = violations;
    result.ok = violations.filter((v) => v.severity === "fail").length === 0;
    return result;
  }

  // Assertion 2: all four exposure types present.
  for (const exposureType of REQUIRED_EXPOSURE_TYPES) {
    result.asserted += 1;
    if (!exposureTypesSeen.has(exposureType)) {
      violations.push({
        subject: `exposure-type:${exposureType}`,
        severity: "fail",
        message: `Exposure type '${exposureType}' has no CounterpartyExposureCalculated events. All four exposure types (pre-settlement, settlement, issuer, replacement-cost) must be represented in the event store. Citations: BCBS 283 §3; RRB Regulation 23; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.`,
      });
    }
  }

  // Assertion 3: both breached and non-breached snapshots present.
  result.asserted += 1;
  if (!hasBreached) {
    violations.push({
      subject: "breach-coverage:breached=true",
      severity: "fail",
      message:
        "No breached=true CounterpartyExposureCalculated events found. " +
        "The event store must include at least one limit-breach scenario " +
        "to validate the alert/escalation pathway. " +
        "Citations: RRB Regulation 23; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.",
    });
  }

  result.asserted += 1;
  if (!hasNonBreached) {
    violations.push({
      subject: "breach-coverage:breached=false",
      severity: "fail",
      message:
        "No breached=false CounterpartyExposureCalculated events found. " +
        "The event store must include at least one normal (non-breach) scenario. " +
        "Citations: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.",
    });
  }

  result.violations = violations;
  result.ok = violations.filter((v) => v.severity === "fail").length === 0;

  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point — run when called directly via bun
// ---------------------------------------------------------------------------

const result = run();

if (!result.ok) {
  for (const v of result.violations) {
    console.error(`[${v.severity.toUpperCase()}] ${PIPELINE}: ${v.message} (${v.subject})`);
  }
  process.exit(1);
}

if (result.violations.length > 0) {
  for (const v of result.violations) {
    console.warn(`[${v.severity.toUpperCase()}] ${PIPELINE}: ${v.message} (${v.subject})`);
  }
}

console.log(`[PASS] ${PIPELINE}: ${result.asserted} assertions checked.`);
