// prototype/scripts/record-thandiwe-cae-decisions.ts
//
// Operationalise Thandiwe (CAE)'s first own-authority Decision event.
// Authority: brief:owen:first-ciso-cae-own-authority-decision-events-ope:2026-05-18
//
// Run once from prototype/: bun run scripts/record-thandiwe-cae-decisions.ts
// This script stays in the repo as an audit record.

import { clock } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

recordDecision(
  {
    decisionId: "D-CAE-QUARTERLY-CONTROL-OPINION-2026-Q2",
    phase: "approved",
    authority: "CAE",
    authorityRef: "thandiwe@bank",
    title: "CAE quarterly control opinion — Q2 2026 build-phase: controls clean",
    category: "governance",
    recommendation:
      "Vera's overnight recon of 2026-05-18: 7 pipelines pass, 0 fail, 0 warn. Control environment is clean at this stage of the build phase.",
    rationale:
      "Third-line opinion issued under CAE mandate per Thandiwe operating spec §9. No escalation required. Next opinion at Q3 2026 or on material finding.",
    sourceDocHashes: [],
    citations: ["GOV-FRAMEWORK-CAE-INDEPENDENCE"],
    recordedVia: "agent:autonomous",
  },
  clock.now(),
);
