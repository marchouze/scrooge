// platform/recon/attribution-nonadditive-no-sum.ts
//
// `recon:attribution-nonadditive-no-sum` — the structural guard FORBIDDING
// summation of non-additive (joint-recompute) metrics in the FIL attribution
// layer (A1 scaffold; design spec §2.2 / §5.2).
//
// THE INVARIANT: a `joint-recompute` metric (VaR, ES, SVaR, IRRBB ΔEVE at the
// diversified level, any tail/quantile measure) is NEVER composed from child
// results — `VaR(group) != VaR(deskA) + VaR(deskB)` (diversification). The
// consolidated value is RE-COMPUTED over the joint member set. Summing child
// VaRs is a known mis-statement that would fail independent validation.
//
// THE GATE HAS TWO HALVES (defence in depth):
//   STATIC  — a `JointRecomputeSemantics` carries NO `add`/`zero`. The recon
//             asserts (over the v2-core kernel source) that the type makes a sum
//             un-expressible: there is no `add` member to call. A regression
//             that added `add` to the joint-recompute variant is caught here.
//   RUNTIME — `assertNoSum(metric)` throws for a joint-recompute metric, and
//             `sumChildren(metric, …)` calls it first. The recon constructs a
//             fixture joint-recompute metric and asserts that BOTH `assertNoSum`
//             and `sumChildren` throw (non-vacuous: the guard CAN fail if the
//             runtime path is removed).
//
// A1 BEHAVIOUR: the production metric registry is empty, so there is no live
// joint-recompute metric to scan; the gate asserts the static + runtime
// invariants on the kernel + a fixture and otherwise passes. Wired now so A3
// (VaR at desk/LE/group) inherits a green, in-suite gate.
//
// WHY V1-SIDE: needs `node:fs` + the recon `types`. v1→v2 is the permitted
// direction.
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD; D-METRIC-ATTRIBUTION-DIMENSIONAL;
//   Principle 2 (the no-sum rule is a topology invariant of the aggregation
//   graph). Risk-advisor: Helena (Chief Risk Officer, governance) — summing
//   child VaRs is a mis-statement.
// Author: Atlas (Core banking platform architect, engineering).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type AttributionMetric,
  type JointRecomputeSemantics,
  assertNoSum,
  isJointRecompute,
  metricRegistry,
  sumChildren,
} from "../../v2-core/fil-attribution";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

/** Path to the kernel metric module (the static-guard source of truth). */
const METRIC_SRC = resolve(import.meta.dir, "..", "..", "v2-core", "fil-attribution", "metric.ts");

/**
 * A fixture joint-recompute metric. By construction it CANNOT carry `add` (the
 * type forbids it); its `evaluate` re-computes over the joint set. Used to prove
 * the runtime guard is non-vacuous.
 */
const jointRecomputeMetric: AttributionMetric<number> & {
  aggregation: JointRecomputeSemantics;
} = {
  metricId: "fixture:joint-recompute-var",
  resultKind: "scalar",
  readsFacets: [],
  stageScope: () => true,
  aggregation: { mode: "joint-recompute" },
  // a stand-in "diversified" measure: max, NOT sum (composing children is wrong)
  evaluate: (members) => members.reduce((mx, _m, i) => Math.max(mx, i + 1), 0),
};

export function run(): ReconResult {
  const result = emptyResult("recon:attribution-nonadditive-no-sum");
  const violations: ReconViolation[] = [];

  // ── STATIC half: the kernel's JointRecomputeSemantics must NOT carry `add`/
  //    `zero`. We assert the interface body contains no `add(` / `zero` member.
  //    A regression that added a summation member to the joint-recompute variant
  //    re-opens the leak and is caught here.
  {
    result.asserted += 1;
    let src = "";
    try {
      src = readFileSync(METRIC_SRC, "utf8");
    } catch (e) {
      violations.push({
        subject: METRIC_SRC,
        message: `cannot read kernel metric source: ${(e as Error).message}`,
        severity: "fail",
      });
    }
    const ifaceMatch = src.match(/export interface JointRecomputeSemantics\s*\{([\s\S]*?)\}/);
    if (!ifaceMatch) {
      violations.push({
        subject: "JointRecomputeSemantics",
        message:
          "could not locate the JointRecomputeSemantics interface in the kernel — the static no-sum guard cannot be asserted",
        severity: "fail",
      });
    } else {
      const body = ifaceMatch[1] ?? "";
      if (/\badd\s*\(/.test(body) || /\bzero\b/.test(body)) {
        violations.push({
          subject: "JointRecomputeSemantics",
          message:
            "joint-recompute semantics declares an `add`/`zero` member — summation must be UN-expressible for a non-additive metric (diversification); remove it",
          severity: "fail",
        });
      }
    }
  }

  // ── RUNTIME half (non-vacuous): assertNoSum + sumChildren must BOTH throw for
  //    a joint-recompute metric. If either silently returns, the guard is dead.
  {
    result.asserted += 1;
    let assertThrew = false;
    try {
      assertNoSum(jointRecomputeMetric);
    } catch {
      assertThrew = true;
    }
    if (!assertThrew) {
      violations.push({
        subject: jointRecomputeMetric.metricId,
        message:
          "assertNoSum did NOT throw for a joint-recompute metric — runtime no-sum guard is dead",
        severity: "fail",
      });
    }

    result.asserted += 1;
    let sumThrew = false;
    try {
      sumChildren(jointRecomputeMetric, [1, 2, 3]);
    } catch {
      sumThrew = true;
    }
    if (!sumThrew) {
      violations.push({
        subject: jointRecomputeMetric.metricId,
        message:
          "sumChildren did NOT throw for a joint-recompute metric — a caller could compose child VaRs",
        severity: "fail",
      });
    }
  }

  // ── LIVE scan: every registered joint-recompute metric is confirmed to carry
  //    no `add` path. A1 registry is empty → vacuous. A3+ registers VaR/ES/SVaR;
  //    each is checked the same way.
  for (const metricId of metricRegistry.list()) {
    const metric = metricRegistry.get(metricId);
    if (!metric || !isJointRecompute(metric.aggregation)) continue;
    result.asserted += 1;
    if ("add" in metric.aggregation || "zero" in metric.aggregation) {
      violations.push({
        subject: metricId,
        message:
          "registered joint-recompute metric exposes an add/zero member — summation must be impossible",
        severity: "fail",
      });
    }
  }

  return {
    ...result,
    violations,
    ok: violations.filter((v) => v.severity === "fail").length === 0,
  };
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const failViolations = r.violations.filter((v) => v.severity === "fail").length;
  process.stdout.write(
    `recon:attribution-nonadditive-no-sum — asserted ${r.asserted} checks; ` +
      `${r.violations.length} violation(s) (${failViolations} fail-severity)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
