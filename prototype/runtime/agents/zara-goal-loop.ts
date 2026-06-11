// runtime/agents/zara-goal-loop.ts
//
// Zara (Chief Compliance Officer, governance) goal-loop — cohort-3 deriver.
//
// Phase: D-AGENT-AUTONOMY-OPERATIONAL Slice 3 — per-persona goal-loop substrate.
// This handler wires Zara into the goal-loop substrate.
// Pattern follows `atlas-goal-loop.ts` (cohort-1 reference implementation),
// `owen-goal-loop.ts` (cohort-2 reference), and `thandiwe-goal-loop.ts`
// (cohort-3 reference).
//
// Rule-engine goal derivation (no LLM calls — rule-engine-only constraint per
// spec §3.4 "MUST NOT — LLM cost-cap"):
//   1. No `MLROSupervisionSnapshot` event from Zara in the last 24h →
//      select "Approve / decline an STR (MLRO judgement)" goal (priority HIGH).
//      MLRO supervision is a continuous cadence duty per FIC ss 28/28A/29.
//   2. Open `AlertOpened` event (transaction monitoring) with no disposition in
//      24h → select "Sanctions-hit disposition (true-positive vs false-positive)"
//      goal (priority HIGH). Open alerts require disposition per §9 row and
//      Mira-to-Zara escalation chain.
//   3. Open `SanctionsHit` or `PEPFlag` event with no resolution in 1h →
//      select "Sanctions-hit disposition (true-positive vs false-positive)" goal
//      (priority CRITICAL). Unresolved sanctions hits / PEP flags are a
//      tipping-off-boundary risk requiring immediate Zara disposition.
//   4. No `ComplianceMonitoringSnapshot` event in the last 7 days →
//      select "Approve RMCP version cycles (within framework)" goal
//      (priority MEDIUM). Compliance monitoring cycle is a weekly cadence
//      per §6 RMCP-monitoring-plan.
//   5. Otherwise → defer (null).
//
// Goal labels must match Team/Zara.md §9 decisions-in-scope row labels exactly
// (T-NEW closed-set check).
//
// Shadow mode: shadowMode: true — Zara is cohort-3; first two substrate ticks
// run in shadow mode per spec §4. Goal-loop events (AgentGoalEvaluated,
// AgentGoalSelected, AgentGoalDeferred) are still emitted so the trace is
// testable; the underlying handler is always called with dryRun=true.
//
// Procedure citations: Zara owns:
//   - `Procedures/by-policy/sanctions-screening.md` — owner; built by Mira
//   - `Procedures/by-policy/kyc-onboarding.md` — co-owner with Mira
//   - `Procedures/by-policy/rmcp-monitoring.md` (planned)
// Coverage-gap step-ID form per _step-id-convention.md §5 used for planned
// procedures that do not yet have step anchors.
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Zara (Chief Compliance Officer, governance) · Atlas (Core banking platform architect)

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
// Import Zara's underlying handler directly to avoid circular dependency
// (handler-callables.ts → this file → handler-callables.ts).
import zaraMlroSupervision from "./zara-mlro-supervision";

// ---------------------------------------------------------------------------
// Spec path
// ---------------------------------------------------------------------------

const ZARA_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Zara.md",
);

// ---------------------------------------------------------------------------
// §9 row labels from Team/Zara.md used by the goal deriver.
// These must match the exact row labels in Zara's spec §9 decisions-in-scope
// for the closed-set validation (T-NEW) to pass.
// ---------------------------------------------------------------------------

const GOAL_MLRO_SUPERVISION = "Approve / decline an STR (MLRO judgement)" as const;
const GOAL_SANCTIONS_SCREENING =
  "Sanctions-hit disposition (true-positive vs false-positive)" as const;
const GOAL_RMCP_VERSION_CYCLE = "Approve RMCP version cycles (within framework)" as const;

// ---------------------------------------------------------------------------
// Procedure paths (§13 of Zara's spec)
// ---------------------------------------------------------------------------

const PROCEDURE_SANCTIONS_SCREENING = "Procedures/by-policy/sanctions-screening.md";
const PROCEDURE_KYC_ONBOARDING = "Procedures/by-policy/kyc-onboarding.md";
const PROCEDURE_RMCP_MONITORING = "Procedures/by-policy/rmcp-monitoring.md";

// Coverage-gap step-ID form per _step-id-convention.md §5 (planned procedures).
const STEP_MLRO = "sanctions-screening:step-1";
const STEP_ALERT = "sanctions-screening:step-1";
const STEP_RMCP = "rmcp-monitoring:step-1";

// ---------------------------------------------------------------------------
// Time constants
// ---------------------------------------------------------------------------

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Rule-engine helpers
// ---------------------------------------------------------------------------

/**
 * Returns the timestamp (ms) of the most recent MLROSupervisionSnapshot
 * event emitted by Zara, or undefined if none exists.
 */
function lastMlroSupervisionSnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "MLROSupervisionSnapshot" })) {
    const p = e.payload as Record<string, unknown>;
    // Filter to events where Zara is the issuing agent
    const actor = String(p.agentUrn ?? p.issuingAgent ?? "");
    if (actor === "agent:zara" || /zara/i.test(actor) || actor === "") {
      const t = new Date(e.as_of).getTime();
      if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
        latest = t;
      }
    }
  }
  return latest;
}

/**
 * Returns true if there are any AlertOpened events within the last 24h that
 * have not been paired with an AlertDisposed event.
 * Approximation: counts open vs disposed; a per-alert correlation register
 * is a substrate gap (§16).
 */
function hasOpenAlertsWithNoDispositionIn24h(): boolean {
  let openCount = 0;
  let disposedCount = 0;
  for (const e of eventStore.replay({ type: "AlertOpened" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && Date.now() - t <= TWENTY_FOUR_HOURS_MS) {
      openCount++;
    }
  }
  for (const _e of eventStore.replay({ type: "AlertDisposed" })) {
    disposedCount++;
  }
  return openCount > disposedCount;
}

/**
 * Returns true if there are any SanctionsHit or PEPFlag events within the
 * last 1h that have not been resolved (no SanctionsHitDisposed or
 * PEPHandlingDecided event more recent than the hit/flag).
 */
function hasOpenSanctionsOrPepHitWithin1h(): boolean {
  let lastHit: number | undefined;
  let lastResolution: number | undefined;

  for (const e of eventStore.replay({ type: "SanctionsHit" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && Date.now() - t <= ONE_HOUR_MS) {
      if (lastHit === undefined || t > lastHit) lastHit = t;
    }
  }
  for (const e of eventStore.replay({ type: "PEPFlag" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && Date.now() - t <= ONE_HOUR_MS) {
      if (lastHit === undefined || t > lastHit) lastHit = t;
    }
  }

  for (const e of eventStore.replay({ type: "SanctionsHitDisposed" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (lastResolution === undefined || t > lastResolution)) {
      lastResolution = t;
    }
  }
  for (const e of eventStore.replay({ type: "PEPHandlingDecided" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (lastResolution === undefined || t > lastResolution)) {
      lastResolution = t;
    }
  }

  return lastHit !== undefined && (lastResolution === undefined || lastHit > lastResolution);
}

/**
 * Returns the timestamp (ms) of the most recent ComplianceMonitoringSnapshot
 * event, or undefined if none exists.
 */
function lastComplianceMonitoringSnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "ComplianceMonitoringSnapshot" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Goal-derivation rule engine for Zara
// ---------------------------------------------------------------------------

export const zaraGoalDeriver: GoalDeriver = async (
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
    "zara-goal-deriver: evaluating candidates",
  );

  const specHash = spec.specHash;

  // Helper: validate a goal is in the closed-set (T-NEW self-check).
  function inClosedSet(goal: string): boolean {
    const ok = spec.decisionsInScope.includes(goal);
    if (!ok) {
      logger.warn(
        { agentUrn: args.agent.urn, goal, closedSet: spec.decisionsInScope },
        "zara-goal-deriver: goal not in closed-set; deferring",
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
  // Candidate 1 (CRITICAL): open SanctionsHit or PEPFlag event with no
  // resolution in the last 1h → "Sanctions-hit disposition" (priority CRITICAL).
  // Unresolved sanctions hits or PEP flags breach the tipping-off boundary and
  // require immediate MLRO disposition per FIC ss 28/28A + RMCP policy.
  // -------------------------------------------------------------------------

  const openSanctionsOrPep = hasOpenSanctionsOrPepHitWithin1h();

  if (openSanctionsOrPep) {
    if (!inClosedSet(GOAL_SANCTIONS_SCREENING)) return null;

    const stepId = resolveStepId(PROCEDURE_SANCTIONS_SCREENING, STEP_ALERT);

    logger.info(
      { agentUrn: args.agent.urn },
      "zara-goal-deriver: unresolved SanctionsHit / PEPFlag within 1h — selecting sanctions-screening-disposition goal (CRITICAL)",
    );

    return {
      kind: "decision",
      chosen: GOAL_SANCTIONS_SCREENING,
      rationale:
        "Open SanctionsHit or PEPFlag event detected with no SanctionsHitDisposed / PEPHandlingDecided resolution in the last 1h. Unresolved sanctions hits breach the tipping-off boundary under FIC s.29(3). Zara must disposition immediately per RMCP PEP policy and §9 'Sanctions-hit disposition' row.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: GOAL_SANCTIONS_SCREENING,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: PROCEDURE_SANCTIONS_SCREENING,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "SanctionsHitDisposed",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "zara-goal-loop:sanctions-screening-disposition",
            priority: "CRITICAL",
          },
        },
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Candidate 2 (HIGH): no MLROSupervisionSnapshot in the last 24h →
  // "Approve / decline an STR (MLRO judgement)" (priority HIGH).
  // MLRO supervision is a continuous cadence duty per FIC ss 28/28A/29;
  // absence > 24h from Zara is an inactivity-SLA breach.
  // -------------------------------------------------------------------------

  const lastMlroSnapshot = lastMlroSupervisionSnapshotMs();
  const needsMlroSupervision =
    lastMlroSnapshot === undefined || Date.now() - lastMlroSnapshot > TWENTY_FOUR_HOURS_MS;

  if (needsMlroSupervision) {
    if (!inClosedSet(GOAL_MLRO_SUPERVISION)) return null;

    const stepId = resolveStepId(PROCEDURE_SANCTIONS_SCREENING, STEP_MLRO);

    logger.info(
      {
        agentUrn: args.agent.urn,
        lastMlroSnapshotAgo: lastMlroSnapshot
          ? `${Math.round((Date.now() - lastMlroSnapshot) / 60_000)}min`
          : "never",
      },
      "zara-goal-deriver: no MLROSupervisionSnapshot in 24h — selecting mlro-supervision goal (HIGH)",
    );

    return {
      kind: "decision",
      chosen: GOAL_MLRO_SUPERVISION,
      rationale: `No MLROSupervisionSnapshot event from Zara in the last 24h (last seen: ${lastMlroSnapshot ? new Date(lastMlroSnapshot).toISOString() : "never"}). MLRO supervision is a continuous duty under FIC ss 28/28A/29; inactivity > 24h is a supervisory-oversight breach. Selecting MLRO-supervision goal to trigger the zara:mlro-supervision handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: GOAL_MLRO_SUPERVISION,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: PROCEDURE_SANCTIONS_SCREENING,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "MLROSupervisionSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "zara-goal-loop:mlro-supervision",
            priority: "HIGH",
          },
        },
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Candidate 3 (HIGH): open AlertOpened event (transaction monitoring) with
  // no disposition in 24h → "Sanctions-hit disposition" (priority HIGH).
  // Open TM alerts without disposition indicate Mira-to-Zara escalation
  // chain is pending; Zara must review and sign disposition per §9.
  // -------------------------------------------------------------------------

  const openAlerts = hasOpenAlertsWithNoDispositionIn24h();

  if (openAlerts) {
    if (!inClosedSet(GOAL_SANCTIONS_SCREENING)) return null;

    const stepId = resolveStepId(PROCEDURE_SANCTIONS_SCREENING, STEP_ALERT);

    logger.info(
      { agentUrn: args.agent.urn },
      "zara-goal-deriver: open AlertOpened events with no disposition in 24h — selecting aml-alert-disposition goal (HIGH)",
    );

    return {
      kind: "decision",
      chosen: GOAL_SANCTIONS_SCREENING,
      rationale:
        "Open AlertOpened event(s) from transaction monitoring detected with no AlertDisposed pairing in the last 24h. Mira-to-Zara alert escalation chain is pending. Zara must review open TM alerts and sign disposition per §9 'Sanctions-hit disposition' row and RMCP §4 alert-management SLA.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: GOAL_SANCTIONS_SCREENING,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: PROCEDURE_KYC_ONBOARDING,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "AlertDisposed",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "zara-goal-loop:aml-alert-disposition",
            priority: "HIGH",
          },
        },
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Candidate 4 (MEDIUM): no ComplianceMonitoringSnapshot in the last 7 days →
  // "Approve RMCP version cycles (within framework)" (priority MEDIUM).
  // Compliance monitoring cycle is a weekly cadence per §6 RMCP-monitoring-plan;
  // absence > 7d indicates the monitoring cycle is overdue.
  // -------------------------------------------------------------------------

  const lastMonitoringSnapshot = lastComplianceMonitoringSnapshotMs();
  const needsMonitoringCycle =
    lastMonitoringSnapshot === undefined || Date.now() - lastMonitoringSnapshot > SEVEN_DAYS_MS;

  if (needsMonitoringCycle) {
    if (!inClosedSet(GOAL_RMCP_VERSION_CYCLE)) return null;

    const stepId = resolveStepId(PROCEDURE_RMCP_MONITORING, STEP_RMCP);

    logger.info(
      {
        agentUrn: args.agent.urn,
        lastMonitoringSnapshotAgo: lastMonitoringSnapshot
          ? `${Math.round((Date.now() - lastMonitoringSnapshot) / (60_000 * 60 * 24))}d`
          : "never",
      },
      "zara-goal-deriver: no ComplianceMonitoringSnapshot in 7d — selecting compliance-monitoring-cycle goal (MEDIUM)",
    );

    return {
      kind: "decision",
      chosen: GOAL_RMCP_VERSION_CYCLE,
      rationale: `No ComplianceMonitoringSnapshot event in the last 7 days (last seen: ${lastMonitoringSnapshot ? new Date(lastMonitoringSnapshot).toISOString() : "never"}). Zara's RMCP-monitoring-plan §6 weekly compliance-monitoring cycle is overdue. Selecting RMCP version-cycle goal to trigger the compliance monitoring run.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: GOAL_RMCP_VERSION_CYCLE,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: PROCEDURE_RMCP_MONITORING,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "ComplianceMonitoringSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "zara-goal-loop:compliance-monitoring-cycle",
            priority: "MEDIUM",
          },
        },
      ],
    };
  }

  // No goal justified — defer.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastMlroSnapshotAgo: lastMlroSnapshot
        ? `${Math.round((Date.now() - lastMlroSnapshot) / 60_000)}min`
        : "never",
      lastMonitoringSnapshotAgo: lastMonitoringSnapshot
        ? `${Math.round((Date.now() - lastMonitoringSnapshot) / (60_000 * 60 * 24))}d`
        : "never",
    },
    "zara-goal-deriver: no action justified — deferring",
  );
  return null;
};

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Brief-bound run-lifecycle dispatch config (shared helper — see
// goal-loop-brief-dispatch.ts). Authority:
// D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION (PR #1182); extended to all
// goal-loops per D-QUEUE-CLOSEOUT-2026-06-10.
// ---------------------------------------------------------------------------
const ZARA_BRIEF_DISPATCH: GoalLoopBriefDispatchConfig = {
  agentSlug: "zara",
  // Shadow-mode cohort: no runHandler — the dispatch never invokes the
  // underlying handler; every brief-bound run closes blocked with the
  // substrate gap surfaced (run-feed visibility without live side-effects).
};

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
// Handler (wired as `zara:goal-loop`)
//
// Shadow mode: shadowMode: true — cohort-3; first two substrate ticks run in
// shadow mode per spec §4. Goal-loop events are emitted so the trace is
// testable; the underlying handler is always called with dryRun=true.
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// zara:mlro-supervision handler directly via its imported callable.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "zara:goal-loop — starting goal-loop cohort-3 run (shadow mode)",
  );

  const agentUrn = "agent:zara";

  // Parse Zara's spec.
  const parseResult = parseSpecFile(ZARA_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: ZARA_SPEC_PATH },
      "zara:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await zaraMlroSupervision(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, zaraGoalDeriver);

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
    "zara:goal-loop — goal-loop iteration complete",
  );

  // Brief-bound dispatch path (D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION,
  // extended per D-QUEUE-CLOSEOUT-2026-06-10): bind a run to the oldest open
  // brief so the iteration is visible in the autonomy run-feed. The shadow
  // constraint holds: the dispatch config has no runHandler, so the underlying
  // handler is never invoked live — every brief-bound run closes blocked with
  // the substrate gap surfaced. Skipped under --dry-run.
  const selectedDecision = goalOutcome !== null && goalOutcome.kind === "decision";
  const openBriefs = selectedDecision && !ctx.dryRun ? openBriefsListForAgent("zara") : [];
  const [brief] = openBriefs;
  if (brief) {
    const dispatch = await dispatchBriefBoundRun(
      ctx,
      brief,
      iterationId,
      openBriefs.length - 1,
      ZARA_BRIEF_DISPATCH,
    );
    logger.info(
      { agent: ctx.agent, iterationId, briefId: brief.briefId, openBriefs: openBriefs.length },
      "zara:goal-loop — run complete (brief-bound dispatch)",
    );
    return {
      eventsEmitted: dispatch.eventsEmitted + goalEventsEmitted,
      ok: true,
      summary: `goal-loop: iteration=${iterationId} outcome=decision dispatch=${dispatch.summary}`,
    };
  }

  // Shadow mode (cohort-3): always dry-run the underlying handler so we
  // observe the trace without side-effects, regardless of goal outcome.
  // The handler will be promoted to live once cohort validation passes.
  if (selectedDecision && !ctx.dryRun) {
    const cadence = await dispatchCadenceRun(ctx, iterationId, ZARA_BRIEF_DISPATCH);
    logger.info(
      { agent: ctx.agent, iterationId },
      "zara:goal-loop — cohort-3 shadow run complete (cadence, instrumented)",
    );
    return {
      eventsEmitted: cadence.eventsEmitted + goalEventsEmitted,
      ok: cadence.handlerOutput.ok,
      summary: `goal-loop cohort-3 shadow: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${cadence.handlerOutput.summary}`,
      ...(cadence.handlerOutput.deliverable
        ? { deliverable: cadence.handlerOutput.deliverable }
        : {}),
    };
  }

  const handlerCtx: AgentRunContext = {
    ...ctx,
    dryRun: true, // shadowMode: true until cohort-3 validation passes
  };

  const handlerOutput = await zaraMlroSupervision(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "zara:goal-loop — cohort-3 shadow run complete (deferred)",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-3 shadow: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
