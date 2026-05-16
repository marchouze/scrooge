// scripts/request-d-rms-phase-2-4-decisions.ts
//
// Open two CEO decisions called out in the RMS Phase 2/3/4 plan
// (/Users/marc/.claude/plans/is-rms-phase-2-snappy-biscuit.md):
//
//   1. D-RMS-PHASE-4-ARCHIVE-SCOPE
//      Does Phase 4 cutover also move Owner Inbox/actioned/ and
//      Team Inbox/actioned/ to archive/, or do they stay queryable
//      in-tree? Phase 1 spec §15 implies full move.
//
//   2. D-RMS-PHASE-2-4-AUTHORSHIP
//      Owen + Atlas joint authorship for the Phase 2/3/4 specs
//      (mirrors Phase 1 §16 q5).
//
// Idempotent: skips emission if a `requested` event for either id is
// already in the register.
//
// Author: Scrooge (Chief of Staff, orchestrator)

import { eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { requestDecision } from "../runtime/decisions/record";

const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));

function hasPhase(decisionId: string, phase: string): boolean {
  const history = register.byId.get(decisionId);
  if (!history) return false;
  return history.events.some((e) => e.phase === phase);
}

function open(decisionId: string, title: string, recommendation: string, rationale: string): void {
  if (hasPhase(decisionId, "requested")) {
    console.log(JSON.stringify({ level: "info", msg: `${decisionId}: already open — skip` }));
    return;
  }
  requestDecision({
    decisionId,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title,
    category: "governance",
    recommendation,
    rationale,
    sourceDocHashes: [],
    citations: ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"],
    recordedVia: "scrooge:session-delegation:rms-phase-2-plan",
    actor: { type: "human", id: "marc@tgv.co.za" },
  });
  console.log(JSON.stringify({ level: "info", msg: `${decisionId}: opened for CEO action` }));
}

// ---------------------------------------------------------------------------
// 1. Phase 4 archive scope
// ---------------------------------------------------------------------------
open(
  "D-RMS-PHASE-4-ARCHIVE-SCOPE",
  "RMS Phase 4 — scope of legacy directory archival",
  "Approve full move of Owner Inbox/, Owner Inbox/actioned/, Team Inbox/, and Team Inbox/actioned/ to archive/ at Phase 4 cutover.",
  "RMS Phase 1 spec §15 (Owen + Atlas, 2026-05-09, CEO-approved as D-RMS-PHASE-1) describes Phase 4 as moving the legacy directories under archive/ with a one-time RecordFiled index event capturing the bulk-historical context. The actioned/ subdirectories have been useful for in-session memory continuity, so we are seeking explicit CEO direction on whether they (a) also move to archive/ (recommended — they are not authoritative once the index event lands and the dashboard reads only registers), or (b) stay queryable in-tree as a historical convenience. Decision needed before Phase 4 dispatch.",
);

// ---------------------------------------------------------------------------
// 2. Phase 2/3/4 spec authorship
// ---------------------------------------------------------------------------
open(
  "D-RMS-PHASE-2-4-AUTHORSHIP",
  "RMS Phase 2/3/4 spec authorship — Owen + Atlas joint, as Phase 1",
  "Approve Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering) joint authorship for Phase 2, Phase 3, and Phase 4 specs.",
  "RMS Phase 1 spec §16 q5 (Owen + Atlas, 2026-05-09) left the Phase 2/3/4 authorship routing open. The dual-author governance-plus-substrate voice landed Phase 1 cleanly under D-RMS-PHASE-1; same pairing for the remaining specs preserves the governance/substrate balance. Decision needed before the Phase 2 spec dispatch.",
);

console.log(
  JSON.stringify({
    level: "info",
    msg: "request-d-rms-phase-2-4-decisions: complete",
  }),
);
