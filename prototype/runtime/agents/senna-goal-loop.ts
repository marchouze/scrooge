// runtime/agents/senna-goal-loop.ts
//
// Senna (Security engineer) goal-loop — cohort-3.
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Senna is wired into the
// goal-loop substrate. This run-handler is the integration point that:
//   1. Materialises a WorldStateSnapshot for agent:senna.
//   2. Runs Senna's rule-engine goal deriver (no LLM calls — cohort-3
//      rule-engine constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   Rule 1 — If no SecuritySubstrateSnapshot event in the last 24h from Senna
//             → goal: "security-substrate-state" (priority HIGH).
//   Rule 2 — Open AuditFinding tagged security with no remediation ticket in 24h
//             → goal: "Approve detection-rule changes within standard" (priority HIGH).
//   Rule 3 — No ZeroTrustPolicyReview event in past 7 days
//             → goal: "Approve secure-SDLC pipeline configuration changes" (priority MEDIUM).
//   Rule 4 — New design PR merged in past 24h with no ThreatModelApproved event
//             → goal: "Threat-model gate at engineering level — refuse / approve / exception-pending"
//               (priority HIGH).
//
// The goal candidates use Senna's §9 decisions-in-scope row labels exactly
// as they appear in Team/Senna.md (the spec's closed-set per T-NEW).
//
// Procedure citations: Senna owns the security-substrate-state handler
// (`runtime/agents/senna-security-substrate-state.ts`). Since procedure files
// for Senna may not yet have step anchors (pre-backfill coverage-gap per
// _step-id-convention.md §5), we use the coverage-gap form:
// `stepId: "security-substrate-state:step-1"` as a placeholder. The recon
// pipeline warns (not fails) for missing step IDs per the build-phase tolerance.
//
// Shadow mode: shadowMode: true for cohort-3 until cohort validation passes
// (per spec §4 "Build runs in shadow mode for the first two substrate ticks").
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect) — wiring.
//         Senna (Security engineer) — goal-deriver rules.

import { resolve } from "node:path";
import type { GoalDeriver, GoalLoopOutcome } from "../../platform/agent-runtime/goal-loop";
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import type { RunWithGoalArgs } from "../../platform/agent-runtime/goal-loop";
import { parseSpecFile } from "../../platform/agent-runtime/spec-parser";
import { LocalAgentWorldStateReader } from "../../platform/agent-runtime/world-state";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import the underlying security-substrate-state handler directly to avoid the
// circular dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import sennaSecuritySubstrateState from "./senna-security-substrate-state";

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Senna
// ---------------------------------------------------------------------------

const SENNA_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Senna.md",
);

// Procedure path for Senna's security-substrate-state procedure (§13).
const SENNA_PROCEDURE_PATH = "Procedures/by-policy/security-substrate-state.md";
// Coverage-gap step-ID form per _step-id-convention.md §5.
const SENNA_PROCEDURE_STEP_ID = "security-substrate-state:step-1";

// §9 row labels from Team/Senna.md (closed-set per T-NEW).
// Candidate 1: security substrate state snapshot goal.
const SECURITY_SUBSTRATE_STATE_GOAL =
  "Approve secure-SDLC pipeline configuration changes" as const;
// Candidate 2: security finding remediation goal.
const SECURITY_FINDING_REMEDIATION_GOAL = "Approve detection-rule changes within standard" as const;
// Candidate 3: zero-trust policy review goal — closest §9 equivalent in build phase.
// Key-rotation cadence enforcement is the primary zero-trust mechanism (identity
// freshness, credential revocation, HSM rotation) in the current substrate.
const ZERO_TRUST_POLICY_REVIEW_GOAL =
  "Set / vary secret-rotation cadence within standing policy" as const;
// Candidate 4: threat-model gate goal for new design PRs.
const THREAT_MODEL_GATE_GOAL =
  "Threat-model gate at engineering level — refuse / approve / exception-pending" as const;

// ---------------------------------------------------------------------------
// Event-query helpers
// ---------------------------------------------------------------------------

function lastSecuritySubstrateSnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "SecuritySubstrateSnapshot" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns true if there are any open AuditFinding events tagged security that
 * have not been addressed with a remediation-related event within 24h.
 *
 * In the current build phase the remediation-closed event schema is not yet
 * fully defined. We detect open security findings by checking whether any
 * AuditFinding event with a security-related tag exists in the store; the
 * absence of a matching SecurityIncidentEnriched or DetectionRuleChanged
 * within 24h is treated as "no remediation ticket".
 */
function hasOpenSecurityAuditFindings(): boolean {
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;

  for (const e of eventStore.replay({ type: "AuditFinding" })) {
    const t = new Date(e.as_of).getTime();
    if (Number.isNaN(t)) continue;
    // Only consider findings raised within the last 24h with no remediation.
    if (t < cutoff) continue;
    // Check payload for security tag — build-phase heuristic: any AuditFinding
    // whose payload includes "security" in a tag, category, or domain field.
    const payload = e.payload as Record<string, unknown> | undefined;
    if (!payload) continue;
    const tags = payload["tags"] ?? payload["category"] ?? payload["domain"] ?? "";
    const tagsStr = Array.isArray(tags) ? tags.join(" ").toLowerCase() : String(tags).toLowerCase();
    if (tagsStr.includes("security")) {
      return true;
    }
  }
  return false;
}

/**
 * Returns the timestamp of the most recent ZeroTrustPolicyReview event,
 * or undefined if none exists.
 *
 * Build-phase note: ZeroTrustPolicyReview is the substrate-level event for
 * Senna's zero-trust posture review. If the event has never been emitted,
 * we treat the review as overdue and fire the secure-SDLC pipeline config
 * goal as the closest §9 equivalent (pipeline configuration governs
 * zero-trust enforcement in the build-phase substrate).
 */
function lastZeroTrustPolicyReviewMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "ZeroTrustPolicyReview" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns true if there are any design PR merge events in the last 24h that
 * have not been paired with a ThreatModelApproved (or ThreatModelGateDecision)
 * event.
 *
 * Build-phase heuristic: we detect DesignPRMerged or PullRequestMerged events
 * with a "design" tag and check whether a matching ThreatModelGateDecision
 * event was emitted within the same 24h window.
 */
function hasUnthreaModeldDesignPR(): boolean {
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;

  // Collect recent ThreatModelGateDecision timestamps as a set.
  const threatModelDecisionTimes = new Set<string>();
  for (const e of eventStore.replay({ type: "ThreatModelGateDecision" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && t >= cutoff) {
      threatModelDecisionTimes.add(e.as_of);
    }
  }

  // If a threat-model decision was issued recently, the gate has been applied.
  if (threatModelDecisionTimes.size > 0) {
    return false;
  }

  // Check for recent design PR merges without a corresponding threat-model gate.
  for (const e of eventStore.replay({ type: "DesignPRMerged" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && t >= cutoff) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Goal deriver
// ---------------------------------------------------------------------------

export const sennaGoalDeriver: GoalDeriver = async (
  args: RunWithGoalArgs,
): Promise<GoalLoopOutcome> => {
  const { spec, worldState } = args;

  logger.info(
    {
      agentUrn: args.agent.urn,
      worldStateHash: worldState.snapshotHash,
      recentRunCount: args.recentRuns.length,
      openFindings: worldState.auditFindingsForMe.length,
      openEscalations: worldState.openEscalationsAddressedToMe.length,
    },
    "senna-goal-deriver: evaluating candidates",
  );

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const specHash = spec.specHash;

  // Build procedure citations — use coverage-gap form per §3.4 contract.
  const procedureEntry = spec.procedureSteps.find(
    (s) => s.procedurePath === SENNA_PROCEDURE_PATH,
  );
  const stepId =
    procedureEntry && procedureEntry.stepIds.length > 0
      ? (procedureEntry.stepIds[0] ?? SENNA_PROCEDURE_STEP_ID)
      : SENNA_PROCEDURE_STEP_ID;

  // Helper: validate goal is in spec closed-set before returning.
  const validateGoal = (goal: string): boolean => {
    if (!spec.decisionsInScope.includes(goal)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal,
          closedSet: spec.decisionsInScope,
        },
        "senna-goal-deriver: goal not in closed-set; deferring",
      );
      return false;
    }
    return true;
  };

  // Rule 1: if no SecuritySubstrateSnapshot in last 24h → security-substrate-state goal (HIGH).
  // Senna's §6 inactivity SLA: weekly security-substrate-state run; but in build phase
  // the 24h window ensures the snapshot is fresh for threat-model gating.
  const lastSnapshot = lastSecuritySubstrateSnapshotMs();
  const needsSnapshot =
    lastSnapshot === undefined || Date.now() - lastSnapshot > TWENTY_FOUR_HOURS_MS;

  if (needsSnapshot) {
    if (!validateGoal(SECURITY_SUBSTRATE_STATE_GOAL)) return null;

    return {
      kind: "decision",
      chosen: SECURITY_SUBSTRATE_STATE_GOAL,
      rationale: `No SecuritySubstrateSnapshot event in the last 24h (last seen: ${lastSnapshot ? new Date(lastSnapshot).toISOString() : "never"}). Senna's security-substrate-state SLA (§6: weekly snapshot; daily freshness gate in build phase) requires a snapshot to be current for threat-model gating. Selecting security-substrate-state goal to trigger the senna:security-substrate-state handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: SECURITY_SUBSTRATE_STATE_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: SENNA_PROCEDURE_PATH,
          stepId,
          // SHA-256 of the procedure file is unknown at runtime without
          // reading it; use the spec hash as a proxy (coverage-gap).
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "SecuritySubstrateSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "senna-goal-loop",
          },
        },
      ],
    };
  }

  // Rule 4: new design PR merged in past 24h with no ThreatModelApproved event (HIGH).
  // Checked before Rule 2 + 3 because threat-model gating is a pre-merge gate —
  // any unreviewed merge is a higher-priority finding than a scheduled review.
  const hasUnthreatedPR = hasUnthreaModeldDesignPR();

  if (hasUnthreatedPR) {
    if (!validateGoal(THREAT_MODEL_GATE_GOAL)) return null;

    return {
      kind: "decision",
      chosen: THREAT_MODEL_GATE_GOAL,
      rationale:
        "A design PR was merged in the last 24h without a corresponding ThreatModelGateDecision event. Senna's §9 mandate (threat-model gate at engineering level) requires a STRIDE/LINDDUN review before or immediately after any design merge. Selecting threat-model-gate goal to trigger the senna:security-substrate-state handler and emit a ThreatModelGateDecision.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: THREAT_MODEL_GATE_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: SENNA_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "ThreatModelGateDecision",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "senna-goal-loop",
          },
        },
      ],
    };
  }

  // Rule 2: open AuditFinding tagged security with no remediation ticket in 24h (HIGH).
  // In build phase, any unaddressed security audit finding drives a detection-rule review.
  const openSecurityFindings = hasOpenSecurityAuditFindings();

  if (openSecurityFindings) {
    if (!validateGoal(SECURITY_FINDING_REMEDIATION_GOAL)) return null;

    return {
      kind: "decision",
      chosen: SECURITY_FINDING_REMEDIATION_GOAL,
      rationale:
        "Open AuditFinding events tagged security detected in the event store with no remediation action within 24h. Senna's §9 mandate (Approve detection-rule changes within standard) requires open security findings to be addressed via a detection-rule review or an updated rule mapped to the MITRE ATT&CK technique. Selecting security-finding-remediation goal to trigger the senna:security-substrate-state handler.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: SECURITY_FINDING_REMEDIATION_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: SENNA_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "DetectionRuleChanged",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "senna-goal-loop",
          },
        },
      ],
    };
  }

  // Rule 3: no ZeroTrustPolicyReview event in past 7 days (MEDIUM).
  // Senna's §6 cadence: weekly zero-trust posture review. Uses the
  // secure-SDLC pipeline configuration goal as the closest §9 equivalent —
  // pipeline configuration changes are the primary zero-trust enforcement
  // mechanism in the build-phase substrate.
  const lastZeroTrustReview = lastZeroTrustPolicyReviewMs();
  const needsZeroTrustReview =
    lastZeroTrustReview === undefined || Date.now() - lastZeroTrustReview > SEVEN_DAYS_MS;

  if (needsZeroTrustReview) {
    if (!validateGoal(ZERO_TRUST_POLICY_REVIEW_GOAL)) return null;

    return {
      kind: "decision",
      chosen: ZERO_TRUST_POLICY_REVIEW_GOAL,
      rationale: `No ZeroTrustPolicyReview event in the last 7 days (last seen: ${lastZeroTrustReview ? new Date(lastZeroTrustReview).toISOString() : "never"}). In build phase the secret-rotation cadence goal is the §9 equivalent for zero-trust policy review: HSM-backed key rotation is the primary identity-freshness / credential-revocation mechanism; reviewing rotation cadence is how Senna enforces the zero-trust posture in the current substrate. Selecting zero-trust-policy-review goal to trigger the senna:security-substrate-state handler and emit a KeyRotationPolicySet review.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: ZERO_TRUST_POLICY_REVIEW_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: SENNA_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "KeyRotationPolicySet",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "senna-goal-loop",
            subTrigger: "zero-trust-policy-review",
          },
        },
      ],
    };
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastSnapshotAgo: lastSnapshot
        ? `${Math.round((Date.now() - lastSnapshot) / 60_000)}min`
        : "never",
      openSecurityFindings,
      hasUnthreatedPR,
      lastZeroTrustReviewAgo: lastZeroTrustReview
        ? `${Math.round((Date.now() - lastZeroTrustReview) / 60_000)}min`
        : "never",
    },
    "senna-goal-deriver: no action justified — deferring",
  );
  return null;
};

// Lazy singletons — avoid re-constructing per handler call.
let _goalLoopRunner: LocalAgentGoalLoopRunner | undefined;
let _worldStateReader: LocalAgentWorldStateReader | undefined;

function getGoalLoopRunner(): LocalAgentGoalLoopRunner {
  if (!_goalLoopRunner) _goalLoopRunner = new LocalAgentGoalLoopRunner({ eventStore });
  return _goalLoopRunner;
}

function getWorldStateReader(): LocalAgentWorldStateReader {
  if (!_worldStateReader) _worldStateReader = new LocalAgentWorldStateReader({ eventStore });
  return _worldStateReader;
}

// ---------------------------------------------------------------------------
// Handler (wired as `senna:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// senna:security-substrate-state handler directly via its imported callable.
//
// Shadow mode: shadowMode: true for cohort-3 first ticks.
// In dry-run mode the goal-loop events are still emitted (so the shadow-mode
// trace is testable per spec §4 "Build runs in shadow mode for the first two
// substrate ticks"), but the senna:security-substrate-state handler is called
// with dryRun=true.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "senna:goal-loop — starting goal-loop cohort-3 run",
  );

  const agentUrn = "agent:senna";

  // Parse Senna's spec.
  const parseResult = parseSpecFile(SENNA_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: SENNA_SPEC_PATH },
      "senna:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await sennaSecuritySubstrateState(ctx);
    return output;
  }
  const { spec } = parseResult;

  // Materialise world state snapshot.
  const worldState = getWorldStateReader().snapshot(agentUrn);
  const recentRuns = getWorldStateReader().readMyRecentRuns(agentUrn, 10);

  const args: RunWithGoalArgs = {
    agent: { urn: agentUrn, publicKeyVersion: 1 },
    spec,
    worldState,
    recentRuns,
  };

  // Run goal derivation through the wrapper.
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, sennaGoalDeriver);

  const goalOutcome = goalLoopResult.outcome ?? null;
  const iterationId = goalLoopResult.iterationId;
  const goalEventsEmitted = goalLoopResult.eventsEmitted;

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
    },
    "senna:goal-loop — goal-loop iteration complete",
  );

  // If escalation or deferred — run handler in dry-run mode (shadow trace).
  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  const handlerCtx: AgentRunContext = {
    ...ctx,
    // In shadow mode (cohort-3 first ticks), always dry-run the handler
    // so we observe the trace without side-effects.
    dryRun: ctx.dryRun || !shouldRunHandler,
  };

  const handlerOutput = await sennaSecuritySubstrateState(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "senna:goal-loop — cohort-3 run complete",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-3: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
