// scripts/decisions/helena-var-appetite-recalibrate-standing-nop.ts
//
// Author: Helena (Chief Risk Officer, governance).
//
// CRO-seat re-calibration of the market-risk 1-day 99% VaR appetite ceiling
// (MR-1-FX, RAS appetite line `appetite:market:trading-var`, RAS §B4) from
// R350k to R575k, coherent with the standing-NOP VaR measurement basis.
//
// Why:
//   PR #1279 (D-VAR-EXPOSURE-INCLUDES-STANDING-NOP, CEO-approved 2026-06-12)
//   re-based market-risk VaR / SVaR / ES onto the standing FX net-open-position
//   (settlement-retained, B3-aligned) — the SAME book BA 310 attests. The
//   corrected live base is ~R499.4k VaR / SVaR, ~R470.7k ES (5 risk factors),
//   versus ~R280k on the OLD trade-only basis (3 risk factors). The MR-1-FX
//   ceiling of R350k was calibrated against the OLD basis, where it sat at
//   ~80% utilisation (amber). Against the corrected base R350k is materially
//   exceeded (~143% → red) and is stale.
//
// Decision (Helena, CRO):
//   RE-CALIBRATE the ceiling to R575k = corrected base ~R499.4k + ~15%
//   management buffer (≈R75k), rounded. This restores the ~87% (amber)
//   utilisation posture the original R350k carried against the old base
//   (R280k / R350k ≈ 80%) — i.e. the early-warning headroom is preserved on the
//   corrected basis, not re-set looser. The ceiling stays an INTERIM build-phase
//   limit under D-BRC-INTERIM-MR-1-FX; it is re-tabled to the Board Risk
//   Committee at licence-day.
//
// Authority: risk-appetite calibration is CRO authority (CLAUDE.md
//   decision-authority-routing). This is a within-methodology re-calibration of
//   an interim, build-phase, TIER-2 market-risk limit (no real trading book, no
//   real capital). No RAS Tier-1 / Board threshold is crossed — the trading-VaR
//   line is tier-2; the tier-1 lines (LCR / NSFR / CET1 / leverage / IRRBB /
//   intraday) are untouched. No CEO sign-off required. The CRO seat
//   self-ratifies (mirrors the D-BOND-RAS-APPETITE precedent).
//
// Idempotent: fixed asOf timestamps so re-runs (home store + CI fresh-store
// backfill) dedup on (decisionId, phase, as_of). NO Date.now() / new Date().
//
// Run once from prototype/, against the shared home store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/decisions/helena-var-appetite-recalibrate-standing-nop.ts
//
// Stays in the repo as an audit record.

import "../../platform/event-store/resolve-event-db-boot";

import { clock } from "../../platform/composition";
import { makeRasLineCalibrated } from "../../platform/event-store/event-types/risk";
import { recordFiled } from "../../platform/records";
import { marketVarAppetiteCeilingZar } from "../../platform/risk/ras-appetite-register";
import { eventStore } from "../../platform/composition";
import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const DECISION_ID = "D-VAR-APPETITE-RECALIBRATE-STANDING-NOP";
const REQUESTED_ASOF = "2026-06-13T09:00:00.000Z";
const APPROVED_ASOF = "2026-06-13T09:01:00.000Z";
const CALIBRATED_ASOF = "2026-06-13T09:02:00.000Z";
const FILED_ASOF = "2026-06-13T09:03:00.000Z";

const LINE_ID = "appetite:market:trading-var";
const OLD_CEILING_ZAR = 350_000;
const NEW_CEILING_ZAR = 575_000;
const CORRECTED_BASE_VAR_ZAR = 499_408;
const CORRECTED_BASE_ES_ZAR = 470_706;

const ACTOR = { type: "service" as const, id: "agent:helena:governance" };

const TITLE =
  "Re-calibrate market-risk VaR appetite (MR-1-FX, appetite:market:trading-var) R350k → R575k vs standing-NOP base";

const CITATIONS = [
  "D-RAS",
  "D-RAS-STRUCTURED-REGISTER",
  "D-VAR-EXPOSURE-INCLUDES-STANDING-NOP",
  "D-BRC-INTERIM-MR-1-FX",
  "WS-MARKET-RISK",
  "BANKS-REG-29",
];

const RECOMMENDATION =
  `Re-calibrate the RAS §B4 market-risk 1-day 99% VaR appetite line ` +
  `\`${LINE_ID}\` (MR-1-FX) from R${OLD_CEILING_ZAR.toLocaleString()} to ` +
  `R${NEW_CEILING_ZAR.toLocaleString()}. New ceiling = corrected standing-NOP ` +
  `VaR base ~R${CORRECTED_BASE_VAR_ZAR.toLocaleString()} + ~15% management buffer ` +
  `(≈R75,000), rounded. RAG bands unchanged in shape: amber ≥80% of ceiling, ` +
  `red ≥100%. Ceiling is the single-source value the VaR-measure emitters read ` +
  `from the canonical RAS register (no more module-local VAR_APPETITE_ZAR). ` +
  `Interim build-phase ceiling under D-BRC-INTERIM-MR-1-FX; re-tabled to the ` +
  `Board Risk Committee at licence-day.`;

const RATIONALE =
  `PR #1279 (D-VAR-EXPOSURE-INCLUDES-STANDING-NOP) re-based market-risk VaR / ` +
  `SVaR / ES onto the standing FX net-open-position (settlement-retained, ` +
  `B3-aligned) — the same book BA 310 attests. Corrected live base ~R` +
  `${CORRECTED_BASE_VAR_ZAR.toLocaleString()} VaR / SVaR, ~R` +
  `${CORRECTED_BASE_ES_ZAR.toLocaleString()} ES (5 risk factors), vs ~R280,000 ` +
  `on the OLD trade-only basis (3 risk factors). The R${OLD_CEILING_ZAR.toLocaleString()} ` +
  `MR-1-FX ceiling was calibrated against the OLD basis (utilisation ~80%, amber); ` +
  `against the corrected base it reads ~143% (red) and is stale. Re-calibrating ` +
  `to R${NEW_CEILING_ZAR.toLocaleString()} restores the ~87% (amber) utilisation ` +
  `posture the original carried against the old base — preserving the early-warning ` +
  `headroom on the corrected basis, not re-setting it looser. Within-methodology, ` +
  `interim, build-phase, tier-2: CRO authority; no RAS Tier-1 / Board threshold ` +
  `crossed; no CEO sign-off required.`;

// --- Decision lifecycle: requested -> approved (CRO self-ratifies) -----------
requestDecision(
  {
    decisionId: DECISION_ID,
    authority: "CRO",
    authorityRef: "helena@bank.internal",
    title: TITLE,
    category: "risk",
    recommendation: RECOMMENDATION,
    rationale:
      "Opens the re-calibration lifecycle. " +
      "Standing FX NOP VaR base now materially exceeds the stale R350k ceiling.",
    citations: CITATIONS,
    recordedVia: "agent:autonomous",
    actor: ACTOR,
  },
  REQUESTED_ASOF,
);

const decision = recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CRO",
    authorityRef: "helena@bank.internal",
    title: TITLE,
    category: "risk",
    recommendation: RECOMMENDATION,
    rationale: RATIONALE,
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "agent:autonomous",
    actor: ACTOR,
  },
  APPROVED_ASOF,
);

// --- RasLineCalibrated: the canonical calibration event ----------------------
const calibration = makeRasLineCalibrated({
  asOf: CALIBRATED_ASOF,
  entity: "LE-ZA-HOZ-BANK",
  actor: ACTOR,
  citations: CITATIONS,
  payload: {
    lineId: LINE_ID,
    rasSection: "RAS §B4",
    calibrationDescription:
      `Market-risk 1-day 99% VaR appetite ceiling R${NEW_CEILING_ZAR.toLocaleString()} ` +
      `(MR-1-FX), measured against the standing FX net-open-position basis ` +
      `(settlement-retained, B3-aligned). Amber ≥80% of ceiling; red ≥100%. ` +
      `Re-calibrated from R${OLD_CEILING_ZAR.toLocaleString()} (stale, old trade-only basis).`,
    calibrationCitations: CITATIONS,
    calibrationSource:
      "record:documents:helena:var-appetite-recalibration-standing-nop:2026-06-13",
    standingAuthority: "D-VAR-EXPOSURE-INCLUDES-STANDING-NOP",
    obligationRowId: "ORG-PR-RETURNS-011",
    calibrationParameters: {
      oldCeilingZar: OLD_CEILING_ZAR,
      newCeilingZar: NEW_CEILING_ZAR,
      correctedBaseVarZar: CORRECTED_BASE_VAR_ZAR,
      correctedBaseEsZar: CORRECTED_BASE_ES_ZAR,
      oldBasisVarZar: 280_000,
      managementBufferPct: 15,
      amberThresholdPctOfCeiling: 80,
      redThresholdPctOfCeiling: 100,
      basis: "standing-FX-NOP-settlement-retained-B3-aligned",
      tier: "tier-2",
      interim: true,
      reTableAt: "licence-day-BRC",
    },
  },
});
eventStore.append(calibration);

// --- RecordFiled: the analysis render (RMS Phase 3) --------------------------
const RENDER_BODY = `# RAS §B4 market-risk VaR appetite re-calibration vs standing-NOP base

**Author:** Helena (Chief Risk Officer, governance)
**Date:** 2026-06-13
**Authority:** D-VAR-EXPOSURE-INCLUDES-STANDING-NOP (CEO-approved 2026-06-12); CRO risk-appetite-calibration authority
**Decision:** ${DECISION_ID} (approved)
**RAS line:** \`${LINE_ID}\` (MR-1-FX, RAS §B4, tier-2)
**Calibration event:** ${calibration.event_id}

## Old basis vs new basis

| | Old (pre-#1279, trade-only) | New (post-#1279, standing-NOP) |
|---|---|---|
| Exposure basis | Settled trades EXCLUDED | Settled FX positions RETAINED (B3-aligned; the book BA 310 attests) |
| Risk factors | 3 | 5 |
| 1-day 99% VaR / SVaR | ~R280,000 | ~R${CORRECTED_BASE_VAR_ZAR.toLocaleString()} |
| Expected Shortfall (97.5%) | ~R349,000 | ~R${CORRECTED_BASE_ES_ZAR.toLocaleString()} |
| Utilisation vs R350k ceiling | ~80% (amber) | ~143% (red) |

PR #1279 (D-VAR-EXPOSURE-INCLUDES-STANDING-NOP) corrected the VaR engine to
measure the bank's standing net open position including settled cash held in
nostro — the FX risk the bank actually bears, and the same book attested on
BA 310 / reg 29(3). The R350k MR-1-FX ceiling was calibrated against the OLD
trade-only basis, where the book sat at ~80% utilisation (amber). On the
corrected basis the same book reads ~143% — a stale appetite, not a genuine
new breach: the exposure did not grow, the *measurement* was corrected.

## Decision: RE-CALIBRATE to R${NEW_CEILING_ZAR.toLocaleString()}

New ceiling = corrected standing-NOP VaR base ~R${CORRECTED_BASE_VAR_ZAR.toLocaleString()}
+ ~15% management buffer (≈R75,000), rounded to R${NEW_CEILING_ZAR.toLocaleString()}.
This restores the ~87% (amber) utilisation posture the original R350k carried
against the old base — the early-warning headroom is preserved on the corrected
basis, not re-set looser. RAG band shape unchanged: amber ≥80% of ceiling,
red ≥100%.

The ceiling is now the single-source value the VaR-measure emitters
(runtime/agents/rohan-market-risk-measure.ts, scripts/market-risk-measure-run.ts)
read from the canonical RAS register line — the former hardcoded
VAR_APPETITE_ZAR = 350_000 constant is retired (Principle 2 — single-graph
discipline; the IRRBB δEVE / intraday-floor precedent).

## Authority / escalation

Risk-appetite calibration is CRO authority (CLAUDE.md decision-authority-routing).
This is a within-methodology re-calibration of an INTERIM, build-phase, TIER-2
market-risk limit (no real trading book, no real capital). No RAS Tier-1 / Board
threshold is crossed — the trading-VaR line is tier-2; the tier-1 lines
(LCR / NSFR / CET1 / leverage / IRRBB / intraday) are untouched. **No CEO
sign-off required.** The ceiling stays an interim limit under
D-BRC-INTERIM-MR-1-FX and is re-tabled to the Board Risk Committee at licence-day.
`;

const filed = recordFiled(
  {
    recordId: "record:documents:helena:var-appetite-recalibration-standing-nop:2026-06-13",
    registerKey: "documents",
    body: RENDER_BODY,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-VAR-EXPOSURE-INCLUDES-STANDING-NOP",
      DECISION_ID,
      "D-BRC-INTERIM-MR-1-FX",
      "WS-MARKET-RISK",
    ],
    actor: ACTOR,
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "RAS §B4 market-risk VaR appetite re-calibration vs standing-NOP base",
      path: "2026-06-13_helena_var-appetite-recalibration-standing-nop.md",
      category: "cro-ras-calibration",
      author: "Helena (Chief Risk Officer, governance)",
      date: "2026-06-13",
    },
  },
  FILED_ASOF,
);

// Sanity: the register now reflects R575k as the single-source ceiling.
const registerCeiling = marketVarAppetiteCeilingZar();

console.log(
  JSON.stringify(
    {
      ok: true,
      decisionId: DECISION_ID,
      decisionEventId: decision.eventId,
      rasLineCalibratedEventId: calibration.event_id,
      recordFiledEventId: filed.eventId,
      lineId: LINE_ID,
      oldCeilingZar: OLD_CEILING_ZAR,
      newCeilingZar: NEW_CEILING_ZAR,
      registerCeilingZar: registerCeiling,
      asOf: { CALIBRATED_ASOF, FILED_ASOF },
      now: clock.now(),
    },
    null,
    2,
  ),
);
