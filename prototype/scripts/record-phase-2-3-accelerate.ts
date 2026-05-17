import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));

function hasPhase(decisionId: string, phase: string): boolean {
  const history = register.byId.get(decisionId);
  if (!history) return false;
  return history.events.some((e) => e.phase === phase);
}

// 1. Record the acceleration decision
const ACCEL_ID = "D-RMS-SOAK-WAIVER";
if (!hasPhase(ACCEL_ID, "approved")) {
  recordDecision(
    {
      decisionId: ACCEL_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: "RMS Phase 2 and Phase 3 — waive one-agent-week observation period; immediate cutover",
      category: "governance",
      recommendation:
        "Approve RMS Phase 2 and Phase 3 as effective immediately upon spec approval, with no mandatory one-agent-week soak period.",
      rationale:
        "The one-agent-week observation period was a prudence buffer built into the Phase 1 spec. The substrate is stable, the dispatch CLIs (dispatch:open-brief, dispatch:start-run, dispatch:close-run) and RecordFiled event type are live and proven. Deferring a further week adds no quality signal. CEO directs immediate cutover: once Phase 2 and Phase 3 specs are authored and approved, the acceptance criterion is met at the moment of approval.",
      sourceDocHashes: [],
      citations: ["D-RMS-PHASE-1"],
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  );
  console.log(JSON.stringify({ level: "info", msg: `${ACCEL_ID}: recorded` }));
} else {
  console.log(JSON.stringify({ level: "info", msg: `${ACCEL_ID}: already recorded` }));
}

// 2. Open D-RMS-PHASE-2
const PHASE2_ID = "D-RMS-PHASE-2";
if (!hasPhase(PHASE2_ID, "requested")) {
  requestDecision({
    decisionId: PHASE2_ID,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "RMS Phase 2 — route all agent dispatches through AgentBriefIssued; retire direct Team Inbox authoring",
    category: "governance",
    recommendation:
      "Approve Phase 2: all new agent dispatches emit AgentBriefIssued event first; Team Inbox markdown files become derived renders of the Briefs register only.",
    rationale:
      "Phase 1 shipped the dispatch CLIs and Briefs register. Phase 2 makes events-first dispatch mandatory. Acceptance criterion per D-RMS-SOAK-WAIVER: immediate on approval.",
    sourceDocHashes: [],
    citations: ["D-RMS-PHASE-1", "D-RMS-SOAK-WAIVER"],
    recordedVia: "scrooge:session-delegation",
    actor: { type: "human", id: "marc@tgv.co.za" },
  });
  console.log(JSON.stringify({ level: "info", msg: `${PHASE2_ID}: opened` }));
} else {
  console.log(JSON.stringify({ level: "info", msg: `${PHASE2_ID}: already open` }));
}

// 3. Open D-RMS-PHASE-3
const PHASE3_ID = "D-RMS-PHASE-3";
if (!hasPhase(PHASE3_ID, "requested")) {
  requestDecision({
    decisionId: PHASE3_ID,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "RMS Phase 3 — route all deliverables through RecordFiled; retire direct Owner Inbox authoring",
    category: "governance",
    recommendation:
      "Approve Phase 3: all new deliverables stored in document substrate via RecordFiled event; Owner Inbox markdown files become derived renders only.",
    rationale:
      "Phase 1 shipped the RecordFiled event type and document store. Phase 3 makes it mandatory for all deliverables. Acceptance criterion per D-RMS-SOAK-WAIVER: immediate on approval.",
    sourceDocHashes: [],
    citations: ["D-RMS-PHASE-1", "D-RMS-SOAK-WAIVER"],
    recordedVia: "scrooge:session-delegation",
    actor: { type: "human", id: "marc@tgv.co.za" },
  });
  console.log(JSON.stringify({ level: "info", msg: `${PHASE3_ID}: opened` }));
} else {
  console.log(JSON.stringify({ level: "info", msg: `${PHASE3_ID}: already open` }));
}

console.log(JSON.stringify({ level: "info", msg: "record-soak-waiver: complete" }));
