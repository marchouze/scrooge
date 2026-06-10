// platform/risk/fx-gateway-thresholds.ts
//
// Ratified pre-trade gateway capital-impact + funding threshold schedule —
// the single typed source BOTH gateway paths evaluate against:
//   - the synchronous gateway pipeline (dashboard/markets-fx-gateway.ts), and
//   - the async check handler (runtime/agents/kai-credit-capital-funding-check.ts).
//
// Authority: D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS (CRO-approved 2026-06-10;
//   Helena, Chief Risk Officer, governance — primary; funding leg co-owned by
//   Ravi (Treasury / ALM engineer, engineering) → Eitan (Treasurer) for
//   ALCO/Treasury). Raised by PR #1181; queue authority D-QUEUE-CLOSEOUT-2026-06-10.
//
// The three ratified sub-decisions (mirroring the requested-phase framing):
//
//   (1) CAPITAL-IMPACT basis — option (a): RAS §B3 capital appetite
//       operationalised as a pro-forma RWA ceiling. The gateway must not admit
//       an order whose pro-forma RWA would consume capital headroom past the
//       RAS amber / CEO-escalation line. Derivation (all named, cited
//       constants — no magic numbers):
//
//         rwaCeiling = (totalCapitalEnvelope − headroomFloor) / operatingMinimumTotalCapitalRatio
//
//       where totalCapitalEnvelope = R300m ICAAP v1 build-phase envelope
//       (`capital.build-phase.total-capital-minor`, CFO), headroomFloor =
//       R100m RAS amber / CEO-escalation headroom (`capital.threshold.
//       ceo-escalation-minor`, CRO, D-RAS), and the operating minimum total
//       capital ratio = 12.0% (`capital.gateway.operating-minimum-total-
//       capital-ratio`: 8.0% Banks Act Reg 38 Pillar-1 base + 2.5% CCB +
//       0.0% Pillar-2A build-phase + 1.5pp RAS §B3 operating buffer).
//       Per-instrument-class RWA weights come from the CRO-owned
//       `rwa.instrument-weight.*` registry (Reg38-CRE20) — an unknown
//       instrument class REJECTS (fail-closed), never silently defaults.
//
//   (2) FUNDING / LCR floor — option (b): the RAS LCR operating buffer, NOT
//       the bare 100% BCBS 238 regulatory minimum. The post-trade LCR floor
//       is sourced LIVE from the RAS appetite register
//       (`appetite:liquidity:lcr`, RAS §B3): the amber band's lower bound —
//       the red / management-action trigger at 110%. The gateway must not
//       admit an order whose estimated post-trade LCR would put the bank
//       inside its own management-action zone.
//
//   (3) GATEWAY POSTURE — fail-closed, mirroring
//       D-FX-GATEWAY-CREDIT-LIMIT-FAIL-CLOSED: unresolvable order fields,
//       an unknown instrument class, or an unavailable threshold input
//       REJECT the order. Sell orders reduce exposure and are admitted
//       without evaluation (consistent with the async handler's standing
//       credit-limit semantics).
//
// Build-phase measurement bindings (each a named, cited constant or an
// event-of-record read — production replaces the baselines, not the logic):
//   - current RWA: latest `RwaComputed` event-of-record in the consulted
//     store (D-RWA-ENGINE-W2-SLICE-3); fallback ICAAP v1 baseline
//     `capital.build-phase.total-rwa-minor` when no event exists yet.
//   - current LCR: `lcr.gateway.build-phase-baseline-pct` until the live LCR
//     observation chain (BA 300 wiring, WS-RETURNS-SUBMISSION-WIRING) lands.
//   - LCR outflow model: `lcr.gateway.outflow-impact-pct-per-million-notional`
//     percentage-points of LCR per R1m ZAR notional (Treasury/ALM-calibrated).
//
// Recon: recon:fx-gateway-threshold-enforcement fails if either gateway path
// regresses to approve-always while this decision stands approved.
//
// Author: Helena (Chief Risk Officer, governance) — threshold authority;
//         Ravi (Treasury / ALM engineer, engineering) — funding-leg co-owner.

import { getFinancialConstant, rwaInstrumentClassWeights } from "../config/financial-constants";
import type { EventStore } from "../event-store/store";
import { requireRasAppetiteLine } from "./ras-appetite-register";

// ---------------------------------------------------------------------------
// Citations
// ---------------------------------------------------------------------------

export const FX_GATEWAY_THRESHOLD_DECISION_ID = "D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS";

export const FX_GATEWAY_CAPITAL_CITATIONS: readonly string[] = [
  FX_GATEWAY_THRESHOLD_DECISION_ID,
  "D-RAS",
  "ORG-PR-01",
  "RAS-B1",
  "Reg38-CRE20",
];

export const FX_GATEWAY_FUNDING_CITATIONS: readonly string[] = [
  FX_GATEWAY_THRESHOLD_DECISION_ID,
  "D-RAS",
  "ORG-PR-01",
  "BCBS-238-LCR",
];

// ---------------------------------------------------------------------------
// Threshold schedule
// ---------------------------------------------------------------------------

/** The ratified, fully-derived threshold schedule (all values in ZAR minor / pct). */
export interface FxGatewayThresholdSchedule {
  /** Decision that ratified this schedule. */
  readonly decisionId: string;
  /** Gateway posture for the two checks. */
  readonly posture: "fail-closed";
  readonly capitalImpact: {
    /** R300m ICAAP v1 build-phase total capital envelope (minor units). */
    readonly totalCapitalEnvelopeMinor: number;
    /** R100m RAS §B3 amber / CEO-escalation headroom floor (minor units). */
    readonly headroomFloorMinor: number;
    /** 12.0% operating minimum total capital ratio (Pillar-1 + CCB + P2A + RAS buffer). */
    readonly operatingMinimumTotalCapitalRatio: number;
    /** Derived pro-forma RWA ceiling (minor units, floored — conservative). */
    readonly proFormaRwaCeilingMinor: number;
    /** ICAAP v1 baseline current RWA used when no RwaComputed event exists. */
    readonly currentRwaBaselineMinor: number;
    /** Reg38-CRE20 instrument-class → RWA weight (CRO-owned registry). */
    readonly rwaWeightByInstrumentClass: Readonly<Record<string, number>>;
  };
  readonly funding: {
    /** Post-trade LCR floor (pct) — RAS §B3 red boundary, sourced from the RAS register. */
    readonly postTradeLcrFloorPct: number;
    /** BCBS 238 regulatory minimum (pct) — sanity lower bound for the floor. */
    readonly regulatoryMinimumLcrPct: number;
    /** Build-phase current-LCR baseline (pct) until the live LCR observation lands. */
    readonly currentLcrBaselinePct: number;
    /** LCR impact in percentage-points per R1m of ZAR notional. */
    readonly outflowImpactPctPerMillionNotional: number;
  };
  readonly citations: readonly string[];
}

/**
 * Build the ratified threshold schedule from the owned constant registry and
 * the RAS appetite register. Pure derivation — every input is a named, cited
 * constant or a register band; this function holds no literal of its own.
 */
export function fxGatewayThresholdSchedule(): FxGatewayThresholdSchedule {
  const totalCapitalEnvelopeMinor = getFinancialConstant("capital.build-phase.total-capital-minor");
  const headroomFloorMinor = getFinancialConstant("capital.threshold.ceo-escalation-minor");
  const operatingMinimumTotalCapitalRatio = getFinancialConstant(
    "capital.gateway.operating-minimum-total-capital-ratio",
  );
  // Conservative floor: never round the ceiling UP.
  const proFormaRwaCeilingMinor = Math.floor(
    (totalCapitalEnvelopeMinor - headroomFloorMinor) / operatingMinimumTotalCapitalRatio,
  );

  // Funding floor: the RAS §B3 LCR amber band's lower bound (== red boundary,
  // the management-action trigger). Sourced from the RAS register so a CRO
  // re-calibration of the appetite line flows through without a code change.
  const lcrLine = requireRasAppetiteLine("appetite:liquidity:lcr");
  if (lcrLine.thresholds.kind !== "ratio") {
    throw new Error(
      "appetite:liquidity:lcr is no longer a ratio appetite line; the FX gateway funding floor cannot be derived (D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS)",
    );
  }
  const amber = lcrLine.thresholds.bands.find((b) => b.band === "amber");
  if (amber?.lowerPct === undefined) {
    throw new Error(
      "appetite:liquidity:lcr has no amber lower bound; the FX gateway funding floor cannot be derived (D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS)",
    );
  }
  const postTradeLcrFloorPct = amber.lowerPct;
  const regulatoryMinimumLcrPct = getFinancialConstant("lcr.minimum-ratio") * 100;
  if (postTradeLcrFloorPct < regulatoryMinimumLcrPct) {
    throw new Error(
      `FX gateway post-trade LCR floor ${postTradeLcrFloorPct}% is below the BCBS 238 regulatory minimum ${regulatoryMinimumLcrPct}% — the RAS operating buffer must never undercut the regulatory floor`,
    );
  }

  return {
    decisionId: FX_GATEWAY_THRESHOLD_DECISION_ID,
    posture: "fail-closed",
    capitalImpact: {
      totalCapitalEnvelopeMinor,
      headroomFloorMinor,
      operatingMinimumTotalCapitalRatio,
      proFormaRwaCeilingMinor,
      currentRwaBaselineMinor: getFinancialConstant("capital.build-phase.total-rwa-minor"),
      rwaWeightByInstrumentClass: rwaInstrumentClassWeights(),
    },
    funding: {
      postTradeLcrFloorPct,
      regulatoryMinimumLcrPct,
      currentLcrBaselinePct: getFinancialConstant("lcr.gateway.build-phase-baseline-pct"),
      outflowImpactPctPerMillionNotional: getFinancialConstant(
        "lcr.gateway.outflow-impact-pct-per-million-notional",
      ),
    },
    citations: [
      FX_GATEWAY_THRESHOLD_DECISION_ID,
      "D-RAS",
      "D-FX-GATEWAY-CREDIT-LIMIT-FAIL-CLOSED",
      "ORG-PR-01",
      "RAS-B1",
      "Reg38-CRE20",
      "BCBS-238-LCR",
    ],
  };
}

// ---------------------------------------------------------------------------
// Current-RWA event-of-record read
// ---------------------------------------------------------------------------

/**
 * Latest `RwaComputed.totalRwaMinor` in the consulted store, or `null` when
 * no RWA event-of-record exists yet (build-phase fresh stores). Callers fall
 * back to the ICAAP v1 baseline in the schedule — never to zero.
 * Event-of-record authority: D-RWA-ENGINE-W2-SLICE-3.
 */
export function latestRwaComputedTotalMinor(store: Pick<EventStore, "replay">): number | null {
  let latest: number | null = null;
  for (const ev of store.replay({ type: "RwaComputed" })) {
    const p = ev.payload as { totalRwaMinor?: unknown };
    if (typeof p.totalRwaMinor === "number" && Number.isFinite(p.totalRwaMinor)) {
      latest = p.totalRwaMinor;
    }
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Evaluators — shared by the sync gateway and the async check handler
// ---------------------------------------------------------------------------

export interface FxGatewayCheckEvaluation {
  readonly outcome: "approve" | "reject";
  /** Present iff outcome is "reject". */
  readonly rejectionReason?: string;
  /** Citation backing a rejection. */
  readonly citationToRule: string;
}

/**
 * Capital-impact check: pro-forma RWA (current + notional × class weight)
 * must not exceed the ratified pro-forma RWA ceiling. Fail-closed: an
 * instrument class with no CRO-owned weight REJECTS.
 *
 * @param instrumentClass  Reg38-CRE20 instrument class (e.g. "FX-spot").
 * @param notionalMinor    ZAR-equivalent notional in minor units.
 * @param currentRwaMinor  Current total RWA (minor); `null` → ICAAP baseline.
 */
export function evaluateCapitalImpact(args: {
  instrumentClass: string;
  notionalMinor: number;
  currentRwaMinor: number | null;
  schedule?: FxGatewayThresholdSchedule;
}): FxGatewayCheckEvaluation {
  const schedule = args.schedule ?? fxGatewayThresholdSchedule();
  const cap = schedule.capitalImpact;
  const citationToRule = FX_GATEWAY_THRESHOLD_DECISION_ID;

  const weight = cap.rwaWeightByInstrumentClass[args.instrumentClass];
  if (weight === undefined) {
    return {
      outcome: "reject",
      rejectionReason: [
        `Capital-impact check is FAIL-CLOSED: instrument class '${args.instrumentClass}' has no`,
        "CRO-owned RWA weight in the rwa.instrument-weight registry (Reg38-CRE20); the order",
        "cannot be capital-assessed and is rejected (D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS).",
      ].join(" "),
      citationToRule,
    };
  }

  const currentRwaMinor = args.currentRwaMinor ?? cap.currentRwaBaselineMinor;
  const proposedRwaMinor = Math.round(args.notionalMinor * weight);
  const proFormaRwaMinor = currentRwaMinor + proposedRwaMinor;

  if (proFormaRwaMinor > cap.proFormaRwaCeilingMinor) {
    return {
      outcome: "reject",
      rejectionReason: [
        `Capital RWA ceiling breached: pro-forma RWA ZAR ${(proFormaRwaMinor / 100).toFixed(0)}`,
        `exceeds the ratified ceiling ZAR ${(cap.proFormaRwaCeilingMinor / 100).toFixed(0)}`,
        `(current RWA ZAR ${(currentRwaMinor / 100).toFixed(0)}, proposed add ZAR`,
        `${(proposedRwaMinor / 100).toFixed(0)} at weight ${weight} for ${args.instrumentClass}).`,
        "Ceiling = (R300m capital envelope − R100m RAS amber headroom floor) / 12.0% operating",
        "minimum total capital ratio (D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS; RAS §B3).",
      ].join(" "),
      citationToRule,
    };
  }

  return { outcome: "approve", citationToRule };
}

/**
 * Funding (LCR) check: estimated post-trade LCR must not fall below the RAS
 * §B3 red boundary (110%) — the bank's own management-action trigger, not
 * the bare BCBS 238 100% minimum.
 *
 * @param notionalMinor  ZAR-equivalent notional in minor units.
 * @param currentLcrPct  Current LCR (pct); `null` → build-phase baseline.
 */
export function evaluateFundingImpact(args: {
  notionalMinor: number;
  currentLcrPct: number | null;
  schedule?: FxGatewayThresholdSchedule;
}): FxGatewayCheckEvaluation {
  const schedule = args.schedule ?? fxGatewayThresholdSchedule();
  const fnd = schedule.funding;
  const citationToRule = FX_GATEWAY_THRESHOLD_DECISION_ID;

  const currentLcrPct = args.currentLcrPct ?? fnd.currentLcrBaselinePct;
  const notionalZar = args.notionalMinor / 100;
  const lcrOutflowPct = (notionalZar / 1_000_000) * fnd.outflowImpactPctPerMillionNotional;
  const postTradeLcrPct = currentLcrPct - lcrOutflowPct;

  if (postTradeLcrPct < fnd.postTradeLcrFloorPct) {
    return {
      outcome: "reject",
      rejectionReason: [
        `LCR headroom insufficient: estimated post-trade LCR ${postTradeLcrPct.toFixed(1)}%`,
        `falls below the RAS §B3 floor ${fnd.postTradeLcrFloorPct}% (current LCR`,
        `${currentLcrPct.toFixed(1)}%, estimated outflow impact ${lcrOutflowPct.toFixed(2)}pp`,
        `for notional ZAR ${notionalZar.toFixed(0)}). Floor = RAS appetite:liquidity:lcr red`,
        "boundary — the management-action trigger, above the BCBS 238 100% regulatory minimum",
        "(D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS; funding leg co-owned by Treasury/ALM).",
      ].join(" "),
      citationToRule,
    };
  }

  return { outcome: "approve", citationToRule };
}
