// scripts/record-d-regulatory-readiness-w2-slice-2.ts
//
// One-shot: emit (a) a CeoDecision event for D-REGULATORY-READINESS-W2-
// SLICE-2 — the RAS B2 calibration + CET1 management buffer ratification
// slice landing under W2 of the regulatory-readiness gate plan, AND
// (b) the RasLineCalibrated event recording the actual calibration
// computed against the build-phase fixture inputs.
//
// Standing authority: D-REGULATORY-READINESS-GATE-PLAN (CEO-approved
// 2026-05-10). W2 Slice 2 sits under Helena (Chief Risk Officer,
// governance) + Rohan (Risk engineer, engineering — under Helena) + Bea
// (Accounting & financial reporting engineer, engineering — under
// Camille (Chief Financial Officer, governance); consult on capital
// fixture inputs). Per the no-pause rule (CLAUDE.md "Operating
// procedures"), downstream slices of an approved decision dispatch
// without per-item CEO confirmation. This script records the slice
// sub-authorisation so the audit trail names it explicitly, AND emits
// the calibration event the recon pipeline asserts on.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Helena (Chief Risk Officer, governance) +
//         Rohan (Risk engineer, engineering — under Helena) +
//         Bea (Accounting & financial reporting engineer, engineering
//              — under Camille (CFO, governance))

import { eventStore } from "../platform/composition";
import { makeRasLineCalibrated } from "../platform/event-store/event-types";
import { logger } from "../platform/observability/logger";
import {
  RAS_B2_CITATIONS,
  RAS_B2_CITATION_LIST,
  RAS_B2_FIXTURE_PILLAR1,
  calibrateRasB2,
} from "../platform/risk/ras-b2-calibration";
import { recordCeoDecision } from "../runtime/decisions/record";

const AS_OF = "2026-05-10T13:00:00.000Z";

const DECISION_ENTRY = {
  decisionId: "D-REGULATORY-READINESS-W2-SLICE-2",
  action: "approve" as const,
  title:
    "Regulatory-Readiness W2 Slice 2 — RAS B2 calibration + CET1 management buffer ratification",
  outcome:
    'Helena (Chief Risk Officer, governance) + Rohan (Risk engineer, engineering — under Helena) + Bea (Accounting & financial reporting engineer, engineering — under Camille (CFO, governance))\'s W2 Slice 2 RAS B2 calibration approved as drafted under standing D-REGULATORY-READINESS-GATE-PLAN authority. Lifts the deferred RAS B2 line (CET1 management buffer ≥ +1.5pp above PA-set CET1 minimum + Pillar 2A + capital conservation buffer) per `ORG-PR-04` from PARTIAL → IN FORCE. Substrate-side: pure calibration function `calibrateRasB2` at `prototype/platform/risk/ras-b2-calibration.ts` codifies the formula `targetCet1RatioPct = paCet1MinimumPct + pillar2APct + ccbPct + 1.5` plus trigger (PA min + 0.75pp) and escalate (PA min + 0.25pp) thresholds; build-phase fixture `RAS_B2_FIXTURE_PILLAR1` mirrors Bea\'s reporting-capability spec (PA min 4.5pp, Pillar 2A 0.0pp, CCB 2.5pp, illustrative live 14.0pp → target floor 8.5pp, surplus 5.5pp, posture green). Live (non-fixture) inputs flow through once W2 Slice 3 (RWA engine + BA-form generator) lands; the calibration formula is identical in both cases — only the input source changes. Typed event `RasLineCalibrated { lineId: "B2", obligationRowId: "ORG-PR-04", calibrationDescription: "CET1 management buffer ≥ +1.5pp above PA min + Pillar 2A + capital conservation buffer", calibrationCitations: [Banks Act 94 of 1990, Reg 38, BCBS Basel III/IV, RAS §B3, ORG-PR-04], standingAuthority: D-REGULATORY-READINESS-GATE-PLAN }` registered in `event-types.ts` and emitted by this script. Recon pipeline `recon:ras-b2-calibration-coverage` (new) asserts (i) at least one active RasLineCalibrated event for B2; (ii) at most one active calibration per line via the supersedes-chain; (iii) payload shape integrity; (iv) obligationRowId matches ORG-PR-04; (v) the five required citations are present; (vi) recorded calibrationParameters match the live calibration function output (drift detection). Status flip: `ORG-PR-04` row in `Regulations/_obligations-register.md` lifts from `PARTIAL (B2 deferred)` → `IN FORCE` per the calibration event — Mira (Compliance / obligations engineer) commits the row-status change in a follow-on PR once the calibration event lands (PR-by-PR separation per the canonical-source registry — the calibration is the canonical signal; the register row is the rendered view). Pure substrate slice — no policy authored, no procedure bound; the RAS §B3 narrative already declares the line, the calibration only ratifies the numbers. Out of scope: Slice 4 stress-projection engine (separate dispatch), live Pillar-1 inputs (W2 Slice 3 dependency), other RAS lines (Slice 2 is B2 only).',
  comment:
    "downstream dispatch from D-REGULATORY-READINESS-GATE-PLAN (W2 Slice 2); no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_helena-rohan-bea_w2-slice-2-ras-b2-calibration.md",
};

function alreadyHasCeoDecision(decisionId: string): boolean {
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    const id = (e.payload as Record<string, unknown>).decisionId;
    if (id === decisionId) return true;
  }
  return false;
}

function alreadyHasActiveRasB2Calibration(): boolean {
  // Active = at least one RasLineCalibrated for lineId="B2" not in a
  // supersedes-chain. For idempotency we treat any prior B2 calibration
  // (active or superseded) as a signal that this script has already run
  // — a recalibration would be a separate emitter that explicitly sets
  // supersedesCalibrationEventId, not a re-run of this script.
  for (const e of eventStore.replay({ type: "RasLineCalibrated" })) {
    const lineId = (e.payload as Record<string, unknown>).lineId;
    if (lineId === "B2") return true;
  }
  return false;
}

function emitRasB2Calibration(): void {
  const calibration = calibrateRasB2(RAS_B2_FIXTURE_PILLAR1);
  const event = makeRasLineCalibrated({
    asOf: AS_OF,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human", id: "marc@tgv.co.za" },
    citations: RAS_B2_CITATION_LIST,
    payload: {
      lineId: "B2",
      rasSection: "RAS §B3",
      calibrationDescription:
        "CET1 management buffer ≥ +1.5pp above PA min + Pillar 2A + capital conservation buffer",
      calibrationCitations: [
        RAS_B2_CITATIONS.banksAct,
        RAS_B2_CITATIONS.reg38,
        RAS_B2_CITATIONS.basel3,
        RAS_B2_CITATIONS.rasB3,
        RAS_B2_CITATIONS.obligation,
      ],
      calibrationSource: "Owner Inbox/2026-05-10_helena-rohan-bea_w2-slice-2-ras-b2-calibration.md",
      standingAuthority: "D-REGULATORY-READINESS-GATE-PLAN",
      obligationRowId: "ORG-PR-04",
      calibrationParameters: {
        targetCet1RatioPct: calibration.targetCet1RatioPct,
        triggerCet1RatioPct: calibration.triggerCet1RatioPct,
        escalateCet1RatioPct: calibration.escalateCet1RatioPct,
        surplusOverTargetPct: calibration.surplusOverTargetPct,
        breachPosture: calibration.breachPosture,
        managementBufferPct: 1.5,
        triggerBufferPct: 0.75,
        escalateBufferPct: 0.25,
        inputSource: calibration.inputSource,
        inputs: {
          paCet1MinimumPct: RAS_B2_FIXTURE_PILLAR1.paCet1MinimumPct,
          pillar2APct: RAS_B2_FIXTURE_PILLAR1.pillar2APct,
          ccbPct: RAS_B2_FIXTURE_PILLAR1.ccbPct,
          liveCet1RatioPct: RAS_B2_FIXTURE_PILLAR1.liveCet1RatioPct,
        },
      },
    },
  });
  eventStore.append(event);
  logger.info(
    {
      eventId: event.event_id,
      lineId: "B2",
      targetCet1RatioPct: calibration.targetCet1RatioPct,
      breachPosture: calibration.breachPosture,
    },
    "RasLineCalibrated event emitted (B2)",
  );
}

function main(): number {
  // Step 1: emit the RasLineCalibrated event for B2.
  if (alreadyHasActiveRasB2Calibration()) {
    logger.info(
      { lineId: "B2" },
      "skipped RasLineCalibrated emit — B2 calibration already in event store",
    );
  } else {
    emitRasB2Calibration();
  }

  // Step 2: emit the CeoDecision sub-authorisation event.
  if (alreadyHasCeoDecision(DECISION_ENTRY.decisionId)) {
    logger.info(
      { decisionId: DECISION_ENTRY.decisionId },
      "skipped CeoDecision emit (event already exists)",
    );
    return 0;
  }
  recordCeoDecision(
    {
      decisionId: DECISION_ENTRY.decisionId,
      action: DECISION_ENTRY.action,
      title: DECISION_ENTRY.title,
      outcome: DECISION_ENTRY.outcome,
      actor: "marc@tgv.co.za",
      comment: DECISION_ENTRY.comment,
      sourceDoc: DECISION_ENTRY.sourceDoc,
      recordedVia: "script:record-d-regulatory-readiness-w2-slice-2",
    },
    AS_OF,
  );
  logger.info(
    { decisionId: DECISION_ENTRY.decisionId, action: DECISION_ENTRY.action },
    "CeoDecision event emitted",
  );
  return 0;
}

process.exit(main());
