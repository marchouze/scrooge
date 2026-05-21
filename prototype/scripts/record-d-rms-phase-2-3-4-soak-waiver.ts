// scripts/record-d-rms-phase-2-3-4-soak-waiver.ts
//
// Backfill Decision events for D-RMS-SOAK-WAIVER, D-RMS-PHASE-2, D-RMS-PHASE-3,
// and record CEO approval for D-RMS-PHASE-4 (in-session, Marc "go" 2026-05-17).
//
// D-RMS-PHASE-2 and D-RMS-PHASE-3 are already active per CLAUDE.md (Phase 2+3
// became immediate via D-RMS-SOAK-WAIVER on 2026-05-17, per PRs #509+#510).
// No Decision events existed in the store — this is a decision-event symmetry gap.
//
// D-RMS-PHASE-4: Marc (CEO) approved "go" in-session 2026-05-17 after reviewing
// the gap close-out plan. D-RMS-PHASE-4-ARCHIVE-SCOPE (scope) was already approved;
// this records the execution approval.
//
// Authority: scrooge:session-delegation; marc@tgv.co.za.
// Run once from prototype/: bun run scripts/record-d-rms-phase-2-3-4-soak-waiver.ts

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

function alreadyApproved(id: string): boolean {
  const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
  return register.byId.get(id)?.events.some((e) => e.phase === "approved") ?? false;
}

// 1. D-RMS-SOAK-WAIVER — waives the soak period between Phase 1 and Phases 2+3
if (alreadyApproved("D-RMS-SOAK-WAIVER")) {
  console.log("D-RMS-SOAK-WAIVER: already approved, skipping");
} else {
  recordDecision(
    {
      decisionId: "D-RMS-SOAK-WAIVER",
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: "RMS soak-period waiver — Phase 2 and Phase 3 immediate",
      category: "governance",
      recommendation:
        "Waive the planned soak period between RMS Phase 1 and Phases 2+3. Phase 2 (AgentBriefIssued mandate) and Phase 3 (RecordFiled mandate) activate immediately on Phase 1 completion.",
      rationale:
        "Phase 1 substrate is substantively complete and proven. The soak period exists to surface integration issues; none were observed. Immediate activation removes a gate with no remaining risk-mitigation value. CEO approved in-session 2026-05-17.",
      sourceDocHashes: [],
      citations: ["D-RMS-PHASE-1"],
      recordedVia: "scrooge:session-delegation",
    },
    "2026-05-17T08:00:00.000Z",
  );
  console.log("D-RMS-SOAK-WAIVER: recorded");
}

// 2. D-RMS-PHASE-2 — AgentBriefIssued mandate for all dispatches
if (alreadyApproved("D-RMS-PHASE-2")) {
  console.log("D-RMS-PHASE-2: already approved, skipping");
} else {
  recordDecision(
    {
      decisionId: "D-RMS-PHASE-2",
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: "RMS Phase 2 — AgentBriefIssued mandate for all agent dispatches",
      category: "governance",
      recommendation:
        "Every agent dispatch must be backed by an AgentBriefIssued event emitted via dispatch:open-brief before the Agent() call. Team Inbox markdown files are derived renders of the event, not canonical artefacts.",
      rationale:
        "Principle 1 compliance: briefs are decisions to dispatch — they must be events. The Phase 2 spec (Owner Inbox/2026-05-17_owen-atlas_rms-phase-2-spec.md) is complete. Recon gate recon:rms-briefs-parity is live. Activated immediately under D-RMS-SOAK-WAIVER. CEO approved 2026-05-17.",
      sourceDocHashes: [],
      citations: ["D-RMS-PHASE-1", "D-RMS-SOAK-WAIVER"],
      recordedVia: "scrooge:session-delegation",
    },
    "2026-05-17T08:01:00.000Z",
  );
  console.log("D-RMS-PHASE-2: recorded");
}

// 3. D-RMS-PHASE-3 — RecordFiled mandate for all deliverables
if (alreadyApproved("D-RMS-PHASE-3")) {
  console.log("D-RMS-PHASE-3: already approved, skipping");
} else {
  recordDecision(
    {
      decisionId: "D-RMS-PHASE-3",
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: "RMS Phase 3 — RecordFiled mandate for all deliverables",
      category: "governance",
      recommendation:
        "Every deliverable must be backed by a RecordFiled event. Owner Inbox markdown files are derived renders of the event, not canonical artefacts. Recon gate recon:rms-documents-parity must pass before any PR that files a deliverable.",
      rationale:
        "Principle 1 compliance: deliverables are records — they must be events. The Phase 3 spec (Owner Inbox/2026-05-17_owen-atlas_rms-phase-3-spec.md) is complete. Recon gate recon:rms-documents-parity is live. Activated immediately under D-RMS-SOAK-WAIVER. CEO approved 2026-05-17.",
      sourceDocHashes: [],
      citations: ["D-RMS-PHASE-1", "D-RMS-SOAK-WAIVER", "D-RMS-PHASE-2"],
      recordedVia: "scrooge:session-delegation",
    },
    "2026-05-17T08:02:00.000Z",
  );
  console.log("D-RMS-PHASE-3: recorded");
}

// 4. D-RMS-PHASE-4 — Phase 4 execution approval (archive cutover)
if (alreadyApproved("D-RMS-PHASE-4")) {
  console.log("D-RMS-PHASE-4: already approved, skipping");
} else {
  recordDecision(
    {
      decisionId: "D-RMS-PHASE-4",
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: "RMS Phase 4 — archive cutover execution approval",
      category: "governance",
      recommendation:
        "Execute Phase 4: move Owner Inbox/, Owner Inbox/actioned/, Team Inbox/, Team Inbox/actioned/ to archive/owner-inbox/ and archive/team-inbox/ (with actioned/ subdirs preserved, per D-RMS-PHASE-4-ARCHIVE-SCOPE A-1). Bulk-index all historical files as RecordFiled events (B-1). Remove legacy Owner Inbox feed parser from dashboard. Retire rms-overlap-parity pipeline (C-1).",
      rationale:
        "Gate conditions met: Phase 2 and Phase 3 active; D-RMS-PHASE-4-ARCHIVE-SCOPE approved; spec complete at Owner Inbox/2026-05-17_owen-atlas_rms-phase-4-spec.md. CEO approved in-session 2026-05-17 ('go' response to gap close-out plan). Owen recommends A-1 / B-1 / C-1.",
      sourceDocHashes: [],
      citations: ["D-RMS-PHASE-1", "D-RMS-PHASE-2", "D-RMS-PHASE-3", "D-RMS-PHASE-4-ARCHIVE-SCOPE"],
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  );
  console.log("D-RMS-PHASE-4: recorded");
}
