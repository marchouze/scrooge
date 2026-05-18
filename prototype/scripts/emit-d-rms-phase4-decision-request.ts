// scripts/emit-d-rms-phase4-decision-request.ts
//
// Emit the D-RMS-PHASE-4 decision request:
//   - Retire legacy inbox directories from in-tree
//   - Retire dashboard ownerInboxFeed parser
//   - RMS registers become sole canonical
//
// Archive-scope (D-RMS-PHASE-4-ARCHIVE-SCOPE) was approved 2026-05-17.
// This decision gates the dashboard code cutover.
//
// Author: Owen (Company Secretary, governance)

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));

function hasPhase(decisionId: string, phase: string): boolean {
  const history = register.byId.get(decisionId);
  if (!history) return false;
  return history.events.some((e) => e.phase === phase);
}

if (hasPhase("D-RMS-PHASE-4", "requested")) {
  console.log(JSON.stringify({ level: "info", msg: "D-RMS-PHASE-4: already requested — skip" }));
} else {
  recordDecision(
    {
      decisionId: "D-RMS-PHASE-4",
      phase: "requested",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title:
        "RMS Phase 4 — retire legacy inbox directories from in-tree; dashboard legacy parser removal",
      category: "governance",
      recommendation:
        "Approve RMS Phase 4: remove legacy Owner Inbox/ and Team Inbox/ directories from the repo tree; retire the dashboard ownerInboxFeed parser; RMS registers become sole canonical.",
      rationale:
        "Archive-scope (D-RMS-PHASE-4-ARCHIVE-SCOPE) approved 2026-05-17. Phase 4 dashboard code changes require this decision to gate the full cutover.",
      sourceDocHashes: [],
      citations: ["D-RMS-PHASE-4-ARCHIVE-SCOPE", "D-RMS-PHASE-1"],
      recordedVia: "agent:autonomous",
    },
    clock.now(),
  );
  console.log(JSON.stringify({ level: "info", msg: "D-RMS-PHASE-4: decision requested" }));
}

console.log(JSON.stringify({ level: "info", msg: "emit-d-rms-phase4-decision-request: complete" }));
