import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));

function hasPhase(decisionId: string, phase: string): boolean {
  const history = register.byId.get(decisionId);
  if (!history) return false;
  return history.events.some((e) => e.phase === phase);
}

for (const [id, title, recommendation] of [
  [
    "D-RMS-PHASE-2",
    "RMS Phase 2 — route all agent dispatches through AgentBriefIssued; retire direct Team Inbox authoring",
    "Approved: all new agent dispatches must emit AgentBriefIssued event first via dispatch:open-brief CLI; Team Inbox markdown files become derived renders of the Briefs register only. Effective immediately per D-RMS-SOAK-WAIVER.",
  ],
  [
    "D-RMS-PHASE-3",
    "RMS Phase 3 — route all deliverables through RecordFiled; retire direct Owner Inbox authoring",
    "Approved: all new deliverables stored in document substrate via RecordFiled event; Owner Inbox markdown files become derived renders only. Effective immediately per D-RMS-SOAK-WAIVER.",
  ],
] as const) {
  if (hasPhase(id, "approved")) {
    console.log(JSON.stringify({ level: "info", msg: `${id}: already approved — skip` }));
    continue;
  }
  recordDecision(
    {
      decisionId: id,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title,
      category: "governance",
      recommendation,
      rationale:
        "Acceleration approved in-session by CEO (marc@tgv.co.za). One-agent-week soak period waived per D-RMS-SOAK-WAIVER. Substrate is stable and proven.",
      sourceDocHashes: [],
      citations: ["D-RMS-PHASE-1", "D-RMS-SOAK-WAIVER"],
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  );
  console.log(JSON.stringify({ level: "info", msg: `${id}: approved` }));
}

console.log(JSON.stringify({ level: "info", msg: "approve-phase-2-3: complete" }));
