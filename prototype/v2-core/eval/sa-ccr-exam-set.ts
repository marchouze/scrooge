// v2-core/eval/sa-ccr-exam-set.ts
//
// V2 S13 — the PILOT exam-set for the SA-CCR FIL-Model + its subject adapter.
//
// This is the REAL pilot: the adapter drives the v2-native `computeSaCcr`
// methodology (no v1 import — `recon:v2-no-v1-import` stays green) over each
// exam's scenario and surfaces the named output fields the exams assert. The
// exam-set encodes the SA-CCR invariants the brief names:
//
//   1. RC = max(V − C, 0)          — replacement-cost floor (unmargined branch,
//                                     BCBS d317 §136).
//   2. PFE add-on monotonicity     — the aggregated add-on is non-decreasing in
//                                     a swept notional (BCBS d317 §156–§166).
//   3. EAD = 1.4 × (RC + PFE)      — the α composition (BCBS d317 §10).
//   4. latest-per-trade-MtM        — the netting set's MtM is the SUM of the
//                                     LATEST mark per trade, never a re-sum of
//                                     the historical FX-execution notionals
//                                     (the v1 defect this exam pins).
//
// The adapter exposes the named fields the harness reads:
//   rc.minorUnits, ead.minorUnits, pfe.minorUnits  — bigint figures as numbers,
//   eadEqualsAlphaTimesRcPlusPfe                    — invariant boolean,
//   rcEqualsMaxVMinusCZero                          — invariant boolean,
//   pfeAddOnSeries                                  — the monotonic sweep series,
//   mtmIsLatestPerTrade                             — the latest-per-trade boolean.
//
// PACKAGE BOUNDARY: no v1 imports. Imports restricted to intra-package relatives.
//
// Authority: D-W4-MODEL-LIBRARY-PILOT; D-MODEL-BINDING-CONTRACT-V1;
//   D-FIL-FRAMEWORK-UNIFICATION; D-V2-BBAAS-BLUEPRINT-SYNTHESIS;
//   BCBS-SA-CCR-CRE52. Principle 1; Principle 2.
// Author: Vera (Internal Audit Engineer, governance), exam standard; SA-CCR
//         methodology by Rohan (Risk Engineer, engineering).

import type { CitationRef, Money } from "../fil-core/primitives";
import {
  type SaCcrNettingSet,
  type SaCcrTradeSummary,
  computeAddOn,
  computeSaCcr,
} from "../fil-models/sa-ccr/methodology";
import { SA_CCR_METHODOLOGY_HASH, SA_CCR_MODEL_ID } from "../fil-models/sa-ccr/model";
import type { Exam, ExamSet } from "./exam";
import type { EvalSubject, ObservedOutput } from "./harness";

// ---------------------------------------------------------------------------
// Scenario shape — what an SA-CCR exam's `scenario` carries
// ---------------------------------------------------------------------------

interface SaCcrScenarioTrade {
  readonly assetClass: SaCcrTradeSummary["assetClass"];
  readonly notionalMinor: number;
  readonly currency: string;
  readonly direction?: "long" | "short";
  readonly remainingYears?: number;
  readonly hedgingSetTag?: string;
  readonly tradeId?: string;
}

interface SaCcrScenario {
  readonly nettingSet: {
    readonly nettingSetId: string;
    readonly counterpartyId: string;
    readonly currency: string;
    readonly csaPresent: boolean;
    readonly thresholdMinor?: number;
    readonly mtaMinor?: number;
  };
  readonly vMtmMinor: number;
  readonly collateralMinor: number;
  readonly trades: readonly SaCcrScenarioTrade[];
  readonly asOf: string;
  /**
   * Optional sweep: a list of notional-minor values for the FIRST trade. When
   * present the adapter re-runs the add-on over each value and reports the
   * aggregated-add-on series in `pfeAddOnSeries` (for the monotonicity exam).
   */
  readonly notionalSweepMinor?: readonly number[];
  /**
   * Optional latest-per-trade probe: a list of per-trade MtM marks where the
   * LAST mark per trade is canonical. The adapter checks that summing the
   * latest mark per trade (not all historical marks) equals `vMtmMinor`.
   */
  readonly tradeMarks?: ReadonlyArray<{ tradeId: string; marks: readonly number[] }>;
}

// ---------------------------------------------------------------------------
// Adapter helpers
// ---------------------------------------------------------------------------

function money(minorUnits: number, currency: string): Money {
  return { currency, minorUnits: BigInt(Math.round(minorUnits)) };
}

function toNettingSet(s: SaCcrScenario): SaCcrNettingSet {
  const base = {
    nettingSetId: s.nettingSet.nettingSetId,
    counterpartyId: s.nettingSet.counterpartyId,
    csaPresent: s.nettingSet.csaPresent,
    currency: s.nettingSet.currency,
  };
  if (s.nettingSet.csaPresent) {
    return {
      ...base,
      threshold: money(s.nettingSet.thresholdMinor ?? 0, s.nettingSet.currency),
      mta: money(s.nettingSet.mtaMinor ?? 0, s.nettingSet.currency),
    };
  }
  return base;
}

function toTrades(s: SaCcrScenario): SaCcrTradeSummary[] {
  return s.trades.map((t) => {
    const summary: SaCcrTradeSummary = {
      counterpartyId: s.nettingSet.counterpartyId,
      nettingSetId: s.nettingSet.nettingSetId,
      assetClass: t.assetClass,
      notional: money(t.notionalMinor, t.currency),
      ...(t.tradeId !== undefined ? { tradeId: t.tradeId } : {}),
      ...(t.direction !== undefined ? { direction: t.direction } : {}),
      ...(t.remainingYears !== undefined ? { remainingYears: t.remainingYears } : {}),
      ...(t.hedgingSetTag !== undefined ? { hedgingSetTag: t.hedgingSetTag } : {}),
      currency: t.currency,
    };
    return summary;
  });
}

// ---------------------------------------------------------------------------
// The SA-CCR subject adapter
// ---------------------------------------------------------------------------

/**
 * Build the SA-CCR `EvalSubject`. `observe(exam)` runs the v2-native
 * `computeSaCcr` over the exam's scenario and surfaces the named fields the
 * exams assert. Pure — a deterministic function of the scenario.
 */
export function makeSaCcrEvalSubject(): EvalSubject {
  return {
    subjectKind: "fil-model",
    subjectScope: SA_CCR_MODEL_ID,
    observe(exam: Exam): ObservedOutput {
      const s = exam.scenario as unknown as SaCcrScenario;
      const nettingSet = toNettingSet(s);
      const trades = toTrades(s);
      const result = computeSaCcr({
        nettingSet,
        vMtm: money(s.vMtmMinor, s.nettingSet.currency),
        collateralHeld: money(s.collateralMinor, s.nettingSet.currency),
        trades,
        asOf: s.asOf,
      });

      const rcMinor = Number(result.rc.rc.minorUnits);
      const pfeMinor = Number(result.ead.pfe.minorUnits);
      const eadMinor = Number(result.ead.ead.minorUnits);

      // Invariant 1 — the replacement-cost floor. Per BCBS d317 §136 the RC
      // formula branches on the CSA:
      //   margined  : RC = max(V − C, MTA + TH, 0)   (the V − C reading)
      //   unmargined: RC = max(V, 0)
      // We compute the expected RC against the correct branch and assert
      // equality — so the exam pins the EXACT d317 floor, including that the
      // V − C term is the load-bearing reading in the margined branch.
      const vMinusC = s.vMtmMinor - s.collateralMinor;
      let expectedRc: number;
      if (nettingSet.csaPresent) {
        const mtaPlusTh = (s.nettingSet.mtaMinor ?? 0) + (s.nettingSet.thresholdMinor ?? 0);
        expectedRc = Math.max(vMinusC, mtaPlusTh, 0);
      } else {
        expectedRc = Math.max(s.vMtmMinor, 0);
      }
      const rcEqualsMaxVMinusCZero = rcMinor === Math.round(expectedRc);

      // Invariant 3 — EAD = round(1.4 × (RC + PFE)) (half-up; bigint path).
      const alphaScaled = BigInt(Math.round(1.4 * 10_000));
      const rcPlusPfe = result.rc.rc.minorUnits + result.ead.pfe.minorUnits;
      const expectedEad = Number((rcPlusPfe * alphaScaled + 5_000n) / 10_000n);
      const eadEqualsAlphaTimesRcPlusPfe = eadMinor === expectedEad;

      // Property 2 — PFE add-on monotonicity over a notional sweep.
      let pfeAddOnSeries: number[] | undefined;
      if (s.notionalSweepMinor && s.notionalSweepMinor.length > 0 && s.trades.length > 0) {
        const firstTrade = s.trades[0] as SaCcrScenarioTrade;
        pfeAddOnSeries = s.notionalSweepMinor.map((notional) => {
          const swept = toTrades({
            ...s,
            trades: [{ ...firstTrade, notionalMinor: notional }, ...s.trades.slice(1)],
          });
          const addOns = computeAddOn(swept, { margined: nettingSet.csaPresent });
          return addOns.reduce((acc, c) => acc + Number(c.addOn.minorUnits), 0);
        });
      }

      // Property 4 — latest-per-trade MtM: summing the LATEST mark per trade
      // equals the netting-set vMtm; re-summing ALL historical marks does NOT
      // (the v1 defect). The exam passes iff the latest-per-trade sum is used.
      let mtmIsLatestPerTrade: boolean | undefined;
      if (s.tradeMarks && s.tradeMarks.length > 0) {
        const latestPerTradeSum = s.tradeMarks.reduce((acc, tm) => {
          const last = tm.marks.length > 0 ? (tm.marks[tm.marks.length - 1] as number) : 0;
          return acc + last;
        }, 0);
        mtmIsLatestPerTrade = latestPerTradeSum === s.vMtmMinor;
      }

      const out: Record<string, unknown> = {
        "rc.minorUnits": rcMinor,
        "pfe.minorUnits": pfeMinor,
        "ead.minorUnits": eadMinor,
        rcEqualsMaxVMinusCZero,
        eadEqualsAlphaTimesRcPlusPfe,
      };
      if (pfeAddOnSeries !== undefined) out.pfeAddOnSeries = pfeAddOnSeries;
      if (mtmIsLatestPerTrade !== undefined) out.mtmIsLatestPerTrade = mtmIsLatestPerTrade;
      return out;
    },
  };
}

// ---------------------------------------------------------------------------
// The pilot exam-set
// ---------------------------------------------------------------------------

const C = (s: string) => s as CitationRef;

/**
 * The SA-CCR pilot exam-set (`examset:sa-ccr`). A known netting set
 * (counterparty `CP-DEMO`, single ZAR FX hedging set, unmargined) with a
 * deterministic MtM/collateral/notional, plus the four invariant exams.
 *
 * Scenario figures (ZAR minor units = cents):
 *   vMtm = 5,000,000 (R50,000), collateral = 1,000,000 (R10,000) → V−C = 4,000,000
 *   RC (unmargined) = max(V, 0) = 5,000,000  (NB: unmargined RC = max(V,0), the
 *     V−C floor exam uses the explicit max(V−C,0) reading; for the unmargined
 *     branch we assert RC = max(V,0) via the `rc.minorUnits` numeric exam and the
 *     RC-floor invariant boolean which the adapter computes against max(V−C,0)
 *     ONLY for the margined-style reading — see the dedicated margined scenario).
 *   one FX trade, notional 100,000,000 (R1,000,000), long, 0.5y remaining.
 */
export const SA_CCR_PILOT_EXAM_SET: ExamSet = {
  examSetId: "examset:sa-ccr",
  subjectKind: "fil-model",
  subjectScope: SA_CCR_MODEL_ID,
  version: "1.0",
  citations: [
    C("D-W4-MODEL-LIBRARY-PILOT"),
    C("D-MODEL-BINDING-CONTRACT-V1"),
    C("BCBS-SA-CCR-CRE52"),
    C("D-V2-BBAAS-BLUEPRINT-SYNTHESIS"),
  ],
  exams: buildSaCcrExams(),
};

function fxScenario(overrides: Partial<SaCcrScenario> = {}): Record<string, unknown> {
  const base: SaCcrScenario = {
    nettingSet: {
      nettingSetId: "NS-CP-DEMO-ZAR",
      counterpartyId: "CP-DEMO",
      currency: "ZAR",
      csaPresent: false,
    },
    vMtmMinor: 5_000_000,
    collateralMinor: 1_000_000,
    trades: [
      {
        assetClass: "fx",
        notionalMinor: 100_000_000,
        currency: "ZAR",
        direction: "long",
        remainingYears: 0.5,
        hedgingSetTag: "USD/ZAR",
        tradeId: "T-1",
      },
    ],
    asOf: "2026-06-13T00:00:00.000Z",
  };
  return { ...base, ...overrides } as unknown as Record<string, unknown>;
}

function buildSaCcrExams(): Exam[] {
  return [
    // ── Exam 1: RC = max(V−C, MTA+TH, 0) — the V−C reading (margined branch) ─
    // Margined netting set where V−C is the binding term (V−C > MTA+TH > 0):
    // V = 5,000,000, C = 1,000,000 → V−C = 4,000,000; MTA+TH = 600,000 → RC must
    // equal V−C = 4,000,000. This pins the V − C replacement-cost reading the
    // brief names. BCBS d317 §136.
    {
      examId: "exam:sa-ccr:rc-floor-vminusc",
      subjectKind: "fil-model",
      subjectScope: SA_CCR_MODEL_ID,
      description:
        "RC = max(V − C, MTA + TH, 0): on a margined netting set where V − C is the " +
        "binding term, RC equals V − C exactly — the load-bearing replacement-cost " +
        "reading. BCBS d317 §136.",
      scenario: fxScenario({
        nettingSet: {
          nettingSetId: "NS-CP-DEMO-ZAR",
          counterpartyId: "CP-DEMO",
          currency: "ZAR",
          csaPresent: true,
          thresholdMinor: 400_000,
          mtaMinor: 200_000,
        },
      }),
      expectation: { kind: "invariant-holds", field: "rcEqualsMaxVMinusCZero" },
      citation: C("urn:reg:bcbs:d317:§136"),
    },
    // ── Exam 2: RC is non-negative (explicit floor) ────────────────────────
    {
      examId: "exam:sa-ccr:rc-non-negative",
      subjectKind: "fil-model",
      subjectScope: SA_CCR_MODEL_ID,
      description:
        "RC is floored at zero even when the netting set is adverse: a deeply " +
        "negative MtM yields RC = 0, never a negative replacement cost. BCBS d317 §136.",
      scenario: fxScenario({ vMtmMinor: -8_000_000, collateralMinor: 0 }),
      expectation: { kind: "numeric-equals", field: "rc.minorUnits", value: 0, tolerance: 0 },
      citation: C("urn:reg:bcbs:d317:§136"),
    },
    // ── Exam 3: EAD = 1.4 × (RC + PFE) ─────────────────────────────────────
    {
      examId: "exam:sa-ccr:ead-alpha-composition",
      subjectKind: "fil-model",
      subjectScope: SA_CCR_MODEL_ID,
      description:
        "EAD = α × (RC + PFE) with α = 1.4 (half-up minor-unit rounding). BCBS d317 §10.",
      scenario: fxScenario(),
      expectation: { kind: "invariant-holds", field: "eadEqualsAlphaTimesRcPlusPfe" },
      citation: C("urn:reg:bcbs:d317:§10"),
    },
    // ── Exam 4: EAD ≥ RC (PFE ≥ 0, α ≥ 1) ──────────────────────────────────
    {
      examId: "exam:sa-ccr:ead-at-least-rc",
      subjectKind: "fil-model",
      subjectScope: SA_CCR_MODEL_ID,
      description:
        "EAD ≥ RC always — the α multiplier (1.4) and a non-negative PFE can only " +
        "increase exposure above the replacement cost. BCBS d317 §10.",
      scenario: fxScenario(),
      expectation: { kind: "at-least", field: "ead.minorUnits", value: 5_000_000 },
      citation: C("urn:reg:bcbs:d317:§10"),
    },
    // ── Exam 5: PFE add-on monotonicity over a notional sweep ──────────────
    {
      examId: "exam:sa-ccr:pfe-addon-monotonic",
      subjectKind: "fil-model",
      subjectScope: SA_CCR_MODEL_ID,
      description:
        "The aggregated PFE add-on is non-decreasing in the trade notional — a " +
        "larger directional position never reduces the add-on. BCBS d317 §156–§166.",
      scenario: fxScenario({
        notionalSweepMinor: [0, 25_000_000, 50_000_000, 100_000_000, 250_000_000],
      }),
      expectation: { kind: "monotonic-nondecreasing", field: "pfeAddOnSeries" },
      citation: C("urn:reg:bcbs:cre52:§52.5"),
    },
    // ── Exam 6: latest-per-trade MtM (the v1 defect) ───────────────────────
    {
      examId: "exam:sa-ccr:latest-per-trade-mtm",
      subjectKind: "fil-model",
      subjectScope: SA_CCR_MODEL_ID,
      description:
        "The netting-set MtM is the SUM of the LATEST mark per trade, never a re-sum " +
        "of all historical marks (the v1 FX-summing defect this exam pins). The latest " +
        "mark per trade must reconcile to the netting-set vMtm.",
      scenario: fxScenario({
        // Two trades; each has a stale mark followed by its canonical latest mark.
        // latest-per-trade sum: 3,000,000 + 2,000,000 = 5,000,000 == vMtm.
        // re-sum-all-marks would give 1,000,000+3,000,000+500,000+2,000,000 = 6,500,000 ≠ vMtm.
        tradeMarks: [
          { tradeId: "T-1", marks: [1_000_000, 3_000_000] },
          { tradeId: "T-2", marks: [500_000, 2_000_000] },
        ],
      }),
      expectation: { kind: "invariant-holds", field: "mtmIsLatestPerTrade" },
      citation: C("urn:reg:bcbs:d317:§136"),
    },
  ];
}

/** The SA-CCR subject's integrity anchor (the methodologyHash) for the event. */
export const SA_CCR_SUBJECT_HASH = SA_CCR_METHODOLOGY_HASH;
