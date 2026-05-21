import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

recordDecision(
  {
    decisionId: "D-RMS-PHASE-4",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "RMS Phase 4 — retire legacy inbox directories from in-tree; dashboard legacy parser removal",
    category: "governance",
    recommendation:
      "Approve RMS Phase 4: remove legacy Owner Inbox/ and Team Inbox/ directories from the repo tree; retire the dashboard ownerInboxFeed parser; RMS registers become sole canonical.",
    rationale:
      "Archive-scope (D-RMS-PHASE-4-ARCHIVE-SCOPE) approved 2026-05-17. File archive complete (PR #523). CEO approved full Phase 4 cutover in session 2026-05-18.",
    sourceDocHashes: [],
    citations: ["D-RMS-PHASE-4-ARCHIVE-SCOPE", "D-RMS-PHASE-1"],
    recordedVia: "scrooge:session-delegation",
  },
  clock.now(),
);
