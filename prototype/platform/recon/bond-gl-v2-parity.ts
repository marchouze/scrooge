// platform/recon/bond-gl-v2-parity.ts
//
// recon:bond-gl-v2-parity — ADVISORY parity gate (Phase 3c).
//
// Asserts that the BOND GL trial-balance entries computed from the V1 bond
// lifecycle events (SubLedgerPostingEmitted, via computeTrialBalance) agree per
// account with the bond GL entries computed from the V2-parallel bond lifecycle
// events (GlPostingEmitted, via the V2 bond GL engine → computeTrialBalanceV2),
// restricted to the bond account set (ACC-1200-001, ACC-3100-001/002/003/005/006,
// ACC-4101-001 — the V1 logical→COA bond mapping in sla/resolver.ts).
//
// ADVISORY at Phase 3c (Charter cmd 3 — no green by concealment, but a parallel
// shadow that has no V2 bond events yet is correctly a PASS, not a fail): the
// gate returns ok:true and WARNS on any per-account gap. It hardens to enforcing
// when the V2 bond path is the authoritative source (a later phase + Decision).
//
// CURRENCY-AGNOSTIC: both trial balances carry their own currency on each row;
// the comparison keys on (leafAccountId, currency) — no hardcoded ZAR
// (WS-MULTI-BASE-CURRENCY).
//
// Authority: D-V1-REMOVAL-PHASE-3C (CEO-approved 2026-06-16);
//            D-ENGINEERING-INTEGRITY-CHARTER;
//            IFRS 9 §3.1.1, §3.2.3, §5.4.1, §5.7.1; IAS 32;
//            brief:atlas:v1-removal-phase-3c-bond-accounting-on-v2-fvtpl-:2026-06-16.
// Author: Atlas (Core banking platform architect, engineering).

import { computeTrialBalanceUncached } from "../accounting/period-close";
import { eventStore } from "../composition";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { computeTrialBalanceV2Uncached } from "../projections/gl-projection-v2";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";
import { runParityCheck } from "./v1-v2-parity-harness";

const PIPELINE = "bond-gl-v2-parity";

// Broad window capturing the entire build phase.
const PERIOD_START = "2026-01-01";
const PERIOD_END = "2099-12-31";

// The anchor entity that the V2 FIL bond instances belong to.
const ANCHOR_ENTITY = "LE-ZA-HOZ-BANK";

/** The bond COA account set (V1 logical→COA, sla/resolver.ts). */
const BOND_ACCOUNTS: ReadonlySet<string> = new Set([
  "ACC-1200-001", // bond nostro
  "ACC-3100-001", // bond asset — banking book (amortised cost)
  "ACC-3100-002", // bond asset — trading book (FVTPL)
  "ACC-3100-003", // accrued interest receivable
  "ACC-3100-005", // unrealised P&L — bonds (FVTPL)
  "ACC-3100-006", // realised P&L — bonds
  "ACC-4101-001", // interest income (EIR)
]);

/** The 5 V2-parallel bond lifecycle event types this gate watches. */
const V2_BOND_EVENT_TYPES = [
  "BondTradeExecutedV2",
  "BondInterestAccruedV2",
  "BondPositionRevaluedV2",
  "BondMaturedV2",
  "BondSoldV2",
] as const;

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (1) Structural self-test — vacuous parity harness must still pass.
  const vacuousViolations = runParityCheck({
    label: "bond-gl-v2-parity:structural-check",
    readV1: () => ({}),
    readV2: () => ({}),
  });
  result.asserted += 1;
  if (vacuousViolations.length > 0) {
    violations.push({
      subject: "bond-gl-v2-parity:parity-harness-structural-check",
      message:
        "The parity harness structural check failed: the vacuous (empty == empty) " +
        "self-test did not pass. This is a harness bug, not a domain divergence. " +
        "Inspect v1-v2-parity-harness.ts.",
      severity: "fail",
    });
  }

  // (2) Registry check — every V2 bond event type must be v2-parallel (F-032).
  for (const type of V2_BOND_EVENT_TYPES) {
    result.asserted += 1;
    const entry = EVENT_TYPE_REGISTRY.find((e) => e.type === type);
    if (!entry) {
      violations.push({
        subject: `bond-gl-v2-parity:registry-missing:${type}`,
        message: `"${type}" is not in the event type registry. This is a three-site F-032 registration defect. Register the type in platform/event-store/registry/ with v2Status: "v2-parallel". Authority: D-V1-REMOVAL-PHASE-3C.`,
        severity: "fail",
      });
    } else if (entry.v2Status !== "v2-parallel") {
      violations.push({
        subject: `bond-gl-v2-parity:unexpected-status:${type}`,
        message: `"${type}" is tagged "${entry.v2Status}" — expected "v2-parallel" at Phase 3c. Authority: D-V1-REMOVAL-PHASE-3C.`,
        severity: entry.v2Status === "v2-replaced" ? "fail" : "warn",
      });
    }
  }

  // (3) Bond trial-balance comparison, restricted to the bond account set.
  const args = {
    eventStore,
    entity: ANCHOR_ENTITY,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
  };

  let v1BondRows = 0;
  let v2BondRows = 0;
  let commonAccounts = 0;
  let v1OnlyAccounts = 0;
  let v2OnlyAccounts = 0;

  try {
    const v1Balance = computeTrialBalanceUncached(args);
    const v2Balance = computeTrialBalanceV2Uncached(args);

    const v1Map = new Map<string, number>();
    for (const row of v1Balance.rows) {
      if (!BOND_ACCOUNTS.has(row.leafAccountId)) continue;
      v1Map.set(`${row.leafAccountId}|${row.currency}`, row.amountMinor);
      v1BondRows += 1;
    }
    const v2Map = new Map<string, number>();
    for (const row of v2Balance.rows) {
      if (!BOND_ACCOUNTS.has(row.leafAccountId)) continue;
      v2Map.set(`${row.leafAccountId}|${row.currency}`, row.amountMinor);
      v2BondRows += 1;
    }

    // Check all V2 bond accounts against V1.
    for (const [key, v2Minor] of v2Map.entries()) {
      result.asserted += 1;
      if (!v1Map.has(key)) {
        v2OnlyAccounts += 1;
        violations.push({
          subject: `bond-gl-v2-parity:v2-only:${key}`,
          message: `V2 posted to bond account/currency "${key}" but V1 has no posting there. V2 should not post to bond accounts outside V1's coverage. Inspect gl-posting-engine-v2-bond.ts account resolution. Authority: D-V1-REMOVAL-PHASE-3C.`,
          severity: "fail",
        });
      } else {
        commonAccounts += 1;
        const v1Minor = v1Map.get(key) ?? 0;
        if (v1Minor !== v2Minor) {
          violations.push({
            subject: `bond-gl-v2-parity:amount-mismatch:${key}`,
            message: `V1↔V2 bond amount mismatch for "${key}": V1=${v1Minor}, V2=${v2Minor}. Bond accounts in both trial balances must byte-match. Inspect gl-posting-engine-v2-bond.ts. Authority: D-V1-REMOVAL-PHASE-3C.`,
            severity: "fail",
          });
        }
      }
    }

    // V1-only bond accounts: advisory warn (expected until the V2 bond path is
    // populated + authoritative).
    for (const [key] of v1Map.entries()) {
      result.asserted += 1;
      if (!v2Map.has(key)) {
        v1OnlyAccounts += 1;
        violations.push({
          subject: `bond-gl-v2-parity:v1-only:${key}`,
          message: `Bond account/currency "${key}" exists in V1 trial balance but not V2. Expected at Phase 3c until the V2 bond lifecycle events are populated + authoritative. Authority: D-V1-REMOVAL-PHASE-3C.`,
          severity: "warn",
        });
      }
    }
  } catch (err) {
    violations.push({
      subject: "bond-gl-v2-parity:fold-error",
      message: `Bond trial balance fold threw: ${err instanceof Error ? err.message : String(err)}. Inspect the event store for malformed GlPostingEmitted / SubLedgerPostingEmitted bond events.`,
      severity: "fail",
    });
    result.asserted += 1;
  }

  // (4) Advisory coverage note.
  result.asserted += 1;
  violations.push({
    subject: "bond-gl-v2-parity:gap:phase-3c-coverage",
    message: `ADVISORY (Phase 3c): bond V1↔V2 GL parity over the bond account set. V1 bond rows: ${v1BondRows}. V2 bond rows: ${v2BondRows}. Common: ${commonAccounts}. V1-only (expected warns): ${v1OnlyAccounts}. V2-only (fail if any): ${v2OnlyAccounts}. TO RESOLVE: populate the V2 bond lifecycle events + promote this gate to enforcing once the V2 bond path is authoritative. Authority: D-V1-REMOVAL-PHASE-3C.`,
    severity: "warn",
  });

  // ADVISORY: ok = true unless a fail-severity violation is present.
  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");

  const failCount = violations.filter((v) => v.severity === "fail").length;
  const warnCount = violations.filter((v) => v.severity === "warn").length;
  result.asOf = `bond-gl-v2-parity [ADVISORY — Phase 3c]: ${failCount} fail, ${warnCount} warn. V1 bond rows: ${v1BondRows}, V2 bond rows: ${v2BondRows}. Common: ${commonAccounts}, V1-only: ${v1OnlyAccounts}, V2-only: ${v2OnlyAccounts}. Harness: ${vacuousViolations.length === 0 ? "OK" : "FAILED"}.`;
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const label = r.ok ? "OK (advisory — warn violations expected at Phase 3c)" : "FAIL";
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
