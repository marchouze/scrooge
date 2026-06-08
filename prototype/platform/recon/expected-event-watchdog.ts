// platform/recon/expected-event-watchdog.ts
//
// Vera recon: expected-event-watchdog — the documented Phase-B follow-on of the
// Trusted-Figures Program (objective 4). The watchdog itself
// (model-registry/expected-event-watchdog.ts) runs at derive time against the
// LIVE event store and cannot be asserted in CI (a fresh CI store legitimately
// has no events). This gate instead asserts the watchdog's *manifest* is
// well-formed and cannot drift from the binding registry:
//
//   1. Expectation ids are unique.
//   2. Every expectation carries complete metadata (eventType / label /
//      owningRole / rationale / citation).
//   3. Each id forms a valid SubstrateAlert alertId slug — so emission cannot
//      throw on the alertId regex when a gap is raised.
//   4. Calc-binding parity: every CALC_BINDINGS modelId has exactly one
//      calc-bound expectation. A newly-bound figure with no watchdog
//      expectation fails here, so a figure cannot silently escape the watchdog.
//
// Mode: blocking (non-zero exit on any violation). Wired into
//       `bun run ci:recon:domain` via `bun run recon:expected-event-watchdog`.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (Core banking platform architect, engineering).

import { makeSubstrateAlert } from "../event-store/event-types/platform";
import { CALC_BINDINGS } from "../model-registry/calculation-binding";
import {
  type ExpectedEvent,
  expectedEvents,
  gapAlertId,
  staleGapAlertId,
} from "../model-registry/expected-event-watchdog";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "expected-event-watchdog";

/** SubstrateAlert alertId shape (mirror of substrateAlertPayloadSchema regex). */
const ALERT_ID_RE = /^alert:[a-z]+:[a-z0-9-]+$/;

export function run(): ReconResult {
  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  const expectations = expectedEvents();

  result.asserted = expectations.length;

  // 1. Unique ids.
  const seen = new Set<string>();
  for (const e of expectations) {
    if (seen.has(e.id)) {
      violations.push({
        subject: e.id,
        message: `duplicate expected-event id "${e.id}"`,
        severity: "fail",
      });
    }
    seen.add(e.id);
  }

  // 2 / 3. Metadata completeness + alertId slug validity.
  for (const e of expectations) {
    for (const [field, val] of [
      ["eventType", e.eventType],
      ["label", e.label],
      ["owningRole", e.owningRole],
      ["rationale", e.rationale],
      ["citation", e.citation],
    ] as const) {
      if (!val || !val.trim()) {
        violations.push({
          subject: e.id,
          message: `expected-event "${e.id}" is missing required metadata field "${field}"`,
          severity: "fail",
        });
      }
    }
    const alertId = gapAlertId(e.id);
    if (!ALERT_ID_RE.test(alertId)) {
      violations.push({
        subject: e.id,
        message: `expected-event "${e.id}" yields an invalid alertId "${alertId}" — SubstrateAlert emission would throw (id must be [a-z0-9-])`,
        severity: "fail",
      });
    }

    // 3b. Freshness-window expectations: maxAgeBusinessDays must be a positive
    // integer, and the date-stamped stale alertId must also be a valid slug
    // (the stale path emits via staleGapAlertId, not gapAlertId).
    if (e.maxAgeBusinessDays !== undefined) {
      if (!Number.isInteger(e.maxAgeBusinessDays) || e.maxAgeBusinessDays < 1) {
        violations.push({
          subject: e.id,
          message: `expected-event "${e.id}" has maxAgeBusinessDays=${e.maxAgeBusinessDays} — must be a positive integer (a freshness window of ≥1 business day)`,
          severity: "fail",
        });
      }
      const staleAlertId = staleGapAlertId(e.id, "2026-01-01T00:00:00.000Z");
      if (!ALERT_ID_RE.test(staleAlertId)) {
        violations.push({
          subject: e.id,
          message: `expected-event "${e.id}" yields an invalid stale alertId "${staleAlertId}" — SubstrateAlert emission would throw (id must be [a-z0-9-])`,
          severity: "fail",
        });
      }
    }
  }

  // 4. Calc-binding parity — every bound figure has exactly one calc expectation.
  const calcByModelId = new Map<string, ExpectedEvent[]>();
  for (const e of expectations) {
    if (e.eventType !== "CalculationPerformed") continue;
    // Identify which binding this expectation covers by matching its predicate.
    for (const b of Object.values(CALC_BINDINGS)) {
      if (e.matches?.({ modelId: b.modelId })) {
        const arr = calcByModelId.get(b.modelId) ?? [];
        arr.push(e);
        calcByModelId.set(b.modelId, arr);
      }
    }
  }
  for (const b of Object.values(CALC_BINDINGS)) {
    const covering = calcByModelId.get(b.modelId) ?? [];
    if (covering.length === 0) {
      violations.push({
        subject: b.modelId,
        message: `bound figure "${b.figure}" (${b.modelId}) has no expected-event watchdog entry — a missing CalculationPerformed would not be detected`,
        severity: "fail",
      });
    } else if (covering.length > 1) {
      violations.push({
        subject: b.modelId,
        message: `bound figure "${b.figure}" (${b.modelId}) is covered by ${covering.length} expectations — expected exactly one`,
        severity: "fail",
      });
    }
  }

  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.ok = failCount === 0;
  result.violations = violations;
  return result;
}

if (import.meta.main) {
  // Touch the SubstrateAlert builder reference so an import-time breakage in the
  // emission path is caught here too (the gate guards the whole emit contract).
  void makeSubstrateAlert;

  const result = run();
  const fails = result.violations.filter((v) => v.severity === "fail");

  for (const v of fails) {
    console.error(`  FAIL  [${v.subject}] ${v.message}`);
  }

  if (fails.length === 0) {
    console.log(
      `recon:${PIPELINE} OK — ${result.asserted} expected-event(s), manifest well-formed and in parity with CALC_BINDINGS`,
    );
  } else {
    console.error(
      `\nrecon:${PIPELINE} — ${result.asserted} expected-event(s) checked, ${fails.length} violation(s)`,
    );
    console.error(`recon:${PIPELINE} FAILED — ${fails.length} violation(s)`);
    process.exit(1);
  }
}
