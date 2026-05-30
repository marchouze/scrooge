// prototype/scripts/decisions/scrooge-agent-autonomy-cohort-2-pilot.ts
//
// CEO authorisation (Marc, in-session 2026-05-30 via Scrooge session delegation)
// to scope the cohort-2 autonomous-authoring pilot — the pre-Azure path to
// advance Principle 6 (autonomous by default) and close the "agents are still
// realised by Scrooge-coordinated in-session runs" gap (CEO state-of-the-bank
// 2026-05-30, lowlight #1).
//
// Finding behind the decision: autonomy is NOT blocked by the Azure/M8 lift.
// The substrate already exists locally — launchd scheduler, ~12 agent
// goal-loops, the Anthropic SDK wrapper runtime/claude.ts (prompt-caching +
// TokenUsageRecorded metering), the 100-gate recon safety-net, and the
// dispatch CLI. What is held back is a deliberate cost-and-safety cap: the
// cohort-1 goal-loops are rule-engine-only ("no LLM calls — LLM cost-cap") and
// the LLM may only add narrative on top of mechanical observations, never
// author a net-new deliverable unsupervised. This decision authorises Atlas +
// Sade to SCOPE (design brief, not a build commitment) the path that lifts
// that cap safely.
//
// Authority chain: CEO build-phase authority over engineering / substrate
// decisions per CLAUDE.md "Decision authority routing" table. Marc's "yes"
// in-session = session delegation per CLAUDE.md "Scrooge session delegation".
//
// Author: Scrooge (Chief of Staff / Orchestrator), recording on behalf of Marc.

import { clock } from "../../platform/composition.ts";
import { recordDecision } from "../../runtime/decisions/record.ts";

const result = recordDecision(
  {
    decisionId: "D-AGENT-AUTONOMY-COHORT-2-PILOT",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "Scope the cohort-2 autonomous-authoring pilot (Vera-first) + guardrails — pre-Azure",
    category: "engineering",
    recommendation:
      "Atlas (Core banking platform architect, engineering) and Sade (AgentOps & Token Efficiency Engineer, engineering) jointly author a design/scoping brief — not a build — for a cohort-2 autonomous-authoring pilot that lets a single low-blast-radius agent's goal-loop author a net-new deliverable via runtime/claude.ts and land it behind the CI gate, with NO dependence on the Azure/M8 lift. The brief must cover: (1) the goal-loop -> claude.ts authoring path for Vera (Internal audit / continuous-assurance engineer) as the first agent, chosen because her deliverables and the recon safety-net are the same surface; (2) three guardrails — Atlas owns (a) a CI gate in the headless path (run `bun run ci` in the agent worktree before any auto-commit; red -> SubstrateAlert + leave brief open, never land) and (c) a per-agent path allowlist so an autonomous run may only touch its own domain's files; Sade owns (b) a token governor reading TokenUsageRecorded — per-tick ceiling, daily spend cap, max-concurrent-runs, hard kill-switch env var, refusing to start a run when over budget; (3) the async-approval model that moves Marc from in-loop executor to batch approver of Decision(requested) escalations via the existing decisions register; (4) a shadow-soak gate reusing Atlas's existing 2-tick dryRun pattern, with Vera recon-comparing autonomous output against the gate set before any flip to live; (5) an explicit statement of what genuinely remains for Azure (event-store durability/HA, Key Vault for the API key) vs what does not. Deliverable is a scoping brief filed to RMS; each guardrail and the pilot itself are independently shippable follow-ons.",
    rationale:
      "The 2026-05-30 CEO state-of-the-bank names 'we are not yet autonomous' as the single biggest gap: every agent run today is a Scrooge-coordinated in-session run, making Marc-in-session the binding runtime. Substrate inspection shows the gap is a deliberate cost/safety policy cap, not a missing capability or an Azure dependency — runtime/claude.ts already exists with prompt-caching and token metering, goal-loops already detect warranted work (467 AgentGoalEvaluated / 369 AgentGoalDeferred events), the launchd scheduler and 100-gate recon harness are local, and the agent-runtime workflows already sync to Neon. Advancing autonomy before Azure therefore needs a scoped pilot plus three guardrails, all locally buildable. Starting with Vera minimises blast radius because her output is the assurance surface itself. This decision commissions the design only; the build is a subsequent decision once the brief is reviewed.",
    sourceDocHashes: [],
    citations: [
      "urn:principle:bank:6-autonomous-by-default",
      "urn:decision:bank:D-AGENT-AUTONOMY-OPERATIONAL",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    { eventId: result.eventId, decisionId: "D-AGENT-AUTONOMY-COHORT-2-PILOT" },
    null,
    2,
  ),
);
