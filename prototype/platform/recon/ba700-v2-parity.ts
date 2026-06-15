// platform/recon/ba700-v2-parity.ts
//
// recon:ba700-v2-parity — ADVISORY parity gate for the Phase 3e V2 BA-700 engine.
//
// STATUS: PHASE 3E — ADVISORY (ok: true even with warn-severity violations).
//
// This gate compares the V1 BA-700 (from generateBA700Return, events-first path)
// against the V2 BA-700 (from computeBA700V2, GlPostingEmitted + CcrEadComputed V2).
//
// ## Expected outcome at Phase 3e
//
// V2 capital numerator is ZERO (no capital GL posting rules emit GlPostingEmitted).
// V2 credit RWA from CcrEadComputed events may exist on the home store but not on
// a clean CI store (no CcrEadComputed events seeded in ci:migrate).
//
// The gate:
//   1. Checks that the V2 projection infrastructure is wired correctly.
//   2. Documents the structural gap (GAP-3E-001) as an advisory warn.
//   3. When V2 side has data: byte-compares coverable cells; mismatches → warn.
//   4. When V2 side has no-data: emits advisory gap summary, ok: true.
//
// ## Why advisory
//
// At Phase 3e scope, the V2 capital GL posting rules do not exist. A hard-fail
// on zero V2 capital would block every CI run without any real regression signal.
// The gate becomes enforcing ONLY after GAP-3E-001 is resolved (capital posting
// rules built and emitting GlPostingEmitted for ACC-5000-001/002/5200-001/002).
//
// Authority: D-V1-REMOVAL-PHASE-3E (CEO-approved 2026-06-15).
// Citations: Reg 38; BCBS Basel III §50–§90; P1-EVENTS-AS-TRUTH.
// Author: Atlas (Substrate Architect, engineering).

import { coaToCapitalClassifications } from "../accounting/coa-registry";
import { eventStore } from "../composition";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { computeBA700V2 } from "../projections/ba700-v2";
import { generateBA700Return } from "../returns/ba700/generator";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";
import { runParityCheck } from "./v1-v2-parity-harness";

const PIPELINE = "ba700-v2-parity";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANCHOR_ENTITY = "LE-ZA-HOZ-BANK";
const FUNCTIONAL_CURRENCY = "ZAR";
const AS_OF = "2099-12-31"; // broad window capturing all build-phase events
const PERIOD_ID = "period:hoz-bank:build-phase";
const PERIOD_START = "2026-01-01";
const PERIOD_END = "2099-12-31";

// ---------------------------------------------------------------------------
// Gate implementation
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (1) Structural self-test — vacuous parity harness must still pass.
  const vacuousViolations = runParityCheck({
    label: "ba700-v2-parity:structural-check",
    readV1: () => ({}),
    readV2: () => ({}),
  });
  result.asserted += 1;
  if (vacuousViolations.length > 0) {
    violations.push({
      subject: "ba700-v2-parity:parity-harness-structural-check",
      message:
        "The parity harness structural check failed: the vacuous (empty == empty) " +
        "self-test did not pass. This is a harness bug, not a domain divergence. " +
        "Inspect v1-v2-parity-harness.ts.",
      severity: "fail",
    });
  }

  // (2) Registry check — GlPostingEmitted and CcrEadComputed must be v2-parallel.
  const glEntry = EVENT_TYPE_REGISTRY.find((e) => e.type === "GlPostingEmitted");
  const ccrEntry = EVENT_TYPE_REGISTRY.find((e) => e.type === "CcrEadComputed");

  result.asserted += 1;
  if (!glEntry) {
    violations.push({
      subject: "ba700-v2-parity:registry-missing:GlPostingEmitted",
      message:
        '"GlPostingEmitted" is not in the event type registry. ' +
        "This is a three-site F-032 registration defect. " +
        'Register the type with v2Status: "v2-parallel". Authority: D-V1-REMOVAL-PHASE-3A.',
      severity: "fail",
    });
  } else if (glEntry.v2Status !== "v2-parallel") {
    violations.push({
      subject: "ba700-v2-parity:unexpected-status:GlPostingEmitted",
      message: `"GlPostingEmitted" is tagged "${glEntry.v2Status}" — expected "v2-parallel". Authority: D-V1-REMOVAL-PHASE-3A.`,
      severity: glEntry.v2Status === "v2-replaced" ? "fail" : "warn",
    });
  }

  result.asserted += 1;
  if (!ccrEntry) {
    violations.push({
      subject: "ba700-v2-parity:registry-missing:CcrEadComputed",
      message:
        '"CcrEadComputed" is not in the event type registry. ' +
        "This is a three-site F-032 registration defect. " +
        'Register the type with v2Status: "v2-parallel". Authority: D-CREDIT-LIMIT-ENGINE-BUILD.',
      severity: "fail",
    });
  } else if (ccrEntry.v2Status !== "v2-parallel") {
    violations.push({
      subject: "ba700-v2-parity:unexpected-status:CcrEadComputed",
      message: `"CcrEadComputed" is tagged "${ccrEntry.v2Status}" — expected "v2-parallel". Authority: D-CREDIT-LIMIT-ENGINE-BUILD.`,
      severity: ccrEntry.v2Status === "v2-replaced" ? "fail" : "warn",
    });
  }

  // (3) Run V1 and V2 projections and compare.
  let v1Tier1 = 0;
  let v1Tier2 = 0;
  let v1Rwa = 0;
  let v2Tier1 = 0;
  let v2Tier2 = 0;
  let v2CreditRwa = 0;
  let v2CoverageStatus: "no-data" | "partial" | "complete" | "error" = "error";

  try {
    // V2 side — GlPostingEmitted + CcrEadComputed.
    const v2Result = computeBA700V2({
      eventStore,
      asOf: AS_OF,
      entity: ANCHOR_ENTITY,
      functionalCurrency: FUNCTIONAL_CURRENCY,
    });

    v2CoverageStatus = v2Result.meta.coverageStatus === "no-data" ? "no-data" : "partial";

    v2Tier1 = v2Result.capitalAdequacy.tier1Capital;
    v2Tier2 = v2Result.capitalAdequacy.tier2Capital;
    v2CreditRwa = v2Result.capitalAdequacy.creditRwa;
    result.asserted += 1;
  } catch (err) {
    violations.push({
      subject: "ba700-v2-parity:v2-projection-error",
      message: `V2 BA-700 projection threw: ${err instanceof Error ? err.message : String(err)}. Inspect computeBA700V2() in platform/projections/ba700-v2.ts.`,
      severity: "fail",
    });
    result.asserted += 1;
  }

  // V1 side — generateBA700Return (events-first path).
  // We call it in a try-catch: if the store has no TrialBalanceSnapshotted or
  // AccountingPeriodClosed events (clean CI), the V1 generator still runs but
  // produces insufficient-data status — that's expected, not an error.
  try {
    const classifications = coaToCapitalClassifications();
    const v1Result = generateBA700Return({
      entityId: ANCHOR_ENTITY,
      reportingDate: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: FUNCTIONAL_CURRENCY,
      eventStore,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      classifications,
      deductions: [],
    });

    v1Tier1 = v1Result.return.capitalAdequacy.tier1Capital;
    v1Tier2 = v1Result.return.capitalAdequacy.tier2Capital;
    v1Rwa = v1Result.return.capitalAdequacy.rwa;
    result.asserted += 1;
  } catch (err) {
    violations.push({
      subject: "ba700-v2-parity:v1-projection-error",
      message: `V1 BA-700 projection threw: ${err instanceof Error ? err.message : String(err)}. Inspect generateBA700Return() in platform/returns/ba700/generator.ts.`,
      severity: "fail",
    });
    result.asserted += 1;
  }

  // (4) Advisory gap — structural coverage gap at Phase 3e.
  result.asserted += 1;
  violations.push({
    subject: "ba700-v2-parity:gap:phase-3e-capital-coverage",
    message: `ADVISORY GAP (Phase 3e): V2 capital numerator (tier1/tier2) is zero — no V2 GL posting rules for capital accounts (ACC-5000-001/002, ACC-5200-001/002) exist at Phase 3e. Only FX posting rules (PR-FX-001-V2, PR-FX-REVAL-V2, PR-FX-CLOSE-V2) emit GlPostingEmitted; these post to FX nostro accounts, not capital. GAP-3E-001. V1 tier1=${v1Tier1} V1 tier2=${v1Tier2} V2 tier1=${v2Tier1} V2 tier2=${v2Tier2}. TO RESOLVE: build V2 GL posting rules for capital accounts (CapitalContributionRecorded V2 equivalent), then assert V2 capital > 0. Authority: D-V1-REMOVAL-PHASE-3E.`,
    severity: "warn",
  });

  // (5) Advisory gap — credit RWA structural partial at Phase 3e.
  result.asserted += 1;
  violations.push({
    subject: "ba700-v2-parity:gap:phase-3e-rwa-coverage",
    message: `ADVISORY GAP (Phase 3e): V2 RWA is credit-RWA-only (from CcrEadComputed V2 events). Market RWA (12.5 × BA-320 FX capital charge) is GAP-3E-002 (no V2 VaR event). Operational RWA is GAP-3E-003 (no V2 op-risk event). V1 totalRwa=${v1Rwa} V2 creditRwa=${v2CreditRwa} (V2 creditRwa uses EAD sum as proxy, not CRE20-weighted — conservative overstatement). Coverage status: ${v2CoverageStatus}. TO RESOLVE: (a) wire BA-320 V2 → marketRwa in BA-700 V2 once flip approved; (b) build V2 op-risk event type. Authority: D-V1-REMOVAL-PHASE-3E.`,
    severity: "warn",
  });

  // (6) When BOTH sides have data (non-zero capital on V2), compare coverable cells.
  if (v2Tier1 > 0 || v2Tier2 > 0) {
    result.asserted += 1;
    // Capital comparison — can only compare if V2 has capital.
    if (v1Tier1 !== v2Tier1) {
      violations.push({
        subject: "ba700-v2-parity:mismatch:tier1Capital",
        message: `V1↔V2 tier1Capital mismatch: V1=${v1Tier1}, V2=${v2Tier1}. Inspect GlPostingEmitted capital-account fold vs V1 SubLedgerPostingEmitted fold. Verify identical capital-account IDs and sign conventions. Authority: D-V1-REMOVAL-PHASE-3E.`,
        severity: "warn",
      });
    }
    if (v1Tier2 !== v2Tier2) {
      violations.push({
        subject: "ba700-v2-parity:mismatch:tier2Capital",
        message: `V1↔V2 tier2Capital mismatch: V1=${v1Tier2}, V2=${v2Tier2}. Inspect GlPostingEmitted T2-account fold vs V1 fold. Authority: D-V1-REMOVAL-PHASE-3E.`,
        severity: "warn",
      });
    }
  }

  // ADVISORY gate: ok = true even when there are warn violations.
  // Only fail-severity violations set ok = false.
  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");

  const failCount = violations.filter((v) => v.severity === "fail").length;
  const warnCount = violations.filter((v) => v.severity === "warn").length;
  const summary =
    `ba700-v2-parity [ADVISORY — Phase 3e]: ${failCount} fail violations, ${warnCount} warn violations. ` +
    `V1: tier1=${v1Tier1} tier2=${v1Tier2} rwa=${v1Rwa}. ` +
    `V2: tier1=${v2Tier1} tier2=${v2Tier2} creditRwa=${v2CreditRwa} (coverage: ${v2CoverageStatus}). ` +
    `GlPostingEmitted registry: ${glEntry?.v2Status ?? "MISSING"}. ` +
    `CcrEadComputed registry: ${ccrEntry?.v2Status ?? "MISSING"}. ` +
    `Harness: ${vacuousViolations.length === 0 ? "OK" : "FAILED"}.`;

  result.asOf = summary;
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const label = r.ok ? "OK (advisory — warn violations expected at Phase 3e)" : "FAIL";
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
