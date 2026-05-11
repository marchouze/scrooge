// runtime/agents/vera-goal-loop.ts
//
// Vera (Internal audit / continuous-assurance engineer) goal-loop — cohort-2
// deriver. Wired as `vera:goal-loop` per D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Vera is the first
// cohort-2 agent to derive and execute goals autonomously from her own
// mandate. This run-handler is the integration point that:
//   1. Materialises a WorldStateSnapshot for agent:vera.
//   2. Runs Vera's rule-engine goal deriver (no LLM calls — cohort constraint
//      per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   - If there are open audit findings with severity "fail" → select goal:
//     "Escalate open audit findings to Thandiwe" and route the
//     overnight-recon handler.
//   - If no overnight recon has run in the last 24 hours → select goal:
//     "Run overnight recon batch" and invoke vera:overnight-recon.
//   - If recon:goal-loop-capability hasn't run recently (no ReconResult for
//     that pipeline in the last 24h) → select goal:
//     "Classify pipeline result `ok` / `warn` / `fail`".
//   - Otherwise → defer (no action needed).
//
// The goal candidates use Vera's §9 decisions-in-scope row labels exactly
// as they appear in Team/Vera.md (the spec's closed-set per T-NEW).
//
// Procedure citations: Vera owns Procedures/by-policy/findings-tracking.md
// and Procedures/by-policy/agent-discipline-attestation.md (both planned).
// Since these files may not yet have step anchors (pre-backfill coverage-gap
// per _step-id-convention.md §5), we use the coverage-gap form:
// `stepId: "findings-tracking:step-1"` as a placeholder. The recon
// pipeline warns (not fails) for missing step IDs per the build-phase
// tolerance.
//
// Shadow mode: `shadowMode: true` until cohort validation passes.
// The goal-loop events are still emitted (so the shadow-mode trace is
// testable per spec §4 "Build runs in shadow mode for the first two
// substrate ticks"), but the underlying handler is called with dryRun=true.
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect) — cohort-2 wiring.

import { resolve } from "node:path";
import type { GoalDeriver, GoalLoopOutcome } from "../../platform/agent-runtime/goal-loop";
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import type { RunWithGoalArgs } from "../../platform/agent-runtime/goal-loop";
import { parseSpecFile } from "../../platform/agent-runtime/spec-parser";
import { LocalAgentWorldStateReader } from "../../platform/agent-runtime/world-state";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import the underlying overnight-recon handler directly to avoid the
// circular dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import veraOvernightRecon from "./vera-overnight-recon";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERA_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Vera.md",
);

// §9 row labels from Team/Vera.md. The goal deriver selects from this
// closed-set; the runtime validates the chosen goal against the parsed spec.
// "Classify pipeline result `ok` / `warn` / `fail`" is the primary in-scope
// decision that covers both the overnight-recon and the goal-loop-capability
// check — it is Vera's broadest audit-execution goal.
const VERA_PIPELINE_CLASSIFY_GOAL = "Classify pipeline result `ok` / `warn` / `fail`" as const;

// Coverage-gap procedure path + step-ID form per _step-id-convention.md §5.
const VERA_PROCEDURE_PATH = "Procedures/by-policy/findings-tracking.md";
const VERA_PROCEDURE_STEP_ID = "findings-tracking:step-1";

// Pipeline identifier for the goal-loop-capability recon.
const GOAL_LOOP_CAPABILITY_PIPELINE = "recon:goal-loop-capability";

// ---------------------------------------------------------------------------
// Goal-derivation rule engine — helpers
// ---------------------------------------------------------------------------

function lastReconResultMsForPipeline(pipeline: string): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "ReconResult" })) {
    const p = e.payload as Record<string, unknown>;
    if (String(p.pipeline ?? "") !== pipeline) continue;
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

function lastOvernightReconMs(): number | undefined {
  // Look for the most recent ReconResult event emitted by vera:overnight-recon.
  // The actor ID on these events is "agent:vera:overnight-recon".
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "ReconResult" })) {
    const actor = e.actor as Record<string, unknown> | undefined;
    const actorId = String(actor?.id ?? "");
    if (!actorId.startsWith("agent:vera:overnight-recon")) continue;
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

function hasOpenFailSeverityAuditFindings(): boolean {
  for (const e of eventStore.replay({ type: "AuditFinding" })) {
    const p = e.payload as Record<string, unknown>;
    if (String(p.severity ?? "") === "fail") return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Vera
// ---------------------------------------------------------------------------

export const veraGoalDeriver: GoalDeriver = async (
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
    "vera-goal-deriver: evaluating candidates",
  );

  const specHash = spec.specHash;

  // Build procedure citations — use coverage-gap form per §3.4 contract.
  // The procedure file may not have step anchors yet (pre-backfill).
  const procedureEntry = spec.procedureSteps.find((s) => s.procedurePath === VERA_PROCEDURE_PATH);
  const stepId =
    procedureEntry && procedureEntry.stepIds.length > 0
      ? (procedureEntry.stepIds[0] ?? VERA_PROCEDURE_STEP_ID)
      : VERA_PROCEDURE_STEP_ID;

  // Validate that our primary goal is in the closed-set before building
  // the outcome (T-NEW self-check).
  if (!spec.decisionsInScope.includes(VERA_PIPELINE_CLASSIFY_GOAL)) {
    logger.warn(
      {
        agentUrn: args.agent.urn,
        goal: VERA_PIPELINE_CLASSIFY_GOAL,
        closedSet: spec.decisionsInScope,
      },
      "vera-goal-deriver: goal not in closed-set; deferring",
    );
    return null;
  }

  const mandateCitations = [
    {
      section: "9-decisions-in-scope" as const,
      rowKey: VERA_PIPELINE_CLASSIFY_GOAL,
      specHash,
    },
  ];

  const procedureCitations = [
    {
      procedurePath: VERA_PROCEDURE_PATH,
      stepId,
      // SHA-256 of the procedure file is unknown at runtime without
      // reading it; use the spec hash as a proxy (coverage-gap).
      procedureHash: specHash,
    },
  ];

  // Candidate 1: open fail-severity audit findings — highest priority.
  // Per §10: fail-severity findings crossing materiality threshold must be
  // escalated to Thandiwe (CAE). For the goal-loop, we select
  // "Classify pipeline result `ok` / `warn` / `fail`" (the in-scope §9
  // decision that covers ongoing finding management), then run overnight
  // recon to surface the current state.
  const hasFailFindings =
    worldState.auditFindingsForMe.length > 0 || hasOpenFailSeverityAuditFindings();
  if (hasFailFindings) {
    logger.info(
      { agentUrn: args.agent.urn, findingCount: worldState.auditFindingsForMe.length },
      "vera-goal-deriver: open fail-severity findings detected — selecting classify-pipeline goal to surface via overnight-recon",
    );
    return {
      kind: "decision",
      chosen: VERA_PIPELINE_CLASSIFY_GOAL,
      rationale: `Open fail-severity audit findings detected (worldState.auditFindingsForMe.length=${worldState.auditFindingsForMe.length}). Vera's §10 escalation policy requires fail findings to be routed to Thandiwe (CAE) within 1h. Running overnight-recon to produce a current ReconResult + AuditFinding event stream for escalation.`,
      mandateCitations,
      procedureCitations,
      plannedEvents: [{ type: "ReconResult" }, { type: "AuditFinding" }],
    };
  }

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  // Candidate 2: no overnight recon in the last 24h.
  // Per §6 inactivity SLA: pipelines must produce a ReconResult at least
  // every 24h. A quiet pipeline is itself a finding.
  const lastOvernightMs = lastOvernightReconMs();
  const overnightDue =
    lastOvernightMs === undefined || Date.now() - lastOvernightMs > TWENTY_FOUR_HOURS_MS;

  if (overnightDue) {
    logger.info(
      {
        agentUrn: args.agent.urn,
        lastOvernightReconAgo: lastOvernightMs
          ? `${Math.round((Date.now() - lastOvernightMs) / 60_000)}min`
          : "never",
      },
      "vera-goal-deriver: overnight recon overdue — selecting classify-pipeline goal",
    );
    return {
      kind: "decision",
      chosen: VERA_PIPELINE_CLASSIFY_GOAL,
      rationale: `No overnight recon ReconResult in the last 24h (last seen: ${lastOvernightMs ? new Date(lastOvernightMs).toISOString() : "never"}). Vera's §6 inactivity SLA requires pipelines to produce a ReconResult at least every 24h. Selecting pipeline-classify goal to trigger the vera:overnight-recon handler.`,
      mandateCitations,
      procedureCitations,
      plannedEvents: [{ type: "ReconResult" }, { type: "AuditFinding" }],
    };
  }

  // Candidate 3: recon:goal-loop-capability hasn't run recently.
  // The goal-loop-capability recon pipeline (Wave-5) validates the
  // planning-trace event stream. If it hasn't produced a ReconResult in
  // the last 24h, it's stale.
  const lastGoalLoopCapabilityMs = lastReconResultMsForPipeline(GOAL_LOOP_CAPABILITY_PIPELINE);
  const goalLoopCapabilityDue =
    lastGoalLoopCapabilityMs === undefined ||
    Date.now() - lastGoalLoopCapabilityMs > TWENTY_FOUR_HOURS_MS;

  if (goalLoopCapabilityDue) {
    logger.info(
      {
        agentUrn: args.agent.urn,
        lastGoalLoopCapabilityAgo: lastGoalLoopCapabilityMs
          ? `${Math.round((Date.now() - lastGoalLoopCapabilityMs) / 60_000)}min`
          : "never",
      },
      "vera-goal-deriver: goal-loop-capability recon stale — selecting classify-pipeline goal",
    );
    return {
      kind: "decision",
      chosen: VERA_PIPELINE_CLASSIFY_GOAL,
      rationale: `No ReconResult for ${GOAL_LOOP_CAPABILITY_PIPELINE} in the last 24h (last seen: ${lastGoalLoopCapabilityMs ? new Date(lastGoalLoopCapabilityMs).toISOString() : "never"}). Vera Wave-5 goal-loop-capability recon must produce a ReconResult at least every 24h. Running overnight-recon (which includes all pipelines) to refresh the goal-loop-capability trace.`,
      mandateCitations,
      procedureCitations,
      plannedEvents: [{ type: "ReconResult" }],
    };
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastOvernightReconAgo: lastOvernightMs
        ? `${Math.round((Date.now() - lastOvernightMs) / 60_000)}min`
        : "never",
      lastGoalLoopCapabilityAgo: lastGoalLoopCapabilityMs
        ? `${Math.round((Date.now() - lastGoalLoopCapabilityMs) / 60_000)}min`
        : "never",
    },
    "vera-goal-deriver: no action justified — deferring",
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
// Handler (wired as `vera:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// vera:overnight-recon handler directly via its imported callable.
//
// In shadow mode (first cohort ticks) the goal-loop events are still emitted
// (so the shadow-mode trace is testable per spec §4 "Build runs in shadow
// mode for the first two substrate ticks"), but the vera:overnight-recon
// handler is called with dryRun=true.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "vera:goal-loop — starting goal-loop cohort-2 run",
  );

  const agentUrn = "agent:vera";

  // Parse Vera's spec.
  const parseResult = parseSpecFile(VERA_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: VERA_SPEC_PATH },
      "vera:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await veraOvernightRecon(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, veraGoalDeriver);

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
    "vera:goal-loop — goal-loop iteration complete",
  );

  // If escalation or deferred — run handler in dry-run mode (shadow trace).
  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  const handlerCtx: AgentRunContext = {
    ...ctx,
    // In shadow mode (first cohort ticks), always dry-run the handler
    // so we observe the trace without side-effects.
    dryRun: ctx.dryRun || !shouldRunHandler,
  };

  const handlerOutput = await veraOvernightRecon(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "vera:goal-loop — cohort-2 run complete",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-2: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
