// scripts/record-d-pa-communications-register-update.ts
//
// One-shot: emit a CeoDecision event of record for
// D-PA-COMMUNICATIONS-REGISTER-UPDATE — the obligations-register v1.14
// expansion that lands new rows for SARB Prudential Authority Directives,
// Joint Standards, Guidance Notes, and ad-hoc Prudential / Joint
// Communications applicable to a wholesale-institutional global-markets
// bank.
//
// Standing authority: register-curator mandate held by Mira (Compliance /
// RegTech engineer, engineering — reports to Zara CCO; obligations-
// register curator) under Zara (Chief Compliance Officer, governance —
// reports to CEO) + WS-INSTRUMENT-ANALYSES continuous workstream.
// No new CEO decision authority required (per CLAUDE.md "Operating
// procedures → Dispatch discipline → No-pause rule" and the standing
// curator scope established at v1.0 of the register).
//
// This script records the curator action as a typed event per CLAUDE.md
// "Operating procedures → Events-first authoring" — every register
// update lands as an event first; the markdown banner is the render.
//
// Run once; idempotent (skips ids already recorded).
//
// Authors: Mira (Compliance / RegTech engineer, engineering — reports to
//   Zara CCO; obligations-register curator) · Imani (Legal-as-code
//   engineer, engineering — reports to Devon COO interim; legal sourcing
//   co-author).

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-PA-COMMUNICATIONS-REGISTER-UPDATE",
  action: "approve" as const,
  title:
    "Obligations register v1.14 — PA Directives + Guidance Notes + Joint Standards expansion (D-PA-COMMUNICATIONS-REGISTER-UPDATE)",
  outcome:
    "Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO; obligations-register curator) and Imani (Legal-as-code engineer, engineering — reports to Devon COO interim; legal sourcing co-author) survey the SARB Prudential Authority publications portal (Directives, Joint Standards, Guidance Notes, Circulars, Prudential / Joint Communications) and add 13 new register rows across four domains: Domain A (Prudential) — 8 rows for D1/2025 + D10/2025 (Pillar 3 disclosure), D2/2024 (BA-return reporting under Reg 46), the PA recovery-and-resolution-planning Directive (Imani follow-up on precise instrument identification), G3/2023 (Basel implementation dates), G3/2025 (Climate Disclosures for banks — supersedes G3/2024 + G2/2024), Prudential Communication 18/2024 (FRTB + CVA implementation roadmap), Prudential Communication 15/2024 (CSRBB Field testing); Domain B (Financial crime) — 1 row (ORG-FC-23) for AML/CFT/CPF Communication 1/2025 (Banks); Domain E (Cyber and operational resilience) — 3 rows for Joint Standard 1/2023 (IT Governance + IT Risk Management — split into two umbrella rows ORG-CY-15 + ORG-CY-16) and a corrective umbrella row ORG-CY-17 for Joint Standard 2/2024 (Cybersecurity and Cyber Resilience — flagging the long-standing JS-1-vs-JS-2-of-2024 mis-citation across ORG-CY-01..05 + ORG-BNK-CYBER-CONS, routed for single-purpose follow-on PR via WS-JS-NUMBER-RECONCILIATION); Domain F (Governance) — 1 row (ORG-GV-22) for Joint Standard 1/2020 (Significant Owner). Filtered out per the wholesale-institutional bank profile (project_strategic_foundation.md): D1/2024 + D2/2024 NPS-side directives (the bank is an indirect NPS participant via correspondent — project_indirect_participant_posture.md); JS 1/2024 (Outsourcing by Insurers — insurer-only); G2/2024 (insurer climate disclosures); meta-instruments C1/2024 + G1/2024 + C1/2023; informational PA / Joint Communications. Six substrate gaps surfaced and routed: WS-JS-NUMBER-RECONCILIATION (Mira), WS-PA-CIRCULAR-INVENTORY (Imani), D1/2025-vs-D10/2025 supersession resolution (Imani), recovery-and-resolution-planning Directive identification (Imani), GN-1/2024-vs-G3/2024 climate-reading clarification (Imani), JS-1/2023 sub-section coverage expansion (Senna + Rashida at first IT-control attestation). Seven new procedure stubs routed to downstream policy authors: Pillar 3 disclosure (Camille + Bea), BA returns Reg 46 (Bea + Camille), recovery-and-resolution planning (Helena + Camille), climate-related disclosures (Helena), IT-governance JS 1/2023 (Devon + Senna + Rashida), AML/CFT/CPF banks supervisory engagement (Zara + Mira + future MLRO), significant-owner notification (Owen + Camille). The seven [citation: TBC] markers added in v1.14 fold into the standing WS-INSTRUMENT-ANALYSES workstream for precise § / clause resolution.",
  comment:
    "register-curator action recorded as event per CLAUDE.md events-first authoring; standing authority — no new CEO decision required",
  sourceDoc:
    "Owner Inbox/2026-05-10_mira-imani_pa-communications-research.md",
  asOf: "2026-05-10T16:00:00.000Z",
};

function main(): number {
  const alreadyRecorded = new Set<string>();
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    const id = (e.payload as Record<string, unknown>).decisionId;
    if (typeof id === "string") alreadyRecorded.add(id);
  }

  if (alreadyRecorded.has(ENTRY.decisionId)) {
    logger.info(
      { decisionId: ENTRY.decisionId },
      "skipped (event already exists)",
    );
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
      recordedVia: "script:record-d-pa-communications-register-update",
    },
    ENTRY.asOf,
  );
  logger.info(
    { decisionId: ENTRY.decisionId, action: ENTRY.action },
    "CeoDecision event emitted",
  );
  return 0;
}

process.exit(main());
