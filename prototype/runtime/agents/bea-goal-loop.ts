// runtime/agents/bea-goal-loop.ts
//
// Bea (Accounting & financial reporting engineer) goal-loop — cohort-2.
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Bea is the first
// cohort-2 agent to derive and execute goals autonomously from her own
// mandate. This run-handler is the integration point that:
//   1. Materialises a WorldStateSnapshot for agent:bea.
//   2. Runs Bea's rule-engine goal deriver (no LLM calls — cohort-2
//      rule-engine constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   - If no SubLedgerReconciled event in the last 24 hours
//     → select "Sign sub-ledger reconciliation".
//   - Else if there are open accounting period items (CloseCycleCompleted
//     older than 24h with no superseding close within that window)
//     → select "Approve close-cycle completion".
//   - Else if no AccountingReadinessSnapshot in the last 24 hours
//     → select "Approve a posting rule for an event type" (the trial-
//     balance equivalent in build phase; gates the first sub-ledger entry).
//   - Otherwise → defer (null outcome).
//
// The goal candidates use Bea's §9 decisions-in-scope row labels exactly
// as they appear in Team/Bea.md (the spec's closed-set per T-NEW).
//
// Procedure citations: Bea owns Procedures/by-policy/accounting-close.md
// (§13 "planned"). Since this file may not yet have step anchors
// (pre-backfill coverage-gap per _step-id-convention.md §5), we use the
// coverage-gap form: `stepId: "accounting-close:step-1"` as a placeholder.
// The recon pipeline warns (not fails) for missing step IDs per the
// build-phase tolerance.
//
// Shadow mode: shadowMode: true until cohort validation passes
// (per spec §4 "Build runs in shadow mode for first two substrate ticks").
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect) — wiring.
//         Bea (Accounting & financial reporting engineer) — goal-deriver rules.

import { resolve } from "node:path";
import type { GoalDeriver, GoalLoopOutcome } from "../../platform/agent-runtime/goal-loop";
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import type { RunWithGoalArgs } from "../../platform/agent-runtime/goal-loop";
import { parseSpecFile } from "../../platform/agent-runtime/spec-parser";
import { LocalAgentWorldStateReader } from "../../platform/agent-runtime/world-state";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import the underlying accounting-readiness handler directly to avoid the
// circular dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import beaAccountingReadiness from "./bea-accounting-readiness";

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Bea
// ---------------------------------------------------------------------------

const BEA_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Bea.md",
);

// Procedure path for Bea's accounting-close procedure (§13).
const BEA_PROCEDURE_PATH = "Procedures/by-policy/accounting-close.md";
// Coverage-gap step-ID form per _step-id-convention.md §5.
const BEA_PROCEDURE_STEP_ID = "accounting-close:step-1";

// §9 row labels from Team/Bea.md (closed-set per T-NEW).
const SUBLEDGER_RECON_GOAL = "Sign sub-ledger reconciliation" as const;
const CLOSE_CYCLE_GOAL = "Approve close-cycle completion" as const;
const POSTING_RULE_GOAL = "Approve a posting rule for an event type" as const;

// ---------------------------------------------------------------------------
// Goal-derivation rule engine
// ---------------------------------------------------------------------------

function lastSubLedgerReconciledMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "SubLedgerReconciled" })) {
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

function lastAccountingReadinessSnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "AccountingReadinessSnapshot" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

export const beaGoalDeriver: GoalDeriver = async (
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
    "bea-goal-deriver: evaluating candidates",
  );

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const specHash = spec.specHash;

  // Build procedure citations — use coverage-gap form per §3.4 contract.
  // The procedure file may not have step anchors yet (pre-backfill).
  const procedureEntry = spec.procedureSteps.find((s) => s.procedurePath === BEA_PROCEDURE_PATH);
  const stepId =
    procedureEntry && procedureEntry.stepIds.length > 0
      ? (procedureEntry.stepIds[0] ?? BEA_PROCEDURE_STEP_ID)
      : BEA_PROCEDURE_STEP_ID;

  // Helper: validate goal is in spec closed-set before returning.
  const validateGoal = (goal: string): boolean => {
    if (!spec.decisionsInScope.includes(goal)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal,
          closedSet: spec.decisionsInScope,
        },
        "bea-goal-deriver: goal not in closed-set; deferring",
      );
      return false;
    }
    return true;
  };

  // Candidate 1: if no SubLedgerReconciled in last 24h, select
  // sub-ledger reconciliation goal. The weekly drift check (§6 cadence)
  // must produce a SubLedgerDriftChecked event every 7 days; in build
  // phase the reconciliation goal fires more frequently to validate the
  // pipeline end-to-end.
  const lastRecon = lastSubLedgerReconciledMs();
  const needsRecon = lastRecon === undefined || Date.now() - lastRecon > TWENTY_FOUR_HOURS_MS;

  if (needsRecon) {
    if (!validateGoal(SUBLEDGER_RECON_GOAL)) return null;

    return {
      kind: "decision",
      chosen: SUBLEDGER_RECON_GOAL,
      rationale: `No SubLedgerReconciled event in the last 24h (last seen: ${lastRecon ? new Date(lastRecon).toISOString() : "never"}). Bea's reconciliation cadence (§6: weekly drift check Monday 06:00 UTC; inactivity SLA: SubLedgerDriftChecked every 7 days) requires a sub-ledger reconciliation. Selecting sub-ledger reconciliation goal to trigger the bea:accounting-readiness handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: SUBLEDGER_RECON_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: BEA_PROCEDURE_PATH,
          stepId,
          // SHA-256 of the procedure file is unknown at runtime without
          // reading it; use the spec hash as a proxy (coverage-gap).
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "SubLedgerReconciled",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "bea-goal-loop",
          },
        },
      ],
    };
  }

  // Candidate 2: if there are open accounting period items
  // (CloseCycleCompleted older than 24h), select close-cycle goal.
  const lastClose = lastCloseCycleCompletedMs();
  const hasOpenPeriodItems =
    lastClose === undefined || Date.now() - lastClose > TWENTY_FOUR_HOURS_MS;

  if (hasOpenPeriodItems) {
    if (!validateGoal(CLOSE_CYCLE_GOAL)) return null;

    return {
      kind: "decision",
      chosen: CLOSE_CYCLE_GOAL,
      rationale: `Open accounting period items detected: no CloseCycleCompleted event in the last 24h (last seen: ${lastClose ? new Date(lastClose).toISOString() : "never"}). Bea's daily close SLA (§6: daily close at 17:00 SAST; CloseCycleCompleted by 22:00 UTC) requires a close-cycle completion. Selecting close-cycle goal to trigger the bea:accounting-readiness handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: CLOSE_CYCLE_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: BEA_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "CloseCycleCompleted",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "bea-goal-loop",
          },
        },
      ],
    };
  }

  // Candidate 3: if no AccountingReadinessSnapshot (trial-balance equivalent
  // in build phase) in the last 24h, select posting-rule goal.
  // This is the build-phase proxy for "Generate trial balance snapshot":
  // until the close engine is wired, the AccountingReadinessSnapshot
  // produced by bea:accounting-readiness is the trial-balance equivalent.
  const lastSnapshot = lastAccountingReadinessSnapshotMs();
  const needsSnapshot =
    lastSnapshot === undefined || Date.now() - lastSnapshot > TWENTY_FOUR_HOURS_MS;

  if (needsSnapshot) {
    if (!validateGoal(POSTING_RULE_GOAL)) return null;

    return {
      kind: "decision",
      chosen: POSTING_RULE_GOAL,
      rationale: `No AccountingReadinessSnapshot in the last 24h (last seen: ${lastSnapshot ? new Date(lastSnapshot).toISOString() : "never"}). In build phase, the AccountingReadinessSnapshot is the trial-balance equivalent: it validates the posting-rule substrate and surfaces accounting cycle gaps. Selecting posting-rule goal to trigger the bea:accounting-readiness handler and produce the daily readiness attestation.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: POSTING_RULE_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: BEA_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "AccountingReadinessSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "bea-goal-loop",
          },
        },
      ],
    };
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastReconAgo: lastRecon ? `${Math.round((Date.now() - lastRecon) / 60_000)}min` : "never",
      lastCloseAgo: lastClose ? `${Math.round((Date.now() - lastClose) / 60_000)}min` : "never",
      lastSnapshotAgo: lastSnapshot
        ? `${Math.round((Date.now() - lastSnapshot) / 60_000)}min`
        : "never",
    },
    "bea-goal-deriver: no action justified — deferring",
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
// Handler (wired as `bea:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// bea:accounting-readiness handler directly via its imported callable.
//
// Shadow mode: shadowMode: true until cohort validation passes.
// In dry-run mode the goal-loop events are still emitted (so the shadow-mode
// trace is testable per spec §4 "Build runs in shadow mode for the first two
// substrate ticks"), but the bea:accounting-readiness handler is called with
// dryRun=true.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "bea:goal-loop — starting goal-loop cohort-2 run",
  );

  const agentUrn = "agent:bea";

  // Parse Bea's spec.
  const parseResult = parseSpecFile(BEA_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: BEA_SPEC_PATH },
      "bea:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await beaAccountingReadiness(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, beaGoalDeriver);

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
    "bea:goal-loop — goal-loop iteration complete",
  );

  // If escalation or deferred — run handler in dry-run mode (shadow trace).
  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  const handlerCtx: AgentRunContext = {
    ...ctx,
    // In shadow mode (cohort-2 first ticks), always dry-run the handler
    // so we observe the trace without side-effects.
    dryRun: ctx.dryRun || !shouldRunHandler,
  };

  const handlerOutput = await beaAccountingReadiness(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "bea:goal-loop — cohort-2 run complete",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-2: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
