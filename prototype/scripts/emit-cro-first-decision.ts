// prototype/scripts/emit-cro-first-decision.ts
//
// Operationalise Helena (CRO)'s first own-authority Decision event.
// Authority: brief:owen:cro-cosec-own-authority-first-event-scripts:2026-05-18
//
// Run once from prototype/: bun run scripts/emit-cro-first-decision.ts
// This script stays in the repo as an audit record.

import { clock } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

recordDecision(
  {
    decisionId: "D-CRO-RAS-BUILD-PHASE-ATTESTATION-2026-Q2",
    phase: "approved",
    authority: "CRO",
    authorityRef: "helena@bank",
    title: "CRO attestation: Q2 2026 Risk Appetite Statement — build-phase baseline approved",
    category: "risk",
    recommendation:
      "Attest the Q2 2026 build-phase Risk Appetite Statement baseline. Zero-appetite procedural gates (Mira, three FATF/AML lines) are measurable via event store. Tier-1 prudential lines (LCR, NSFR, CET1) are registered as substrate gaps pending Rohan + Ravi + Bea measurement build. No appetite breach detected on measurable lines.",
    rationale:
      "RAS attestation issued under CRO mandate per Helena operating spec §9. Risk-appetite-watch handler is live (autonomous daily run since 2026-05-16 under D-FLEET-ROLLOUT-SEQUENCING). 3 of 13 RAS lines currently measurable; 10-line gap is a registered roadmap item and does not constitute a breach. Escalation threshold for Board/BRC not met. Next attestation at Q3 2026 close or on material appetite breach.",
    sourceDocHashes: [],
    citations: ["D-FLEET-ROLLOUT-SEQUENCING", "GOV-FRAMEWORK-CRO-MANDATE"],
    recordedVia: "agent:autonomous",
  },
  clock.now(),
);
