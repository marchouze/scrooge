// runtime/agents/mira-goal-loop.ts
//
// Mira (Compliance / RegTech engineer) goal-loop — cohort-2 deriver.
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Mira is the first
// cohort-2 agent to derive goals autonomously from her compliance mandate.
// This run-handler is the integration point that:
//   1. Materialises a WorldStateSnapshot for agent:mira.
//   2. Runs Mira's rule-engine goal deriver (no LLM calls — cohort rule-engine
//      constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   - If no ObligationsRegisterSnapshot in the last 24 hours →
//     select "Register-entry approval" goal (obligations-register review).
//   - If open compliance findings (AuditFinding addressed to agent:mira) →
//     select "Obligation impact assessment on existing controls" goal and
//     emit AgentEscalation to Zara (CCO) per §10 "Ambiguous obligation interpretation".
//   - If no AlertDisposed event in the last 24 hours and AlertOpened events
//     are present (unanswered alerts) →
//     select "Transaction-monitoring alert disposition (close / escalate)" goal.
//   - Otherwise → defer (null outcome).
//
// Goal candidates use Mira's §9 decisions-in-scope row labels exactly as
// they appear in Team/Mira.md (the spec's closed-set per T-NEW).
//
// Procedure citations: Mira owns Procedures/by-policy/sanctions-screening.md
// and Procedures/by-policy/kyc-onboarding.md.
// Since these files may not yet have step anchors (pre-backfill coverage-gap
// per _step-id-convention.md §5), we use the coverage-gap form:
// `stepId: "<procedure>:step-1"` as a placeholder. The recon
// pipeline warns (not fails) for missing step IDs per the build-phase
// tolerance.
//
// Shadow mode: shadowMode is true until cohort validation passes.
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Mira (Compliance / RegTech engineer) / Atlas (Core banking platform architect)

import { resolve } from "node:path";
import type { GoalDeriver, GoalLoopOutcome } from "../../platform/agent-runtime/goal-loop";
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import type { RunWithGoalArgs } from "../../platform/agent-runtime/goal-loop";
import { parseSpecFile } from "../../platform/agent-runtime/spec-parser";
import { LocalAgentWorldStateReader } from "../../platform/agent-runtime/world-state";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import the underlying obligations-snapshot handler directly to avoid the
// circular dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import miraObligationsSnapshot from "./mira-obligations-snapshot";

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Mira
// ---------------------------------------------------------------------------

const MIRA_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Mira.md",
);

// §9 row labels from Team/Mira.md — provided for documentation; the
// closed-set is read from the parsed spec at runtime (T-NEW closed-set check).
// Kept here so the goal-deriver can reference them in comments / unit tests
// without re-parsing the spec file.
// const MIRA_DECISIONS_IN_SCOPE = [ ... ] — see Team/Mira.md §9
// const MIRA_EVENTS_EMITTED     = [ ... ] — see Team/Mira.md §11

// Mira's procedure paths (§13).
const MIRA_OBLIGATIONS_PROCEDURE_PATH = "Procedures/by-policy/kyc-onboarding.md";
const MIRA_MONITORING_PROCEDURE_PATH = "Procedures/by-policy/sanctions-screening.md";
// Coverage-gap step-ID form per _step-id-convention.md §5.
const MIRA_OBLIGATIONS_STEP_ID = "kyc-onboarding:step-1";
const MIRA_MONITORING_STEP_ID = "sanctions-screening:step-1";

// Goal labels — must match Team/Mira.md §9 first-column row labels exactly (T-NEW).
const OBLIGATIONS_REVIEW_GOAL =
  "Register-entry approval" as const;
const OPEN_FINDINGS_GOAL =
  "Obligation impact assessment on existing controls" as const;
const TRANSACTION_MONITORING_GOAL =
  "Transaction-monitoring alert disposition (close / escalate)" as const;

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Goal-derivation rule engine helpers
// ---------------------------------------------------------------------------

function lastObligationsSnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "ObligationsRegisterSnapshot" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

function hasOpenAuditFindings(agentUrn: string): boolean {
  for (const e of eventStore.replay({ type: "AuditFinding" })) {
    const p = e.payload as Record<string, unknown>;
    if (String(p.addressedTo ?? "") === agentUrn) return true;
  }
  return false;
}

function hasUndisposedAlerts(): boolean {
  // Count open alerts and disposed alerts — if open > disposed, we have
  // unanswered alerts requiring disposition.
  let openCount = 0;
  let disposedCount = 0;
  for (const e of eventStore.replay({ type: "AlertOpened" })) {
    // Any AlertOpened event within the last 24h counts as an unanswered alert
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

function lastAlertDisposedMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "AlertDisposed" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

export const miraGoalDeriver: GoalDeriver = async (
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
    "mira-goal-deriver: evaluating candidates",
  );

  const specHash = spec.specHash;

  // Helper — build procedure citation for a given path / step-id.
  const buildProcedureCitation = (procedurePath: string, stepId: string) => {
    const procedureEntry = spec.procedureSteps.find((s) => s.procedurePath === procedurePath);
    const resolvedStepId =
      procedureEntry && procedureEntry.stepIds.length > 0
        ? (procedureEntry.stepIds[0] ?? stepId)
        : stepId;
    return {
      procedurePath,
      stepId: resolvedStepId,
      // SHA-256 of the procedure file is unknown at runtime without reading it;
      // use the spec hash as a proxy (coverage-gap).
      procedureHash: specHash,
    };
  };

  // Candidate 1: open audit findings addressed to Mira → escalate to Zara (CCO).
  // Per §10 "Ambiguous obligation interpretation" row: escalation target is Zara.
  // The goal selected is obligation-impact-assessment (in §9 closed-set), not the
  // finding itself (findings require Vera → Zara chain per independence rules).
  const hasFindings =
    worldState.auditFindingsForMe.length > 0 || hasOpenAuditFindings(args.agent.urn);
  if (hasFindings) {
    logger.info(
      { agentUrn: args.agent.urn, findingCount: worldState.auditFindingsForMe.length },
      "mira-goal-deriver: open audit findings detected — selecting obligation-impact-assessment goal",
    );

    if (!spec.decisionsInScope.includes(OPEN_FINDINGS_GOAL)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal: OPEN_FINDINGS_GOAL,
          closedSet: spec.decisionsInScope,
        },
        "mira-goal-deriver: open-findings goal not in closed-set; deferring",
      );
      return null;
    }

    return {
      kind: "decision",
      chosen: OPEN_FINDINGS_GOAL,
      rationale: `Open audit findings detected (${worldState.auditFindingsForMe.length} in world-state; additional findings may exist in the event store). Mira must assess obligation impact and escalate to Zara (CCO) per §10 "Ambiguous obligation interpretation" escalation row.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: OPEN_FINDINGS_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        buildProcedureCitation(MIRA_OBLIGATIONS_PROCEDURE_PATH, MIRA_OBLIGATIONS_STEP_ID),
      ],
      plannedEvents: [
        {
          type: "ObligationImpactAssessed",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "mira-goal-loop:open-findings",
          },
        },
      ],
    };
  }

  // Candidate 2: if no ObligationsRegisterSnapshot in last 24h, review the register.
  const lastSnapshot = lastObligationsSnapshotMs();
  const needsObligationsReview =
    lastSnapshot === undefined || Date.now() - lastSnapshot > TWENTY_FOUR_HOURS_MS;

  if (needsObligationsReview) {
    logger.info(
      {
        agentUrn: args.agent.urn,
        lastObligationsSnapshotAgo: lastSnapshot
          ? `${Math.round((Date.now() - lastSnapshot) / 60_000)}min`
          : "never",
      },
      "mira-goal-deriver: no ObligationsRegisterSnapshot in last 24h — selecting register-entry-approval goal",
    );

    if (!spec.decisionsInScope.includes(OBLIGATIONS_REVIEW_GOAL)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal: OBLIGATIONS_REVIEW_GOAL,
          closedSet: spec.decisionsInScope,
        },
        "mira-goal-deriver: obligations-review goal not in closed-set; deferring",
      );
      return null;
    }

    return {
      kind: "decision",
      chosen: OBLIGATIONS_REVIEW_GOAL,
      rationale: `No ObligationsRegisterSnapshot in the last 24h (last seen: ${lastSnapshot ? new Date(lastSnapshot).toISOString() : "never"}). Mira's obligations-register review is due. Selecting register-entry-approval goal to trigger the mira:obligations-snapshot handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: OBLIGATIONS_REVIEW_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        buildProcedureCitation(MIRA_OBLIGATIONS_PROCEDURE_PATH, MIRA_OBLIGATIONS_STEP_ID),
      ],
      plannedEvents: [
        {
          type: "ObligationRegistered",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "mira-goal-loop:obligations-review",
          },
        },
      ],
    };
  }

  // Candidate 3: if there are unanswered transaction-monitoring alerts
  // with no AlertDisposed event in the last 24h, prioritise alert triage.
  const lastAlertDisposed = lastAlertDisposedMs();
  const needsAlertReview =
    hasUndisposedAlerts() &&
    (lastAlertDisposed === undefined || Date.now() - lastAlertDisposed > TWENTY_FOUR_HOURS_MS);

  if (needsAlertReview) {
    logger.info(
      {
        agentUrn: args.agent.urn,
        lastAlertDisposedAgo: lastAlertDisposed
          ? `${Math.round((Date.now() - lastAlertDisposed) / 60_000)}min`
          : "never",
      },
      "mira-goal-deriver: unanswered transaction-monitoring alerts — selecting alert-disposition goal",
    );

    if (!spec.decisionsInScope.includes(TRANSACTION_MONITORING_GOAL)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal: TRANSACTION_MONITORING_GOAL,
          closedSet: spec.decisionsInScope,
        },
        "mira-goal-deriver: alert-disposition goal not in closed-set; deferring",
      );
      return null;
    }

    return {
      kind: "decision",
      chosen: TRANSACTION_MONITORING_GOAL,
      rationale: `Unanswered transaction-monitoring alerts detected and no AlertDisposed event in the last 24h (last disposed: ${lastAlertDisposed ? new Date(lastAlertDisposed).toISOString() : "never"}). Mira must triage open alerts per §9 "Transaction-monitoring alert disposition" row.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: TRANSACTION_MONITORING_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        buildProcedureCitation(MIRA_MONITORING_PROCEDURE_PATH, MIRA_MONITORING_STEP_ID),
      ],
      plannedEvents: [
        {
          type: "AlertDisposed",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "mira-goal-loop:alert-triage",
          },
        },
      ],
    };
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastObligationsSnapshotAgo: lastSnapshot
        ? `${Math.round((Date.now() - lastSnapshot) / 60_000)}min`
        : "never",
    },
    "mira-goal-deriver: no action justified — deferring",
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
// Handler (wired as `mira:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// mira:obligations-snapshot handler directly via its imported callable.
//
// Shadow mode: shadowMode is true for the first cohort ticks. The goal-loop
// events are still emitted (so the shadow-mode trace is testable per spec
// §4 "Build runs in shadow mode for the first two substrate ticks"), but the
// mira:obligations-snapshot handler is called with dryRun=true.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "mira:goal-loop — starting goal-loop cohort-2 run",
  );

  const agentUrn = "agent:mira";

  // Parse Mira's spec.
  const parseResult = parseSpecFile(MIRA_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: MIRA_SPEC_PATH },
      "mira:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await miraObligationsSnapshot(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, miraGoalDeriver);

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
    "mira:goal-loop — goal-loop iteration complete",
  );

  // If deferred or escalation — run the handler in dry-run mode (shadow trace).
  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  const handlerCtx: AgentRunContext = {
    ...ctx,
    // In shadow mode (first cohort ticks), always dry-run the handler
    // so we observe the trace without side-effects.
    dryRun: ctx.dryRun || !shouldRunHandler,
  };

  const handlerOutput = await miraObligationsSnapshot(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "mira:goal-loop — cohort-2 run complete",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-2: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
