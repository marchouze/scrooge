// prototype/scripts/record-devon-coo-decisions.ts
//
// Operationalise Devon (COO)'s first own-authority Decision event.
// Authority: brief:atlas:gateway-scenario-d-cfo-coo-cco-authority-operati:2026-05-18
//
// Run once from prototype/: bun run scripts/record-devon-coo-decisions.ts
// This script stays in the repo as an audit record.

import { clock } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

recordDecision(
  {
    decisionId: "D-COO-CAB-SUBSTRATE-SCHEDULER-2026-Q2",
    phase: "approved",
    authority: "COO",
    authorityRef: "devon@bank",
    title: "COO CAB approval: ScheduledTrigger emitter (A2.1) — approved for substrate deployment",
    category: "other",
    recommendation:
      "Approve deployment of the Bun-based substrate scheduler (ScheduledTrigger emitter, A2.1) to the build-phase substrate. Change is infrastructure-only; no customer-facing impact.",
    rationale:
      "CAB review completed under COO mandate per Devon operating spec §9. Change affects substrate scheduler only; no customer-facing routes; DR/BC impact nil; SLO headroom confirmed. No escalation triggers met.",
    sourceDocHashes: [],
    citations: ["ORG-PR-01"],
    recordedVia: "agent:autonomous",
  },
  clock.now(),
);
