// runtime/agents/devon-goal-loop.ts
//
// Devon (Chief Operating Officer) goal-loop — cohort-3.
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Devon is wired into the
// goal-loop substrate. This run-handler is the integration point that:
//   1. Materialises a WorldStateSnapshot for agent:devon.
//   2. Runs Devon's rule-engine goal deriver (no LLM calls — cohort-3
//      rule-engine constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   - If no OperationalResilienceSnapshot from Devon in the last 24 hours
//     → select "Approve operational-resilience scenario design" goal
//       (closest §9 equivalent for triggering a resilience snapshot run).
//   - Else if open RiskRaised events with no resolving event within 48h
//     → select "Triage and disposition of medium-severity operational incidents"
//       goal (incident-response dispatch per Devon's §9 mandate).
//   - Else if no WorkstreamRegistered from Devon in the last 7 days
//     → select "Engineering hire-prioritisation within bench" goal
//       (engineering-bench-review per §9; WorkstreamRegistered is Devon's
//       output event for bench roadmap and hire decisions).
//   - Else if no SubstrateStateSnapshot (Atlas) in the last 48h
//     → select "Approve a change at CAB" goal as proxy for substrate-health
//       escalation to Atlas (CAB sign-off is Devon's §9 gate for substrate
//       changes; absence of Atlas snapshot is an ops-resilience signal).
//   - Otherwise → defer (null outcome).
//
// The goal candidates use Devon's §9 decisions-in-scope row labels exactly
// as they appear in Team/Devon.md (the spec's closed-set per T-NEW).
//
// Procedure citations: Devon owns operational-resilience and CAB procedures
// (§13). Since step anchors may not yet be backfilled (pre-backfill coverage-
// gap per _step-id-convention.md §5), we use the coverage-gap form:
// `stepId: "operational-resilience:step-1"` as a placeholder. The recon
// pipeline warns (not fails) for missing step IDs per the build-phase
// tolerance.
//
// Shadow mode: shadowMode: true for cohort-3 until cohort validation passes
// (per spec §4 "Build runs in shadow mode for the first two substrate ticks").
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect) — wiring.
//         Devon (Chief Operating Officer) — goal-deriver rules.

import { resolve } from "node:path";
import type { GoalDeriver, GoalLoopOutcome } from "../../platform/agent-runtime/goal-loop";
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import type { RunWithGoalArgs } from "../../platform/agent-runtime/goal-loop";
import { parseSpecFile } from "../../platform/agent-runtime/spec-parser";
import { LocalAgentWorldStateReader } from "../../platform/agent-runtime/world-state";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import the underlying operational-resilience-snapshot handler directly to
// avoid the circular dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import devonOperationalResilienceSnapshot from "./devon-operational-resilience-snapshot";
import {
  type GoalLoopBriefDispatchConfig,
  dispatchBriefBoundRun,
  dispatchCadenceRun,
  openBriefsListForAgent,
} from "./goal-loop-brief-dispatch";

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Devon
// ---------------------------------------------------------------------------

const DEVON_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Devon.md",
);

// Procedure path for Devon's operational-resilience procedure (§13).
const DEVON_PROCEDURE_PATH = "Procedures/by-policy/operational-resilience.md";
// Coverage-gap step-ID form per _step-id-convention.md §5.
const DEVON_PROCEDURE_STEP_ID = "operational-resilience:step-1";

// §9 row labels from Team/Devon.md (closed-set per T-NEW).
// Candidate 1: operational-resilience snapshot goal (Rule 1).
const RESILIENCE_SNAPSHOT_GOAL = "Approve operational-resilience scenario design" as const;
// Candidate 2: incident-response goal (Rule 2).
const INCIDENT_RESPONSE_GOAL =
  "Triage and disposition of medium-severity operational incidents" as const;
// Candidate 3: engineering-bench-review goal (Rule 3).
const BENCH_REVIEW_GOAL = "Engineering hire-prioritisation within bench" as const;
// Candidate 4: substrate-health escalation proxy goal (Rule 4).
const SUBSTRATE_HEALTH_GOAL = "Approve a change at CAB" as const;

// ---------------------------------------------------------------------------
// Event-query helpers
// ---------------------------------------------------------------------------

/**
 * Returns the timestamp of the most recent OperationalResilienceSnapshot
 * event emitted by Devon, or undefined if none exists.
 */
function lastOperationalResilienceSnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "OperationalResilienceSnapshot" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns true if there are RiskRaised events in the last 48h that have not
 * been paired with a matching RiskResolved (or equivalent closure) event.
 *
 * In the current build phase the closure event schema is not yet defined.
 * We detect open findings by checking whether any RiskRaised event exists
 * within the 48h window; until a RiskResolved family is emitted the finding
 * stays open.
 */
function hasOpenRiskRaisedWithin48h(): boolean {
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
  const cutoff = Date.now() - FORTY_EIGHT_HOURS_MS;
  for (const e of eventStore.replay({ type: "RiskRaised" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && t >= cutoff) {
      // Any RiskRaised within the window that has no closure is open.
      // Build-phase: no RiskResolved event type registered yet (§16 gap).
      return true;
    }
  }
  return false;
}

/**
 * Returns the timestamp of the most recent WorkstreamRegistered event from
 * Devon, or undefined if none exists.
 *
 * Devon emits WorkstreamRegistered for bench roadmap items and hire decisions
 * (§11 "Events emitted"). Absence beyond 7 days signals the bench review
 * cadence has slipped.
 */
function lastWorkstreamRegisteredMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "WorkstreamRegistered" })) {
    // Filter to Devon-originated events where possible via actor id.
    const actor = (e as { actor?: { id?: string } }).actor;
    if (actor?.id && !/devon/i.test(actor.id)) continue;
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns the timestamp of the most recent SubstrateStateSnapshot event
 * (emitted by Atlas), or undefined if none exists.
 *
 * Devon's operational-resilience roll-up depends on Atlas's substrate-state
 * snapshot (§11 "upstream substrate snapshots"). Absence beyond 48h is
 * an ops-resilience signal that Devon must escalate.
 */
function lastSubstrateStateSnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "SubstrateStateSnapshot" })) {
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

export const devonGoalDeriver: GoalDeriver = async (
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
    "devon-goal-deriver: evaluating candidates",
  );

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const specHash = spec.specHash;

  // Build procedure citations — use coverage-gap form per §3.4 contract.
  const procedureEntry = spec.procedureSteps.find((s) => s.procedurePath === DEVON_PROCEDURE_PATH);
  const stepId =
    procedureEntry && procedureEntry.stepIds.length > 0
      ? (procedureEntry.stepIds[0] ?? DEVON_PROCEDURE_STEP_ID)
      : DEVON_PROCEDURE_STEP_ID;

  // Helper: validate goal is in spec closed-set before returning.
  const validateGoal = (goal: string): boolean => {
    if (!spec.decisionsInScope.includes(goal)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal,
          closedSet: spec.decisionsInScope,
        },
        "devon-goal-deriver: goal not in closed-set; deferring",
      );
      return false;
    }
    return true;
  };

  // ---------------------------------------------------------------------------
  // Rule 1: No OperationalResilienceSnapshot in the last 24h
  // → goal: operational-resilience-snapshot (priority HIGH)
  //
  // Devon's §6 inactivity SLA: "Daily platform-state rollup must produce an
  // event; quiet > 24h is a substrate alert." The RESILIENCE_SNAPSHOT_GOAL
  // is the §9 trigger for the devon:operational-resilience-snapshot handler.
  // ---------------------------------------------------------------------------

  const lastResilienceSnapshot = lastOperationalResilienceSnapshotMs();
  const needsResilienceSnapshot =
    lastResilienceSnapshot === undefined ||
    Date.now() - lastResilienceSnapshot > TWENTY_FOUR_HOURS_MS;

  if (needsResilienceSnapshot) {
    if (!validateGoal(RESILIENCE_SNAPSHOT_GOAL)) return null;

    return {
      kind: "decision",
      chosen: RESILIENCE_SNAPSHOT_GOAL,
      rationale: `No OperationalResilienceSnapshot event in the last 24h (last seen: ${lastResilienceSnapshot ? new Date(lastResilienceSnapshot).toISOString() : "never"}). Devon's §6 inactivity SLA (daily platform-state rollup; quiet > 24h is a substrate alert) requires an immediate operational-resilience snapshot run. Selecting resilience-snapshot goal to trigger the devon:operational-resilience-snapshot handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: RESILIENCE_SNAPSHOT_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: DEVON_PROCEDURE_PATH,
          stepId,
          // SHA-256 of the procedure file is unknown at runtime without
          // reading it; use the spec hash as a proxy (coverage-gap).
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "OperationalResilienceSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "devon-goal-loop",
          },
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 2: Open RiskRaised event within 48h with no resolving event
  // → goal: incident-response dispatch (priority HIGH)
  //
  // Devon's §9 mandate covers "Triage and disposition of medium-severity
  // operational incidents". Open RiskRaised events unresolved within 48h
  // indicate an ops risk Devon must triage. Build-phase: no RiskResolved
  // event schema yet (§16 gap); any RiskRaised within window is treated
  // as open.
  // ---------------------------------------------------------------------------

  const openRisk = hasOpenRiskRaisedWithin48h();

  if (openRisk) {
    if (!validateGoal(INCIDENT_RESPONSE_GOAL)) return null;

    return {
      kind: "decision",
      chosen: INCIDENT_RESPONSE_GOAL,
      rationale:
        "Open RiskRaised event(s) detected within the last 48h that have not been resolved. Devon's §9 mandate (Triage and disposition of medium-severity operational incidents) requires incident-response dispatch. Build-phase note: RiskResolved event schema not yet registered (§16 substrate gap); any unresolved RiskRaised within 48h is treated as an open incident. Selecting incident-response goal to trigger the devon:operational-resilience-snapshot handler for incident triage.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: INCIDENT_RESPONSE_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: DEVON_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "OperationalResilienceSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "devon-goal-loop:incident-response",
          },
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 3: No WorkstreamRegistered from Devon in the last 7 days
  // → goal: engineering-bench-review (priority MEDIUM)
  //
  // Devon's §9 mandate covers "Engineering hire-prioritisation within bench"
  // and emits WorkstreamRegistered events (§11). Absence beyond 7 days
  // signals the engineering-bench review cadence has slipped. Build-phase:
  // bench review is the primary readiness gate before hire decisions.
  // ---------------------------------------------------------------------------

  const lastWorkstream = lastWorkstreamRegisteredMs();
  const needsBenchReview =
    lastWorkstream === undefined || Date.now() - lastWorkstream > SEVEN_DAYS_MS;

  if (needsBenchReview) {
    if (!validateGoal(BENCH_REVIEW_GOAL)) return null;

    return {
      kind: "decision",
      chosen: BENCH_REVIEW_GOAL,
      rationale: `No WorkstreamRegistered event from Devon in the last 7 days (last seen: ${lastWorkstream ? new Date(lastWorkstream).toISOString() : "never"}). Devon's §9 mandate (Engineering hire-prioritisation within bench) and §6 cadence require a periodic engineering-bench review that produces WorkstreamRegistered outputs. Selecting bench-review goal to trigger the devon:operational-resilience-snapshot handler, which inventories bench state and surfaces roadmap gaps.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: BENCH_REVIEW_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: DEVON_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "WorkstreamRegistered",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "devon-goal-loop:bench-review",
          },
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 4: No SubstrateStateSnapshot (Atlas) in the last 48h
  // → goal: substrate-health-check escalation to Atlas (priority MEDIUM)
  //
  // Devon's operational-resilience roll-up depends on Atlas's
  // SubstrateStateSnapshot (§11 "upstream substrate snapshots observed").
  // Absence beyond 48h is an ops-resilience signal Devon must act on:
  // the §9 CAB-approval gate proxies Devon's authority to initiate a
  // substrate-health check via the operational-resilience-snapshot handler.
  // ---------------------------------------------------------------------------

  const lastSubstrateSnapshot = lastSubstrateStateSnapshotMs();
  const needsSubstrateHealthCheck =
    lastSubstrateSnapshot === undefined ||
    Date.now() - lastSubstrateSnapshot > FORTY_EIGHT_HOURS_MS;

  if (needsSubstrateHealthCheck) {
    if (!validateGoal(SUBSTRATE_HEALTH_GOAL)) return null;

    return {
      kind: "decision",
      chosen: SUBSTRATE_HEALTH_GOAL,
      rationale: `No SubstrateStateSnapshot (Atlas) in the last 48h (last seen: ${lastSubstrateSnapshot ? new Date(lastSubstrateSnapshot).toISOString() : "never"}). Devon's operational-resilience roll-up (§11) depends on Atlas's weekly substrate-state snapshot; absence beyond 48h is a resilience signal. Devon escalates via the §9 CAB-approval gate as the proxy for initiating a substrate-health check and alerting Atlas (Core banking platform architect). Selecting substrate-health-check goal to trigger the devon:operational-resilience-snapshot handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: SUBSTRATE_HEALTH_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: DEVON_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "OperationalResilienceSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "devon-goal-loop:substrate-health-check",
          },
        },
      ],
    };
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastResilienceSnapshotAgo: lastResilienceSnapshot
        ? `${Math.round((Date.now() - lastResilienceSnapshot) / 60_000)}min`
        : "never",
      openRisk,
      lastWorkstreamAgo: lastWorkstream
        ? `${Math.round((Date.now() - lastWorkstream) / 60_000)}min`
        : "never",
      lastSubstrateSnapshotAgo: lastSubstrateSnapshot
        ? `${Math.round((Date.now() - lastSubstrateSnapshot) / 60_000)}min`
        : "never",
    },
    "devon-goal-deriver: no action justified — deferring",
  );
  return null;
};

// ---------------------------------------------------------------------------
// Brief-bound run-lifecycle dispatch config (shared helper — see
// goal-loop-brief-dispatch.ts). Authority:
// D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION (PR #1182); extended to all
// goal-loops per D-QUEUE-CLOSEOUT-2026-06-10.
// ---------------------------------------------------------------------------
const DEVON_BRIEF_DISPATCH: GoalLoopBriefDispatchConfig = {
  agentSlug: "devon",
  selfExecutablePattern: /operational[\s-]?resilience/i,
  deliveredClassLabel: "operational-resilience snapshot attestation",
  runHandler: devonOperationalResilienceSnapshot,
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
// Handler (wired as `devon:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// devon:operational-resilience-snapshot handler directly via its imported
// callable.
//
// Shadow mode: shadowMode: true for cohort-3 first ticks.
// In dry-run mode the goal-loop events are still emitted (so the shadow-mode
// trace is testable per spec §4 "Build runs in shadow mode for the first two
// substrate ticks"), but the devon:operational-resilience-snapshot handler
// is called with dryRun=true.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "devon:goal-loop — starting goal-loop cohort-3 run",
  );

  const agentUrn = "agent:devon";

  // Parse Devon's spec.
  const parseResult = parseSpecFile(DEVON_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: DEVON_SPEC_PATH },
      "devon:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await devonOperationalResilienceSnapshot(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, devonGoalDeriver);

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
    "devon:goal-loop — goal-loop iteration complete",
  );

  // If escalation or deferred — run handler in dry-run mode (shadow trace).
  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  // Brief-bound dispatch path (D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION,
  // extended per D-QUEUE-CLOSEOUT-2026-06-10): when the loop selected a
  // decision and an open brief is addressed to this agent, bind a run to the
  // oldest brief and emit AgentRunStarted{agent-runtime} → AgentRunCompleted
  // so the iteration is visible in the autonomy run-feed and the brief stops
  // being re-selected every tick. Skipped under --dry-run.
  const openBriefs = shouldRunHandler && !ctx.dryRun ? openBriefsListForAgent("devon") : [];
  const [brief] = openBriefs;
  if (brief) {
    const dispatch = await dispatchBriefBoundRun(
      ctx,
      brief,
      iterationId,
      openBriefs.length - 1,
      DEVON_BRIEF_DISPATCH,
    );
    logger.info(
      { agent: ctx.agent, iterationId, briefId: brief.briefId, openBriefs: openBriefs.length },
      "devon:goal-loop — run complete (brief-bound dispatch)",
    );
    return {
      eventsEmitted: dispatch.eventsEmitted + goalEventsEmitted,
      ok: true,
      summary: `goal-loop: iteration=${iterationId} outcome=decision dispatch=${dispatch.summary}`,
    };
  }

  if (shouldRunHandler && !ctx.dryRun) {
    const cadence = await dispatchCadenceRun(ctx, iterationId, DEVON_BRIEF_DISPATCH);
    logger.info(
      { agent: ctx.agent, iterationId },
      "devon:goal-loop — cohort-3 run complete (cadence, instrumented)",
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

  const handlerOutput = await devonOperationalResilienceSnapshot(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "devon:goal-loop — cohort-3 run complete (deferred)",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-3: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
