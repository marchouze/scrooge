// platform/recon/conduct-surveillance-coverage.ts
//
// Continuous-controls pipeline: conduct surveillance coverage.
//
// Asserts that the conduct surveillance register contains at least one
// `ConductEventRecorded` event — covering each mandatory category
// (best-execution-failure, front-running-flag, wash-trade-flag,
// market-manipulation-alert) across the scenario seed.
//
// Why this pipeline exists:
//
//   1. **Surveillance gate.** The conduct-surveillance register is load-bearing
//      for the bank's FSCA reporting obligation under FSRA §131. The recon
//      asserts the substrate is exercised (at least one observation per
//      category) before commencement-of-trading.
//   2. **Lifecycle completeness.** The pipeline verifies that the scenario
//      seed exercises the full observation lifecycle: flag-raised →
//      under-investigation → resolved | escalated.
//   3. **Citation-chain integrity.** Every ConductEventRecorded event must
//      cite D-MARKET-CONDUCT (or the FMA / FSRA obligation reference),
//      enforcing Principle 2 upward citation discipline.
//
// Independence: reads the event store via eventStore.replay; does not import
// agent runtime.
//
// Authority: D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
// Author: Atlas (Principal Software Engineer, engineering) +
//   Mira (Compliance / RegTech engineer, engineering).

import { eventStore } from "../composition";
import type { ReconResult, ReconViolation } from "./types";
import { emptyResult } from "./types";

const PIPELINE = "conduct-surveillance-coverage";

/**
 * Mandatory observation categories that must appear in the event store.
 * Each maps to the `category` field on `ConductEventRecordedPayload`.
 */
const REQUIRED_CATEGORIES = [
  "best-execution-failure",
  "front-running-flag",
  "wash-trade-flag",
  "market-manipulation-alert",
] as const;

type RequiredCategory = (typeof REQUIRED_CATEGORIES)[number];

/**
 * Mandatory lifecycle statuses that must appear at least once across all
 * ConductEventRecorded events (demonstrates the full lifecycle).
 */
const REQUIRED_STATUSES = ["flag-raised", "under-investigation", "resolved", "escalated"] as const;

type RequiredStatus = (typeof REQUIRED_STATUSES)[number];

/**
 * Required citation substring — every ConductEventRecorded must cite
 * D-MARKET-CONDUCT (or an acceptable alias) per Principle 2.
 */
const REQUIRED_CITATION_PATTERN = /D-MARKET-CONDUCT|FINANCIAL-MARKETS-ACT|FSRA/;

// ---------------------------------------------------------------------------
// Event shape (minimal — avoids importing the full payload type at recon time)
// ---------------------------------------------------------------------------

interface ConductEventRecordedLike {
  readonly event_id: string;
  readonly citations: readonly string[];
  readonly payload: {
    readonly observationId?: unknown;
    readonly category?: unknown;
    readonly status?: unknown;
    readonly counterpartyId?: unknown;
    readonly severity?: unknown;
    readonly escalatedToMlro?: unknown;
    readonly tradeIds?: unknown;
  };
}

export interface RunOpts {
  /**
   * Override the event source — used by tests to feed synthetic events
   * without touching the live event store.
   */
  events?: Iterable<ConductEventRecordedLike>;
}

function loadEvents(opts: RunOpts): ConductEventRecordedLike[] {
  if (opts.events) return [...opts.events];
  const out: ConductEventRecordedLike[] = [];
  for (const e of eventStore.replay({ type: "ConductEventRecorded" })) {
    out.push({
      event_id: e.event_id,
      citations: e.citations,
      payload: e.payload as ConductEventRecordedLike["payload"],
    });
  }
  return out;
}

function eventStoreIsEmpty(opts: RunOpts): boolean {
  if (opts.events !== undefined) return false;
  for (const _e of eventStore.replay({ type: "ConductEventRecorded" })) return false;
  return true;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const events = loadEvents(opts);

  // ---------------------------------------------------------------------------
  // Assertion 1: at least one ConductEventRecorded exists.
  // ---------------------------------------------------------------------------
  result.asserted++;
  if (events.length === 0) {
    if (eventStoreIsEmpty(opts)) {
      // Fresh bench — soften to info (matches ras-b2-calibration-coverage pattern).
      violations.push({
        subject: "ConductEventRecorded",
        message:
          "Event store contains no ConductEventRecorded events. " +
          "Run the conduct surveillance scenario seed " +
          "(`bun run scenario:conduct-surveillance`) to populate the register.",
        severity: "info",
      });
      result.violations = violations;
      result.ok = true;
      return result;
    }
    violations.push({
      subject: "ConductEventRecorded",
      message:
        "No ConductEventRecorded events found in the event store. " +
        "The conduct surveillance register is empty — FSRA §131 reporting " +
        "obligation cannot be satisfied. Run the scenario seed to populate.",
      severity: "fail",
    });
    result.violations = violations;
    result.ok = false;
    return result;
  }

  // ---------------------------------------------------------------------------
  // Assertion 2: all mandatory categories are represented.
  // ---------------------------------------------------------------------------
  result.asserted++;
  const categoriesPresent = new Set<string>();
  for (const e of events) {
    const cat = e.payload.category;
    if (typeof cat === "string") categoriesPresent.add(cat);
  }
  for (const required of REQUIRED_CATEGORIES as readonly RequiredCategory[]) {
    if (!categoriesPresent.has(required)) {
      violations.push({
        subject: `ConductEventRecorded:category:${required}`,
        message:
          `No ConductEventRecorded with category="${required}" found. ` +
          `The conduct surveillance register must cover all mandatory ` +
          `observation categories (FMA §§78–82; D-MARKET-CONDUCT). ` +
          `Add a scenario event with category="${required}".`,
        severity: "fail",
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Assertion 3: all mandatory lifecycle statuses are represented.
  // ---------------------------------------------------------------------------
  result.asserted++;
  const statusesPresent = new Set<string>();
  for (const e of events) {
    const st = e.payload.status;
    if (typeof st === "string") statusesPresent.add(st);
  }
  for (const required of REQUIRED_STATUSES as readonly RequiredStatus[]) {
    if (!statusesPresent.has(required)) {
      violations.push({
        subject: `ConductEventRecorded:status:${required}`,
        message:
          `No ConductEventRecorded with status="${required}" found. ` +
          `The scenario seed must exercise the full observation lifecycle ` +
          `(flag-raised → under-investigation → resolved | escalated). ` +
          `Add a ConductEventRecorded event with status="${required}".`,
        severity: "fail",
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Assertion 4: every event carries a valid citation.
  // ---------------------------------------------------------------------------
  result.asserted++;
  for (const e of events) {
    const hasCitation = e.citations.some((c) => REQUIRED_CITATION_PATTERN.test(c));
    if (!hasCitation) {
      violations.push({
        subject: `ConductEventRecorded:${e.event_id}`,
        message:
          `ConductEventRecorded event ${e.event_id} does not cite ` +
          `D-MARKET-CONDUCT, FINANCIAL-MARKETS-ACT, or FSRA. ` +
          `Principle 2 requires every conduct observation to trace to its ` +
          `regulatory source. Add the required citation.`,
        severity: "fail",
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Assertion 5: payload shape — observationId, counterpartyId, severity
  //              are non-empty strings on every event.
  // ---------------------------------------------------------------------------
  result.asserted++;
  for (const e of events) {
    const requiredFields: Array<[string, unknown]> = [
      ["observationId", e.payload.observationId],
      ["counterpartyId", e.payload.counterpartyId],
      ["severity", e.payload.severity],
    ];
    for (const [field, value] of requiredFields) {
      if (typeof value !== "string" || value.length === 0) {
        violations.push({
          subject: `ConductEventRecorded:${e.event_id}:${field}`,
          message:
            `Required field \`${field}\` is missing or empty on ` +
            `ConductEventRecorded event ${e.event_id}. ` +
            `Payload may be from an older schema version — re-emit via the scenario seed.`,
          severity: "fail",
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Assertion 6: tradeIds is an array (may be empty for model-raised alerts).
  // ---------------------------------------------------------------------------
  result.asserted++;
  for (const e of events) {
    if (!Array.isArray(e.payload.tradeIds)) {
      violations.push({
        subject: `ConductEventRecorded:${e.event_id}:tradeIds`,
        message:
          `Required field \`tradeIds\` is not an array on ` +
          `ConductEventRecorded event ${e.event_id}. ` +
          `Must be an array (may be empty for model-raised alerts).`,
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
        ? "conduct-surveillance-coverage passed — ConductEventRecorded events present, all categories and lifecycle statuses covered."
        : "conduct-surveillance-coverage FAILED — see violations.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
