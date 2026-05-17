// platform/agents/performance-feedback.ts
//
// Feedback builder — converts a PerformanceEvaluationResult into a structured
// feedback document. The text is stored in the AgentFeedbackIssued event and
// filed in the RMS document register via recordFiled(); no file is written to
// Owner Inbox (Owner Inbox writing was Phase 0 behaviour, retired when the RMS
// redesign landed — D-RMS-PHASE-1).
//
// Author: Sade (AgentOps engineer, engineering)

import type { PerformanceEvaluationResult } from "./performance-evaluator";

// ---------------------------------------------------------------------------
// Agent display name — capitalise first letter
// ---------------------------------------------------------------------------

function displayName(agentId: string): string {
  return agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

// ---------------------------------------------------------------------------
// Score formatter
// ---------------------------------------------------------------------------

function pct(score: number): string {
  return `${(score * 100).toFixed(0)}%`;
}

function tierLabel(tier: PerformanceEvaluationResult["tier"]): string {
  const labels: Record<PerformanceEvaluationResult["tier"], string> = {
    exceeds: "Exceeds Expectations",
    meets: "Meets Expectations",
    "needs-improvement": "Needs Improvement",
    unsatisfactory: "Unsatisfactory",
  };
  return labels[tier];
}

// ---------------------------------------------------------------------------
// Feedback text builder
// ---------------------------------------------------------------------------

function buildFeedbackText(result: PerformanceEvaluationResult): string {
  const name = displayName(result.agentId);
  const { scores, tier, narrative, runMetrics, qualityMetrics, strategicMetrics } = result;

  const lines: string[] = [
    "## Performance Summary",
    "",
    `**Agent:** ${name}  `,
    `**Evaluation period:** ${result.evaluationPeriod}  `,
    `**Tier:** ${tierLabel(tier)}  `,
    `**Overall score:** ${pct(scores.overall)}`,
    "",
    narrative.feedbackSummary,
    "",
    "## Scores",
    "",
    "| Dimension | Score | Weight |",
    "|-----------|-------|--------|",
    `| Delivery  | ${pct(scores.delivery)} | 40% |`,
    `| Quality   | ${pct(scores.quality)} | 40% |`,
    `| Strategic | ${pct(scores.strategic)} | 20% |`,
    `| **Overall** | **${pct(scores.overall)}** | — |`,
    "",
    "## Run Metrics",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Runs started | ${runMetrics.runsStarted} |`,
    `| Runs delivered | ${runMetrics.runsDelivered} |`,
    `| Runs blocked | ${runMetrics.runsBlocked} |`,
    `| Runs failed | ${runMetrics.runsFailed} |`,
    `| Delivery rate | ${pct(runMetrics.deliveryRate)} |`,
    "",
    "## Quality Metrics",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Audit findings raised | ${qualityMetrics.auditFindingsRaised} |`,
    `| — Critical | ${qualityMetrics.findingsBySeverity.critical} |`,
    `| — High | ${qualityMetrics.findingsBySeverity.high} |`,
    `| — Medium | ${qualityMetrics.findingsBySeverity.medium} |`,
    `| — Low | ${qualityMetrics.findingsBySeverity.low} |`,
    `| Audit findings resolved | ${qualityMetrics.auditFindingsResolved} |`,
    `| CI violations | ${qualityMetrics.ciViolations} |`,
    `| Worktree violations | ${qualityMetrics.worktreeViolations} |`,
    "",
    "## Strategic Metrics",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Decisions advanced | ${strategicMetrics.decisionsAdvanced.length > 0 ? strategicMetrics.decisionsAdvanced.join(", ") : "—"} |`,
    `| Workstreams progressed | ${strategicMetrics.workstreamsProgressed.length > 0 ? strategicMetrics.workstreamsProgressed.join(", ") : "—"} |`,
    `| Compliance artifacts | ${strategicMetrics.complianceArtifacts} |`,
    `| PRs merged (proxy) | ${strategicMetrics.prsMerged} |`,
    "",
    "## Strengths",
    "",
    ...narrative.strengths.map((s) => `- ${s}`),
    "",
    "## Areas for Improvement",
    "",
    ...narrative.areasForImprovement.map((a) => `- ${a}`),
    "",
    "## Suggested Focus for Next Period",
    "",
  ];

  // Suggest focus based on tier and weakest score
  if (tier === "exceeds") {
    lines.push(
      `${name} is performing at the highest tier. Maintain current delivery discipline and continue advancing strategic decisions. Consider mentoring lower-performing agents or taking on additional mandate scope.`,
    );
  } else if (tier === "meets") {
    const weakest =
      scores.delivery < scores.quality && scores.delivery < scores.strategic
        ? "delivery rate"
        : scores.quality < scores.delivery && scores.quality < scores.strategic
          ? "quality (audit findings / CI violations)"
          : "strategic contribution";
    lines.push(
      `${name} is meeting expectations. Focus on improving ${weakest} to reach the "exceeds" tier. Review any open audit findings and ensure dispatch discipline (CLAUDE.md §Operating procedures) is followed consistently.`,
    );
  } else if (tier === "needs-improvement") {
    lines.push(
      `${name} requires improvement. Priority: resolve all open audit findings, eliminate CI and worktree violations, and ensure every started run reaches a delivered outcome. Review mandate alignment — if runs are blocking due to substrate gaps, escalate via AgentEscalation.`,
    );
  } else {
    lines.push(
      `${name} is performing at an unsatisfactory level. An AgentEscalation has been raised to Devon (COO) and Vera (internal audit engineer, governance) for review. Immediate action required: identify the root cause of non-delivery, resolve critical audit findings, and confirm mandate is still valid.`,
    );
  }

  lines.push(
    "",
    "---",
    "",
    "*Issued by Sade (AgentOps engineer, engineering) — automated daily evaluation.*",
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FeedbackIssuedResult {
  feedbackText: string;
}

/**
 * Build performance feedback text for an agent evaluation result.
 * The text is returned for event emission and RMS document filing;
 * no file is written to disk (Owner Inbox writing was Phase 0, retired
 * when D-RMS-PHASE-1 landed).
 */
export function issueFeedback(
  result: PerformanceEvaluationResult,
  _evaluationEventId: string,
): FeedbackIssuedResult {
  return { feedbackText: buildFeedbackText(result) };
}
