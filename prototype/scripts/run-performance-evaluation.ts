// scripts/run-performance-evaluation.ts
//
// One-shot evaluation run for the 2026-05-14/15 period.
//
// This script contains a hardcoded evaluation dataset computed from:
//   - git log origin/main --since="2026-05-14" --until="2026-05-16"
//   - PR titles and CI conflict data for PRs #387–#395
//   - Scoring rubric in CLAUDE.md §Dispatch discipline (Sade evaluation run)
//
// Agents evaluated (all with ≥1 PR in the period):
//   Iris (#387), Atlas (#388), Zara (#389), Mira (#390), Sade (#391),
//   Imani (#392, joint Atlas+Imani), Noa (#393), Anya (#394), Ravi (#395)
//
// Idempotent: checks for existing AgentPerformanceEvaluated events for
// evaluationPeriod = "2026-05-14" before emitting.
//
// Usage:
//   bun run agent:performance-eval
//   bun run scripts/run-performance-evaluation.ts --force
//
// Author: Sade (AgentOps & Token Efficiency Engineer, engineering)

import { eventStore } from "../platform/composition";
import {
  makeAgentFeedbackIssued,
  makeAgentPerformanceEvaluated,
} from "../platform/event-store/event-types/performance";
import type { Actor } from "../platform/event-store/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVALUATION_PERIOD = "2026-05-14";
const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-05-15T08:00:00.000Z";
const CITATIONS = ["D-AGENT-AUTONOMY-OPERATIONAL"];
const ACTOR: Actor = {
  type: "service",
  id: "agent:sade:performance-evaluator",
};

const force = process.argv.includes("--force");

// ---------------------------------------------------------------------------
// Scoring helpers (mirror the rubric in the dispatch brief)
// ---------------------------------------------------------------------------

/** Clamp a number to [0, 1]. */
function clamp(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function overallScore(delivery: number, quality: number, strategic: number): number {
  return clamp(delivery * 0.4 + quality * 0.4 + strategic * 0.2);
}

function tier(overall: number): "exceeds" | "meets" | "needs-improvement" | "unsatisfactory" {
  if (overall >= 0.85) return "exceeds";
  if (overall >= 0.65) return "meets";
  if (overall >= 0.4) return "needs-improvement";
  return "unsatisfactory";
}

// ---------------------------------------------------------------------------
// Hardcoded evaluation dataset — 2026-05-14/15 period
//
// Scoring rubric (from dispatch brief):
//   delivery  = runsDelivered / runsStarted  (1 PR = 1 run delivered = 1.0)
//   quality   = 1.0 − 0.1×ciViolation − 0.15×auditFinding
//               + 0.05 for clean merge (no conflicts); capped at 1.0
//   strategic = 0.2×prsMerged + 0.1×decisionsAdvanced; capped at 1.0
//   overall   = 0.4×delivery + 0.4×quality + 0.2×strategic
//
// CI violations attributed per dispatch brief §3:
//   PRs #391 (Sade), #392 (Imani joint with Atlas), #393 (Noa), #395 (Ravi)
//   all had event-types/index.ts conflicts requiring manual rebase — 1 violation each.
//
// Decision advanced: Atlas — D-POLICY-DOCUMENT-HOME (Option C, PR #388).
// ---------------------------------------------------------------------------

interface AgentData {
  agentId: string;
  fullTitle: string; // "Name (Role, department)" — identity discipline
  prsMerged: number;
  ciViolations: number;
  auditFindingsRaised: number;
  decisionsAdvanced: string[];
  workstreamsProgressed: string[];
  prNumber: number | number[];
  note: string;
}

const AGENTS: AgentData[] = [
  {
    agentId: "iris",
    fullTitle: "Iris (Information Officer, governance)",
    prsMerged: 1,
    ciViolations: 0,
    auditFindingsRaised: 0,
    decisionsAdvanced: [],
    workstreamsProgressed: [],
    prNumber: 387,
    note: "PAIA Manual v1 scaffold — s.51 statutory document",
  },
  {
    agentId: "atlas",
    fullTitle: "Atlas (Core Banking Platform Architect, engineering)",
    prsMerged: 1,
    ciViolations: 0,
    auditFindingsRaised: 0,
    decisionsAdvanced: ["D-POLICY-DOCUMENT-HOME"],
    workstreamsProgressed: [],
    prNumber: 388,
    note: "D-POLICY-DOCUMENT-HOME Option C + policy register backfill",
  },
  {
    agentId: "zara",
    fullTitle: "Zara (Chief Compliance Officer, governance)",
    prsMerged: 1,
    ciViolations: 0,
    auditFindingsRaised: 0,
    decisionsAdvanced: [],
    workstreamsProgressed: [],
    prNumber: 389,
    note: "RMCP v1 scaffold — FIC Act s.42 Risk Management and Compliance Programme",
  },
  {
    agentId: "mira",
    fullTitle: "Mira (Compliance / RegTech Engineer, engineering)",
    prsMerged: 1,
    ciViolations: 0,
    auditFindingsRaised: 0,
    decisionsAdvanced: [],
    workstreamsProgressed: [],
    prNumber: 390,
    note: "5 critical policy backfill — Collateral Mgmt, Counterparty Onboarding, Margin, Hedge Accounting, Pricing",
  },
  {
    agentId: "sade",
    fullTitle: "Sade (AgentOps & Token Efficiency Engineer, engineering)",
    prsMerged: 1,
    ciViolations: 1,
    auditFindingsRaised: 0,
    decisionsAdvanced: [],
    workstreamsProgressed: [],
    prNumber: 391,
    note: "AgentOps v1 + TokenUsageRecorded, AgentEfficiencyAdvisoryIssued, AgentPromptOptimizationApplied event types",
  },
  {
    agentId: "imani",
    fullTitle: "Imani (Legal-as-Code Engineer, engineering)",
    prsMerged: 1,
    ciViolations: 1,
    auditFindingsRaised: 0,
    decisionsAdvanced: [],
    workstreamsProgressed: [],
    prNumber: 392,
    note: "Event-trigger bus + legal-entity-tree (joint PR with Atlas)",
  },
  {
    agentId: "noa",
    fullTitle: "Noa (Intranet Product Owner & UI Architect, engineering)",
    prsMerged: 1,
    ciViolations: 1,
    auditFindingsRaised: 0,
    decisionsAdvanced: [],
    workstreamsProgressed: [],
    prNumber: 393,
    note: "3 intranet typed events — IntranetFeatureShipped, DesignReviewComplete, UXFindingRaised",
  },
  {
    agentId: "anya",
    fullTitle: "Anya (Data / Analytics Engineer, engineering)",
    prsMerged: 1,
    ciViolations: 0,
    auditFindingsRaised: 0,
    decisionsAdvanced: [],
    workstreamsProgressed: [],
    prNumber: 394,
    note: "Semantic-layer quantity registry — 20 core bank quantities + SemanticLayerQuantityRegistered event",
  },
  {
    agentId: "ravi",
    fullTitle: "Ravi (Treasury / ALM Engineer, engineering)",
    prsMerged: 1,
    ciViolations: 1,
    auditFindingsRaised: 0,
    decisionsAdvanced: [],
    workstreamsProgressed: [],
    prNumber: 395,
    note: "FTP attribution engine — FtpCurvePublished + FtpAttributionRecorded events",
  },
];

// ---------------------------------------------------------------------------
// Idempotency check
// ---------------------------------------------------------------------------

function alreadyEvaluated(agentId: string): boolean {
  for (const e of eventStore.replay({ type: "AgentPerformanceEvaluated" })) {
    const p = e.payload as Record<string, unknown>;
    if (String(p.agentId) === agentId && String(p.evaluationPeriod) === EVALUATION_PERIOD) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let evaluated = 0;
let skipped = 0;

console.log(`\nAgent Performance Evaluation — period: ${EVALUATION_PERIOD}`);
console.log("=".repeat(60));

for (const agent of AGENTS) {
  if (!force && alreadyEvaluated(agent.agentId)) {
    console.log(`  SKIP  ${agent.agentId} — already evaluated for ${EVALUATION_PERIOD}`);
    skipped++;
    continue;
  }

  // --- Delivery ---
  const deliveryScore = 1.0; // All agents delivered their 1 run

  // --- Quality ---
  // Start at 1.0; deduct for CI violations and audit findings; +0.05 clean merge
  const baseQuality = 1.0;
  const qualityDeductions = agent.ciViolations * 0.1 + agent.auditFindingsRaised * 0.15;
  const cleanMergeBonus = agent.ciViolations === 0 && agent.auditFindingsRaised === 0 ? 0.05 : 0;
  const qualityScore = clamp(baseQuality - qualityDeductions + cleanMergeBonus);

  // --- Strategic ---
  const strategicScore = clamp(agent.prsMerged * 0.2 + agent.decisionsAdvanced.length * 0.1);

  // --- Overall ---
  const overall = overallScore(deliveryScore, qualityScore, strategicScore);
  const agentTier = tier(overall);

  const scores = {
    delivery: deliveryScore,
    quality: qualityScore,
    strategic: strategicScore,
    overall,
  };

  // Build narrative strengths
  const strengths: string[] = [];
  if (agent.ciViolations === 0 && agent.auditFindingsRaised === 0) {
    strengths.push("Zero CI violations and audit findings — clean operational discipline.");
  }
  if (agent.prsMerged > 0) {
    strengths.push(
      `${agent.prsMerged} PR(s) merged in the evaluation period (PR #${Array.isArray(agent.prNumber) ? agent.prNumber.join(", #") : agent.prNumber}): ${agent.note}.`,
    );
  }
  if (agent.decisionsAdvanced.length > 0) {
    strengths.push(`Advanced CEO-level decision(s): ${agent.decisionsAdvanced.join(", ")}.`);
  }
  if (strengths.length === 0) {
    strengths.push("Baseline performance observed — no standout strengths beyond delivery.");
  }

  // Build narrative areas for improvement
  const areasForImprovement: string[] = [];
  if (agent.ciViolations > 0) {
    areasForImprovement.push(
      `${agent.ciViolations} CI violation(s) from event-types/index.ts merge conflict — review dispatch discipline (CLAUDE.md §Dispatch discipline) and consider rebasing earlier in the run.`,
    );
  }
  if (agent.decisionsAdvanced.length === 0 && agent.workstreamsProgressed.length === 0) {
    areasForImprovement.push(
      "Strategic contribution limited to a single PR delivery — consider advancing CEO-level decisions or progressing workstreams to improve strategic score.",
    );
  }
  if (areasForImprovement.length === 0) {
    areasForImprovement.push(
      "No specific improvement areas for this period — maintain current standards.",
    );
  }

  const feedbackSummary =
    `Agent ${agent.agentId} ${agentTier === "exceeds" ? "exceeds expectations" : agentTier === "meets" ? "meets expectations" : agentTier} ` +
    `for ${EVALUATION_PERIOD} (overall: ${(overall * 100).toFixed(0)}%). ` +
    `Top strength: ${strengths[0]} ` +
    `Focus area: ${areasForImprovement[0]}`;

  // Emit AgentPerformanceEvaluated
  const evalEvent = makeAgentPerformanceEvaluated({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      agentId: agent.agentId,
      evaluationPeriod: EVALUATION_PERIOD,
      evaluatedBy: ACTOR.id,
      runMetrics: {
        runsStarted: agent.prsMerged,
        runsDelivered: agent.prsMerged,
        runsBlocked: 0,
        runsFailed: 0,
        deliveryRate: 1.0,
      },
      qualityMetrics: {
        auditFindingsRaised: agent.auditFindingsRaised,
        auditFindingsResolved: 0,
        ciViolations: agent.ciViolations,
        worktreeViolations: 0,
      },
      strategicMetrics: {
        decisionsAdvanced: agent.decisionsAdvanced,
        workstreamsProgressed: agent.workstreamsProgressed,
        complianceArtifacts: agent.prsMerged, // each PR = 1 compliance artifact
        prsMerged: agent.prsMerged,
      },
      scores,
      tier: agentTier,
      narrative: {
        strengths,
        areasForImprovement,
        feedbackSummary,
      },
    },
  });

  eventStore.append(evalEvent);

  // Emit AgentFeedbackIssued (delivered via owner-inbox — summary report covers all agents)
  const feedbackEvent = makeAgentFeedbackIssued({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      agentId: agent.agentId,
      evaluationPeriod: EVALUATION_PERIOD,
      evaluationEventId: evalEvent.event_id,
      deliveredVia: "team-inbox",
      artifactPath: "Owner Inbox/2026-05-15_sade_agent-performance-evaluation-2026-05-14-15.md",
      feedbackText: feedbackSummary,
      issuedBy: ACTOR.id,
    },
  });

  eventStore.append(feedbackEvent);

  const tierSymbol = agentTier === "exceeds" ? "★" : agentTier === "meets" ? "✓" : "⚠";

  console.log(
    `  ${tierSymbol}  ${agent.agentId.padEnd(10)} overall=${(overall * 100).toFixed(0)}% ` +
      `delivery=${(deliveryScore * 100).toFixed(0)}% ` +
      `quality=${(qualityScore * 100).toFixed(0)}% ` +
      `strategic=${(strategicScore * 100).toFixed(0)}% ` +
      `tier=${agentTier}`,
  );

  evaluated++;
}

console.log("=".repeat(60));
console.log(`Evaluated: ${evaluated}  Skipped (idempotent): ${skipped}`);
console.log("Events emitted: AgentPerformanceEvaluated + AgentFeedbackIssued per agent.\n");
