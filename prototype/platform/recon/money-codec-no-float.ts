// platform/recon/money-codec-no-float.ts
//
// Continuous-controls pipeline: money-codec-no-float (S1.5 gate).
//
// ## What it asserts
//
// Every MoneyWire value that has been serialised into an event payload stored
// in the event store must have its `amount` field as a STRING, never as a JSON
// NUMBER (IEEE-754 float). A numeric `amount` is a Principle-5 violation —
// it reintroduces the float-drift hazard that the decimal-money stack
// eliminates, and a Principle-1 violation — the event store would contain a
// payload that cannot be decoded by `decodeMoney()` without loss.
//
// ## Detection strategy
//
// For every event in the event store (or the sample passed to `runRecon`),
// the pipeline calls `findFloatMoneyViolations(event.payload)` from
// `platform/core/money-codec.ts`. That function recursively walks the payload
// and returns the dotted path of any object whose shape is
// `{ __money: "v1", amount: <number>, ... }`. A violation at any path causes
// a "fail"-severity finding.
//
// ## CI-store posture
//
// A fresh CI event store has no events → 0 asserted, 0 findings, PASS.
// The gate cannot false-positive before any money-bearing event is emitted.
// It bites the moment a payload is stored with a numeric `amount` in a
// MoneyWire struct.
//
// ## Steady-state expectation
//
// During the build phase all events are emitted through the V1 legacy path
// (integer `*Minor` fields in Zod-validated payloads). V2 MoneyWire fields
// are type-level only until slice 3 wires them into live emitters. So in the
// current phase this gate will typically report 0 events scanned or 0 findings.
// It becomes load-bearing in slice 3 when V2 payloads reach the live event
// store.
//
// Authority:
//   - D-MONEY-DECIMAL-BUILD-PROCEED (CEO-approved)
//   - D-MONEY-DECIMAL-REDENOMINATION (CEO-approved)
//   - brief:atlas:money-slice-2-sweep-all-33-transactional-event-s:2026-06-13
//
// Citations:
//   - Principle 1 — events are the only source of truth.
//   - Principle 5 — multi-currency, multi-entity, multi-country from day one.
//   - D-MONEY-DECIMAL-BUILD-PROCEED
//   - D-MONEY-DECIMAL-REDENOMINATION
//
// Author: Atlas (Core banking platform architect, engineering).

import { findFloatMoneyViolations } from "../core/money-codec";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

export interface MinimalEvent {
  event_id: string;
  type: string;
  entity?: string;
  payload?: unknown;
}

export interface RunOpts {
  /** Events to scan. Defaults to an empty array (CI-store posture: 0 findings). */
  events?: MinimalEvent[];
  /**
   * When true the gate runs in "sample mode" — only the first `sampleSize`
   * events per event type are inspected. Useful for large stores where a full
   * scan would be slow.
   */
  sample?: boolean;
  sampleSize?: number;
}

// ---------------------------------------------------------------------------
// Core recon logic
// ---------------------------------------------------------------------------

export function runRecon(opts: RunOpts = {}): ReconResult {
  const events = opts.events ?? [];
  const sample = opts.sample ?? false;
  const sampleSize = opts.sampleSize ?? 100;

  const base = emptyResult("money-codec-no-float");

  if (events.length === 0) {
    return base;
  }

  // Optionally sample: first N events per type.
  let toScan: MinimalEvent[];
  if (sample) {
    const countByType = new Map<string, number>();
    toScan = [];
    for (const ev of events) {
      const seen = countByType.get(ev.type) ?? 0;
      if (seen < sampleSize) {
        toScan.push(ev);
        countByType.set(ev.type, seen + 1);
      }
    }
  } else {
    toScan = events;
  }

  const violations: ReconViolation[] = [];

  for (const ev of toScan) {
    if (ev.payload === undefined || ev.payload === null) continue;

    const paths = findFloatMoneyViolations(ev.payload);
    for (const path of paths) {
      violations.push({
        subject: ev.event_id,
        severity: "fail",
        message: `Event ${ev.event_id} (type=${ev.type}) has a numeric MoneyWire amount at payload.${path}. MoneyWire.amount MUST be a string, never a JSON number (Principle 1 + Principle 5). Use encodeMoney() or moneyWireFromMinor() to produce a compliant MoneyWire.`,
      });
    }
  }

  return {
    ...base,
    asserted: toScan.length,
    violations,
    ok: violations.length === 0,
  };
}

export default runRecon;
