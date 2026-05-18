// prototype/scripts/record-zara-cco-decisions.ts
//
// Operationalise Zara (CCO)'s first own-authority Decision event.
// Authority: brief:atlas:gateway-scenario-d-cfo-coo-cco-authority-operati:2026-05-18
//
// Run once from prototype/: bun run scripts/record-zara-cco-decisions.ts
// This script stays in the repo as an audit record.

import { clock } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

recordDecision(
  {
    decisionId: "D-CCO-RMCP-V1-ATTESTATION-2026-Q2",
    phase: "approved",
    authority: "CCO",
    authorityRef: "zara@bank",
    title: "CCO attestation: RMCP v1 programme — build-phase controls are adequate for pre-commencement stage",
    category: "compliance",
    recommendation:
      "Attest that RMCP v1 controls are adequate for the current build phase. No customer onboarding has commenced; STR/CTR/TPR obligations are not yet triggered; the programme is ready for licence-application review.",
    rationale:
      "Attestation issued under CCO mandate per Zara operating spec §9. No CDD/EDD obligations triggered (no clients). No STR/CTR/TPR obligations triggered (no transactions). RMCP v1 is adequate for build phase. Next attestation at commencement-of-trading or material RMCP revision.",
    sourceDocHashes: [],
    citations: ["FIC-ACT-S21", "FIC-ACT-S22", "FIC-ACT-S29", "BANKS-ACT-94-1990-S60"],
    recordedVia: "agent:autonomous",
  },
  clock.now(),
);
