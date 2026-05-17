import { clock, eventStore } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";

const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
const id = "D-RMS-PHASE-4-ARCHIVE-SCOPE";
const already = register.byId.get(id)?.events.some(e => e.phase === "approved");

if (already) {
  console.log(JSON.stringify({ level: "info", msg: `${id}: already approved` }));
} else {
  recordDecision({
    decisionId: id,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "RMS Phase 4 — scope of legacy directory archival",
    category: "governance",
    recommendation: "Full move: Owner Inbox/, Owner Inbox/actioned/, Team Inbox/, and Team Inbox/actioned/ all move to archive/ at Phase 4 cutover. No directories stay in-tree.",
    rationale: "CEO approved in-session 2026-05-17. Once the one-time RecordFiled bulk-index event lands and the dashboard reads only registers, the legacy directories have no load-bearing role. Keeping actioned/ in-tree creates dead weight and ambiguity. Full archive is cleanest.",
    sourceDocHashes: [],
    citations: ["D-RMS-PHASE-1", "D-RMS-PHASE-2-3-ACCELERATE"],
    recordedVia: "scrooge:session-delegation",
  }, clock.now());
  console.log(JSON.stringify({ level: "info", msg: `${id}: approved` }));
}
