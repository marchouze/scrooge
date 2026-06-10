// platform/recon/fx-gateway-threshold-enforcement.ts
//
// recon:fx-gateway-threshold-enforcement — the FX pre-trade gateway's
// capital-impact and funding checks must ENFORCE the CRO-ratified threshold
// schedule and may never regress to approve-always while
// D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS stands approved (CRO, 2026-06-10;
// funding leg co-owned by Ravi, Treasury / ALM engineer, engineering).
//
// Three assertion families:
//
//   (A) SOURCE — both gateway paths call the shared evaluators:
//       - dashboard/markets-fx-gateway.ts (sync pipeline) must call
//         evaluateCapitalImpact and evaluateFundingImpact and still run the
//         "capital-impact" + "funding" check kinds;
//       - runtime/agents/kai-credit-capital-funding-check.ts (async handler)
//         must call both evaluators;
//       - the retired capital-funding-stub.json must not be referenced by
//         any production module (tests/scripts excluded — historical text).
//
//   (B) SCHEDULE — the ratified schedule stays derivable and coherent:
//       - pro-forma RWA ceiling = floor((capital envelope − headroom floor) /
//         operating minimum total capital ratio), positive, and above the
//         ICAAP v1 current-RWA baseline (a ceiling below the baseline would
//         silently reject everything — a mis-calibration, not a posture);
//       - the post-trade LCR floor equals the RAS appetite:liquidity:lcr
//         amber lower bound (RAS §B3 red boundary) and is ≥ the BCBS 238
//         regulatory minimum.
//
//   (C) BEHAVIOUR — the evaluators actually reject a breach (approve-always
//       cannot hide behind intact call-sites):
//       - a capital breach (notional pushing pro-forma RWA past the ceiling)
//         REJECTS, and an unknown instrument class REJECTS (fail-closed);
//       - a funding breach (post-trade LCR below the RAS floor) REJECTS;
//       - a small order PASSES both (the gate proves enforcement, not a
//         reject-always stub).
//
// Standing authority: D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS (CRO-approved
// 2026-06-10). If that decision is ever superseded, this gate is amended by
// the superseding decision — it does not silently lapse.
// Citations: D-RAS; RAS §B3; ORG-PR-01; RAS-B1; Reg38-CRE20; BCBS-238-LCR;
//   D-FX-GATEWAY-CREDIT-LIMIT-FAIL-CLOSED (posture precedent).
//
// Author: Helena (Chief Risk Officer, governance) — threshold authority;
//   gate co-located with the register it guards.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluateCapitalImpact,
  evaluateFundingImpact,
  fxGatewayThresholdSchedule,
} from "../risk/fx-gateway-thresholds";
import type { ReconResult, ReconViolation } from "./types";

const PIPELINE = "fx-gateway-threshold-enforcement";

const REPO_PROTOTYPE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Production modules that must reference the evaluators / must not reference the stub. */
const SYNC_GATEWAY_PATH = "dashboard/markets-fx-gateway.ts";
const ASYNC_HANDLER_PATH = "runtime/agents/kai-credit-capital-funding-check.ts";

export interface SourceFiles {
  /** Contents of dashboard/markets-fx-gateway.ts. */
  readonly syncGateway: string;
  /** Contents of runtime/agents/kai-credit-capital-funding-check.ts. */
  readonly asyncHandler: string;
}

function loadSourceFiles(): SourceFiles {
  return {
    syncGateway: readFileSync(join(REPO_PROTOTYPE_ROOT, SYNC_GATEWAY_PATH), "utf-8"),
    asyncHandler: readFileSync(join(REPO_PROTOTYPE_ROOT, ASYNC_HANDLER_PATH), "utf-8"),
  };
}

/**
 * Run the gate. `sources` may be injected by tests (e.g. to reconstruct the
 * pre-enforcement approve-always gateway and prove the gate FAILS on it);
 * production runs read the live files.
 */
export function run(opts: { sources?: SourceFiles } = {}): ReconResult {
  const violations: ReconViolation[] = [];
  let asserted = 0;
  const sources = opts.sources ?? loadSourceFiles();

  // ── (A) Source assertions ──────────────────────────────────────────────
  const sourceChecks: ReadonlyArray<{ file: string; text: string; needle: string; why: string }> = [
    {
      file: SYNC_GATEWAY_PATH,
      text: sources.syncGateway,
      needle: "evaluateCapitalImpact(",
      why: "sync gateway capital-impact check no longer calls the shared evaluator (approve-always regression)",
    },
    {
      file: SYNC_GATEWAY_PATH,
      text: sources.syncGateway,
      needle: "evaluateFundingImpact(",
      why: "sync gateway funding check no longer calls the shared evaluator (approve-always regression)",
    },
    {
      file: SYNC_GATEWAY_PATH,
      text: sources.syncGateway,
      needle: '"capital-impact"',
      why: "sync gateway no longer runs the capital-impact check kind",
    },
    {
      file: SYNC_GATEWAY_PATH,
      text: sources.syncGateway,
      needle: '"funding"',
      why: "sync gateway no longer runs the funding check kind",
    },
    {
      file: ASYNC_HANDLER_PATH,
      text: sources.asyncHandler,
      needle: "evaluateCapitalImpact(",
      why: "async handler capital-impact check no longer calls the shared evaluator (approve-always regression)",
    },
    {
      file: ASYNC_HANDLER_PATH,
      text: sources.asyncHandler,
      needle: "evaluateFundingImpact(",
      why: "async handler funding check no longer calls the shared evaluator (approve-always regression)",
    },
  ];
  for (const check of sourceChecks) {
    asserted += 1;
    if (!check.text.includes(check.needle)) {
      violations.push({
        subject: `${check.file} :: ${check.needle}`,
        message: `${check.why}. The capital-impact + funding checks must enforce the ratified threshold schedule while D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS is approved.`,
        severity: "fail",
      });
    }
  }
  // Stub re-introduction check is over CODE lines only — header comments may
  // legitimately narrate that the stub is retired.
  const codeLines = (text: string): string =>
    text
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
      })
      .join("\n");
  for (const [file, text] of [
    [SYNC_GATEWAY_PATH, sources.syncGateway],
    [ASYNC_HANDLER_PATH, sources.asyncHandler],
  ] as const) {
    asserted += 1;
    if (codeLines(text).includes("capital-funding-stub.json")) {
      violations.push({
        subject: `${file} :: capital-funding-stub.json`,
        message:
          "production gateway path references the RETIRED capital-funding-stub.json; thresholds must come from platform/risk/fx-gateway-thresholds.ts (D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS).",
        severity: "fail",
      });
    }
  }

  // ── (B) Schedule coherence ────────────────────────────────────────────
  try {
    const schedule = fxGatewayThresholdSchedule();
    const cap = schedule.capitalImpact;

    asserted += 1;
    const expectedCeiling = Math.floor(
      (cap.totalCapitalEnvelopeMinor - cap.headroomFloorMinor) /
        cap.operatingMinimumTotalCapitalRatio,
    );
    if (cap.proFormaRwaCeilingMinor !== expectedCeiling || cap.proFormaRwaCeilingMinor <= 0) {
      violations.push({
        subject: "schedule.capitalImpact.proFormaRwaCeilingMinor",
        message: `pro-forma RWA ceiling ${cap.proFormaRwaCeilingMinor} does not equal the ratified derivation floor((envelope − headroom floor) / operating ratio) = ${expectedCeiling}.`,
        severity: "fail",
      });
    }

    asserted += 1;
    if (cap.proFormaRwaCeilingMinor <= cap.currentRwaBaselineMinor) {
      violations.push({
        subject: "schedule.capitalImpact",
        message: `pro-forma RWA ceiling ${cap.proFormaRwaCeilingMinor} is at or below the ICAAP v1 current-RWA baseline ${cap.currentRwaBaselineMinor} — every order would reject; recalibrate (CRO).`,
        severity: "fail",
      });
    }

    asserted += 1;
    if (schedule.funding.postTradeLcrFloorPct < schedule.funding.regulatoryMinimumLcrPct) {
      violations.push({
        subject: "schedule.funding.postTradeLcrFloorPct",
        message: `post-trade LCR floor ${schedule.funding.postTradeLcrFloorPct}% undercuts the BCBS 238 regulatory minimum ${schedule.funding.regulatoryMinimumLcrPct}%.`,
        severity: "fail",
      });
    }

    // ── (C) Behavioural assertions ──────────────────────────────────────
    // Capital breach: one order notional that alone overshoots the ceiling.
    asserted += 1;
    const fxWeight = cap.rwaWeightByInstrumentClass["FX-spot"];
    if (fxWeight === undefined) {
      throw new Error(
        "rwa.instrument-weight registry no longer carries FX-spot — the gateway's primary instrument class is unweighted (CRO registry regression)",
      );
    }
    const breachNotionalMinor = Math.ceil((cap.proFormaRwaCeilingMinor / fxWeight) * 2);
    const capitalBreach = evaluateCapitalImpact({
      instrumentClass: "FX-spot",
      notionalMinor: breachNotionalMinor,
      currentRwaMinor: null,
      schedule,
    });
    if (capitalBreach.outcome !== "reject") {
      violations.push({
        subject: "evaluateCapitalImpact :: breach",
        message:
          "a pro-forma RWA breach was APPROVED — the capital-impact check has regressed to approve-always.",
        severity: "fail",
      });
    }

    asserted += 1;
    const unknownClass = evaluateCapitalImpact({
      instrumentClass: "NOT-A-REAL-CLASS",
      notionalMinor: 100,
      currentRwaMinor: null,
      schedule,
    });
    if (unknownClass.outcome !== "reject") {
      violations.push({
        subject: "evaluateCapitalImpact :: unknown-instrument-class",
        message:
          "an unknown instrument class was APPROVED — the fail-closed posture (D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS) has regressed.",
        severity: "fail",
      });
    }

    // Funding breach: notional whose outflow drags LCR below the RAS floor.
    asserted += 1;
    const fnd = schedule.funding;
    const breachPp = fnd.currentLcrBaselinePct - fnd.postTradeLcrFloorPct + 1;
    const fundingBreachNotionalMinor = Math.ceil(
      (breachPp / fnd.outflowImpactPctPerMillionNotional) * 1_000_000 * 100,
    );
    const fundingBreach = evaluateFundingImpact({
      notionalMinor: fundingBreachNotionalMinor,
      currentLcrPct: null,
      schedule,
    });
    if (fundingBreach.outcome !== "reject") {
      violations.push({
        subject: "evaluateFundingImpact :: breach",
        message:
          "a post-trade LCR breach was APPROVED — the funding check has regressed to approve-always.",
        severity: "fail",
      });
    }

    // Pass path: a R1m FX-spot order must clear both checks (proves the gate
    // is enforcement, not a reject-always stub).
    asserted += 1;
    const smallNotionalMinor = 1_000_000_00;
    const capitalPass = evaluateCapitalImpact({
      instrumentClass: "FX-spot",
      notionalMinor: smallNotionalMinor,
      currentRwaMinor: null,
      schedule,
    });
    const fundingPass = evaluateFundingImpact({
      notionalMinor: smallNotionalMinor,
      currentLcrPct: null,
      schedule,
    });
    if (capitalPass.outcome !== "approve" || fundingPass.outcome !== "approve") {
      violations.push({
        subject: "evaluators :: small-order pass path",
        message:
          "a R1m FX-spot order failed the capital-impact or funding check — thresholds are mis-calibrated (reject-always), not enforcing.",
        severity: "fail",
      });
    }
  } catch (err) {
    violations.push({
      subject: "fxGatewayThresholdSchedule()",
      message: `threshold schedule could not be derived: ${err instanceof Error ? err.message : String(err)}`,
      severity: "fail",
    });
  }

  return {
    pipeline: PIPELINE,
    ok: violations.every((v) => v.severity !== "fail"),
    asserted,
    violations,
    asOf: new Date().toISOString(), // wall-clock: recon pipeline infrastructure timestamp
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

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
        ? "fx-gateway-threshold-enforcement passed — both gateway paths enforce the CRO-ratified capital-impact + funding thresholds."
        : "fx-gateway-threshold-enforcement FAILED — a gateway check regressed while D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS is approved; see violations.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
