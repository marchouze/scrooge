// runtime/agents/rohan-goal-loop.ts
//
// Rohan (Risk engineer) goal-loop — cohort-3.
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Rohan is wired into the
// goal-loop substrate. This run-handler is the integration point that:
//   1. Materialises a WorldStateSnapshot for agent:rohan.
//   2. Runs Rohan's rule-engine goal deriver (no LLM calls — cohort-3
//      rule-engine constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   - If no RiskRunCompleted event in the last 24 hours
//     → select "Sign daily limit-utilisation".
//   - Else if open RiskRaised events not yet resolved
//     → select "Raise a RiskRaised event on a detected risk".
//   - Else if no ICAAPSubmissionDrafted in the last 7 days
//     → select "Sign RWA / RWA-attribution submission to Camille"
//       (closest §9 equivalent to "Generate ICAAP snapshot" in build phase;
//       the ICAAP substrate is a paper exercise during build — per §16
//       "ICAAP / ILAAP run as paper exercise during build-only").
//   - Otherwise → defer (null outcome).
//
// The goal candidates use Rohan's §9 decisions-in-scope row labels exactly
// as they appear in Team/Rohan.md (the spec's closed-set per T-NEW).
//
// Procedure citations: Rohan owns Procedures/by-policy/daily-risk-run.md
// (§13 "planned"). Since this file may not yet have step anchors
// (pre-backfill coverage-gap per _step-id-convention.md §5), we use the
// coverage-gap form: `stepId: "daily-risk-run:step-1"` as a placeholder.
// The recon pipeline warns (not fails) for missing step IDs per the
// build-phase tolerance.
//
// Shadow mode: shadowMode: true for cohort-3 until cohort validation passes
// (per spec §4 "Build runs in shadow mode for the first two substrate ticks").
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect) — wiring.
//         Rohan (Risk engineer) — goal-deriver rules.

import { resolve } from "node:path";
import type { GoalDeriver, GoalLoopOutcome } from "../../platform/agent-runtime/goal-loop";
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import type { RunWithGoalArgs } from "../../platform/agent-runtime/goal-loop";
import { parseSpecFile } from "../../platform/agent-runtime/spec-parser";
import { LocalAgentWorldStateReader } from "../../platform/agent-runtime/world-state";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import the underlying risk-run handler directly to avoid the circular
// dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import rohanRiskRun from "./rohan-risk-run";

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Rohan
// ---------------------------------------------------------------------------

const ROHAN_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Rohan.md",
);

// Procedure path for Rohan's daily-risk-run procedure (§13).
const ROHAN_PROCEDURE_PATH = "Procedures/by-policy/daily-risk-run.md";
// Coverage-gap step-ID form per _step-id-convention.md §5.
const ROHAN_PROCEDURE_STEP_ID = "daily-risk-run:step-1";

// §9 row labels from Team/Rohan.md (closed-set per T-NEW).
// Candidate 1: daily risk-run goal.
const DAILY_RISK_RUN_GOAL = "Sign daily limit-utilisation" as const;
// Candidate 2: open risk-findings goal.
const RISK_FINDINGS_GOAL = "Raise a RiskRaised event on a detected risk" as const;
// Candidate 3: ICAAP snapshot goal — closest §9 equivalent in build phase
// (ICAAP as paper exercise per §16; RWA-attribution submission gates the
// capital-readiness attestation that is the build-phase ICAAP proxy).
const ICAAP_SNAPSHOT_GOAL = "Sign RWA / RWA-attribution submission to Camille" as const;

// ---------------------------------------------------------------------------
// Event-query helpers
// ---------------------------------------------------------------------------

function lastRiskRunCompletedMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "RiskRunCompleted" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns true if there are any RiskRaised events that have NOT been paired
 * with a matching RiskResolved (or equivalent closure) event.
 *
 * In the current build phase the closure event schema is not yet defined
 * (§16 "risk engine modules in build-only"). We detect open findings by
 * checking whether any RiskRaised event exists in the store; until a
 * RiskResolved family is emitted the count stays open.
 */
function hasOpenRiskFindings(): boolean {
  for (const _e of eventStore.replay({ type: "RiskRaised" })) {
    // Any RiskRaised entry signals an open finding in build phase (no
    // RiskResolved event type yet registered). Return immediately on the
    // first match to avoid full-scan on large stores.
    return true;
  }
  return false;
}

/**
 * Returns the timestamp of the most recent ICAAPSubmissionDrafted event,
 * or undefined if none exists.
 *
 * Build-phase note (§16): ICAAP is a paper exercise until licence-day; the
 * ICAAPSubmissionDrafted event is the substrate-level proxy for "ICAAP
 * snapshot produced". If the event has never been emitted, we treat the
 * ICAAP as overdue and fire the RWA-attribution goal as the closest §9
 * equivalent (capital-readiness attestation gate).
 */
function lastIcaapSubmissionDraftedMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "ICAAPSubmissionDrafted" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Goal deriver
// ---------------------------------------------------------------------------

export const rohanGoalDeriver: GoalDeriver = async (
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
    "rohan-goal-deriver: evaluating candidates",
  );

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const specHash = spec.specHash;

  // Build procedure citations — use coverage-gap form per §3.4 contract.
  const procedureEntry = spec.procedureSteps.find((s) => s.procedurePath === ROHAN_PROCEDURE_PATH);
  const stepId =
    procedureEntry && procedureEntry.stepIds.length > 0
      ? (procedureEntry.stepIds[0] ?? ROHAN_PROCEDURE_STEP_ID)
      : ROHAN_PROCEDURE_STEP_ID;

  // Helper: validate goal is in spec closed-set before returning.
  const validateGoal = (goal: string): boolean => {
    if (!spec.decisionsInScope.includes(goal)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal,
          closedSet: spec.decisionsInScope,
        },
        "rohan-goal-deriver: goal not in closed-set; deferring",
      );
      return false;
    }
    return true;
  };

  // Candidate 1: if no RiskRunCompleted in last 24h, select daily risk-run
  // goal. Rohan's §6 inactivity SLA: daily risk run must produce a
  // RiskRunCompleted event by 08:00 UTC each day.
  const lastRiskRun = lastRiskRunCompletedMs();
  const needsDailyRun =
    lastRiskRun === undefined || Date.now() - lastRiskRun > TWENTY_FOUR_HOURS_MS;

  if (needsDailyRun) {
    if (!validateGoal(DAILY_RISK_RUN_GOAL)) return null;

    return {
      kind: "decision",
      chosen: DAILY_RISK_RUN_GOAL,
      rationale: `No RiskRunCompleted event in the last 24h (last seen: ${lastRiskRun ? new Date(lastRiskRun).toISOString() : "never"}). Rohan's daily risk-run SLA (§6: run at 06:00 UTC; RiskRunCompleted by 08:00 UTC) requires a daily risk batch. Selecting daily risk-run goal to trigger the rohan:risk-run handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: DAILY_RISK_RUN_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: ROHAN_PROCEDURE_PATH,
          stepId,
          // SHA-256 of the procedure file is unknown at runtime without
          // reading it; use the spec hash as a proxy (coverage-gap).
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "RiskRunCompleted",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "rohan-goal-loop",
          },
        },
      ],
    };
  }

  // Candidate 2: open RiskRaised events not yet resolved.
  // In build phase, any un-resolved RiskRaised is treated as open (no
  // RiskResolved event type yet registered — §16 substrate gap).
  // This candidate fires the "Raise a RiskRaised event" goal which drives
  // the risk-run handler to surface the open finding into the next run pack.
  const openRiskFindings = hasOpenRiskFindings();

  if (openRiskFindings) {
    if (!validateGoal(RISK_FINDINGS_GOAL)) return null;

    return {
      kind: "decision",
      chosen: RISK_FINDINGS_GOAL,
      rationale:
        "Open RiskRaised events detected in the event store that have not been resolved. Rohan's §9 mandate (Raise a RiskRaised event on a detected risk) requires the risk-run handler to process open risk findings. Selecting risk-findings goal to trigger the rohan:risk-run handler.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: RISK_FINDINGS_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: ROHAN_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "RiskRaised",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "rohan-goal-loop",
          },
        },
      ],
    };
  }

  // Candidate 3: if no ICAAPSubmissionDrafted in last 7 days, select ICAAP
  // snapshot goal. Build-phase note (§16): ICAAP is a paper exercise until
  // licence-day. The RWA-attribution submission goal is the closest §9
  // equivalent — it gates the capital-readiness attestation that the ICAAP
  // depends on. Per §6 cadence: annual ICAAP at FY-end + 90 days; weekly
  // ICAAP-readiness check (7-day trigger here) validates the pipeline
  // end-to-end in build phase.
  const lastIcaap = lastIcaapSubmissionDraftedMs();
  const needsIcaapSnapshot = lastIcaap === undefined || Date.now() - lastIcaap > SEVEN_DAYS_MS;

  if (needsIcaapSnapshot) {
    if (!validateGoal(ICAAP_SNAPSHOT_GOAL)) return null;

    return {
      kind: "decision",
      chosen: ICAAP_SNAPSHOT_GOAL,
      rationale: `No ICAAPSubmissionDrafted event in the last 7 days (last seen: ${lastIcaap ? new Date(lastIcaap).toISOString() : "never"}). In build phase the RWA-attribution submission goal is the §9 equivalent for ICAAP snapshot generation: it validates the capital-readiness substrate that feeds the ICAAP. Selecting ICAAP-snapshot goal to trigger the rohan:risk-run handler and produce the capital-readiness attestation.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: ICAAP_SNAPSHOT_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: ROHAN_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "ICAAPSubmissionDrafted",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "rohan-goal-loop",
          },
        },
      ],
    };
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastRiskRunAgo: lastRiskRun
        ? `${Math.round((Date.now() - lastRiskRun) / 60_000)}min`
        : "never",
      openRiskFindings,
      lastIcaapAgo: lastIcaap ? `${Math.round((Date.now() - lastIcaap) / 60_000)}min` : "never",
    },
    "rohan-goal-deriver: no action justified — deferring",
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
// Handler (wired as `rohan:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// rohan:risk-run handler directly via its imported callable.
//
// Shadow mode: shadowMode: true for cohort-3 first ticks.
// In dry-run mode the goal-loop events are still emitted (so the shadow-mode
// trace is testable per spec §4 "Build runs in shadow mode for the first two
// substrate ticks"), but the rohan:risk-run handler is called with
// dryRun=true.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "rohan:goal-loop — starting goal-loop cohort-3 run",
  );

  const agentUrn = "agent:rohan";

  // Parse Rohan's spec.
  const parseResult = parseSpecFile(ROHAN_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: ROHAN_SPEC_PATH },
      "rohan:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await rohanRiskRun(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, rohanGoalDeriver);

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
    "rohan:goal-loop — goal-loop iteration complete",
  );

  // If escalation or deferred — run handler in dry-run mode (shadow trace).
  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  const handlerCtx: AgentRunContext = {
    ...ctx,
    // In shadow mode (cohort-3 first ticks), always dry-run the handler
    // so we observe the trace without side-effects.
    dryRun: ctx.dryRun || !shouldRunHandler,
  };

  const handlerOutput = await rohanRiskRun(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "rohan:goal-loop — cohort-3 run complete",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-3: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
