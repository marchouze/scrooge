// runtime/agents/camille-goal-loop.ts
//
// Camille (Chief Financial Officer) goal-loop — cohort-3.
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Camille is wired into the
// goal-loop substrate. This run-handler is the integration point that:
//   1. Materialises a WorldStateSnapshot for agent:camille.
//   2. Runs Camille's rule-engine goal deriver (no LLM calls — cohort-3
//      rule-engine constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   - Rule 1: If no FinancialPositionSnapshot from Camille in the last 24h
//     → select "Approve monthly close" goal (HIGH priority).
//       The FinancialPositionSnapshot is the build-phase proxy for a
//       financial-position attestation; its absence means the CFO position-
//       statement cadence has lapsed.
//   - Rule 2: If no CloseCycleCompleted in the last 7 days
//     → select "Approve monthly close" goal (HIGH priority).
//       The monthly close SLA (§6) requires a CloseCycleCompleted event;
//       absence for 7 days means a close cycle has been missed entirely.
//   - Rule 3: If open AgentEscalation addressed to Camille with no resolution
//     within 24h → select "Approve external-auditor interface decisions" goal
//     (HIGH priority). Unresolved escalations to the CFO surface via §10
//     escalation channels; the 24h SLA is per §10 "Material AFS or BA-return
//     restatement".
//   - Rule 4: If no CapitalAdequacySnapshot in the last 7 days → select
//     "Approve capital actions in operational scope (instrument-issuance
//     preparation; dividend capacity)" goal (MEDIUM priority). Capital-
//     adequacy monitoring (§6: weekly regulatory-capital run) drives Camille's
//     ICAAP-aligned capital-action approvals.
//   - Otherwise → defer (null outcome).
//
// The goal candidates use Camille's §9 decisions-in-scope row labels exactly
// as they appear in Team/Camille.md (the spec's closed-set per T-NEW).
//
// Procedure citations: Camille owns close-approval and capital-management
// procedures (§13). Since step anchors may not yet be backfilled (pre-backfill
// coverage-gap per _step-id-convention.md §5), we use the coverage-gap form:
// `stepId: "close-approval:step-1"` as a placeholder. The recon pipeline
// warns (not fails) for missing step IDs per the build-phase tolerance.
//
// Shadow mode: shadowMode: true for cohort-3 until cohort validation passes
// (per spec §4 "Build runs in shadow mode for the first two substrate ticks").
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect) — wiring.
//         Camille (Chief Financial Officer) — goal-deriver rules.

import { resolve } from "node:path";
import type { GoalDeriver, GoalLoopOutcome } from "../../platform/agent-runtime/goal-loop";
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import type { RunWithGoalArgs } from "../../platform/agent-runtime/goal-loop";
import { parseSpecFile } from "../../platform/agent-runtime/spec-parser";
import { LocalAgentWorldStateReader } from "../../platform/agent-runtime/world-state";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import the underlying financial-position-snapshot handler directly to avoid
// the circular dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import camilleFinancialPositionSnapshot from "./camille-financial-position-snapshot";
import {
  type GoalLoopBriefDispatchConfig,
  dispatchBriefBoundRun,
  dispatchCadenceRun,
  openBriefsListForAgent,
} from "./goal-loop-brief-dispatch";

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Camille
// ---------------------------------------------------------------------------

const CAMILLE_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Camille.md",
);

// Procedure path for Camille's close-approval procedure (§13).
const CAMILLE_PROCEDURE_PATH = "Procedures/by-policy/close-approval.md";
// Coverage-gap step-ID form per _step-id-convention.md §5.
const CAMILLE_PROCEDURE_STEP_ID = "close-approval:step-1";

// §9 row labels from Team/Camille.md (closed-set per T-NEW).
const MONTHLY_CLOSE_GOAL = "Approve monthly close" as const;
const EXTERNAL_AUDITOR_GOAL = "Approve external-auditor interface decisions" as const;
const CAPITAL_ACTIONS_GOAL =
  "Approve capital actions in operational scope (instrument-issuance preparation; dividend capacity)" as const;

// ---------------------------------------------------------------------------
// Event-log helpers
// ---------------------------------------------------------------------------

function lastFinancialPositionSnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "FinancialPositionSnapshot" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

function lastCloseCycleCompletedMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "CloseCycleCompleted" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

function lastCapitalAdequacySnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "CapitalAdequacySnapshot" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

function hasUnresolvedEscalationForCamille(): boolean {
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;

  // Collect escalation IDs older than 24h addressed to Camille.
  const openEscalationIds = new Set<string>();
  for (const e of eventStore.replay({ type: "AgentEscalation" })) {
    const t = new Date(e.as_of).getTime();
    if (Number.isNaN(t)) continue;
    const payload = e.payload as Record<string, unknown> | undefined;
    const addressedTo = payload?.addressedTo ?? payload?.addressed_to ?? payload?.targetAgent;
    const isForCamille =
      addressedTo === "agent:camille" ||
      addressedTo === "Camille" ||
      (Array.isArray(addressedTo) &&
        (addressedTo.includes("agent:camille") || addressedTo.includes("Camille")));
    if (isForCamille && t < cutoff) {
      const id = e.event_id ?? String(t);
      openEscalationIds.add(id);
    }
  }

  if (openEscalationIds.size === 0) return false;

  // Remove escalations that have a resolving event.
  for (const e of eventStore.replay({ type: "AgentEscalationResolved" })) {
    const payload = e.payload as Record<string, unknown> | undefined;
    const refId = payload?.escalationId ?? payload?.escalation_id ?? payload?.refId;
    if (typeof refId === "string") {
      openEscalationIds.delete(refId);
    }
  }

  return openEscalationIds.size > 0;
}

// ---------------------------------------------------------------------------
// Goal-derivation rule engine
// ---------------------------------------------------------------------------

export const camilleGoalDeriver: GoalDeriver = async (
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
    "camille-goal-deriver: evaluating candidates",
  );

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const specHash = spec.specHash;

  // Build procedure citations — use coverage-gap form per §3.4 contract.
  // The procedure file may not have step anchors yet (pre-backfill).
  const procedureEntry = spec.procedureSteps.find(
    (s) => s.procedurePath === CAMILLE_PROCEDURE_PATH,
  );
  const stepId =
    procedureEntry && procedureEntry.stepIds.length > 0
      ? (procedureEntry.stepIds[0] ?? CAMILLE_PROCEDURE_STEP_ID)
      : CAMILLE_PROCEDURE_STEP_ID;

  // Helper: validate goal is in spec closed-set before returning.
  const validateGoal = (goal: string): boolean => {
    if (!spec.decisionsInScope.includes(goal)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal,
          closedSet: spec.decisionsInScope,
        },
        "camille-goal-deriver: goal not in closed-set; deferring",
      );
      return false;
    }
    return true;
  };

  // Rule 1 — No FinancialPositionSnapshot in the last 24h (HIGH).
  // The FinancialPositionSnapshot is Camille's primary attestation event
  // in build phase — it documents the CFO financial-position view and
  // surfaces the substrate gaps preventing a real IFRS balance sheet.
  const lastSnapshot = lastFinancialPositionSnapshotMs();
  const needsSnapshot =
    lastSnapshot === undefined || Date.now() - lastSnapshot > TWENTY_FOUR_HOURS_MS;

  if (needsSnapshot) {
    if (!validateGoal(MONTHLY_CLOSE_GOAL)) return null;

    return {
      kind: "decision",
      chosen: MONTHLY_CLOSE_GOAL,
      rationale: `No FinancialPositionSnapshot in the last 24h (last seen: ${lastSnapshot ? new Date(lastSnapshot).toISOString() : "never"}). Camille's daily financial-position attestation cadence (§6) requires a FinancialPositionSnapshot every 24h to keep the CFO position-statement current. Selecting monthly-close goal to trigger the camille:financial-position-snapshot handler and produce the daily attestation.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: MONTHLY_CLOSE_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: CAMILLE_PROCEDURE_PATH,
          stepId,
          // SHA-256 of the procedure file is unknown at runtime without
          // reading it; use the spec hash as a proxy (coverage-gap).
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "FinancialPositionSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "camille-goal-loop",
          },
        },
      ],
    };
  }

  // Rule 2 — No CloseCycleCompleted in the last 7 days (HIGH).
  // Camille's monthly close SLA (§6: daily close 17:00 SAST; weekly
  // regulatory-capital run Monday 06:00 SAST) requires a CloseCycleCompleted
  // event within the 7-day window. Absence means a close cycle has lapsed.
  const lastClose = lastCloseCycleCompletedMs();
  const closeCycleLapsed = lastClose === undefined || Date.now() - lastClose > SEVEN_DAYS_MS;

  if (closeCycleLapsed) {
    if (!validateGoal(MONTHLY_CLOSE_GOAL)) return null;

    return {
      kind: "decision",
      chosen: MONTHLY_CLOSE_GOAL,
      rationale: `No CloseCycleCompleted event in the last 7 days (last seen: ${lastClose ? new Date(lastClose).toISOString() : "never"}). Camille's close-cycle SLA requires a CloseCycleCompleted within the 7-day window; absence indicates a lapsed close cycle. Selecting monthly-close goal to trigger the camille:financial-position-snapshot handler to surface the close-cycle gap.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: MONTHLY_CLOSE_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: CAMILLE_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "CloseCycleCompleted",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "camille-goal-loop",
          },
        },
      ],
    };
  }

  // Rule 3 — Open AgentEscalation addressed to Camille with no resolution
  // in 24h (HIGH). Escalations to Camille per §10 (material AFS/BA-return
  // restatement, auditor disagreement, capital top-up trigger, tax dispute)
  // carry a 24h SLA. Unresolved escalations require immediate disposition.
  const hasUnresolvedEscalation = hasUnresolvedEscalationForCamille();

  if (hasUnresolvedEscalation) {
    if (!validateGoal(EXTERNAL_AUDITOR_GOAL)) return null;

    return {
      kind: "decision",
      chosen: EXTERNAL_AUDITOR_GOAL,
      rationale:
        "Open AgentEscalation addressed to Camille with no resolving AgentEscalationResolved event within 24h. Per §10 escalation channels (material AFS/BA-return restatement, auditor disagreement, capital top-up trigger, tax dispute), the 24h SLA requires immediate CFO disposition. Selecting auditor-interface-decisions goal to trigger the camille:financial-position-snapshot handler and surface the unresolved escalation.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: EXTERNAL_AUDITOR_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: CAMILLE_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "AgentEscalation",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "camille-goal-loop",
            note: "escalation-disposition",
          },
        },
      ],
    };
  }

  // Rule 4 — No CapitalAdequacySnapshot in the last 7 days (MEDIUM).
  // Camille's weekly regulatory-capital run (§6: Monday 06:00 SAST) should
  // produce a CapitalAdequacySnapshot every 7 days; absence means the
  // ICAAP-aligned capital-monitoring cadence has lapsed and Camille must
  // review and approve capital-adequacy status.
  const lastCapitalSnapshot = lastCapitalAdequacySnapshotMs();
  const capitalSnapshotLapsed =
    lastCapitalSnapshot === undefined || Date.now() - lastCapitalSnapshot > SEVEN_DAYS_MS;

  if (capitalSnapshotLapsed) {
    if (!validateGoal(CAPITAL_ACTIONS_GOAL)) return null;

    return {
      kind: "decision",
      chosen: CAPITAL_ACTIONS_GOAL,
      rationale: `No CapitalAdequacySnapshot in the last 7 days (last seen: ${lastCapitalSnapshot ? new Date(lastCapitalSnapshot).toISOString() : "never"}). Camille's weekly regulatory-capital run cadence (§6: Monday 06:00 SAST) requires a CapitalAdequacySnapshot within the 7-day window. Selecting capital-actions goal to trigger the camille:financial-position-snapshot handler and surface the capital-adequacy monitoring gap.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: CAPITAL_ACTIONS_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: CAMILLE_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "CapitalAdequacySnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "camille-goal-loop",
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
      lastCloseAgo: lastClose ? `${Math.round((Date.now() - lastClose) / 60_000)}min` : "never",
      lastCapitalSnapshotAgo: lastCapitalAdequacySnapshotMs()
        ? `${Math.round((Date.now() - (lastCapitalAdequacySnapshotMs() ?? 0)) / 60_000)}min`
        : "never",
    },
    "camille-goal-deriver: no action justified — deferring",
  );
  return null;
};

// ---------------------------------------------------------------------------
// Brief-bound run-lifecycle dispatch config (shared helper — see
// goal-loop-brief-dispatch.ts). Authority:
// D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION (PR #1182); extended to all
// goal-loops per D-QUEUE-CLOSEOUT-2026-06-10.
// ---------------------------------------------------------------------------
const CAMILLE_BRIEF_DISPATCH: GoalLoopBriefDispatchConfig = {
  agentSlug: "camille",
  selfExecutablePattern: /financial[\s-]?position|position[\s-]?snapshot/i,
  deliveredClassLabel: "financial-position snapshot attestation",
  runHandler: camilleFinancialPositionSnapshot,
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
// Handler (wired as `camille:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// camille:financial-position-snapshot handler directly via its imported callable.
//
// Shadow mode: shadowMode: true until cohort validation passes.
// In dry-run mode the goal-loop events are still emitted (so the shadow-mode
// trace is testable per spec §4 "Build runs in shadow mode for the first two
// substrate ticks"), but the camille:financial-position-snapshot handler is
// called with dryRun=true.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "camille:goal-loop — starting goal-loop cohort-3 run",
  );

  const agentUrn = "agent:camille";

  // Parse Camille's spec.
  const parseResult = parseSpecFile(CAMILLE_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: CAMILLE_SPEC_PATH },
      "camille:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await camilleFinancialPositionSnapshot(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, camilleGoalDeriver);

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
    "camille:goal-loop — goal-loop iteration complete",
  );

  // If escalation or deferred — run handler in dry-run mode (shadow trace).
  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  // Brief-bound dispatch path (D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION,
  // extended per D-QUEUE-CLOSEOUT-2026-06-10): when the loop selected a
  // decision and an open brief is addressed to this agent, bind a run to the
  // oldest brief and emit AgentRunStarted{agent-runtime} → AgentRunCompleted
  // so the iteration is visible in the autonomy run-feed and the brief stops
  // being re-selected every tick. Skipped under --dry-run.
  const openBriefs = shouldRunHandler && !ctx.dryRun ? openBriefsListForAgent("camille") : [];
  const [brief] = openBriefs;
  if (brief) {
    const dispatch = await dispatchBriefBoundRun(
      ctx,
      brief,
      iterationId,
      openBriefs.length - 1,
      CAMILLE_BRIEF_DISPATCH,
    );
    logger.info(
      { agent: ctx.agent, iterationId, briefId: brief.briefId, openBriefs: openBriefs.length },
      "camille:goal-loop — run complete (brief-bound dispatch)",
    );
    return {
      eventsEmitted: dispatch.eventsEmitted + goalEventsEmitted,
      ok: true,
      summary: `goal-loop: iteration=${iterationId} outcome=decision dispatch=${dispatch.summary}`,
    };
  }

  if (shouldRunHandler && !ctx.dryRun) {
    const cadence = await dispatchCadenceRun(ctx, iterationId, CAMILLE_BRIEF_DISPATCH);
    logger.info(
      { agent: ctx.agent, iterationId },
      "camille:goal-loop — cohort-3 run complete (cadence, instrumented)",
    );
    return {
      eventsEmitted: cadence.eventsEmitted + goalEventsEmitted,
      ok: cadence.handlerOutput.ok,
      summary: `goal-loop cohort-3: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${cadence.handlerOutput.summary}`,
      ...(cadence.handlerOutput.deliverable ? { deliverable: cadence.handlerOutput.deliverable } : {}),
    };
  }

  const handlerCtx: AgentRunContext = {
    ...ctx,
    dryRun: true,
  };

  const handlerOutput = await camilleFinancialPositionSnapshot(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "camille:goal-loop — cohort-3 run complete (deferred)",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-3: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
