// runtime/agents/thandiwe-goal-loop.ts
//
// Thandiwe (Chief Audit Executive, governance) goal-loop — cohort-3 deriver.
//
// Phase: D-AGENT-AUTONOMY-OPERATIONAL Slice 3 — per-persona goal-loop substrate.
// This handler wires Thandiwe into the goal-loop substrate.
// Pattern follows `atlas-goal-loop.ts` (cohort-1 reference implementation) and
// `owen-goal-loop.ts` (cohort-2 reference).
//
// Rule-engine goal derivation (no LLM calls — rule-engine-only constraint per
// spec §3.4 "MUST NOT — LLM cost-cap"):
//   1. No `AuditCommitteePackPrepped` event in the last 7 days →
//      select "Sign quarterly third-line opinion" goal (AC prep is the
//      weekly cadence trigger; absence > 7d means the prep is overdue).
//   2. Open `AuditFinding` events with severity "fail" / HIGH / Tier-1 not yet
//      escalated (no paired `AgentEscalation` with same findingId in scope) →
//      select "Sign individual audit findings" goal to surface critical findings
//      for escalation.
//   3. No `AuditPlanRevisionApproved` event recently (no event within the last
//      365 days, or no event ever) →
//      select "Approve audit-plan revisions" goal (risk-based audit plan is
//      a standing annual cadence per §6).
//   4. Otherwise → defer (null).
//
// Shadow mode: shadowMode: true — Thandiwe is cohort-3; first two substrate
// ticks run in shadow mode per spec §4. Goal-loop events (AgentGoalEvaluated,
// AgentGoalSelected, AgentGoalDeferred) are still emitted so the trace is
// testable; the underlying handler is always called with dryRun=true.
//
// Procedure citations: Thandiwe owns:
//   - `Procedures/by-policy/ceo-decision-review.md` (live; assurance role)
//   - `Procedures/by-policy/audit-plan-cycle.md` (planned)
//   - `Procedures/by-policy/findings-tracking.md` (planned)
// Coverage-gap step-ID form per _step-id-convention.md §5 used for planned
// procedures that do not yet have step anchors.
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Thandiwe (Chief Audit Executive, governance) · Atlas (Core banking platform architect)

import { resolve } from "node:path";
import type { GoalDeriver, GoalLoopOutcome } from "../../platform/agent-runtime/goal-loop";
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import type { RunWithGoalArgs } from "../../platform/agent-runtime/goal-loop";
import { parseSpecFile } from "../../platform/agent-runtime/spec-parser";
import { LocalAgentWorldStateReader } from "../../platform/agent-runtime/world-state";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import Thandiwe's underlying handler directly to avoid circular dependency
// (handler-callables.ts → this file → handler-callables.ts).
import thandiweAuditCommitteePrep from "./thandiwe-audit-committee-prep";

// ---------------------------------------------------------------------------
// Spec path
// ---------------------------------------------------------------------------

const THANDIWE_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Thandiwe.md",
);

// ---------------------------------------------------------------------------
// §9 row labels from Team/Thandiwe.md used by the goal deriver.
// These must match the exact row labels in Thandiwe's spec §9 decisions-in-scope
// for the closed-set validation (T-NEW) to pass.
// ---------------------------------------------------------------------------

const GOAL_SIGN_THIRD_LINE_OPINION = "Sign quarterly third-line opinion" as const;
const GOAL_SIGN_AUDIT_FINDINGS = "Sign individual audit findings" as const;
const GOAL_APPROVE_AUDIT_PLAN_REVISIONS = "Approve audit-plan revisions" as const;

// ---------------------------------------------------------------------------
// Procedure paths (§13 of Thandiwe's spec)
// ---------------------------------------------------------------------------

const PROCEDURE_CEO_DECISION_REVIEW = "Procedures/by-policy/ceo-decision-review.md";
const PROCEDURE_AUDIT_PLAN_CYCLE = "Procedures/by-policy/audit-plan-cycle.md";
const PROCEDURE_FINDINGS_TRACKING = "Procedures/by-policy/findings-tracking.md";

// Coverage-gap step-ID form per _step-id-convention.md §5 (planned procedures).
const STEP_AC_PREP = "ceo-decision-review:step-1";
const STEP_FINDINGS = "findings-tracking:step-1";
const STEP_AUDIT_PLAN = "audit-plan-cycle:step-1";

// ---------------------------------------------------------------------------
// Rule-engine helpers
// ---------------------------------------------------------------------------

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THREE_SIXTY_FIVE_DAYS_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Returns the timestamp (ms) of the most recent AuditCommitteePackPrepped
 * event, or undefined if none exists.
 */
function lastAuditCommitteePackPrepMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "AuditCommitteePackPrepped" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns true if there are any open AuditFinding events with severity
 * "fail", "high", "critical", or "tier-1" that have not been paired with
 * a corresponding AgentEscalation event.
 *
 * Approximation: checks whether any critical/high-severity AuditFinding event
 * exists more recently than the last AgentEscalation emitted by Thandiwe.
 * A full per-finding escalation register is a substrate gap (§16).
 */
function hasUnescalatedCriticalFindings(): boolean {
  let lastCriticalFinding: number | undefined;
  let lastEscalation: number | undefined;

  for (const e of eventStore.replay({ type: "AuditFinding" })) {
    const p = e.payload as Record<string, unknown>;
    const severity = String(p.severity ?? "").toLowerCase();
    if (/fail|high|critical|tier[\s-]?1/.test(severity)) {
      const t = new Date(e.as_of).getTime();
      if (!Number.isNaN(t) && (lastCriticalFinding === undefined || t > lastCriticalFinding)) {
        lastCriticalFinding = t;
      }
    }
  }

  // Look for AgentEscalation events issued by Thandiwe.
  for (const e of eventStore.replay({ type: "AgentEscalation" })) {
    const p = e.payload as Record<string, unknown>;
    const actor = String(p.agentUrn ?? p.issuingAgent ?? "");
    if (/thandiwe/i.test(actor) || actor === "agent:thandiwe") {
      const t = new Date(e.as_of).getTime();
      if (!Number.isNaN(t) && (lastEscalation === undefined || t > lastEscalation)) {
        lastEscalation = t;
      }
    }
  }

  // Unescalated if a critical finding is more recent than the last escalation.
  return (
    lastCriticalFinding !== undefined &&
    (lastEscalation === undefined || lastCriticalFinding > lastEscalation)
  );
}

/**
 * Returns the timestamp (ms) of the most recent AuditPlanRevisionApproved
 * event, or undefined if none exists.
 */
function lastAuditPlanRevisionApprovedMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "AuditPlanRevisionApproved" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Goal-derivation rule engine for Thandiwe
// ---------------------------------------------------------------------------

export const thandiweGoalDeriver: GoalDeriver = async (
  args: RunWithGoalArgs,
): Promise<GoalLoopOutcome> => {
  const { spec } = args;

  logger.info(
    {
      agentUrn: args.agent.urn,
      worldStateHash: args.worldState.snapshotHash,
      recentRunCount: args.recentRuns.length,
      openFindings: args.worldState.auditFindingsForMe.length,
      openEscalations: args.worldState.openEscalationsAddressedToMe.length,
    },
    "thandiwe-goal-deriver: evaluating candidates",
  );

  const specHash = spec.specHash;

  // Helper: validate a goal is in the closed-set (T-NEW self-check).
  function inClosedSet(goal: string): boolean {
    const ok = spec.decisionsInScope.includes(goal);
    if (!ok) {
      logger.warn(
        { agentUrn: args.agent.urn, goal, closedSet: spec.decisionsInScope },
        "thandiwe-goal-deriver: goal not in closed-set; deferring",
      );
    }
    return ok;
  }

  // Helper: resolve a procedure step-ID from spec, with coverage-gap fallback.
  function resolveStepId(procedurePath: string, fallback: string): string {
    const entry = spec.procedureSteps.find((s) => s.procedurePath === procedurePath);
    return entry && entry.stepIds.length > 0 ? (entry.stepIds[0] ?? fallback) : fallback;
  }

  // -------------------------------------------------------------------------
  // Candidate 1: no AuditCommitteePackPrepped in the last 7 days →
  // "Sign quarterly third-line opinion" (AC prep weekly cadence per §6).
  // The inactivity SLA in §6 states: quiet > 7 days is a substrate alert.
  // -------------------------------------------------------------------------

  const lastACPrep = lastAuditCommitteePackPrepMs();
  const needsACPrep = lastACPrep === undefined || Date.now() - lastACPrep > SEVEN_DAYS_MS;

  if (needsACPrep) {
    if (!inClosedSet(GOAL_SIGN_THIRD_LINE_OPINION)) return null;

    const stepId = resolveStepId(PROCEDURE_CEO_DECISION_REVIEW, STEP_AC_PREP);

    logger.info(
      {
        agentUrn: args.agent.urn,
        lastACPrepAgo: lastACPrep
          ? `${Math.round((Date.now() - lastACPrep) / 60_000)}min`
          : "never",
      },
      "thandiwe-goal-deriver: no AuditCommitteePackPrepped in 7d — selecting third-line opinion goal",
    );

    return {
      kind: "decision",
      chosen: GOAL_SIGN_THIRD_LINE_OPINION,
      rationale: `No AuditCommitteePackPrepped event in the last 7 days (last seen: ${lastACPrep ? new Date(lastACPrep).toISOString() : "never"}). Thandiwe's §6 inactivity SLA states quiet > 7 days is a substrate alert. Selecting quarterly third-line opinion goal to trigger the thandiwe:audit-committee-prep handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: GOAL_SIGN_THIRD_LINE_OPINION,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: PROCEDURE_CEO_DECISION_REVIEW,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "AuditCommitteePackPrepped",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "thandiwe-goal-loop",
          },
        },
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Candidate 2: open AuditFinding events with severity "fail" / HIGH /
  // Tier-1 not yet escalated → "Sign individual audit findings".
  // Per §7 Triggers: HIGH-severity findings → triage within 24h; issuance
  // within 5 working days; AC notification per severity protocol.
  // -------------------------------------------------------------------------

  const unescalatedCritical = hasUnescalatedCriticalFindings();

  if (unescalatedCritical) {
    if (!inClosedSet(GOAL_SIGN_AUDIT_FINDINGS)) return null;

    const stepId = resolveStepId(PROCEDURE_FINDINGS_TRACKING, STEP_FINDINGS);

    logger.info(
      { agentUrn: args.agent.urn },
      "thandiwe-goal-deriver: unescalated critical AuditFinding events — selecting findings goal",
    );

    return {
      kind: "decision",
      chosen: GOAL_SIGN_AUDIT_FINDINGS,
      rationale:
        "Open AuditFinding events with severity fail/HIGH/Tier-1 detected without a corresponding AgentEscalation from Thandiwe. §7 mandates triage within 24h and AC notification per severity protocol. Selecting individual audit findings goal to sign and escalate critical findings.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: GOAL_SIGN_AUDIT_FINDINGS,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: PROCEDURE_FINDINGS_TRACKING,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "AuditFinding",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "thandiwe-goal-loop",
            action: "sign-and-escalate",
          },
        },
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Candidate 3: no AuditPlanRevisionApproved in the last 365 days →
  // "Approve audit-plan revisions" (annual cadence per §6 and first-90-days
  // plan item 2: risk-based audit plan submitted for AC approval).
  // -------------------------------------------------------------------------

  const lastAuditPlanApproved = lastAuditPlanRevisionApprovedMs();
  const needsAuditPlan =
    lastAuditPlanApproved === undefined ||
    Date.now() - lastAuditPlanApproved > THREE_SIXTY_FIVE_DAYS_MS;

  if (needsAuditPlan) {
    if (!inClosedSet(GOAL_APPROVE_AUDIT_PLAN_REVISIONS)) return null;

    const stepId = resolveStepId(PROCEDURE_AUDIT_PLAN_CYCLE, STEP_AUDIT_PLAN);

    logger.info(
      {
        agentUrn: args.agent.urn,
        lastAuditPlanAgo: lastAuditPlanApproved
          ? `${Math.round((Date.now() - lastAuditPlanApproved) / (60_000 * 60 * 24))}d`
          : "never",
      },
      "thandiwe-goal-deriver: no AuditPlanRevisionApproved in 365d — selecting audit-plan goal",
    );

    return {
      kind: "decision",
      chosen: GOAL_APPROVE_AUDIT_PLAN_REVISIONS,
      rationale: `No AuditPlanRevisionApproved event in the last 365 days (last seen: ${lastAuditPlanApproved ? new Date(lastAuditPlanApproved).toISOString() : "never"}). Thandiwe's §6 annual audit-plan refresh cadence is due. The first-90-days plan item 2 (risk-based audit plan submitted for AC approval) is also overdue. Selecting audit-plan revisions goal.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: GOAL_APPROVE_AUDIT_PLAN_REVISIONS,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: PROCEDURE_AUDIT_PLAN_CYCLE,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "AuditPlanRevisionApproved",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "thandiwe-goal-loop",
          },
        },
      ],
    };
  }

  // No goal justified — defer.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastACPrepAgo: lastACPrep ? `${Math.round((Date.now() - lastACPrep) / 60_000)}min` : "never",
      lastAuditPlanAgo: lastAuditPlanApproved
        ? `${Math.round((Date.now() - lastAuditPlanApproved) / (60_000 * 60 * 24))}d`
        : "never",
    },
    "thandiwe-goal-deriver: no action justified — deferring",
  );
  return null;
};

// ---------------------------------------------------------------------------
// Lazy singletons — avoid re-constructing per handler call.
// ---------------------------------------------------------------------------

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
// Handler (wired as `thandiwe:goal-loop`)
//
// Shadow mode: shadowMode: true — cohort-3; first two substrate ticks run in
// shadow mode per spec §4. Goal-loop events are emitted so the trace is
// testable; the underlying handler is always called with dryRun=true.
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// thandiwe:audit-committee-prep handler directly via its imported callable.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "thandiwe:goal-loop — starting goal-loop cohort-3 run (shadow mode)",
  );

  const agentUrn = "agent:thandiwe";

  // Parse Thandiwe's spec.
  const parseResult = parseSpecFile(THANDIWE_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: THANDIWE_SPEC_PATH },
      "thandiwe:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await thandiweAuditCommitteePrep(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, thandiweGoalDeriver);

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
    "thandiwe:goal-loop — goal-loop iteration complete",
  );

  // Shadow mode (cohort-3): always dry-run the underlying handler so we
  // observe the trace without side-effects, regardless of goal outcome.
  // The handler will be promoted to live once cohort validation passes.
  const handlerCtx: AgentRunContext = {
    ...ctx,
    dryRun: true, // shadowMode: true until cohort-3 validation passes
  };

  const handlerOutput = await thandiweAuditCommitteePrep(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "thandiwe:goal-loop — cohort-3 shadow run complete",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-3 shadow: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
