// scripts/record-d-regulatory-readiness-w2-slice-1.ts
//
// One-shot: emit a CeoDecision event for D-REGULATORY-READINESS-W2-SLICE-1
// — the framework-spec slice landing the ICAAP / ILAAP / Recovery triplet
// framework under W2 of the regulatory-readiness gate plan.
//
// Standing authority: D-REGULATORY-READINESS-GATE-PLAN (CEO-approved
// 2026-05-10). W2 is the ICAAP / ILAAP / Recovery workstream sequenced by
// Helena (Chief Risk Officer, governance) + Camille (Chief Financial
// Officer, governance). This script records the slice-1 sub-authorisation
// so the audit trail names it explicitly. No new policy decision: per the
// no-pause rule (CLAUDE.md "Operating procedures"), downstream slices of
// an approved decision dispatch without per-item CEO confirmation.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Helena (Chief Risk Officer, governance) +
//         Camille (Chief Financial Officer, governance)

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-REGULATORY-READINESS-W2-SLICE-1",
  action: "approve" as const,
  title: "Regulatory-Readiness W2 Slice 1 — ICAAP/ILAAP/Recovery framework spec (S5 + H7 folded)",
  outcome:
    'Helena (Chief Risk Officer, governance) + Camille (Chief Financial Officer, governance)\'s W2 Slice 1 framework spec approved as drafted under standing D-REGULATORY-READINESS-GATE-PLAN authority. Single readable framework lands at `Owner Inbox/2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md` covering: (i) the three-document scope (ICAAP per Reg 38 + BCBS Basel III/IV; ILAAP per Reg 26 + BCBS 144 + BCBS 248; Recovery Plan per Banks Act §§ 60-72 + FSB Key Attributes), authored separately but submitted as a triplet at licence-application; (ii) consolidated-basis reading per D-REGULATORY-PERIMETER — solo `Hoz Bank Limited` plus group-consolidated `Hoz Group Limited` for all three documents; (iii) RAS B2 ratify-pathway specifying the +1.5pp CET1 management buffer calibration sequenced through W2 Slice 2 (substrate-side calibration brief by Helena + Rohan; governance ratification as `D-RAS-B2-CALIBRATION` follow-on; exit signal: `RasLineCalibrated { lineId: "B2" }` event + `ORG-PR-04` lifted PARTIAL → IN FORCE); (iv) substrate-dependency map across W2 Slices 2-7 naming RWA engine, BA-form generator, stress-projection engine, intraday-liquidity feed, CFP rehearsal harness, indicator-monitoring substrate; (v) governance pathway — Helena chairs ICAAP / ILAAP narrative + Recovery; Camille chairs Capital Management Policy + BA returns; Eitan (Treasurer, governance) chairs ILAAP liquidity-side; Owen (Company Secretary, governance) secretarial on Recovery-Plan governance triggers (BRC chair → CEO escalation → recovery-plan-activation); Nadia (Independent-validation engineer under Helena) on model-risk validation; Vera (internal audit engineer under Thandiwe (Chief Audit Executive, governance)) third-line assurance; (vi) per-document section-set with owner + substrate dependency + exit signal per binding clause (14 ICAAP sections, 12 ILAAP sections, 10 Recovery sections — every section attestable); (vii) S5 Capital management policy + first BA returns dry-run folded into W2 Slice 3; H7 Recovery-and-Resolution preparation pack folded into W2 Slice 6; (viii) citation surface citing `ORG-PR-01` / `ORG-PR-04` / `ORG-PR-08` / `ORG-PR-12` / `ORG-PR-15` / `ORG-PR-24` / `ORG-PR-25` (in-register) and Banks Act §§ 60-72 + Reg 38 + Reg 26 + Reg 39 + BCBS Basel III/IV + BCBS 144 + BCBS 248 + BCBS D295 + BCBS D335 + FSB Key Attributes (external standards, sub-clause indices marked `[citation: TBC]` per Principle 2 — Imani (Legal-as-code engineer) + external counsel ratify at the licence-application gate, no invented citations); (ix) Reg 39 ↔ NPA gate-dimension cross-link per `ORG-PR-25` reads through to ICAAP §3.1.12 capital-impact (NPA dimension #7) + operational-risk (NPA dimension #4). Recon `recon:icaap-section-coverage` planned (Vera Wave-4 follow-on) — not built in this slice; substrate gap surfaced. Pure document slice — no code changes beyond this CeoDecision-emitter.',
  comment:
    "downstream dispatch from D-REGULATORY-READINESS-GATE-PLAN (W2 Slice 1); no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md",
  asOf: "2026-05-10T12:00:00.000Z",
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
      recordedVia: "script:record-d-regulatory-readiness-w2-slice-1",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
