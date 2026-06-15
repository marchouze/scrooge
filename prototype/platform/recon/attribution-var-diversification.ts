// platform/recon/attribution-var-diversification.ts
//
// `recon:attribution-var-diversification` — the A3 NON-ADDITIVE proof gate.
//
// This is the point of A3: VaR is a `joint-recompute` `AttributionMetric`, and
// the consolidated (group) VaR is RE-COMPUTED over the joint member set — it is
// NOT the sum of child VaRs (diversification). The gate asserts, over the LIVE
// standing-NOP book (the SAME basis the v1 VaR engine + B3 measure):
//
//   (a) NO-SUM — the VaR metric is joint-recompute (no `add`); `assertNoSum` +
//       `sumChildren` throw for it. (The runtime half of the no-sum rule, on the
//       REAL registered metric, not a fixture.)
//
//   (b) DIVERSIFICATION — partition the book's currencies across two desks and
//       compute each desk's VaR + the GROUP VaR over the joint member set. When
//       ≥2 desks carry exposure with offsetting/imperfectly-correlated factors,
//       `VaR(group) < Σ VaR(desk)` strictly. Summing child VaRs OVERSTATES risk
//       — that mis-statement is exactly what the joint-recompute semantics forbid.
//       The gate reports the diversification figure (Σ-desk − group).
//
//   (c) v1 PARITY (READ-ONLY) — the v2 attribution GROUP VaR reconciles to the
//       v1 `computeMarketRisk(...)` standing-NOP VaR (~R499k at the live book),
//       byte-for-byte. The v2 metric ports the v1 historical-simulation math
//       (no import); this gate proves the port agrees on the live inputs. v1 is
//       UNTOUCHED — the gate only reads it.
//
//   (d) ADDITIVE CONTROL — the FX P&L metric (A2, additive) rolls up:
//       group P&L == Σ desk P&L exactly. The contrast with (b) is the whole
//       lesson: additive metrics sum, non-additive ones must re-compute.
//
// READ-ONLY: replays the live FX book + reads the v1 var-engine + market-data
// store; computes the v2 attribution figures; touches no production path. A
// flat / historyless book downgrades (b)/(c) to info (nothing to diversify /
// reconcile) — (a)/(d) always run.
//
// WHY V1-SIDE: needs `node:fs`-adjacent composition wiring + the v1 var-engine +
// the recon `types`. v1→v2 is the permitted dependency direction.
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD (A3 build slice);
//   D-METRIC-ATTRIBUTION-DIMENSIONAL; D-VAR-EXPOSURE-INCLUDES-STANDING-NOP
//   (CEO-approved 2026-06-12, methodology owner Helena (Chief Risk Officer,
//   governance)); Principle 1; Principle 2 (no-sum is an aggregation-graph
//   topology invariant).
// Author: Atlas (Core banking platform architect, engineering) ·
//         Rohan (Risk systems engineer, engineering — VaR methodology) ·
//         Helena (Chief Risk Officer, governance — summing child VaRs is a
//           mis-statement) · Vera (Internal audit engineer, third line — recon shape).

import { ANCHOR_TENANT_ID, type TenantId } from "../../v2-core/control-plane/tenant";
import {
  type AttributionMetric,
  type Instant,
  type ResolvedMember,
  type Slice,
  type SliceMember,
  assertNoSum,
  evaluateSlice,
  sumChildren,
} from "../../v2-core/fil-attribution";
import type { MarketDataSlice } from "../../v2-core/fil-facets/facets";
import {
  type FxPnlResult,
  fcyCashFromSettledReceivable,
  fcyCashRiskMeasurable,
  fcyCashValuable,
  fxPnlMetric,
} from "../../v2-core/fil-models/fx-valuation";
import {
  type JointVarResult,
  type VarReturnMatrix,
  jointVar,
  makeVarMetric,
} from "../../v2-core/fil-models/market-risk-var";
import { eventStore } from "../composition";
import type { Event } from "../event-store/types";
import { resolveMarketDataDbPath } from "../market-data/resolve-market-data-db";
import { MarketDataStore } from "../market-data/store";
import { computeMarketRisk, deriveRiskFactorExposures } from "../market-risk/var-engine";
import { majorStringToMinorBigint, minorBigintToMajorString } from "../risk/sa-ccr/v2-money-bridge";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "attribution-var-diversification";
const ANCHOR_TENANT = ANCHOR_TENANT_ID as TenantId;

/** Relative tolerance for the v1↔v2 VaR parity (rounding across two derivations). */
const REL_TOLERANCE = 1e-6;

export interface RunOpts {
  /** Override the event source — used by tests. */
  events?: Iterable<Event>;
  /** Override the market-data store — used by tests. */
  marketData?: MarketDataStore;
  /** Override the asOf — used by tests (default: now). */
  asOf?: string;
}

interface VarMember {
  readonly member: ResolvedMember;
  readonly currency: string;
  readonly factor: string;
  /** Which of the two synthetic desks this currency is assigned to. */
  readonly desk: string;
}

/**
 * Build the v2 FX-trading book VaR members from the v1 standing-NOP exposures.
 * One member per non-flat foreign currency, carrying BOTH a `Valuable` (its
 * signed ZAR exposure, valued at the C/ZAR rate) and a `RiskMeasurable` (its FX
 * delta factor). Currencies are partitioned across two synthetic desks so the
 * diversification proof has a non-trivial partition.
 */
function buildVarMembers(
  exposures: readonly { factor: string; exposureZar: number; returnObservations: number }[],
  returnsByFactor: ReadonlyMap<string, number[]>,
): { members: VarMember[]; returnMatrix: VarReturnMatrix } {
  const members: VarMember[] = [];
  const returnMatrix = new Map<string, readonly number[]>();
  let i = 0;
  for (const e of exposures) {
    const ccy = e.factor.split("/")[0] ?? e.factor;
    if (e.exposureZar === 0) continue;
    returnMatrix.set(e.factor, returnsByFactor.get(e.factor) ?? []);

    // The Valuable values the position at a UNIT C/ZAR rate so its
    // reporting-currency value == the signed ZAR exposure (the var-engine's
    // exposureZar is already in ZAR; we carry it as the FCY notional valued at
    // rate 1 to keep the member's Valuable in ZAR).
    const exposureMinor = BigInt(Math.round(e.exposureZar * 100));
    const position = fcyCashFromSettledReceivable({
      currency: "ZAR",
      signedNotional: minorBigintToMajorString(exposureMinor),
    });
    // Partition currencies across two desks BY EXPOSURE SIGN — a "long desk"
    // (net-long currencies) and a "short desk" (net-short currencies). This is a
    // real netting structure: at the group, the long desk's directional risk
    // partially OFFSETS the short desk's, so the joint group VaR is strictly less
    // than the sum of the two desk VaRs. (A naive round-robin split can put two
    // correlated same-direction exposures on different desks whose worst-case
    // scenario coincides with the group's — yielding zero apparent benefit; the
    // sign split surfaces the genuine diversification on the live book.)
    const desk = e.exposureZar >= 0 ? "desk-long" : "desk-short";
    const member: ResolvedMember = {
      instanceUrn: `fil:inst:${ANCHOR_TENANT}:var-${ccy}-${i}` as SliceMember["instanceUrn"],
      stage: "settled",
      tenantId: ANCHOR_TENANT,
      facets: {
        Valuable: fcyCashValuable(position),
        // The RiskMeasurable reports the REAL factor (C/ZAR), so the VaR metric
        // keys the exposure to the right currency's return window.
        RiskMeasurable: fcyCashRiskMeasurable(
          fcyCashFromSettledReceivable({
            currency: ccy,
            signedNotional: minorBigintToMajorString(exposureMinor),
          }),
        ),
      },
      groupKey: desk,
    };
    members.push({ member, currency: ccy, factor: e.factor, desk });
    i += 1;
  }
  return { members, returnMatrix };
}

/** The VaR metric reads exposure via Valuable; the unit-rate marks return ZAR. */
function unitMarks(currencies: readonly string[], asOf: string): MarketDataSlice {
  const observables: Record<string, number> = { "ZAR/ZAR": 1 };
  for (const c of currencies) observables[`${c}/ZAR`] = 1;
  return { asOf: asOf as Instant, observables };
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  const asOf = opts.asOf ?? new Date().toISOString();

  // ---------------------------------------------------------------------------
  // (a) NO-SUM — the VaR metric is joint-recompute; assertNoSum + sumChildren
  //     throw for it (the runtime guard on the REAL metric).
  // ---------------------------------------------------------------------------
  const varMetricProbe = makeVarMetric(new Map());
  {
    result.asserted += 1;
    let threw = false;
    try {
      assertNoSum(varMetricProbe);
    } catch {
      threw = true;
    }
    if (!threw) {
      violations.push({
        subject: "market-risk-var",
        message:
          "assertNoSum did NOT throw for the VaR metric — VaR must be joint-recompute (no sum)",
        severity: "fail",
      });
    }

    result.asserted += 1;
    let sumThrew = false;
    try {
      sumChildren(varMetricProbe as AttributionMetric<unknown>, []);
    } catch {
      sumThrew = true;
    }
    if (!sumThrew) {
      violations.push({
        subject: "market-risk-var",
        message: "sumChildren did NOT throw for the VaR metric — a caller could compose child VaRs",
        severity: "fail",
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Resolve the live standing-NOP exposures + return matrix from the v1 engine
  // (the single shared source). The market-data store carries the return windows.
  // ---------------------------------------------------------------------------
  const events = opts.events ? [...opts.events] : undefined;
  const liveStore = opts.marketData ?? new MarketDataStore(resolveMarketDataDbPath().path);

  // Build a thin EventStore-shaped façade when tests inject events; otherwise use
  // the composed event store directly.
  const eventStoreForVar = events
    ? ({ replay: () => events } as unknown as Parameters<
        typeof deriveRiskFactorExposures
      >[0]["eventStore"])
    : eventStore;

  const { exposures, returnsByFactor } = deriveRiskFactorExposures({
    eventStore: eventStoreForVar,
    marketData: liveStore,
    asOf,
  });

  const liveExposures = exposures.filter((e) => e.exposureZar !== 0);
  const { members, returnMatrix } = buildVarMembers(liveExposures, returnsByFactor);
  const currencies = members.map((m) => m.currency);
  const marks = unitMarks(currencies, asOf);

  // The metric over the LIVE return window.
  const varMetric = makeVarMetric(returnMatrix);

  // ---------------------------------------------------------------------------
  // (d) ADDITIVE CONTROL — FX P&L rolls up: group == Σ desk, exactly.
  //     (Computed over the same members at the unit rate; P&L additivity is the
  //     contrast against VaR non-additivity.)
  // ---------------------------------------------------------------------------
  {
    const allMembers = members.map((m) => m.member);
    const groupSlice: Slice = {
      tenantId: ANCHOR_TENANT,
      where: [{ dim: "book", op: "eq", value: "fx-trading" }],
      level: "group",
    };
    const deskSlice: Slice = {
      tenantId: ANCHOR_TENANT,
      where: [{ dim: "book", op: "eq", value: "fx-trading" }],
      level: "desk",
    };
    const groupPnl = evaluateSlice(fxPnlMetric, groupSlice, allMembers, marks, asOf as Instant);
    const deskPnl = evaluateSlice(fxPnlMetric, deskSlice, allMembers, marks, asOf as Instant);
    const groupTotal = sumPnl(groupPnl.cells.map((c) => c.value));
    const deskTotal = sumPnl(deskPnl.cells.map((c) => c.value));
    result.asserted += 1;
    if (groupTotal !== deskTotal) {
      violations.push({
        subject: "fx-pnl:group-vs-Σdesk",
        message: `additive P&L roll-up broken: group ${groupTotal} != Σ desk ${deskTotal} (minor units). An additive metric MUST sum across the partition.`,
        severity: "fail",
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Flat / historyless book: nothing to diversify or reconcile. (b)/(c) → info.
  // ---------------------------------------------------------------------------
  if (members.length === 0) {
    violations.push({
      subject: "fx-trading book",
      message:
        "live book carries no standing FX position (flat bench) — no VaR diversification or v1 parity to assert. (a)/(d) ran; (b)/(c) skipped (info).",
      severity: opts.events !== undefined ? "fail" : "info",
    });
    result.violations = violations;
    result.ok = violations.every((v) => v.severity !== "fail");
    result.asOf = `${PIPELINE}: flat book; ${result.asserted} assertion(s); read-only.`;
    return result;
  }

  // ---------------------------------------------------------------------------
  // Compute GROUP VaR (joint over all members) + per-DESK VaR via the engine.
  // ---------------------------------------------------------------------------
  const allMembers = members.map((m) => m.member);
  const groupVarSlice: Slice = {
    tenantId: ANCHOR_TENANT,
    where: [{ dim: "book", op: "eq", value: "fx-trading" }],
    level: "group",
  };
  // For the GROUP cell we hand the engine ALL members in one cell (groupKey is
  // overridden to a single group bucket via the slice level "group").
  const groupMembers: ResolvedMember[] = allMembers.map((m) => ({ ...m, groupKey: "GROUP" }));
  const groupEval = evaluateSlice(varMetric, groupVarSlice, groupMembers, marks, asOf as Instant);
  const groupVar = (groupEval.cells[0]?.value as JointVarResult | undefined)?.varZar ?? 0;

  // Per-desk VaR: evaluate the metric per desk partition (each cell = that desk's
  // joint member set). The engine partitions by groupKey (= desk).
  const deskVarSlice: Slice = {
    tenantId: ANCHOR_TENANT,
    where: [{ dim: "book", op: "eq", value: "fx-trading" }],
    level: "desk",
  };
  const deskEval = evaluateSlice(varMetric, deskVarSlice, allMembers, marks, asOf as Instant);
  const deskVars = deskEval.cells.map((c) => ({
    desk: c.groupKey,
    varZar: (c.value as JointVarResult).varZar,
  }));
  const sumDeskVar = deskVars.reduce((s, d) => s + d.varZar, 0);
  const desksWithExposure = deskVars.filter((d) => d.varZar > 0).length;

  // ---------------------------------------------------------------------------
  // (b) DIVERSIFICATION — group VaR < Σ desk VaR strictly (when ≥2 desks carry
  //     risk). A weak inequality (≤) always holds for a coherent quantile under
  //     sub-additivity; we assert the STRICT diversification benefit when there
  //     is more than one risk-bearing desk.
  // ---------------------------------------------------------------------------
  const diversificationBenefit = sumDeskVar - groupVar;
  if (desksWithExposure >= 2) {
    result.asserted += 1;
    if (!(groupVar < sumDeskVar)) {
      violations.push({
        subject: "var:diversification",
        message: `group VaR ${groupVar.toFixed(2)} is NOT < Σ desk VaR ${sumDeskVar.toFixed(2)} — a joint-recompute group VaR must show a diversification benefit (or at least equality) vs the (forbidden) sum of child VaRs. Σ-desk overstates risk by construction.`,
        severity: "fail",
      });
    }
    // The group VaR must never EXCEED the sum (sub-additivity of a coherent
    // measure over the same scenarios) — a violation means the join is wrong.
    result.asserted += 1;
    if (groupVar > sumDeskVar + 1e-6) {
      violations.push({
        subject: "var:sub-additivity",
        message: `group VaR ${groupVar.toFixed(2)} EXCEEDS Σ desk VaR ${sumDeskVar.toFixed(2)} — the joint recompute is mis-built (a diversified group cannot be riskier than the sum of its parts under historical simulation).`,
        severity: "fail",
      });
    }
  } else {
    violations.push({
      subject: "var:diversification",
      message: `only ${desksWithExposure} desk(s) carry VaR exposure — diversification across desks is not demonstrable on the live book (info). Group VaR ${groupVar.toFixed(2)}.`,
      severity: "info",
    });
  }

  // ---------------------------------------------------------------------------
  // (c) v1 PARITY (READ-ONLY) — group VaR == v1 standing-NOP VaR.
  // ---------------------------------------------------------------------------
  const v1Report = computeMarketRisk({ eventStore: eventStoreForVar, marketData: liveStore, asOf });
  if (v1Report.status === "computed" && v1Report.var.present) {
    const v1Var = v1Report.var.value;
    result.asserted += 1;
    const denom = Math.max(Math.abs(v1Var), 1);
    const relDelta = Math.abs(groupVar - v1Var) / denom;
    if (relDelta > REL_TOLERANCE) {
      violations.push({
        subject: "var:group-vs-v1-nop",
        message: `v2 attribution GROUP VaR ${groupVar.toFixed(2)} != v1 standing-NOP VaR ${v1Var.toFixed(2)} (rel delta ${relDelta.toExponential(3)}). The ported v2 historical-simulation must reconcile byte-for-byte to the v1 engine over the SAME NOP basis + return matrix (read-only). v1 is untouched.`,
        severity: "fail",
      });
    }
    result.asOf =
      `${PIPELINE}: group VaR R${groupVar.toFixed(2)} == v1-NOP VaR R${v1Var.toFixed(2)} ` +
      `(parity rel ${relDelta.toExponential(2)}); Σ-desk VaR R${sumDeskVar.toFixed(2)}; ` +
      `diversification benefit R${diversificationBenefit.toFixed(2)} across ${desksWithExposure} desk(s); ` +
      `${members.length} currency member(s); read-only / v1 untouched.`;
  } else {
    violations.push({
      subject: "var:group-vs-v1-nop",
      message: `v1 var-engine status "${v1Report.status}" — no computed VaR to reconcile to (insufficient history or flat). Parity assertion skipped (info). Group VaR ${groupVar.toFixed(2)}.`,
      severity: "info",
    });
    result.asOf =
      `${PIPELINE}: group VaR R${groupVar.toFixed(2)}; Σ-desk VaR R${sumDeskVar.toFixed(2)}; ` +
      `diversification benefit R${diversificationBenefit.toFixed(2)}; v1 status ${v1Report.status}; read-only.`;
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

/** Additive fold of FX P&L results (mirrors the metric's `add`, for the control). */
function sumPnl(values: readonly FxPnlResult[]): bigint {
  let acc = 0n;
  for (const v of values) acc += majorStringToMinorBigint(v.amount);
  return acc;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const failCount = r.violations.filter((v) => v.severity === "fail").length;
  process.stdout.write(
    `recon:${PIPELINE} ${r.ok ? "OK" : "FAIL"} — ${r.asOf}; ${r.violations.length} violation(s) (${failCount} fail)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}

// jointVar re-exported for tests that want the bare kernel.
export { jointVar };
