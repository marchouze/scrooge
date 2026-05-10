// scripts/record-d-pa-communications-full-historical-sweep.ts
//
// One-shot: emit a CeoDecision event of record for
// D-PA-COMMUNICATIONS-FULL-HISTORICAL-SWEEP — the obligations-register
// v1.16 expansion that lifts the time-bounds self-imposed in PR #171
// v1.14 (Directives since-2018, Guidance Notes since-2018, Circulars
// since-2020) and produces a full historical sweep covering every PA
// Directive, Joint Standard, Guidance Note, Circular, and Prudential /
// Joint Communication for banks from regime-start (~1996) to today.
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
  decisionId: "D-PA-COMMUNICATIONS-FULL-HISTORICAL-SWEEP",
  action: "approve" as const,
  title:
    "Obligations register v1.16 — full historical PA-communications sweep (no time-bound) (D-PA-COMMUNICATIONS-FULL-HISTORICAL-SWEEP)",
  outcome:
    "Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO; obligations-register curator) and Imani (Legal-as-code engineer, engineering — reports to Devon COO interim; legal sourcing co-author) execute the full historical sweep dispatched by Marc (CEO) — every SARB Prudential Authority Directive, Joint Standard, Guidance Note, Circular, and Prudential / Joint Communication issued for banks since the PA-regime began (~1996), no time-bound. v1.16 adds 22 new register rows in Domain A (Prudential) covering the 2010–2020 Directives + Pre-2018 Guidance Notes corpus that PR #171 v1.14 missed under its self-imposed since-2018 time-bound: 11 Directives (D1/2014 SA credit-risk; D2/2014 LCR initial; D3/2014 leverage initial; D5/2015 NSFR initial; D1/2016 recovery-plan submission — pins PR #171 §6 #4 gap; D2/2016 resolution-planning input; D3/2017 Pillar 3 publication; D5/2017 CCF; D4/2018 SA-CCR; D6/2019 IRRBB; D2/2020 op-risk significant-loss-event reporting) and 10 Guidance Notes (GN 5/2010 liquidity qualitative principles; GN 4/2011 op-risk qualitative; GN 7/2012 stress testing; GN 3/2013 external-auditor reporting; GN 7/2013 significant-shareholder fit-and-proper; GN 2/2015 credit-risk qualitative; GN 5/2015 model-risk; GN 6/2016 conduct-risk; GN 2/2018 recovery-and-resolution-planning qualitative; GN 4/2019 IFRS-9 ECL transition). Closes 4 of the 6 PR #171 §6 substrate gaps: WS-PA-CIRCULAR-INVENTORY (no register additions — circular catalogue is dominated by lapsed pandemic-relief + meta catalogue-resets); D1/2025-vs-D10/2025 supersession (D10/2025 supersedes D1/2025; ORG-PR-27 status updated); recovery-and-resolution-planning Directive identification (D1/2016; ORG-PR-30 + ORG-BNK-RECOVERY-CONS citations refined; ORG-PR-39 added as the precise instrument anchor); GN 1/2024-vs-G3/2024 climate-reading clarification (distinct instruments; ORG-PR-22 body refined). Filtered out per the wholesale-institutional bank profile (project_strategic_foundation.md + project_indirect_participant_posture.md): D4/2014 (D-SIB) + D6/2015 (IRB) — conditional-bind; routed to new WS-CONDITIONAL-BIND-TRACKING workstream. Pre-2010 Directive corpus: wholesale superseded by Regulations Relating to Banks 2012 + subsequent BCBS-aligned directives — no register rows added; supersession chain noted in research findings. JS 1/2025 (insurer enterprise RMF) — insurer-only, applicability filter. Joint Standards regime is now comprehensive in the register at v1.15 (no new JS rows in v1.16). Nine new procedure-stub routes recorded: SA credit-risk (Helena+Camille), LCR-NSFR-leverage (Eitan+Helena), recovery-resolution-planning refinement (Helena+Camille), SA-CCR-and-FRTB-CVA (Helena+Camille+Saskia), IRRBB-CSRBB (Helena+Eitan), op-risk loss-event reporting (Helena+Devon), external-auditor PA reporting (Camille+Thandiwe), model-risk management (Helena+Nadia), conduct-risk management (Zara+Helena). The 21 [citation: TBC] markers added in v1.16 fold into the standing WS-INSTRUMENT-ANALYSES workstream for precise § / clause resolution. Net-new-vs-PR #171 delta: +22 register rows; total instruments surveyed across categories: ~75 (in-force + superseded + repealed + meta + informational + insurer-only).",
  comment:
    "register-curator action recorded as event per CLAUDE.md events-first authoring; standing authority — no new CEO decision required; full historical sweep per Marc dispatch lifting PR #171 self-imposed time-bounds",
  sourceDoc:
    "Owner Inbox/2026-05-10_mira-imani_pa-communications-full-historical-sweep.md",
  asOf: "2026-05-10T22:00:00.000Z",
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
      recordedVia: "script:record-d-pa-communications-full-historical-sweep",
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
