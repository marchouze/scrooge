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
    "Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO; obligations-register curator) and Imani (Legal-as-code engineer, engineering — reports to Devon COO interim; legal sourcing co-author) execute the full historical sweep dispatched by Marc (CEO) — every SARB Prudential Authority Directive, Joint Standard, Guidance Note, Circular, and Prudential / Joint Communication issued for banks since the PA-regime began (~1996), no time-bound. v1.16 adds 14 new register rows in Domain A (Prudential), each with both an instrument-number AND a topic confirmed via URL filename or quoted secondary-source (Mondaq / Lexology / Moody's / Bowmans / Webber Wentzel / BIS FSI). The 14 new rows are: ORG-PR-35 (D1/2015 — Recovery plan minimum requirements; pins PR #171 §6 #4), ORG-PR-36 (D6/2015 — Revised LCR), ORG-PR-37 (D5/2021 — Capital Framework for South Africa based on Basel III; supersedes D4/2020), ORG-PR-38 (D4/2021 — Externally-facilitated liquidity stress simulation), ORG-PR-39 (D9/2021 — Principles for the Sound Management of Operational Risk; adopts BCBS PSMOR March 2021 12-principles), ORG-PR-40 (D3/2022 — LEX Directive Annexure 1 dated 1 April 2022), ORG-PR-41 (D4/2022 — Directive on Risk Return), ORG-PR-42 (D7/2022 — Banks CBC Directive — Directors and executive officers), ORG-PR-43 (D1/2023 — Matters related to NSFR; replaces D8/2017), ORG-PR-44 (D3/2023 — Regulatory treatment of accounting provisions), ORG-PR-45 (D4/2023 — Directive on operational resilience; supersedes D10/2021), ORG-PR-46 (D8/2023 — Threshold amounts for revised SA + IRB approaches for credit risk + liquidity-risk framework + IRRBB; replaces D1/2016), ORG-PR-47 (D2/2025 — Capital treatment of significant investments in Insurance entities), ORG-PR-48 (GN 5/2013 — Foreign Exchange Settlement Risk). Closes 4 of the 6 PR #171 §6 substrate gaps: WS-PA-CIRCULAR-INVENTORY (no register additions — circular catalogue is dominated by lapsed pandemic-relief + meta catalogue-resets); D1/2025-vs-D10/2025 supersession (D10/2025 supersedes D1/2025; ORG-PR-27 status updated); recovery-and-resolution-planning Directive identification (D1/2015 per Mondaq quote anchoring 4 February 2015 issuance; ORG-PR-30 + ORG-BNK-RECOVERY-CONS citations refined; ORG-PR-35 added as the precise instrument anchor); GN 1/2024-vs-G3/2024 climate-reading clarification (distinct instruments; ORG-PR-22 body refined). Filtered out per the wholesale-institutional bank profile (project_strategic_foundation.md + project_indirect_participant_posture.md): D6/2023 (D-SIB consolidated information) + D3/2025 (D-SIB Leverage Buffer) — Hoz is not a D-SIB; GN 3/2010 (IMA market-risk hypothetical backtesting) — Hoz uses Standardised Approach for market risk; GN 3/2011 (covered bonds) — Hoz does not currently issue covered bonds; routed to new WS-CONDITIONAL-BIND-TRACKING workstream. Surfaced-but-untyped Directives (2014–2018) and Guidance Notes (2010, 2018) — topic confirmation routed to WS-INSTRUMENT-ANALYSES for Imani's deep-PDF-text-extraction follow-up; per Principle 2 (no invented topics), no register rows added until topic is confirmed. Pre-2010 Directive corpus: wholesale superseded by Regulations Relating to Banks 2012 + subsequent BCBS-aligned directives — no register rows added. PA Banks Circulars (2020–2025): dominated by lapsed pandemic-relief instruments + meta catalogue-resets — no in-force applicable circulars for a wholesale bank. Joint Standards regime: comprehensive in the register at v1.15 (no new JS rows in v1.16). Thirteen new procedure-stub routes recorded: recovery-resolution-planning refinement (Helena+Camille), LCR-NSFR-liquidity-stress (Eitan+Helena), capital-framework-Basel-III (Camille+Helena), operational-resilience (Devon+Helena+Rashida), large-exposures (Helena+Camille), risk-return-reporting (Helena+Bea+Iris), directors-executive-officers-fit-and-proper (Owen), regulatory-treatment-of-accounting-provisions (Bea+Camille), threshold-amounts-credit-liquidity-IRRBB (Helena+Camille+Eitan), capital-treatment-of-insurance-investments (Camille+Helena), FX-settlement-risk (Saskia+Helena), outsourcing-of-functions (Devon+Senna+Iris), group-controls (Owen+Helena+Camille). The 14 [citation: TBC] markers added in v1.16 fold into the standing WS-INSTRUMENT-ANALYSES workstream for precise § / clause resolution. Net-new-vs-PR #171 delta: +14 register rows; ~50+ instruments surveyed across categories (in-force + superseded + repealed + meta + informational + insurer-only + conditional-bind); 4 of 6 PR #171 §6 substrate gaps closed.",
  comment:
    "register-curator action recorded as event per CLAUDE.md events-first authoring; standing authority — no new CEO decision required; full historical sweep per Marc dispatch lifting PR #171 self-imposed time-bounds",
  sourceDoc: "Owner Inbox/2026-05-10_mira-imani_pa-communications-full-historical-sweep.md",
  asOf: "2026-05-10T22:00:00.000Z",
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
      recordedVia: "script:record-d-pa-communications-full-historical-sweep",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
