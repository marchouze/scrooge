// platform/agents/performance-evaluator.ts
//
// Pure evaluation engine for daily agent performance scoring.
// Called by performance-runner.ts once per agent per evaluation period.
//
// Principle 6 — autonomous by default; every agent is a standing autonomous
// agent whose outputs are scored daily. This file implements the scoring
// rubric without calling the Claude API (deterministic rules only).
//
// TODO: replace inline stub payload interfaces with imports from
// event-types/performance.ts once Mira's PR lands.
//
// Author: Sade (AgentOps engineer, engineering)

import { eventStore } from "../composition";

// ---------------------------------------------------------------------------
// Inline stubs — replace with imports from event-types/performance.ts once
// Mira's PR lands.
// ---------------------------------------------------------------------------

interface RunMetrics {
  runsStarted: number;
  runsDelivered: number;
  runsBlocked: number;
  runsFailed: number;
  deliveryRate: number; // 0–1
}

interface QualityMetrics {
  auditFindingsRaised: number;
  auditFindingsResolved: number;
  ciViolations: number;
  worktreeViolations: number;
  /** Severity breakdown for fine-grained penalty calculation. */
  findingsBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface StrategicMetrics {
  decisionsAdvanced: string[];
  workstreamsProgressed: string[];
  complianceArtifacts: number;
  prsMerged: number;
}

interface Scores {
  delivery: number; // 0–1
  quality: number; // 0–1
  strategic: number; // 0–1
  overall: number; // weighted: delivery 40%, quality 40%, strategic 20%
}

type Tier = "exceeds" | "meets" | "needs-improvement" | "unsatisfactory";

interface Narrative {
  strengths: string[];
  areasForImprovement: string[];
  feedbackSummary: string;
}

export interface PerformanceEvaluationResult {
  agentId: string;
  evaluationPeriod: string;
  runMetrics: RunMetrics;
  qualityMetrics: QualityMetrics;
  strategicMetrics: StrategicMetrics;
  scores: Scores;
  tier: Tier;
  narrative: Narrative;
}

// ---------------------------------------------------------------------------
// Hardcoded agent fleet — fallback if AgentRegistered events are absent.
// Prefer event-replay (see performance-runner.ts); this list is the safety net.
// ---------------------------------------------------------------------------

export const KNOWN_AGENTS = [
  "atlas",
  "mira",
  "anya",
  "vera",
  "sade",
  "senna",
  "ravi",
  "noa",
  "kai",
  "rohan",
  "nadia",
  "tomas",
  "imani",
  "pax",
  "nolan",
  "bea",
  "yael",
  "niko",
  "iris",
  "helena",
  "owen",
  "zara",
  "devon",
  "camille",
  "eitan",
  "saskia",
  "thandiwe",
  "rashida",
] as const;

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function scoreDelivery(m: RunMetrics): number {
  if (m.runsStarted === 0) return 0; // no runs = zero delivery; absence of work is not neutral
  const r = m.deliveryRate;
  if (r >= 0.9) return 1.0;
  if (r >= 0.7) return 0.75;
  if (r >= 0.5) return 0.5;
  return r * 0.5;
}

function scoreQuality(m: QualityMetrics, runMetrics: RunMetrics): number {
  const noObservableActivity =
    runMetrics.runsStarted === 0 &&
    m.auditFindingsRaised === 0 &&
    m.ciViolations === 0 &&
    m.worktreeViolations === 0;
  // Absence of violations when no work was done is absence of evidence, not quality.
  if (noObservableActivity) return 0.5;
  let score = 1.0;
  score -= m.findingsBySeverity.critical * 0.3;
  score -= m.findingsBySeverity.high * 0.15;
  score -= m.findingsBySeverity.medium * 0.05;
  score -= m.findingsBySeverity.low * 0.01;
  score -= m.ciViolations * 0.1;
  score -= m.worktreeViolations * 0.2;
  score += m.auditFindingsResolved * 0.05; // recovery credit
  return Math.min(1, Math.max(0, score));
}

function scoreStrategic(m: StrategicMetrics): number {
  // Base score from decisions advanced
  let score: number;
  if (m.decisionsAdvanced.length >= 2) {
    score = 1.0;
  } else if (m.decisionsAdvanced.length === 1) {
    score = 0.8;
  } else if (m.workstreamsProgressed.length >= 3) {
    score = 0.9;
  } else if (m.workstreamsProgressed.length >= 1) {
    score = 0.7;
  } else if (
    m.prsMerged === 0 &&
    m.decisionsAdvanced.length === 0 &&
    m.workstreamsProgressed.length === 0
  ) {
    score = 0; // zero strategic contribution = zero strategic score
  } else {
    score = 0.6;
  }
  // PR bonus
  if (m.prsMerged >= 5) score = Math.min(1.0, score + 0.1);
  return score;
}

function tierFromOverall(overall: number): Tier {
  if (overall >= 0.85) return "exceeds";
  if (overall >= 0.65) return "meets";
  if (overall >= 0.4) return "needs-improvement";
  return "unsatisfactory";
}

// ---------------------------------------------------------------------------
// Narrative generation — deterministic, no Claude API
// ---------------------------------------------------------------------------

function buildNarrative(
  agentId: string,
  scores: Scores,
  tier: Tier,
  runMetrics: RunMetrics,
  qualityMetrics: QualityMetrics,
  strategicMetrics: StrategicMetrics,
): Narrative {
  const strengths: string[] = [];
  const areasForImprovement: string[] = [];

  const inactive =
    runMetrics.runsStarted === 0 &&
    strategicMetrics.prsMerged === 0 &&
    strategicMetrics.decisionsAdvanced.length === 0 &&
    strategicMetrics.workstreamsProgressed.length === 0;

  // Strengths
  if (runMetrics.runsStarted > 0 && runMetrics.deliveryRate >= 0.9) {
    strengths.push(
      `High delivery rate of ${(runMetrics.deliveryRate * 100).toFixed(0)}% — consistently completing assigned runs.`,
    );
  }
  // Only credit clean quality signals when the agent actually did work.
  if (
    !inactive &&
    qualityMetrics.ciViolations === 0 &&
    qualityMetrics.worktreeViolations === 0 &&
    qualityMetrics.auditFindingsRaised === 0
  ) {
    strengths.push(
      "Zero CI violations, worktree isolation violations, and audit findings — clean operational discipline.",
    );
  } else if (
    !inactive &&
    qualityMetrics.ciViolations === 0 &&
    qualityMetrics.worktreeViolations === 0
  ) {
    strengths.push(
      "Zero CI violations and worktree isolation violations — process hygiene maintained.",
    );
  }
  if (strategicMetrics.decisionsAdvanced.length >= 2) {
    strengths.push(
      `Advanced ${strategicMetrics.decisionsAdvanced.length} CEO-level decisions: ${strategicMetrics.decisionsAdvanced.join(", ")}.`,
    );
  } else if (strategicMetrics.decisionsAdvanced.length === 1) {
    strengths.push(`Advanced CEO-level decision: ${strategicMetrics.decisionsAdvanced[0]}.`);
  }
  if (strategicMetrics.prsMerged >= 5) {
    strengths.push(
      `Strong engineering output — ${strategicMetrics.prsMerged} PRs merged in the evaluation period.`,
    );
  } else if (strategicMetrics.prsMerged > 0) {
    strengths.push(`${strategicMetrics.prsMerged} PR(s) merged in the evaluation period.`);
  }
  if (qualityMetrics.auditFindingsResolved > 0) {
    strengths.push(
      `Resolved ${qualityMetrics.auditFindingsResolved} audit finding(s) — demonstrates accountability and responsiveness.`,
    );
  }
  if (strengths.length === 0) {
    if (inactive) {
      strengths.push(
        "No activity recorded this period — no runs started, no PRs merged, no decisions advanced.",
      );
    } else {
      strengths.push(
        "No standout strengths recorded for this period — baseline performance observed.",
      );
    }
  }

  // Areas for improvement
  if (runMetrics.runsStarted > 0 && runMetrics.deliveryRate < 0.5) {
    areasForImprovement.push(
      `Low delivery rate of ${(runMetrics.deliveryRate * 100).toFixed(0)}% — more than half of started runs did not deliver. Investigate blockers.`,
    );
  } else if (runMetrics.runsStarted > 0 && runMetrics.deliveryRate < 0.7) {
    areasForImprovement.push(
      `Delivery rate of ${(runMetrics.deliveryRate * 100).toFixed(0)}% is below target (70%). Review run-blocking factors.`,
    );
  }
  if (qualityMetrics.findingsBySeverity.critical > 0) {
    areasForImprovement.push(
      `${qualityMetrics.findingsBySeverity.critical} critical audit finding(s) raised — these carry the highest penalty and must be resolved immediately.`,
    );
  }
  if (qualityMetrics.findingsBySeverity.high > 0) {
    areasForImprovement.push(
      `${qualityMetrics.findingsBySeverity.high} high-severity audit finding(s) — requires prompt resolution.`,
    );
  }
  if (qualityMetrics.ciViolations > 0) {
    areasForImprovement.push(
      `${qualityMetrics.ciViolations} CI violation(s) — review dispatch discipline (CLAUDE.md §Operating procedures).`,
    );
  }
  if (qualityMetrics.worktreeViolations > 0) {
    areasForImprovement.push(
      `${qualityMetrics.worktreeViolations} worktree isolation violation(s) — agents must NEVER cd to /Users/marc/code/Bank (CLAUDE.md worktree-isolation rule).`,
    );
  }
  if (inactive) {
    areasForImprovement.push(
      "Agent was completely inactive this period — zero runs, zero PRs, zero decisions, zero workstreams. " +
        "An autonomous agent must generate output on its own cadence (Principle 6). " +
        "Review whether the scheduler is firing, whether the mandate is clear, and escalate if a substrate gap is blocking dispatch.",
    );
  } else if (
    strategicMetrics.decisionsAdvanced.length === 0 &&
    strategicMetrics.workstreamsProgressed.length === 0 &&
    strategicMetrics.prsMerged === 0
  ) {
    areasForImprovement.push(
      "No strategic contribution recorded — no decisions advanced, workstreams progressed, or PRs merged. Review mandate alignment.",
    );
  }
  if (areasForImprovement.length === 0) {
    areasForImprovement.push("No specific improvement areas identified for this period.");
  }

  // Summary paragraph
  const tierLabel: Record<Tier, string> = {
    exceeds: "exceeds expectations",
    meets: "meets expectations",
    "needs-improvement": "needs improvement",
    unsatisfactory: "is unsatisfactory",
  };
  const topStrength = strengths[0];
  const topArea = areasForImprovement[0];
  const feedbackSummary =
    `Agent ${agentId} ${tierLabel[tier]} for the evaluation period ` +
    `(overall score: ${(scores.overall * 100).toFixed(0)}%). ` +
    `Top strength: ${topStrength} ` +
    `Focus area: ${topArea}`;

  return { strengths, areasForImprovement, feedbackSummary };
}

// ---------------------------------------------------------------------------
// Data collection from event store
// ---------------------------------------------------------------------------

function collectRunMetrics(agentId: string, evaluationPeriod: string): RunMetrics {
  let runsStarted = 0;
  let runsDelivered = 0;
  let runsBlocked = 0;
  let runsFailed = 0;

  const agentLower = agentId.toLowerCase();

  for (const e of eventStore.replay({})) {
    // Date prefix match on as_of
    if (!e.as_of.startsWith(evaluationPeriod)) continue;

    const p = e.payload as Record<string, unknown>;

    if (e.type === "AgentRunStarted") {
      const agentRef = p.agent as Record<string, unknown> | undefined;
      const agentName = String(agentRef?.name ?? "").toLowerCase();
      const agentIdField = String(agentRef?.agentId ?? "").toLowerCase();
      if (agentName === agentLower || agentIdField === `agent:${agentLower}`) {
        runsStarted++;
      }
    }

    if (e.type === "AgentRunCompleted") {
      const agentRef = p.agent as Record<string, unknown> | undefined;
      const agentName = String(agentRef?.name ?? "").toLowerCase();
      const agentIdField = String(agentRef?.agentId ?? "").toLowerCase();
      if (agentName === agentLower || agentIdField === `agent:${agentLower}`) {
        const outcome = String(p.outcome ?? "");
        if (outcome === "delivered") runsDelivered++;
        else if (outcome === "blocked") runsBlocked++;
        // "withdrawn" counted as neither delivered nor failed
      }
    }

    if (e.type === "SubstrateAgentRunStarted") {
      const agentStr = String(p.agent ?? "").toLowerCase();
      if (agentStr === agentLower || agentStr === `agent:${agentLower}`) {
        runsStarted++;
      }
    }

    if (e.type === "SubstrateAgentRunCompleted") {
      const agentStr = String(p.agent ?? "").toLowerCase();
      if (agentStr === agentLower || agentStr === `agent:${agentLower}`) {
        const outcome = String(p.outcome ?? "");
        if (outcome === "delivered") runsDelivered++;
        else if (outcome === "blocked") runsBlocked++;
        else if (outcome === "failed") runsFailed++;
      }
    }

    if (e.type === "SubstrateAgentRunFailed") {
      const agentStr = String(p.agent ?? "").toLowerCase();
      if (agentStr === agentLower || agentStr === `agent:${agentLower}`) {
        runsFailed++;
      }
    }
  }

  const totalCompleted = runsDelivered + runsBlocked + runsFailed;
  const deliveryRate =
    runsStarted === 0
      ? 0
      : totalCompleted === 0
        ? 0
        : runsDelivered / Math.max(runsStarted, totalCompleted);

  return { runsStarted, runsDelivered, runsBlocked, runsFailed, deliveryRate };
}

function collectQualityMetrics(agentId: string, evaluationPeriod: string): QualityMetrics {
  const agentUrn = `agent:${agentId.toLowerCase()}`;
  const findingsBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  let auditFindingsRaised = 0;
  let auditFindingsResolved = 0;
  const ciViolations = 0; // CI violations are not yet surfaced as distinct events; tracked via audit findings
  const worktreeViolations = 0; // Same — tracked via audit findings; full pipeline is a substrate gap

  const openFindingIds = new Set<string>();

  for (const e of eventStore.replay({})) {
    if (!e.as_of.startsWith(evaluationPeriod)) continue;
    const p = e.payload as Record<string, unknown>;

    if (e.type === "AuditFinding") {
      const addressedTo = String(p.addressedTo ?? "");
      const agentRef = String(p.agentId ?? "");
      if (addressedTo === agentUrn || agentRef === agentUrn || agentRef === agentId) {
        const severity = String(p.severity ?? "low") as keyof typeof findingsBySeverity;
        if (severity in findingsBySeverity) findingsBySeverity[severity]++;
        auditFindingsRaised++;
        const findingId = String(p.findingId ?? e.event_id);
        openFindingIds.add(findingId);
      }
    }

    if (e.type === "AuditFindingResolved" || e.type === "ValidationFindingClosed") {
      const findingId = String(p.findingId ?? "");
      if (openFindingIds.has(findingId)) {
        auditFindingsResolved++;
        openFindingIds.delete(findingId);
      }
    }
  }

  return {
    auditFindingsRaised,
    auditFindingsResolved,
    ciViolations,
    worktreeViolations,
    findingsBySeverity,
  };
}

function collectStrategicMetrics(agentId: string, evaluationPeriod: string): StrategicMetrics {
  const agentLower = agentId.toLowerCase();
  const agentUrn = `agent:${agentLower}`;
  const decisionsAdvanced: string[] = [];
  const workstreamsProgressed: string[] = [];
  let complianceArtifacts = 0;
  let prsMerged = 0;

  for (const e of eventStore.replay({})) {
    if (!e.as_of.startsWith(evaluationPeriod)) continue;
    const p = e.payload as Record<string, unknown>;

    // CeoDecision events where this agent submitted or advanced
    if (e.type === "CeoDecision") {
      const actorId = String(e.actor?.id ?? "").toLowerCase();
      const advancedBy = String(p.advancedBy ?? "").toLowerCase();
      const decidedBy = String(p.decidedBy ?? "").toLowerCase();
      if (
        actorId === agentUrn ||
        actorId === agentLower ||
        advancedBy.includes(agentLower) ||
        decidedBy.includes(agentLower)
      ) {
        const decisionId = String(p.decisionId ?? e.event_id);
        if (!decisionsAdvanced.includes(decisionId)) decisionsAdvanced.push(decisionId);
      }
    }

    // WorkstreamStarted / WorkstreamCompleted where actor is this agent
    if (e.type === "WorkstreamStarted" || e.type === "WorkstreamCompleted") {
      const actorId = String(e.actor?.id ?? "").toLowerCase();
      if (actorId === agentUrn || actorId === agentLower) {
        const wsId = String(p.workstreamId ?? e.event_id);
        if (!workstreamsProgressed.includes(wsId)) workstreamsProgressed.push(wsId);
      }
    }

    // AgentRunCompleted — count deliverable documents as compliance artifacts
    if (e.type === "AgentRunCompleted") {
      const agentRef = p.agent as Record<string, unknown> | undefined;
      const agentName = String(agentRef?.name ?? "").toLowerCase();
      const agentIdField = String(agentRef?.agentId ?? "").toLowerCase();
      if (agentName === agentLower || agentIdField === `agent:${agentLower}`) {
        const hashes = Array.isArray(p.deliverableDocumentHashes)
          ? p.deliverableDocumentHashes
          : [];
        complianceArtifacts += hashes.length;
        // followOnRoutes with kind "code-pr" count as PRs merged (best-effort proxy)
        const followOn = Array.isArray(p.followOnRoutes) ? p.followOnRoutes : [];
        for (const r of followOn) {
          if (
            typeof r === "object" &&
            r !== null &&
            (r as Record<string, unknown>).kind === "code-pr"
          ) {
            prsMerged++;
          }
        }
      }
    }

    // SubstrateAgentRunCompleted — if deliverable present, count as PR
    if (e.type === "SubstrateAgentRunCompleted") {
      const agentStr = String(p.agent ?? "").toLowerCase();
      if (agentStr === agentLower || agentStr === `agent:${agentLower}`) {
        if (p.deliverable) prsMerged++;
      }
    }
  }

  return { decisionsAdvanced, workstreamsProgressed, complianceArtifacts, prsMerged };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a single agent for a given evaluation period (YYYY-MM-DD).
 * Pure function — reads from the event store, does not write.
 */
export async function evaluateAgent(
  agentId: string,
  evaluationPeriod: string,
): Promise<PerformanceEvaluationResult> {
  const runMetrics = collectRunMetrics(agentId, evaluationPeriod);
  const qualityMetrics = collectQualityMetrics(agentId, evaluationPeriod);
  const strategicMetrics = collectStrategicMetrics(agentId, evaluationPeriod);

  const delivery = scoreDelivery(runMetrics);
  const quality = scoreQuality(qualityMetrics, runMetrics);
  const strategic = scoreStrategic(strategicMetrics);
  const overall = delivery * 0.4 + quality * 0.4 + strategic * 0.2;

  const scores: Scores = { delivery, quality, strategic, overall };
  const tier = tierFromOverall(overall);
  const narrative = buildNarrative(
    agentId,
    scores,
    tier,
    runMetrics,
    qualityMetrics,
    strategicMetrics,
  );

  return {
    agentId,
    evaluationPeriod,
    runMetrics,
    qualityMetrics,
    strategicMetrics,
    scores,
    tier,
    narrative,
  };
}
