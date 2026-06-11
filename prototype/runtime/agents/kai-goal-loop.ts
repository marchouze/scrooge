// runtime/agents/kai-goal-loop.ts
//
// Kai (Trading Systems Engineer) goal-loop — cohort-3.
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Kai is wired into the
// goal-loop substrate. This run-handler is the integration point that:
//   1. Materialises a WorldStateSnapshot for agent:kai.
//   2. Runs Kai's rule-engine goal deriver (no LLM calls — cohort-3
//      rule-engine constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//
//   Rule 1: No `TradeBooked` or `OrderFilled` event in past 24h (market hours)
//     → goal: "Order-book health call (degrade / failover)" (priority HIGH)
//     Rationale: absence of any trade/fill activity during market hours signals
//     a potential OMS/EMS outage or connectivity failure. Kai must confirm
//     stack health and initiate failover if warranted.
//
//   Rule 2: Open `MarketDataDelayed` or `MarketDataFailover` event with no
//     resolution (no `MarketDataSourceChanged` pairing) in past 1h
//     → goal: "Market-data-source change" (priority CRITICAL)
//     Rationale: unresolved market-data outage blocks pre-trade risk checks
//     and best-execution evidence; immediate disposition required.
//
//   Rule 3: No `BestExecutionAttested` event in past 7 days
//     → goal: "Best-execution evidence pipeline sign-off" (priority MEDIUM)
//     Rationale: FSCA best-execution obligations (FAIS General Code s.16A)
//     require periodic attestation. Weekly cadence in build phase validates
//     the pipeline end-to-end before commencement-of-trading.
//
//   Rule 4: No `PreTradeGatewayBlock` validation event in past 24h
//     → goal: "Pre-trade-gateway limit change within Rohan's framework"
//     (priority MEDIUM)
//     Rationale: if the pre-trade gateway has not been exercised (no block
//     events emitted) in 24h, the validation circuit may be degraded. Kai
//     must confirm gateway health by triggering a validation run.
//
//   Otherwise → defer (null outcome).
//
// The goal candidates use Kai's §9 decisions-in-scope row labels exactly
// as they appear in Team/Kai.md (the spec's closed-set per T-NEW).
//
// Procedure citations: Kai's §13 procedures are planned; we use the
// coverage-gap form per _step-id-convention.md §5.
//
// Shadow mode: shadowMode: true for cohort-3 until cohort validation passes
// (per spec §4 "Build runs in shadow mode for the first two substrate ticks").
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect) — wiring.
//         Kai (Trading Systems Engineer) — goal-deriver rules.

import { resolve } from "node:path";
import type { GoalDeriver, GoalLoopOutcome } from "../../platform/agent-runtime/goal-loop";
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import type { RunWithGoalArgs } from "../../platform/agent-runtime/goal-loop";
import { parseSpecFile } from "../../platform/agent-runtime/spec-parser";
import { LocalAgentWorldStateReader } from "../../platform/agent-runtime/world-state";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";
import {
  type GoalLoopBriefDispatchConfig,
  dispatchBriefBoundRun,
  dispatchCadenceRun,
  openBriefsListForAgent,
} from "./goal-loop-brief-dispatch";
// Import the underlying kai:m1-cdm-typescript-bindings handler directly
// to avoid the circular dependency that would arise from importing run.ts.
// Goal-loop dispatches to the most operationally-relevant existing Kai handler
// as the downstream action target (no dedicated trading-stack-health handler
// yet — build-phase gap; cdm-bindings handler performs stack self-test).
import kaiM1CdmTypescriptBindings from "./kai-m1-cdm-typescript-bindings";

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Kai
// ---------------------------------------------------------------------------

const KAI_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Kai.md",
);

// Procedure path for Kai's trading-stack procedures (§13).
const KAI_PROCEDURE_PATH = "Procedures/by-policy/trading-stack-health.md";
// Coverage-gap step-ID form per _step-id-convention.md §5.
const KAI_PROCEDURE_STEP_ID = "trading-stack-health:step-1";

// §9 row labels from Team/Kai.md (closed-set per T-NEW).
// Candidate 1: trading stack health / order-book health call goal.
const TRADING_STACK_HEALTH_GOAL = "Order-book health call (degrade / failover)" as const;
// Candidate 2: market-data failover disposition goal.
const MARKET_DATA_FAILOVER_GOAL = "Market-data-source change" as const;
// Candidate 3: best-execution attestation goal.
const BEST_EXECUTION_GOAL = "Best-execution evidence pipeline sign-off" as const;
// Candidate 4: pre-trade gateway validation goal.
const PRE_TRADE_GATEWAY_GOAL = "Pre-trade-gateway limit change within Rohan's framework" as const;

// ---------------------------------------------------------------------------
// Event-query helpers
// ---------------------------------------------------------------------------

/**
 * Returns the timestamp of the most recent TradeBooked or OrderFilled event,
 * or undefined if neither has ever been emitted.
 */
function lastTradingActivityMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "TradeBooked" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  for (const e of eventStore.replay({ type: "OrderFilled" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns true if there is an open MarketDataDelayed or MarketDataFailover
 * event that has not been resolved by a MarketDataSourceChanged event within
 * the past 1 hour.
 *
 * In the current build phase: we detect open market-data issues by checking
 * whether any MarketDataDelayed or MarketDataFailover event exists that is
 * more recent than the most recent MarketDataSourceChanged event (i.e. the
 * failover has not been resolved). If no MarketDataSourceChanged has ever
 * been emitted, any MarketDataDelayed/Failover event is treated as open.
 */
function hasOpenMarketDataIssue(): boolean {
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const cutoff = Date.now() - ONE_HOUR_MS;

  // Find the most recent MarketDataSourceChanged (resolution event).
  let lastResolutionMs: number | undefined;
  for (const e of eventStore.replay({ type: "MarketDataSourceChanged" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (lastResolutionMs === undefined || t > lastResolutionMs)) {
      lastResolutionMs = t;
    }
  }

  // Check if any MarketDataDelayed or MarketDataFailover occurred within the
  // past 1h AND is more recent than the last resolution.
  for (const e of eventStore.replay({ type: "MarketDataDelayed" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && t > cutoff) {
      // Issue is within the 1h window; open if not yet resolved.
      if (lastResolutionMs === undefined || t > lastResolutionMs) return true;
    }
  }
  for (const e of eventStore.replay({ type: "MarketDataFailover" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && t > cutoff) {
      if (lastResolutionMs === undefined || t > lastResolutionMs) return true;
    }
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
 * Returns the timestamp of the most recent PreTradeGatewayBlock event,
 * or undefined if none exists.
 *
 * Build-phase note: PreTradeGatewayBlock events are emitted by the
 * pre-trade gateway aggregator when an order is rejected. A 24h absence
 * of block events indicates the gateway validation circuit may be
 * degraded (no orders flowing through, or the circuit is bypassed).
 */
function lastPreTradeGatewayBlockMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "PreTradeGatewayBlock" })) {
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

export const kaiGoalDeriver: GoalDeriver = async (
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
    "kai-goal-deriver: evaluating candidates",
  );

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const specHash = spec.specHash;

  // Build procedure citations — use coverage-gap form per §3.4 contract.
  const procedureEntry = spec.procedureSteps.find((s) => s.procedurePath === KAI_PROCEDURE_PATH);
  const stepId =
    procedureEntry && procedureEntry.stepIds.length > 0
      ? (procedureEntry.stepIds[0] ?? KAI_PROCEDURE_STEP_ID)
      : KAI_PROCEDURE_STEP_ID;

  // Helper: validate goal is in spec closed-set before returning.
  const validateGoal = (goal: string): boolean => {
    if (!spec.decisionsInScope.includes(goal)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal,
          closedSet: spec.decisionsInScope,
        },
        "kai-goal-deriver: goal not in closed-set; deferring",
      );
      return false;
    }
    return true;
  };

  // Rule 2 (CRITICAL priority): open market-data issue with no resolution
  // within 1h. Checked before Rule 1 because a market-data outage blocks
  // all trading activity and is the more urgent disposition.
  const openMarketDataIssue = hasOpenMarketDataIssue();

  if (openMarketDataIssue) {
    if (!validateGoal(MARKET_DATA_FAILOVER_GOAL)) return null;

    return {
      kind: "decision",
      chosen: MARKET_DATA_FAILOVER_GOAL,
      rationale:
        "Open MarketDataDelayed or MarketDataFailover event detected within the past 1h with no corresponding MarketDataSourceChanged resolution. Kai's §9 mandate (Market-data-source change) requires immediate failover disposition — unresolved market-data gaps block pre-trade risk checks and best-execution evidence. Selecting market-data-failover goal with CRITICAL priority.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: MARKET_DATA_FAILOVER_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: KAI_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "MarketDataSourceChanged",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "kai-goal-loop",
          },
        },
      ],
    };
  }

  // Rule 1 (HIGH priority): no TradeBooked or OrderFilled in past 24h
  // (market hours). Signals potential OMS/EMS outage or connectivity failure.
  const lastActivity = lastTradingActivityMs();
  const needsTradingStackHealthCheck =
    lastActivity === undefined || Date.now() - lastActivity > TWENTY_FOUR_HOURS_MS;

  if (needsTradingStackHealthCheck) {
    if (!validateGoal(TRADING_STACK_HEALTH_GOAL)) return null;

    return {
      kind: "decision",
      chosen: TRADING_STACK_HEALTH_GOAL,
      rationale: `No TradeBooked or OrderFilled event in the last 24h (last seen: ${lastActivity ? new Date(lastActivity).toISOString() : "never"}). Absence of trading activity during market hours signals a potential OMS/EMS outage or exchange connectivity failure. Kai's §9 mandate (Order-book health call) requires stack health confirmation and failover initiation if warranted. Selecting trading-stack-health-check goal.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: TRADING_STACK_HEALTH_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: KAI_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "OrderBookDegraded",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "kai-goal-loop",
          },
        },
      ],
    };
  }

  // Rule 3 (MEDIUM priority): no BestExecutionAttested in past 7 days.
  // FSCA best-execution obligations (FAIS General Code s.16A) require
  // periodic attestation. Weekly cadence in build phase validates the
  // pipeline before commencement-of-trading.
  const lastBestExecution = lastBestExecutionAttestedMs();
  const needsBestExecutionAttestation =
    lastBestExecution === undefined || Date.now() - lastBestExecution > SEVEN_DAYS_MS;

  if (needsBestExecutionAttestation) {
    if (!validateGoal(BEST_EXECUTION_GOAL)) return null;

    return {
      kind: "decision",
      chosen: BEST_EXECUTION_GOAL,
      rationale: `No BestExecutionAttested event in the last 7 days (last seen: ${lastBestExecution ? new Date(lastBestExecution).toISOString() : "never"}). FSCA best-execution obligations (FAIS General Code s.16A) require periodic attestation with venue-comparison evidence. Selecting best-execution attestation goal to trigger the evidence pipeline sign-off.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: BEST_EXECUTION_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: KAI_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "BestExecutionAttested",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "kai-goal-loop",
          },
        },
      ],
    };
  }

  // Rule 4 (MEDIUM priority): no PreTradeGatewayBlock in past 24h.
  // Absence of block events signals the gateway validation circuit may
  // be degraded (no orders flowing through, or circuit bypassed).
  // Kai must confirm gateway health by triggering a validation run.
  const lastGatewayBlock = lastPreTradeGatewayBlockMs();
  const needsGatewayValidation =
    lastGatewayBlock === undefined || Date.now() - lastGatewayBlock > TWENTY_FOUR_HOURS_MS;

  if (needsGatewayValidation) {
    if (!validateGoal(PRE_TRADE_GATEWAY_GOAL)) return null;

    return {
      kind: "decision",
      chosen: PRE_TRADE_GATEWAY_GOAL,
      rationale: `No PreTradeGatewayBlock validation event in the last 24h (last seen: ${lastGatewayBlock ? new Date(lastGatewayBlock).toISOString() : "never"}). Absence of block events indicates the pre-trade gateway validation circuit may be degraded. Kai's §9 mandate requires confirming gateway health within Rohan's approved limit framework. Selecting pre-trade-gateway-validation goal.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: PRE_TRADE_GATEWAY_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: KAI_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "PreTradeGatewayBlock",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "kai-goal-loop",
          },
        },
      ],
    };
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastActivityAgo: lastActivity
        ? `${Math.round((Date.now() - lastActivity) / 60_000)}min`
        : "never",
      openMarketDataIssue,
      lastBestExecutionAgo: lastBestExecution
        ? `${Math.round((Date.now() - lastBestExecution) / 60_000)}min`
        : "never",
      lastGatewayBlockAgo: lastGatewayBlock
        ? `${Math.round((Date.now() - lastGatewayBlock) / 60_000)}min`
        : "never",
    },
    "kai-goal-deriver: no action justified — deferring",
  );
  return null;
};

// ---------------------------------------------------------------------------
// Brief-bound run-lifecycle dispatch config (shared helper — see
// goal-loop-brief-dispatch.ts). Authority:
// D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION (PR #1182); extended to all
// goal-loops per D-QUEUE-CLOSEOUT-2026-06-10.
// ---------------------------------------------------------------------------
const KAI_BRIEF_DISPATCH: GoalLoopBriefDispatchConfig = {
  agentSlug: "kai",
  selfExecutablePattern: /cdm[\s-]?(typescript[\s-]?)?bindings/i,
  deliveredClassLabel: "CDM TypeScript-bindings attestation",
  runHandler: kaiM1CdmTypescriptBindings,
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
// Handler (wired as `kai:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// kai:m1-cdm-typescript-bindings handler directly via its imported callable
// as the downstream action target (build-phase proxy; a dedicated
// trading-stack-health handler is a roadmap item per D-AGENT-AUTONOMY-OPERATIONAL).
//
// Shadow mode: shadowMode: true for cohort-3 first ticks.
// In dry-run mode the goal-loop events are still emitted (so the shadow-mode
// trace is testable per spec §4 "Build runs in shadow mode for the first two
// substrate ticks"), but the downstream handler is called with dryRun=true.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "kai:goal-loop — starting goal-loop cohort-3 run",
  );

  const agentUrn = "agent:kai";

  // Parse Kai's spec.
  const parseResult = parseSpecFile(KAI_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: KAI_SPEC_PATH },
      "kai:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await kaiM1CdmTypescriptBindings(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, kaiGoalDeriver);

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
    "kai:goal-loop — goal-loop iteration complete",
  );

  // If escalation or deferred — run handler in dry-run mode (shadow trace).
  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  // Brief-bound dispatch path (D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION,
  // extended per D-QUEUE-CLOSEOUT-2026-06-10): when the loop selected a
  // decision and an open brief is addressed to this agent, bind a run to the
  // oldest brief and emit AgentRunStarted{agent-runtime} → AgentRunCompleted
  // so the iteration is visible in the autonomy run-feed and the brief stops
  // being re-selected every tick. Skipped under --dry-run.
  const openBriefs = shouldRunHandler && !ctx.dryRun ? openBriefsListForAgent("kai") : [];
  const [brief] = openBriefs;
  if (brief) {
    const dispatch = await dispatchBriefBoundRun(
      ctx,
      brief,
      iterationId,
      openBriefs.length - 1,
      KAI_BRIEF_DISPATCH,
    );
    logger.info(
      { agent: ctx.agent, iterationId, briefId: brief.briefId, openBriefs: openBriefs.length },
      "kai:goal-loop — run complete (brief-bound dispatch)",
    );
    return {
      eventsEmitted: dispatch.eventsEmitted + goalEventsEmitted,
      ok: true,
      summary: `goal-loop: iteration=${iterationId} outcome=decision dispatch=${dispatch.summary}`,
    };
  }

  if (shouldRunHandler && !ctx.dryRun) {
    const cadence = await dispatchCadenceRun(ctx, iterationId, KAI_BRIEF_DISPATCH);
    logger.info(
      { agent: ctx.agent, iterationId },
      "kai:goal-loop — cohort-3 run complete (cadence, instrumented)",
    );
    return {
      eventsEmitted: cadence.eventsEmitted + goalEventsEmitted,
      ok: cadence.handlerOutput.ok,
      summary: `goal-loop cohort-3: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${cadence.handlerOutput.summary}`,
      ...(cadence.handlerOutput.deliverable
        ? { deliverable: cadence.handlerOutput.deliverable }
        : {}),
    };
  }

  const handlerCtx: AgentRunContext = {
    ...ctx,
    dryRun: true,
  };

  const handlerOutput = await kaiM1CdmTypescriptBindings(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "kai:goal-loop — cohort-3 run complete (deferred)",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-3: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
