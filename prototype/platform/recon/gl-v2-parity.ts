// platform/recon/gl-v2-parity.ts
//
// recon:gl-v2-parity — ADVISORY parity gate for the Phase 3A V2 GL engine.
//
// STATUS: PHASE 3A — ADVISORY (ok: true even with warn-severity violations).
//
// This gate compares the V1 trial-balance (SubLedgerPostingEmitted → computeTrialBalance)
// against the V2 trial-balance (GlPostingEmitted → computeTrialBalanceV2) for
// the anchor entity over a fixed window.
//
// ## Expected outcome at Phase 3A
//
// V2 covers only the FX sub-set (PR-FX-001-V2, PR-FX-REVAL-V2, PR-FX-CLOSE-V2).
// V1 covers all 42 trigger types. The gate therefore expects:
//
//   - Accounts where V1 posts and V2 does NOT → advisory warn (expected gap).
//   - Accounts where BOTH post → byte-compared per (leafAccountId, currency).
//   - The parity check will produce WARN violations for every V1-only account.
//
// The gate is ADVISORY: `result.ok = true` regardless of warn violations.
// It becomes enforcing after full V2 coverage is achieved (Phase 3 complete —
// all domains have FIL models and emit GlPostingEmitted).
//
// ## Why advisory, not fail
//
// At Phase 3A scope only 3 of 42 posting rules have V2 equivalents. A byte-
// equivalence comparison across the full trial balance would produce 39+ fail
// violations for every account that V1 posts and V2 doesn't — this is NOT a
// regression but an expected structural gap. Advisory severity surfaces the gap
// without blocking merges, while the parity harness logic validates that the
// covered (FX) accounts do NOT diverge.
//
// Authority: D-V1-REMOVAL-PHASE-3A (CEO-approved 2026-06-15).
// Citations: IFRS-9-§3.1.1; IFRS-9-§5.7.1; IFRS-9-§3.2.3; P1-EVENTS-AS-TRUTH.
// Author: Atlas (Substrate Architect, engineering).

import { computeTrialBalanceUncached } from "../accounting/period-close";
import { eventStore } from "../composition";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { computeTrialBalanceV2Uncached } from "../projections/gl-projection-v2";
import {
  V2_ANCHOR_ENTITY,
  V2_PERIOD_END,
  V2_PERIOD_START,
} from "../projections/v2-read-window";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";
import { runParityCheck } from "./v1-v2-parity-harness";

const PIPELINE = "gl-v2-parity";

// ---------------------------------------------------------------------------
// Period window + anchor entity. Sourced from the shared v2-read-window module
// so the dashboard's V2 read path (gl-view, useV2Store) and this parity gate
// read exactly the same (entity, window) — no drift between what is surfaced
// and what is proven. These are ISO date strings (periodStart ≤ as_of ≤ periodEnd).
// ---------------------------------------------------------------------------

const PERIOD_START = V2_PERIOD_START;
const PERIOD_END = V2_PERIOD_END;
const ANCHOR_ENTITY = V2_ANCHOR_ENTITY;

// ---------------------------------------------------------------------------
// Gate implementation
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (1) Structural self-test — vacuous parity harness must still pass.
  const vacuousViolations = runParityCheck({
    label: "gl-v2-parity:structural-check",
    readV1: () => ({}),
    readV2: () => ({}),
  });
  result.asserted += 1;
  if (vacuousViolations.length > 0) {
    violations.push({
      subject: "gl-v2-parity:parity-harness-structural-check",
      message:
        "The parity harness structural check failed: the vacuous (empty == empty) " +
        "self-test did not pass. This is a harness bug, not a domain divergence. " +
        "Inspect v1-v2-parity-harness.ts.",
      severity: "fail",
    });
  }

  // (2) Registry check — GlPostingEmitted must be v2-parallel.
  const glEntry = EVENT_TYPE_REGISTRY.find((e) => e.type === "GlPostingEmitted");
  result.asserted += 1;
  if (!glEntry) {
    violations.push({
      subject: "gl-v2-parity:registry-missing:GlPostingEmitted",
      message:
        '"GlPostingEmitted" is not in the event type registry. ' +
        "This is a three-site F-032 registration defect. " +
        'Register the type in platform/event-store/registry/ with v2Status: "v2-parallel". ' +
        "Authority: D-V1-REMOVAL-PHASE-3A.",
      severity: "fail",
    });
  } else if (glEntry.v2Status !== "v2-parallel") {
    violations.push({
      subject: "gl-v2-parity:unexpected-status:GlPostingEmitted",
      message: `"GlPostingEmitted" is tagged "${glEntry.v2Status}" — expected "v2-parallel". Phase 3A runs GlPostingEmitted in parallel with SubLedgerPostingEmitted. v2-replaced requires full V2 coverage across all 42 trigger types (Phase 3 complete) plus byte-equivalence proof. Authority: D-V1-REMOVAL-PHASE-3A.`,
      severity: glEntry.v2Status === "v2-replaced" ? "fail" : "warn",
    });
  }

  // (3) V1 vs V2 trial-balance comparison.
  //
  // At Phase 3A the comparison is account-by-account:
  //   - Accounts only in V1 → advisory warn (expected gap, not a regression).
  //   - Accounts only in V2 → fail (V2 should not post to accounts V1 doesn't).
  //   - Accounts in both → byte-compare the amountMinor values.
  //
  // We use the Uncached paths to avoid snapshot cross-contamination between
  // the two trial balance types.
  const args = {
    eventStore,
    entity: ANCHOR_ENTITY,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
  };

  let v1RowCount = 0;
  let v2RowCount = 0;
  let commonAccounts = 0;
  let v1OnlyAccounts = 0;
  let v2OnlyAccounts = 0;

  try {
    const v1Balance = computeTrialBalanceUncached(args);
    const v2Balance = computeTrialBalanceV2Uncached(args);

    v1RowCount = v1Balance.rows.length;
    v2RowCount = v2Balance.rows.length;

    // Build lookup maps by (leafAccountId, currency).
    const v1Map = new Map<string, number>();
    for (const row of v1Balance.rows) {
      v1Map.set(`${row.leafAccountId}|${row.currency}`, row.amountMinor);
    }
    const v2Map = new Map<string, number>();
    for (const row of v2Balance.rows) {
      v2Map.set(`${row.leafAccountId}|${row.currency}`, row.amountMinor);
    }

    // Check all V2 accounts against V1.
    for (const [key, v2Minor] of v2Map.entries()) {
      result.asserted += 1;
      if (!v1Map.has(key)) {
        v2OnlyAccounts += 1;
        violations.push({
          subject: `gl-v2-parity:v2-only:${key}`,
          message: `V2 posted to account/currency "${key}" but V1 has no posting there. V2 should not post to accounts outside V1's coverage at Phase 3A scope. Inspect gl-posting-engine-v2.ts to verify account code resolution. Authority: D-V1-REMOVAL-PHASE-3A.`,
          severity: "fail",
        });
      } else {
        const v1Minor = v1Map.get(key) ?? 0;
        commonAccounts += 1;
        if (v1Minor !== v2Minor) {
          violations.push({
            subject: `gl-v2-parity:amount-mismatch:${key}`,
            message: `V1↔V2 amount mismatch for "${key}": V1 amountMinor=${v1Minor}, V2 amountMinor=${v2Minor}. These accounts are in both trial balances and must byte-match. Inspect gl-posting-engine-v2.ts posting logic for this account. Authority: D-V1-REMOVAL-PHASE-3A.`,
            severity: "fail",
          });
        }
      }
    }

    // V1-only accounts: advisory warn (expected gap at Phase 3A).
    for (const [key] of v1Map.entries()) {
      result.asserted += 1;
      if (!v2Map.has(key)) {
        v1OnlyAccounts += 1;
        violations.push({
          subject: `gl-v2-parity:v1-only:${key}`,
          message: `Account/currency "${key}" exists in V1 trial balance but not V2. Expected at Phase 3A: V2 covers only the FX sub-set (PR-FX-001-V2, PR-FX-REVAL-V2, PR-FX-CLOSE-V2). All other V1 accounts (bond, equity, IRS, repo, MMD, IBL) are V1-only until their FIL models are built. Authority: D-V1-REMOVAL-PHASE-3A.`,
          severity: "warn",
        });
      }
    }
  } catch (err) {
    violations.push({
      subject: "gl-v2-parity:fold-error",
      message: `Trial balance fold threw: ${err instanceof Error ? err.message : String(err)}. Inspect the event store for malformed GlPostingEmitted or SubLedgerPostingEmitted events.`,
      severity: "fail",
    });
    result.asserted += 1;
  }

  // (4) Advisory gap documentation — surface the structural coverage gap.
  result.asserted += 1;
  violations.push({
    subject: "gl-v2-parity:gap:phase-3a-coverage",
    message: `ADVISORY GAP (Phase 3A): V2 GL engine covers 3 of 42 V1 posting rules (PR-FX-001-V2, PR-FX-REVAL-V2, PR-FX-CLOSE-V2 — FX sub-set only). V1 rows: ${v1RowCount}. V2 rows: ${v2RowCount}. Common accounts: ${commonAccounts}. V1-only: ${v1OnlyAccounts}. V2-only: ${v2OnlyAccounts}. V1-only accounts will produce warn violations above — expected, not regressions. TO RESOLVE: build FIL models for bond / equity / IRS / repo / MMD / IBL and wire each to emit GlPostingEmitted, then promote this gate to enforcing. Authority: D-V1-REMOVAL-PHASE-3A.`,
    severity: "warn",
  });

  // ADVISORY gate: ok = true even when there are warn violations.
  // Only fail-severity violations set ok = false.
  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");

  const failCount = violations.filter((v) => v.severity === "fail").length;
  const warnCount = violations.filter((v) => v.severity === "warn").length;
  const summary = `gl-v2-parity [ADVISORY — Phase 3A]: ${failCount} fail violations, ${warnCount} warn violations. V1 rows: ${v1RowCount}, V2 rows: ${v2RowCount}. Common: ${commonAccounts}, V1-only (expected warns): ${v1OnlyAccounts}, V2-only (fail if any): ${v2OnlyAccounts}. GlPostingEmitted registry: ${glEntry?.v2Status ?? "MISSING"}. Harness: ${vacuousViolations.length === 0 ? "OK" : "FAILED"}.`;

  result.asOf = summary;
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const label = r.ok ? "OK (advisory — warn violations expected at Phase 3A)" : "FAIL";
  process.stdout.write(`\nrecon:${PIPELINE} ${label}\n${r.asOf}\n`);
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.asOf,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
