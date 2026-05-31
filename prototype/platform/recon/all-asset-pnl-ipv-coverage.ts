// platform/recon/all-asset-pnl-ipv-coverage.ts
//
// Vera continuous-controls pipeline: all-asset-pnl-ipv-coverage.
//
// Asserts the two invariants of the all-asset-class P&L + IPV MVP
// (brief:bea:all-asset-class-p-l-ipv-coverage-mvp:2026-05-31):
//
//   (A) Position-source no-silent-zero. Every position the cross-asset
//       position-source yields (FX-spot, bond, equity, IRD) carries its mark as
//       a FinancialInput — `present` (markable) or `absent` (no production mark)
//       — and NEVER a silent 0. The pipeline replays the real store, builds the
//       position set, and asserts:
//         - every position's markZarMinor is a well-formed FinancialInput
//           (has either {present:true,value} or {present:false,reason,expectedFrom});
//         - the cross-asset total is `absent` iff ≥1 position is unmarkable
//           (the partition is internally consistent — an absent position must
//           appear in unmarkableKeys and must not have been folded into the
//           markable total).
//
//   (B) IPV schedule level coverage. The extended IPV schedule
//       (IPV_SCHEDULE_PCT) covers EVERY IFRS-13 level (1, 2, 3) for EVERY
//       parameter type (price, curve-point, vol-point, credit-spread) with a
//       finite, positive relative band — no hole, no zero band (a zero band
//       would make every mark breach), no NaN. This is the per-IFRS-13-level
//       and per-parameter-type extension the brief requires beyond the FX-spot
//       two-tier schedule (which is checked separately by its own tier set).
//
// Empty-store posture (per platform/recon/document-registration.ts): the IPV
// schedule check (B) is a pure structural assertion over the in-code grid and
// always runs. The position-source check (A) is structural too — on an empty
// store the position set is simply empty, which trivially satisfies the
// no-silent-zero partition — so there is no "fresh runner" downgrade to make:
// an empty store yields `ok:true` with `asserted` reflecting the schedule grid.
//
// P1 — events are the only source of truth: the position set is replayed, not
//   stored; the assertion is over the derivation, not a cached number.
// P2 — single-graph discipline: ties the position-source + IPV-schedule nodes
//   to valuation-policy §3/§7 and pricing-policy §5 via citations.
//
// Authority:
//   - Camille (CFO, governance) recommendation R3 (all-asset-class P&L + IPV)
//   - valuation-policy-v1 §3 (market data source hierarchy) / §7 (IPV by level)
//   - pricing-policy-v1 §5 (IPV)
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (no-silent-zero)
//   - brief:bea:all-asset-class-p-l-ipv-coverage-mvp:2026-05-31
//
// Author: Bea (Accounting & financial reporting engineer, engineering)
//   — pipeline contract per Vera (Internal audit engineer, engineering).

import { eventStore as defaultEventStore } from "../composition";
import type { EventStore } from "../event-store/store";
import {
  IFRS_FAIR_VALUE_LEVELS,
  IPV_PARAMETER_TYPES,
  type IfrsFairValueLevel,
  type IpvParameterType,
  getIpvScheduleTolerance,
} from "../markets/ipv-tolerance";
import { buildPositionSet } from "../product-control/position-source";
import { isPresent } from "../types/financial-input";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "all-asset-pnl-ipv-coverage";

export interface RunOpts {
  /** Override the event store (tests pre-seed their own in-memory store). */
  store?: EventStore;
  /** Override the report date used to build the position set. Defaults to today. */
  reportDate?: string;
}

/**
 * A well-formed FinancialInput is exactly one of:
 *   { present: true, value: <finite number>, lineage: <string> }
 *   { present: false, reason: <string>, expectedFrom: <string> }
 * — never `{ present: true, value: 0 }` masquerading as a real figure with no
 * lineage, and never a bare number.
 */
function isWellFormedFinancialInput(input: unknown): boolean {
  if (typeof input !== "object" || input === null) return false;
  const o = input as Record<string, unknown>;
  if (o.present === true) {
    return typeof o.value === "number" && Number.isFinite(o.value) && typeof o.lineage === "string";
  }
  if (o.present === false) {
    return typeof o.reason === "string" && typeof o.expectedFrom === "string";
  }
  return false;
}

export function run(opts: RunOpts = {}): ReconResult {
  const store = opts.store ?? defaultEventStore;
  const reportDate = opts.reportDate ?? new Date().toISOString().slice(0, 10);
  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  let asserted = 0;

  // -------------------------------------------------------------------------
  // (B) IPV schedule level coverage — pure structural assertion over the grid.
  // -------------------------------------------------------------------------
  for (const level of IFRS_FAIR_VALUE_LEVELS as readonly IfrsFairValueLevel[]) {
    for (const param of IPV_PARAMETER_TYPES as readonly IpvParameterType[]) {
      asserted += 1;
      const { pctThreshold, zarThreshold } = getIpvScheduleTolerance(level, param);
      if (!Number.isFinite(pctThreshold) || pctThreshold <= 0) {
        violations.push({
          subject: `ipv-schedule:L${level}:${param}`,
          message: `IPV schedule band for IFRS-13 Level ${level} / parameter "${param}" is ${pctThreshold} — must be a finite positive fraction. A zero or non-finite band would make every mark breach (or never breach). Calibrate the band in IPV_SCHEDULE_PCT.`,
          severity: "fail",
        });
      }
      if (!Number.isFinite(zarThreshold) || zarThreshold <= 0) {
        violations.push({
          subject: `ipv-schedule:L${level}:${param}`,
          message: `IPV schedule absolute ZAR threshold for IFRS-13 Level ${level} / parameter "${param}" is ${zarThreshold} — must be a finite positive amount.`,
          severity: "fail",
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // (A) Position-source no-silent-zero — replay the store, build the set, and
  //     assert every position routes through a well-formed FinancialInput and
  //     the markable/unmarkable partition is internally consistent.
  // -------------------------------------------------------------------------
  const set = buildPositionSet(store, reportDate);

  const unmarkable = new Set(set.unmarkableKeys);
  let recomputedMarkableTotal = 0;
  for (const p of set.positions) {
    asserted += 1;
    if (!isWellFormedFinancialInput(p.markZarMinor)) {
      violations.push({
        subject: `position:${p.assetClass}:${p.instrumentKey}`,
        message: `position mark is not a well-formed FinancialInput — every asset class must route its mark through present()/absent() (no silent 0, no bare number). Got: ${JSON.stringify(p.markZarMinor)}.`,
        severity: "fail",
      });
      continue;
    }
    if (isPresent(p.markZarMinor)) {
      recomputedMarkableTotal += p.markZarMinor.value;
      // A markable position must NOT also be listed unmarkable.
      if (unmarkable.has(p.instrumentKey)) {
        violations.push({
          subject: `position:${p.assetClass}:${p.instrumentKey}`,
          message:
            "position has a present mark but also appears in unmarkableKeys — the markable/unmarkable partition is inconsistent.",
          severity: "fail",
        });
      }
    } else {
      // An absent position MUST be in the unmarkable ledger (so it is excluded
      // from the total loudly, not silently dropped).
      if (!unmarkable.has(p.instrumentKey)) {
        violations.push({
          subject: `position:${p.assetClass}:${p.instrumentKey}`,
          message:
            "position mark is absent but the key is missing from unmarkableKeys — an unmarkable position must be tracked so the total can declare itself incomplete.",
          severity: "fail",
        });
      }
    }
  }

  // The recomputed markable total (Σ present positions) must equal the
  // position-set's reported markableTotalZarMinor — no silent inclusion of an
  // absent (would-be-0) position.
  if (recomputedMarkableTotal !== set.markableTotalZarMinor) {
    violations.push({
      subject: PIPELINE,
      message: `markableTotalZarMinor (${set.markableTotalZarMinor}) ≠ Σ present positions (${recomputedMarkableTotal}). An absent position may have been folded as a silent 0, or a present one omitted.`,
      severity: "fail",
    });
  }

  // The cross-asset total must be absent IFF ≥1 position is unmarkable.
  const totalIsPresent = isPresent(set.totalUnrealised);
  const anyUnmarkable = set.unmarkableKeys.length > 0;
  if (totalIsPresent === anyUnmarkable) {
    violations.push({
      subject: PIPELINE,
      message: `cross-asset total presence (${totalIsPresent ? "present" : "absent"}) is inconsistent with unmarkable count (${set.unmarkableKeys.length}). The total must be absent iff ≥1 position lacks a production mark (no-silent-zero contract).`,
      severity: "fail",
    });
  }

  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.ok = failCount === 0;
  result.asserted = asserted;
  result.violations = violations;
  return result;
}

// ---------------------------------------------------------------------------
// CLI entrypoint — invoked by `bun run recon:all-asset-pnl-ipv-coverage`
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = run();
  const statusLabel = result.ok ? "PASS" : "FAIL";
  console.log(
    `[${PIPELINE}] ${statusLabel} — ${result.asserted} asserted, ${result.violations.length} violation(s)`,
  );
  for (const v of result.violations) {
    const prefix = v.severity === "fail" ? "  FAIL" : v.severity === "warn" ? "  WARN" : "  INFO";
    console.log(`${prefix}  ${v.subject}: ${v.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}
