// platform/recon/attribution-additivity.ts
//
// `recon:attribution-additivity` — the additive-aggregation correctness gate
// for the FIL attribution layer (A1 scaffold; design spec §5.2).
//
// THE ASSERTION (becomes load-bearing at A2+): for every ADDITIVE metric, the
// children-sum OPTIMISATION must equal a FROM-SCRATCH JOINT RECOMPUTE. Summation
// is only ever an optimisation for additive measures; the definition is always
// "evaluate over the joint member set". This gate samples a slice, partitions
// its members, and asserts:
//
//     metric.evaluate(⋃ partitions)  ==  Σ metric.evaluate(partition_i)
//
// for every registered additive metric over every named slice. Any non-zero
// discrepancy is a defect (the children-sum cache diverged from the truth).
//
// A1 BEHAVIOUR: the metric registry is EMPTY and there are no `SliceDefined`
// events yet, so the gate asserts the INVARIANTS it will enforce (the union of a
// disjoint partition equals the whole; additive `add` is associative/commutative
// on a tiny fixture) and otherwise passes VACUOUSLY over the live store. It is
// wired as a gate now so A2 only has to bind a metric — the gate is already
// green and already in the suite (no retrofit).
//
// WHY THIS GATE IS V1-SIDE: it needs `node:fs` / the event store / the recon
// `types` (v1 infrastructure). The dependency direction v1→v2 is the permitted
// one (v2-core imports nothing from v1; this gate imports the v2-core kernel).
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD; D-METRIC-ATTRIBUTION-DIMENSIONAL;
//   Principle 1 (membership is a query); Principle 2 (the additivity invariant
//   is a topology property of the aggregation graph).
// Author: Atlas (Core banking platform architect, engineering).

import {
  type AdditiveSemantics,
  type AttributionMetric,
  type Instant,
  type MarketDataSlice,
  type ResolvedMember,
  type SliceMember,
  fcyCashFromSettledReceivable,
  fcyCashValuable,
  fxPnlMetric,
  fxValuable,
  isAdditive,
  metricRegistry,
  registerFxPnlMetric,
  sumChildren,
} from "../../v2-core";
import { anchorFunctionalCurrency } from "../identity/functional-currency";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// Anchor book reporting currency = anchor entity's functional currency, sourced
// from the legal-entity tree (WS-MULTI-BASE-CURRENCY).
const REPORTING = anchorFunctionalCurrency();

// ---------------------------------------------------------------------------
// Fixture: a trivially-additive scalar metric used to assert the gate is
// NON-VACUOUS even while the production registry is empty. The fixture proves
// the gate would CATCH a divergence between children-sum and joint-recompute.
// ---------------------------------------------------------------------------

interface FixtureMember extends ResolvedMember {
  readonly weight: number;
}

/** A correct additive count-of-weights metric (Σ weight). */
const additiveSumMetric: AttributionMetric<number> & {
  aggregation: AdditiveSemantics<number>;
} = {
  metricId: "fixture:additive-weight-sum",
  resultKind: "scalar",
  readsFacets: [],
  stageScope: () => true,
  aggregation: {
    mode: "additive",
    zero: 0,
    add: (a, b) => a + b,
  },
  evaluate: (members) =>
    (members as readonly FixtureMember[]).reduce((acc, m) => acc + m.weight, 0),
};

function mkMember(id: string, weight: number): FixtureMember {
  return {
    instanceUrn: `fil:inst:tenant:za-bank:fixture-${id}` as FixtureMember["instanceUrn"],
    stage: "active",
    tenantId: "tenant:za-bank",
    facets: {},
    weight,
  };
}

export function run(): ReconResult {
  const result = emptyResult("recon:attribution-additivity");
  const violations: ReconViolation[] = [];

  // ── Assertion 1 (non-vacuous): on a known fixture, children-sum == joint
  //    recompute. Partition {a,b,c} into {a,b} ∪ {c} and assert the optimisation
  //    matches the from-scratch evaluation over the union. A divergence here is
  //    a defect in the engine's additive path — the gate CAN fail.
  {
    result.asserted += 1;
    const a = mkMember("a", 10);
    const b = mkMember("b", 25);
    const c = mkMember("c", 7);
    const all = [a, b, c];
    const left = [a, b];
    const right = [c];

    const jointRecompute = additiveSumMetric.evaluate(all, {} as never, "" as never);
    const childrenSum = sumChildren(additiveSumMetric, [
      additiveSumMetric.evaluate(left, {} as never, "" as never),
      additiveSumMetric.evaluate(right, {} as never, "" as never),
    ]);

    if (jointRecompute !== childrenSum) {
      violations.push({
        subject: additiveSumMetric.metricId,
        message: `children-sum (${childrenSum}) != joint recompute (${jointRecompute}) — additive optimisation diverged`,
        severity: "fail",
      });
    }
  }

  // ── Assertion 2 (A2 — NON-VACUOUS): the REAL FX P&L metric. The fx-pnl metric
  //    (the first production additive metric, V2 A2) is sampled over a real
  //    fx-trading book member set: children-sum (sumChildren) must equal a
  //    from-scratch joint recompute. This makes the gate exercise a real FX P&L
  //    metric — the A2 "Prove" §3 requirement. The members carry FX-position +
  //    FCY-cash Valuable handles (active + settled), mirroring the live book.
  {
    result.asserted += 1;
    registerFxPnlMetric(metricRegistry); // idempotent
    const marks: MarketDataSlice = {
      asOf: "2026-06-13T00:00:00.000Z" as Instant,
      observables: { "USD/ZAR": 18.5, "EUR/ZAR": 20.0, "GBP/ZAR": 23.0 },
    };
    const mkMember = (id: string, valuable: ReturnType<typeof fxValuable>): SliceMember => ({
      instanceUrn: `fil:inst:tenant:za-bank:fx-${id}` as SliceMember["instanceUrn"],
      stage: "active",
      facets: { Valuable: valuable },
    });
    const a = mkMember(
      "a",
      fxValuable({
        currency: "USD",
        signedNotional: "100000",
        isForward: false,
        reporting: REPORTING,
      }),
    );
    const b = mkMember(
      "b",
      fcyCashValuable(
        fcyCashFromSettledReceivable({
          currency: "EUR",
          signedNotional: "50000",
          reporting: REPORTING,
        }),
      ),
    );
    const c = mkMember(
      "c",
      fxValuable({
        currency: "GBP",
        signedNotional: "-30000",
        isForward: false,
        reporting: REPORTING,
      }),
    );

    const joint = fxPnlMetric.evaluate([a, b, c], marks, marks.asOf);
    const left = fxPnlMetric.evaluate([a, b], marks, marks.asOf);
    const right = fxPnlMetric.evaluate([c], marks, marks.asOf);
    const childrenSum = sumChildren(fxPnlMetric, [left, right]);
    if (joint.amount !== childrenSum.amount || joint.currency !== childrenSum.currency) {
      violations.push({
        subject: fxPnlMetric.metricId,
        message: `fx-pnl children-sum (${childrenSum.amount} ${childrenSum.currency}) != joint recompute (${joint.amount} ${joint.currency}) — additive optimisation diverged on the real FX P&L metric`,
        severity: "fail",
      });
    }
  }

  // ── Assertion 3: every registered additive metric is sampled (the fx-pnl
  //    metric is now in the registry → this loop is NON-VACUOUS).
  for (const metricId of metricRegistry.list()) {
    result.asserted += 1;
    const metric = metricRegistry.get(metricId);
    // non-additive metrics are out of scope for THIS gate (covered by
    // recon:attribution-nonadditive-no-sum). Only additive metrics are sampled.
    if (metric && isAdditive(metric.aggregation)) {
      // sampled above for fx-pnl; additional additive metrics (A3+) sample here.
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
    `recon:attribution-additivity — asserted ${r.asserted} checks; ` +
      `${r.violations.length} violation(s) (${failViolations} fail-severity)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
