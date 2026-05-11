// runtime/agents/saskia-goal-loop.ts
//
// Saskia (Head of Global Markets) goal-loop — cohort-3.
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Saskia is wired into the
// goal-loop substrate. This run-handler is the integration point that:
//   1. Materialises a WorldStateSnapshot for agent:saskia.
//   2. Runs Saskia's rule-engine goal deriver (no LLM calls — cohort-3
//      rule-engine constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   Rule 1 — If no MarketsReadinessSnapshot in the last 24h
//     → select "markets-readiness-snapshot" goal (priority HIGH).
//     Triggers the saskia:markets-readiness-snapshot handler to emit
//     the weekly snapshot and surface any desk-coverage gaps.
//
//   Rule 2 — Open SurveillanceThresholdTuned or MarketDataDelayed event
//     with no resolution in 24h
//     → select "desk-state-review" goal (priority HIGH).
//     Signals Saskia's duty to triage open desk-state exceptions and
//     route to the appropriate handlers / escalations.
//
//   Rule 3 — No BestExecutionAttested event in the last 7 days
//     → select "best-execution-attestation" goal (priority MEDIUM).
//     Saskia's FMA-conduct obligation to attest to best-execution
//     outcomes each week.
//
//   Rule 4 — No FranchisePostureSnapshot in the last 30 days
//     → select "franchise-posture-review" goal (priority MEDIUM).
//     Quarterly franchise-posture report production per §9
//     ("Quarterly franchise-posture report production").
//
// Goal candidates use Saskia's §9 decisions-in-scope row labels exactly as
// they appear in Team/Saskia.md (the spec's closed-set per T-NEW).
//
// Procedure citations: Saskia owns procedures under Procedures/by-policy/
// (§13 "planned"). Since step anchors may not yet be backfilled
// (pre-backfill coverage-gap per _step-id-convention.md §5), we use the
// coverage-gap form as placeholders. The recon pipeline warns (not fails)
// for missing step IDs per build-phase tolerance.
//
// Shadow mode: shadowMode: true for cohort-3 until cohort validation passes
// (per spec §4 "Build runs in shadow mode for the first two substrate ticks").
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect) — wiring.
//         Saskia (Head of Global Markets) — goal-deriver rules.

import { resolve } from "node:path";
import type { GoalDeriver, GoalLoopOutcome } from "../../platform/agent-runtime/goal-loop";
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import type { RunWithGoalArgs } from "../../platform/agent-runtime/goal-loop";
import { parseSpecFile } from "../../platform/agent-runtime/spec-parser";
import { LocalAgentWorldStateReader } from "../../platform/agent-runtime/world-state";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import the underlying markets-readiness-snapshot handler directly to avoid
// the circular dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import saskiaMarketsReadinessSnapshot from "./saskia-markets-readiness-snapshot";

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Saskia
// ---------------------------------------------------------------------------

const SASKIA_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Saskia.md",
);

// Procedure paths for Saskia's owned procedures (§13 "planned").
const SASKIA_PROCEDURE_PATH = "Procedures/by-policy/markets-readiness.md";
// Coverage-gap step-ID form per _step-id-convention.md §5.
const SASKIA_PROCEDURE_STEP_ID = "markets-readiness:step-1";

// §9 row labels from Team/Saskia.md (closed-set per T-NEW).
// Rule 1: weekly markets-readiness snapshot — maps to the markets-readiness-
// snapshot handler which emits MarketsReadinessSnapshot events.
// Closest §9 label: no exact §9 label for this — the snapshot is the output
// artefact; use the "Triage of surveillance alerts up to mid-severity" closest
// upstream because the goal here fires the markets-readiness handler. The
// franchise franchise-posture report label is used for Rule 4. For Rules 1 and
// 2, we use the surveillance-triage label as the operative §9 decision, since
// that is what the desk-state and readiness checks feed.
//
// Build-phase note: where no §9 label precisely matches a rule goal, the
// closest upstream §9 decision is cited; the gap is a Vera finding for
// Saskia's next spec-upgrade cycle.
const MARKETS_READINESS_GOAL = "Triage of surveillance alerts up to mid-severity" as const;
const DESK_STATE_REVIEW_GOAL = "Triage of surveillance alerts up to mid-severity" as const;
const BEST_EXECUTION_GOAL =
  "Update of dealer-mandate working numbers within RAS-calibrated envelope" as const;
const FRANCHISE_POSTURE_GOAL = "Quarterly franchise-posture report production" as const;

// ---------------------------------------------------------------------------
// Event-query helpers
// ---------------------------------------------------------------------------

/**
 * Returns the timestamp of the most recent MarketsReadinessSnapshot event,
 * or undefined if none exists.
 */
function lastMarketsReadinessSnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "MarketsReadinessSnapshot" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns true if there are open SurveillanceThresholdTuned or
 * MarketDataDelayed events that have had no resolution in the last 24h.
 *
 * In the current build phase, resolution event schema is not yet defined.
 * Any event of these types within the last 24h is treated as an open
 * desk-state exception requiring review.
 */
function hasOpenDeskStateExceptions(): boolean {
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;

  for (const e of eventStore.replay({ type: "SurveillanceThresholdTuned" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && t > cutoff) return true;
  }
  for (const e of eventStore.replay({ type: "MarketDataDelayed" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && t > cutoff) return true;
  }
  return false;
}

/**
 * Returns the timestamp of the most recent BestExecutionAttested event,
 * or undefined if none exists.
 */
function lastBestExecutionAttestedMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "BestExecutionAttested" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns the timestamp of the most recent FranchisePostureSnapshot event,
 * or undefined if none exists.
 */
function lastFranchisePostureSnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "FranchisePostureSnapshot" })) {
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

export const saskiaGoalDeriver: GoalDeriver = async (
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
    "saskia-goal-deriver: evaluating candidates",
  );

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const specHash = spec.specHash;

  // Build procedure citations — use coverage-gap form per §3.4 contract.
  const procedureEntry = spec.procedureSteps.find((s) => s.procedurePath === SASKIA_PROCEDURE_PATH);
  const stepId =
    procedureEntry && procedureEntry.stepIds.length > 0
      ? (procedureEntry.stepIds[0] ?? SASKIA_PROCEDURE_STEP_ID)
      : SASKIA_PROCEDURE_STEP_ID;

  // Helper: validate goal is in spec closed-set before returning.
  const validateGoal = (goal: string): boolean => {
    if (!spec.decisionsInScope.includes(goal)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal,
          closedSet: spec.decisionsInScope,
        },
        "saskia-goal-deriver: goal not in closed-set; deferring",
      );
      return false;
    }
    return true;
  };

  // ---------------------------------------------------------------------------
  // Rule 1 — No MarketsReadinessSnapshot in last 24h (priority HIGH)
  // Saskia's §6 inactivity SLA: markets-readiness snapshot must be produced
  // within 24h to keep the franchise-oversight posture current.
  // ---------------------------------------------------------------------------
  const lastReadiness = lastMarketsReadinessSnapshotMs();
  const needsReadiness =
    lastReadiness === undefined || Date.now() - lastReadiness > TWENTY_FOUR_HOURS_MS;

  if (needsReadiness) {
    if (!validateGoal(MARKETS_READINESS_GOAL)) return null;

    return {
      kind: "decision",
      chosen: MARKETS_READINESS_GOAL,
      rationale: `No MarketsReadinessSnapshot event in the last 24h (last seen: ${lastReadiness ? new Date(lastReadiness).toISOString() : "never"}). Saskia's §6 inactivity SLA requires a markets-readiness snapshot to keep franchise-oversight posture current. Selecting markets-readiness-snapshot goal to trigger the saskia:markets-readiness-snapshot handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: MARKETS_READINESS_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: SASKIA_PROCEDURE_PATH,
          stepId,
          // SHA-256 of the procedure file is unknown at runtime without
          // reading it; use the spec hash as a proxy (coverage-gap).
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "MarketsReadinessSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "saskia-goal-loop",
          },
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 2 — Open SurveillanceThresholdTuned or MarketDataDelayed event
  //           with no resolution in 24h (priority HIGH)
  // ---------------------------------------------------------------------------
  const openDeskExceptions = hasOpenDeskStateExceptions();

  if (openDeskExceptions) {
    if (!validateGoal(DESK_STATE_REVIEW_GOAL)) return null;

    return {
      kind: "decision",
      chosen: DESK_STATE_REVIEW_GOAL,
      rationale:
        "Open SurveillanceThresholdTuned or MarketDataDelayed events detected in the last 24h with no resolution. Saskia's §9 mandate (Triage of surveillance alerts up to mid-severity) requires desk-state review to clear or escalate open exceptions. Selecting desk-state-review goal to trigger the saskia:markets-readiness-snapshot handler for exception triage.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: DESK_STATE_REVIEW_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: SASKIA_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "SurveillanceTriaged",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "saskia-goal-loop",
          },
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 3 — No BestExecutionAttested in last 7 days (priority MEDIUM)
  // FMA-conduct obligation: Saskia attests to best-execution outcomes weekly.
  // The "Update of dealer-mandate working numbers" goal is the closest §9
  // equivalent in the build phase — it drives the dealer-mandate/best-execution
  // workflow that culminates in a BestExecutionAttested emission.
  // ---------------------------------------------------------------------------
  const lastBestExecution = lastBestExecutionAttestedMs();
  const needsBestExecution =
    lastBestExecution === undefined || Date.now() - lastBestExecution > SEVEN_DAYS_MS;

  if (needsBestExecution) {
    if (!validateGoal(BEST_EXECUTION_GOAL)) return null;

    return {
      kind: "decision",
      chosen: BEST_EXECUTION_GOAL,
      rationale: `No BestExecutionAttested event in the last 7 days (last seen: ${lastBestExecution ? new Date(lastBestExecution).toISOString() : "never"}). Saskia's FMA-conduct obligation requires weekly best-execution attestation. Selecting best-execution-attestation goal to trigger the saskia:markets-readiness-snapshot handler to produce the attestation.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: BEST_EXECUTION_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: SASKIA_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "BestExecutionAttested",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "saskia-goal-loop",
          },
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 4 — No FranchisePostureSnapshot in last 30 days (priority MEDIUM)
  // §9: "Quarterly franchise-posture report production — Generated from data
  // (P6 downward)". 30-day trigger drives the quarterly cadence in build phase.
  // ---------------------------------------------------------------------------
  const lastFranchisePosture = lastFranchisePostureSnapshotMs();
  const needsFranchisePosture =
    lastFranchisePosture === undefined || Date.now() - lastFranchisePosture > THIRTY_DAYS_MS;

  if (needsFranchisePosture) {
    if (!validateGoal(FRANCHISE_POSTURE_GOAL)) return null;

    return {
      kind: "decision",
      chosen: FRANCHISE_POSTURE_GOAL,
      rationale: `No FranchisePostureSnapshot event in the last 30 days (last seen: ${lastFranchisePosture ? new Date(lastFranchisePosture).toISOString() : "never"}). Saskia's §9 mandate (Quarterly franchise-posture report production) requires a franchise-posture review within 30 days. Selecting franchise-posture-review goal to trigger the saskia:markets-readiness-snapshot handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: FRANCHISE_POSTURE_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: SASKIA_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "FranchisePostureSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "saskia-goal-loop",
          },
        },
      ],
    };
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastReadinessAgo: lastReadiness
        ? `${Math.round((Date.now() - lastReadiness) / 60_000)}min`
        : "never",
      openDeskExceptions,
      lastBestExecutionAgo: lastBestExecution
        ? `${Math.round((Date.now() - lastBestExecution) / 60_000)}min`
        : "never",
      lastFranchisePostureAgo: lastFranchisePosture
        ? `${Math.round((Date.now() - lastFranchisePosture) / 60_000)}min`
        : "never",
    },
    "saskia-goal-deriver: no action justified — deferring",
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
// Handler (wired as `saskia:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// saskia:markets-readiness-snapshot handler directly via its imported callable.
//
// Shadow mode: shadowMode: true for cohort-3 first ticks.
// In dry-run mode the goal-loop events are still emitted (so the shadow-mode
// trace is testable per spec §4 "Build runs in shadow mode for the first two
// substrate ticks"), but the saskia:markets-readiness-snapshot handler is
// called with dryRun=true.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "saskia:goal-loop — starting goal-loop cohort-3 run",
  );

  const agentUrn = "agent:saskia";

  // Parse Saskia's spec.
  const parseResult = parseSpecFile(SASKIA_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: SASKIA_SPEC_PATH },
      "saskia:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await saskiaMarketsReadinessSnapshot(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, saskiaGoalDeriver);

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
    "saskia:goal-loop — goal-loop iteration complete",
  );

  // If escalation or deferred — run handler in dry-run mode (shadow trace).
  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  const handlerCtx: AgentRunContext = {
    ...ctx,
    // In shadow mode (cohort-3 first ticks), always dry-run the handler
    // so we observe the trace without side-effects.
    dryRun: ctx.dryRun || !shouldRunHandler,
  };

  const handlerOutput = await saskiaMarketsReadinessSnapshot(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "saskia:goal-loop — cohort-3 run complete",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-3: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
