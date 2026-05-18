// prototype/scripts/emit-cosec-first-decision.ts
//
// Operationalise Owen (CoSec)'s first own-authority Decision event.
// Authority: brief:owen:cro-cosec-own-authority-first-event-scripts:2026-05-18
//
// Run once from prototype/: bun run scripts/emit-cosec-first-decision.ts
// This script stays in the repo as an audit record.

import { clock } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

recordDecision(
  {
    decisionId: "D-COSEC-PROCEDURE-REGISTER-Q2-2026-BASELINE",
    phase: "approved",
    authority: "CoSec",
    authorityRef: "owen@bank",
    title:
      "CoSec approval: Q2 2026 procedure register baseline — 103 procedures POPULATED, governance clean",
    category: "governance",
    recommendation:
      "Approve the Q2 2026 build-phase procedure register baseline. 103 procedures are in POPULATED state; 1 PLANNED (swift-csp, deferred). Register reflects the canonical governance and operating procedures for the build phase.",
    rationale:
      "Procedure register review completed under CoSec mandate per Owen operating spec §9. All S7-Targeted procedures are POPULATED; no STUB entries remain in the active register. The single PLANNED entry (swift-csp) is deferred pending correspondent-bank confirmation and is not a gap at this build stage. Decision-authority routing table operationalised per D-DECISIONS-FRAMEWORK-REDESIGN. No escalation trigger met. Next review at Q3 2026 or on material procedure gap finding.",
    sourceDocHashes: [],
    citations: ["D-DECISIONS-FRAMEWORK-REDESIGN", "GOV-FRAMEWORK-COSEC-MANDATE"],
    recordedVia: "agent:autonomous",
  },
  clock.now(),
);
