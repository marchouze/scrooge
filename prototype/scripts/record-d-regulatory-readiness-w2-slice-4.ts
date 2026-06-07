// scripts/record-d-regulatory-readiness-w2-slice-4.ts
//
// One-shot: emit a CeoDecision event for D-REGULATORY-READINESS-W2-SLICE-4
// — the stress-projection engine + Pillar-2 add-on + ICAAP narrative-data
// feed landing W2 Slice 4 of the regulatory-readiness gate plan.
//
// Standing authority: D-REGULATORY-READINESS-GATE-PLAN (CEO-approved
// 2026-05-10). This script records the slice-4 sub-authorisation so the
// audit trail names it explicitly. No new policy decision: per the
// no-pause rule (CLAUDE.md "Operating procedures"), downstream slices of
// an approved decision dispatch without per-item CEO confirmation.
//
// Run once; idempotent (skips ids already recorded).
//
// Authors: Rohan (Risk engineer, engineering — reports to Helena CRO;
//   stress-engine + Pillar-2 + ICAAP feed author) + Helena (Chief Risk
//   Officer, governance — reports to CEO; Pillar-2 accountable owner +
//   ICAAP narrative author) + Nadia (Independent-validation engineer,
//   engineering — peer-in-second-line under Helena CRO; model
//   validation per RAS B7).

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-REGULATORY-READINESS-W2-SLICE-4",
  action: "approve" as const,
  title:
    "Regulatory-Readiness W2 Slice 4 — stress-projection engine + Pillar-2 add-on + ICAAP narrative-data feed",
  outcome:
    "Rohan (Risk engineer, engineering — reports to Helena CRO; stress-engine + Pillar-2 + ICAAP feed author) + Helena (Chief Risk Officer, governance — reports to CEO; Pillar-2 accountable owner + ICAAP narrative author) + Nadia (Independent-validation engineer, engineering — peer-in-second-line under Helena CRO; model validation per RAS B7) ship the stress-projection engine producing actual numbers under the standardised approach per Reg 38 + Reg 39 + BCBS Basel III ICAAP guidance + ORG-PR-12. Engine projects CET1 / Tier1 / Total / Leverage / LCR / NSFR over a 3-year quarterly horizon (12 quarters; 13 observations including q0 base) under four scenarios — base (central forecast; CET1 stock +12% / credit-RWA +10% / Op-RWA +8% cumulative), adverse (moderate downturn; +15% credit-RWA / +20% market-RWA / +2% CET1 / −5% HQLA / +15% net-cash-outflows), severely-adverse (severe downturn; +25% credit-RWA / +35% market-RWA / +12% Op-RWA / −10% CET1 / −15% HQLA / +30% net-cash-outflows / −10% ASF), and reverse-stress (search backwards — bisect on scalar k to bind CET1 ratio at PA min 4.5%). Pure-function design (no event side-effects, no document-store writes, no event-store reads); per-entity scope guard inherits from Slice-3 RWA engine (Hoz Bank only at v0.1; Hoz Securities + Hoz Group rejected). Pillar-2 add-on = max(stress-deficit, risk-bucket sum) where stress-deficit = max(0, floorRatio × worstTotalRwa − worstCet1Stock) and floorRatio = paCet1MinimumRatio + managementBufferRatio (default 4.5% + 1.5% = 6.0% inheriting RAS B2 buffer per ORG-PR-04). ICAAP narrative-data feed lands four typed sections (capitalAdequacy / stressTesting / pillar2 / capitalPlanning) consumed by Helena's narrative author without re-derivation of figures (Principle 2: every action traces to a source). Nadia's independent validation report accepts engine for build-phase rehearsal use — production sign-off deferred to post-licence-day after two Major findings remediate (N-V0.1-01 linear-multiplicative RWA / capital coupling MUST upgrade to a real P&L projection that couples stressed RWA → provisions / NII / NCI → retained earnings → CET1 stock; N-V0.1-02 fixture-grade shock paths MUST replace with SARB PA-published macroprudential paths via Mira's WS-INSTRUMENT-ANALYSES). Independence boundary documented: Nadia ≠ Rohan; both report to Helena CRO; Helena's reporting line through to CEO is independent of model-build line; Thandiwe (CAE) holds third-line independent assurance over the model-risk discipline. Tests: 33 across 9 describes — per-scenario projection round-trip (4 × 13 quarters); reverse-stress reach-minimum invariant (terminal CET1 binds at target ±5bp); Pillar-2 correctness (max-of); ICAAP feed completeness + traceability; per-entity isolation; determinism (byte-identical JSON); boundary errors (empty bundle / wrong-length shocks / negative capital / zero outflows / non-ISO-4217); citations + placeholders (D-REGULATORY-READINESS-GATE-PLAN + slice + Reg 38 + Reg 39 + BCBS Basel III ICAAP + ORG-PR-12); scenario-bundle invariants (severity ordering: severely-adverse > adverse > base on credit-RWA shocks + CET1 erosion). 1054 / 1054 prototype tests pass after this slice lands. Sample stressed CET1 ratio path (severely-adverse, 13 quarterly observations from synthetic fixture R250m total RWA / R45m CET1): 18.00% / 17.58% / 17.17% / 16.78% / 16.38% / 16.00% / 15.63% / 15.26% / 14.91% / 14.56% / 14.22% / 13.88% / 13.56%. Reverse-stress binds at k=7.251 (terminal CET1 ratio 4.504% vs target 4.500%) — synthetic fixture has substantial headroom; reverse-stress requires 7×-amplified shock to drive CET1 to PA min. Substrate gaps surfaced: real PA-published macro paths via Mira's WS-INSTRUMENT-ANALYSES; v1.0 RWA / capital coupling via P&L projection; multi-dimensional reverse-stress (search over independent shock dimensions); Pillar-2 risk-bucket inventory population (Helena's first ICAAP run); FX-translation overlay under stress (M-phase markets-substrate); tax overlay on stressed P&L (Yael's slice paused build-phase); CVA stress (Reporting Slice 4 BA 600 owns); optional StressTestRunCompleted event for replay (compute-on-demand chosen to avoid event-types.ts collision with parallel work); Slice 5 ILAAP liquidity-side substrate (Ravi + Eitan); Slice 6 Recovery Plan authoring (Helena + Owen + Rohan); Slice 7 first end-to-end ICAAP / ILAAP / Recovery dry-run. Coordination — single dispatch path per CLAUDE.md no-spawn-task-+-Agent rule; Phase D scenario extension (Bea+Tomas) different code area no collision; Reporting Slice 6 IFRS statement renderer (Bea+Atlas) different code area no collision; consumes Slice-3 RWA engine + Slice-2 RAS B2 calibration + Reporting Slice 4 BA 100 + D-BANK-ACCOUNT-SUBSTRATE balance projections + Reporting Slice 1 semantic-layer registry as-is; no changes to event-types.ts, registry.ts, period-close.ts, semantic/entries.ts, semantic/liquidity-entries.ts, semantic/risk-weight-entries.ts, dashboard/derive.ts, handlers-metadata.ts, handler-callables.ts, package.json (respect parallel work). Forward-link to W2 Slice 5 (ILAAP intraday + CFP rehearsal), Slice 6 (Recovery Plan), Slice 7 (first end-to-end dry-run), and a future D-REGULATORY-READINESS-W2-SLICE-4-V1.0 that addresses Nadia's two Major findings.",
  comment:
    "downstream dispatch from D-REGULATORY-READINESS-GATE-PLAN (W2 Slice 4); no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_rohan-helena-nadia_w2-slice-4-stress-engine.md",
  asOf: "2026-05-10T16:00:00.000Z",
};

function main(): number {
  const alreadyRecorded = new Set<string>();
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    const id = (e.payload as Record<string, unknown>).decisionId;
    if (typeof id === "string") alreadyRecorded.add(id);
  }

  if (alreadyRecorded.has(ENTRY.decisionId)) {
    logger.info({ decisionId: ENTRY.decisionId }, "skipped (event already exists)");
    return 0;
  }

  recordCeoDecision(
    {
      decisionId: ENTRY.decisionId,
      action: ENTRY.action,
      title: ENTRY.title,
      outcome: ENTRY.outcome,
      actor: "marc@tgv.co.za",
      comment: ENTRY.comment,
      sourceDoc: ENTRY.sourceDoc,
      recordedVia: "script:record-d-regulatory-readiness-w2-slice-4",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
