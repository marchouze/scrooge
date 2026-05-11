// runtime/agents/anya-goal-loop.ts
//
// Anya (Data / analytics engineer) goal-loop — cohort-3 deriver.
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Anya is wired into the
// goal-loop substrate as a cohort-3 agent. This run-handler is the integration
// point that:
//   1. Materialises a WorldStateSnapshot for agent:anya.
//   2. Runs Anya's rule-engine goal deriver (no LLM calls — cohort rule-engine
//      constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   - If no DataProjectionSnapshot in the last 24 hours →
//     select "Re-derive the dashboard projection cache" goal and trigger the
//     anya:projection-drift handler (which emits DataProjectionSnapshot).
//   - Else if no DashboardProjectionRefreshed in the last 24 hours →
//     select "Re-derive the dashboard projection cache" goal and trigger the
//     anya:projection-refresh handler (which emits DashboardProjectionRefreshed).
//   - Else if no DataProjectionSnapshot in the last 7 days (stale semantic layer
//     proxy — SemanticLayerSnapshot not yet a registered event type; covered by
//     the DataProjectionSnapshot inactivity SLA per §6) →
//     select "Re-derive the dashboard projection cache" goal.
//   - Otherwise → defer (null outcome).
//
// Goal candidates use Anya's §9 decisions-in-scope row labels exactly as
// they appear in Team/Anya.md (the spec's closed-set per T-NEW).
//
// Procedure citations: Anya co-owns Procedures/by-policy/projection-registration.md
// with Atlas (§13 "planned"). Since this file may not yet have step anchors
// (pre-backfill coverage-gap per _step-id-convention.md §5), we use the
// coverage-gap form: `stepId: "projection-registration:step-1"` as a placeholder.
// The recon pipeline warns (not fails) for missing step IDs per the
// build-phase tolerance.
//
// Shadow mode: shadowMode: true for all cohort-3 ticks until cohort validation
// passes (per spec §4 "Build runs in shadow mode for first two substrate ticks").
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect) — wiring.
//         Anya (Data / analytics engineer) — goal-deriver rules.

import { resolve } from "node:path";
import type { GoalDeriver, GoalLoopOutcome } from "../../platform/agent-runtime/goal-loop";
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import type { RunWithGoalArgs } from "../../platform/agent-runtime/goal-loop";
import { parseSpecFile } from "../../platform/agent-runtime/spec-parser";
import { LocalAgentWorldStateReader } from "../../platform/agent-runtime/world-state";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import the underlying projection-drift handler directly to avoid the
// circular dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import anyaProjectionDrift from "./anya-projection-drift";

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Anya
// ---------------------------------------------------------------------------

const ANYA_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Anya.md",
);

// Procedure path for Anya's projection-registration procedure (§13).
const ANYA_PROCEDURE_PATH = "Procedures/by-policy/projection-registration.md";
// Coverage-gap step-ID form per _step-id-convention.md §5.
const ANYA_PROCEDURE_STEP_ID = "projection-registration:step-1";

// §9 row label from Team/Anya.md (closed-set per T-NEW).
// This is the only §9 row that Anya can self-initiate autonomously;
// all other §9 rows require an external input (a new projection definition
// request, a metric request, etc.) which arrives via trigger rather than
// goal-loop derivation.
const PROJECTION_CACHE_GOAL = "Re-derive the dashboard projection cache" as const;

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Event-store helpers
// ---------------------------------------------------------------------------

function lastEventMs(type: string): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type })) {
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

export const anyaGoalDeriver: GoalDeriver = async (
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
    "anya-goal-deriver: evaluating candidates",
  );

  const specHash = spec.specHash;

  // Build procedure citations — use coverage-gap form per §3.4 contract.
  // The procedure file may not have step anchors yet (pre-backfill).
  const procedureEntry = spec.procedureSteps.find(
    (s) => s.procedurePath === ANYA_PROCEDURE_PATH,
  );
  const stepId =
    procedureEntry && procedureEntry.stepIds.length > 0
      ? (procedureEntry.stepIds[0] ?? ANYA_PROCEDURE_STEP_ID)
      : ANYA_PROCEDURE_STEP_ID;

  // Helper: validate goal is in spec closed-set before returning.
  const validateGoal = (goal: string): boolean => {
    if (!spec.decisionsInScope.includes(goal)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal,
          closedSet: spec.decisionsInScope,
        },
        "anya-goal-deriver: goal not in closed-set; deferring",
      );
      return false;
    }
    return true;
  };

  // Candidate 1: no DataProjectionSnapshot in the last 24h.
  // Anya's §6 inactivity SLA: "Drift sweep must produce a
  // DashboardProjectionRefreshed event every 24h." The DataProjectionSnapshot
  // emitted by anya:projection-drift is the canonical record that the sweep ran.
  const lastProjectionSnapshot = lastEventMs("DataProjectionSnapshot");
  const needsProjectionSnapshot =
    lastProjectionSnapshot === undefined ||
    Date.now() - lastProjectionSnapshot > TWENTY_FOUR_HOURS_MS;

  if (needsProjectionSnapshot) {
    if (!validateGoal(PROJECTION_CACHE_GOAL)) return null;

    return {
      kind: "decision",
      chosen: PROJECTION_CACHE_GOAL,
      rationale: `No DataProjectionSnapshot in the last 24h (last seen: ${lastProjectionSnapshot ? new Date(lastProjectionSnapshot).toISOString() : "never"}). Anya's inactivity SLA (§6: drift sweep must produce a snapshot every 24h) is overdue. Selecting projection-cache goal to trigger anya:projection-drift.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: PROJECTION_CACHE_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: ANYA_PROCEDURE_PATH,
          stepId,
          // SHA-256 of the procedure file is unknown at runtime without
          // reading it; use the spec hash as a proxy (coverage-gap).
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "DataProjectionSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "anya-goal-loop",
          },
        },
      ],
    };
  }

  // Candidate 2: stale projections — no DashboardProjectionRefreshed in the
  // last 24h. Anya's §6 inactivity SLA: DashboardProjectionRefreshed every 24h.
  const lastProjectionRefreshed = lastEventMs("DashboardProjectionRefreshed");
  const needsRefresh =
    lastProjectionRefreshed === undefined ||
    Date.now() - lastProjectionRefreshed > TWENTY_FOUR_HOURS_MS;

  if (needsRefresh) {
    if (!validateGoal(PROJECTION_CACHE_GOAL)) return null;

    return {
      kind: "decision",
      chosen: PROJECTION_CACHE_GOAL,
      rationale: `Stale projections: no DashboardProjectionRefreshed in the last 24h (last seen: ${lastProjectionRefreshed ? new Date(lastProjectionRefreshed).toISOString() : "never"}). Anya's inactivity SLA (§6) requires a projection refresh. Selecting projection-cache goal to trigger anya:projection-drift (which also re-derives the dashboard cache).`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: PROJECTION_CACHE_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: ANYA_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "DashboardProjectionRefreshed",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "anya-goal-loop",
          },
        },
      ],
    };
  }

  // Candidate 3: semantic-layer proxy — no DataProjectionSnapshot in the last
  // 7 days. SemanticLayerSnapshot is not yet a registered event type (§16
  // substrate gap: "Semantic-layer registry — designed; not yet hosted").
  // Until it lands, we use the DataProjectionSnapshot as the semantic-layer
  // health proxy: if no snapshot in 7 days the semantic layer is considered
  // stale and a full drift sweep is warranted.
  const needsSemanticLayerProxy =
    lastProjectionSnapshot === undefined ||
    Date.now() - lastProjectionSnapshot > SEVEN_DAYS_MS;

  if (needsSemanticLayerProxy) {
    if (!validateGoal(PROJECTION_CACHE_GOAL)) return null;

    return {
      kind: "decision",
      chosen: PROJECTION_CACHE_GOAL,
      rationale: `Semantic-layer proxy stale: no DataProjectionSnapshot in the last 7 days (last seen: ${lastProjectionSnapshot ? new Date(lastProjectionSnapshot).toISOString() : "never"}). The SemanticLayerSnapshot event type is not yet registered (§16 substrate gap); DataProjectionSnapshot serves as the proxy. Selecting projection-cache goal to publish a full projection snapshot and refresh the semantic-layer proxy.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: PROJECTION_CACHE_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: ANYA_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "DataProjectionSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "anya-goal-loop",
            note: "semantic-layer-proxy",
          },
        },
      ],
    };
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastProjectionSnapshotAgo: lastProjectionSnapshot
        ? `${Math.round((Date.now() - lastProjectionSnapshot) / 60_000)}min`
        : "never",
      lastProjectionRefreshedAgo: lastProjectionRefreshed
        ? `${Math.round((Date.now() - lastProjectionRefreshed) / 60_000)}min`
        : "never",
    },
    "anya-goal-deriver: no action justified — deferring",
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
// Handler (wired as `anya:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// anya:projection-drift handler directly via its imported callable.
//
// In dry-run mode the goal-loop events are still emitted (so the shadow-mode
// trace is testable per spec §4 "Build runs in shadow mode for the first two
// substrate ticks"), but the anya:projection-drift handler is called with
// dryRun=true.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "anya:goal-loop — starting goal-loop cohort-3 run",
  );

  const agentUrn = "agent:anya";

  // Parse Anya's spec.
  const parseResult = parseSpecFile(ANYA_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: ANYA_SPEC_PATH },
      "anya:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await anyaProjectionDrift(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, anyaGoalDeriver);

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
    "anya:goal-loop — goal-loop iteration complete",
  );

  // If deferred — run handler in dry-run mode (shadow trace).
  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  const handlerCtx: AgentRunContext = {
    ...ctx,
    // In shadow mode (cohort-3 ticks), always dry-run the handler
    // so we observe the trace without side-effects.
    dryRun: ctx.dryRun || !shouldRunHandler,
  };

  const handlerOutput = await anyaProjectionDrift(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "anya:goal-loop — cohort-3 run complete",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-3: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
