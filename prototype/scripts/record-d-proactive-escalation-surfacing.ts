import { recordDecision } from "../runtime/decisions/record.ts";

const result = recordDecision(
  {
    decisionId: "D-PROACTIVE-ESCALATION-SURFACING",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Decision-required items from autonomous runs must be surfaced to the CEO proactively, not buried in substrate-state snapshots",
    category: "governance",
    recommendation:
      "Two-part remediation of the escalation-surfacing gap. (1) Discipline: codify a 'decision-required-first' operating rule in CLAUDE.md — every Scrooge status/report leads with failed agent runs, high+/critical SubstrateAlerts, and blocked work, each paired with a concrete call-to-action and a prompt for the CEO's OK in the same turn; gating remediation on CEO OK is permitted, silence is not. (2) Substrate: Atlas (substrate engineer) specs a CEO-escalation surface so that high+/critical SubstrateAlerts and SubstrateAgentRunFailed events emitted by autonomous runtime ticks are pushed to the CEO proactively (dashboard decision-required tile + digest) rather than sitting only in Atlas substrate-state snapshots that must be queried. Until the push channel ships, Scrooge is the manual stand-in and surfaces on every report.",
    rationale:
      "On 2026-06-09, asked 'what ran autonomously today', the autonomous runtime had correctly emitted a SubstrateAgentRunFailed for tomas:daily-reconciliation plus 3 high-severity integrity SubstrateAlerts (2 SLA unresolved-currency GBP/JPY suspense, 1 scheduled-dispatch failure). The runtime detect-and-escalated exactly as designed, but the escalations were only visible inside Atlas's hourly substrate-state markdown snapshot — there is no proactive push to the CEO. The CEO had to ask before the decision-required items surfaced, and they were then presented as a trailing footnote rather than a lead with a call-to-action. The autonomous-by-default principle (Principle 6) makes escalations first-class typed channels; a typed escalation that no one is pushed toward is a half-built channel. This decision closes the loop: the runtime escalates, and the escalation reaches the residual human decision-maker proactively.",
    sourceDocHashes: [],
    citations: ["D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE"],
    recordedVia: "scrooge:session-delegation",
  },
  new Date().toISOString(),
);

console.log(JSON.stringify(result, null, 2));
