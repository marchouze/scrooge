// prototype/scripts/decisions/scrooge-dispatch-sync-primitive.ts
//
// CEO authorisation (Marc, in-session 2026-05-20 via Scrooge session delegation)
// for Atlas to build a dispatch sync primitive that prevents the v1.0 incident
// in WS-MARKET-RISK-PROCEDURES from recurring.
//
// Incident: 2026-05-20 PR #610 (Helena v1.0). Helena's CRO decision was
// dispatched in parallel with Bea's §6.3 independent-validation review.
// Helena's 60s poll fallback fired before Bea's comment landed, even though
// Bea posted ~3 min before merge. Helena merged with phase: approved despite
// Bea's READY-WITH-OBSERVATIONS. Two procedures (FRTB-SA, MRL) landed on main
// with material gaps that required a v1.1 amendment cycle (PR #615).
//
// Authority chain: CEO build-phase authority over engineering / substrate
// decisions per CLAUDE.md "Decision authority routing" table. Marc's "y file
// now" in-session = session delegation per CLAUDE.md "Scrooge session
// delegation" rule.
//
// Author: Scrooge (Chief of Staff / Orchestrator), recording on behalf of Marc.

import { clock } from "../../platform/composition.ts";
import { recordDecision } from "../../runtime/decisions/record.ts";

const result = recordDecision(
  {
    decisionId: "D-DISPATCH-SYNC-PRIMITIVE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "Authorise Atlas to build a dispatch sync primitive for reviewer+decider runs",
    category: "engineering",
    recommendation:
      "Atlas (Core banking platform architect, engineering) designs and builds a synchronisation primitive that prevents a decider-class dispatch (e.g., Helena CRO approval) from closing before all required reviewer-class dispatches (e.g., Bea §6.3 validation) bracketing the same scope have closed. Default mechanism: an event-driven blocker — decider-class briefs may declare `blockedOn: AgentRunClosed{briefId|deliverableScope}` and the dispatch runtime refuses to emit AgentRunStarted until those events land. Fallback: if `blockedOn` events do not land within a configurable timeout, the decider's run is suspended (not silently advanced) and Scrooge is notified. Alternative paths Atlas may choose if simpler: (a) Scrooge orchestrator enforces sequential dispatch and never opens decider+reviewer briefs concurrently for the same scope; (b) richer poll-with-recheck contract baked into agent prompts. Atlas picks the design and writes a short spec before building.",
    rationale:
      "On 2026-05-20, WS-MARKET-RISK-PROCEDURES v1.0 PR #610 merged with two procedures (PROC-RISK-FRTB-SA-01, PROC-RISK-MRL-01) carrying material defects flagged by Bea but unseen by Helena at decision time. Root cause is a missing synchronisation primitive between parallel reviewer (Bea) and decider (Helena) runs. The v1.1 amendment cycle (PR #615) corrected the substantive content but the underlying substrate defect remains. This decision is the CEO authorisation to fix it. Citations: market-risk-policy-v1 §6.3 (independent validation gate); D-MR-PROC-S8-2-APPROVE (v1.0); D-MR-PROC-S8-2-V11-APPROVE (v1.1). Substrate-gap chain captured in AgentRunClosed event 196ea822-d220-48ac-825c-06ffacd2a9dd (Helena v1.0).",
    sourceDocHashes: [],
    citations: [
      "urn:policy:bank:market-risk:v1",
      "urn:decision:bank:D-MR-PROC-S8-2-APPROVE",
      "urn:decision:bank:D-MR-PROC-S8-2-V11-APPROVE",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  clock.now(),
);

console.log(JSON.stringify(result, null, 2));
