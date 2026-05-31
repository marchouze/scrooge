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
//   - Candidate 0 (event-reactive): open unhandled briefs addressed to Bea
//     (>30 min old) → select "Approve a posting rule for an event type"
//     (Bea's broadest in-scope accounting-engineering decision, the analog of
//     Atlas's "platform-design PR" catch-all). Mirrors Atlas's candidate-0a.
//   - Candidate 1 (cadence): no AccountingReadinessSnapshot in the last 24h
//     → select "Approve a posting rule for an event type" (the trial-balance
//     equivalent in build phase; this is the only event the wired
//     bea:accounting-readiness handler actually emits).
//   - Otherwise → defer (null outcome).
//
// 2026-05-31 fix (D-AGENT-AUTONOMY-COHORT-2-PILOT): the prior cascade gated
// candidates 1 & 2 on SubLedgerReconciled / CloseCycleCompleted — events that
// the wired handler (bea:accounting-readiness) NEVER emits. Since neither is
// ever produced, the deriver jammed permanently on candidate 1 ("Sign sub-
// ledger reconciliation"): every tick saw "no recon in 24h", re-selected it,
// the handler emitted only an AccountingReadinessSnapshot, and the loop
// repeated forever — while Bea's real backlog of open briefs went unread.
// The loop is now (a) brief-aware and (b) cadence-gated only on the event its
// handler can actually emit. The SubLedger-reconciliation and close-cycle
// goals return when their handlers exist (§16 substrate gaps).
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
// Live (shadow mode removed 2026-05-31): Bea exited cohort-2 shadow mode after
// validation (spec §4 "first two substrate ticks" — Bea has had 15+). When the
// goal-loop selects a decision the bea:accounting-readiness handler now runs
// live and emits; it is dry-run ONLY when the loop deferred/escalated (no
// decision to execute) or when --dry-run is passed explicitly.
// Authority: D-AGENT-AUTONOMY-COHORT-2-PILOT (CEO-approved 2026-05-30).
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
import type { EventStore } from "../../platform/event-store/store";
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

// §9 row label from Team/Bea.md (closed-set per T-NEW). This is Bea's broadest
// in-scope accounting-engineering decision and the only goal whose planned
// event (AccountingReadinessSnapshot) the wired handler actually emits.
const POSTING_RULE_GOAL = "Approve a posting rule for an event type" as const;

// ---------------------------------------------------------------------------
// Goal-derivation rule engine
// ---------------------------------------------------------------------------

/**
 * Returns the count of open (not yet started/completed) briefs addressed to
 * Bea, older than `minAgeMs` (default 30 min). Mirrors Atlas's
 * `openBriefsAddressedToAtlas`: a brief is "handled" once any AgentRunStarted
 * or AgentRunCompleted carries its briefId. This is the candidate that makes
 * Bea's loop react to her real backlog instead of looping on one cadence goal.
 * Authority: D-AGENT-AUTONOMY-COHORT-2-PILOT.
 */
export function openBriefsAddressedToBea(
  store: EventStore = eventStore,
  minAgeMs = 30 * 60 * 1000,
): number {
  const handledBriefIds = new Set<string>();
  for (const e of store.replay({ type: "AgentRunCompleted" })) {
    const id = String((e.payload as Record<string, unknown>).briefId ?? "");
    if (id) handledBriefIds.add(id);
  }
  for (const e of store.replay({ type: "AgentRunStarted" })) {
    const id = String((e.payload as Record<string, unknown>).briefId ?? "");
    if (id) handledBriefIds.add(id);
  }
  let count = 0;
  for (const e of store.replay({ type: "AgentBriefIssued" })) {
    const p = e.payload as Record<string, unknown>;
    const briefId = String(p.briefId ?? e.event_id);
    const toName = String((p.issuedTo as Record<string, unknown>)?.name ?? "");
    if (!toName.toLowerCase().includes("bea")) continue;
    if (handledBriefIds.has(briefId)) continue;
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && Date.now() - t > minAgeMs) count++;
  }
  return count;
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

  // Build the posting-rule goal outcome — shared by candidates 0 and 1.
  // Both route to the bea:accounting-readiness handler, whose sole emitted
  // event is AccountingReadinessSnapshot (the build-phase trial-balance
  // equivalent). plannedEvents therefore declares exactly that event — the
  // prior mismatch (declaring SubLedgerReconciled / CloseCycleCompleted while
  // the handler emitted only AccountingReadinessSnapshot) was the root of the
  // permanent jam.
  const postingRuleOutcome = (rationale: string): GoalLoopOutcome => ({
    kind: "decision",
    chosen: POSTING_RULE_GOAL,
    rationale,
    mandateCitations: [{ section: "9-decisions-in-scope", rowKey: POSTING_RULE_GOAL, specHash }],
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
        type: "AccountingReadinessSnapshot",
        payloadPreview: { agentUrn: args.agent.urn, trigger: "bea-goal-loop" },
      },
    ],
  });

  // Candidate 0 (event-reactive): open unhandled briefs addressed to Bea.
  // Checked before the cadence candidate so Bea reacts to her real backlog.
  const pendingBriefCount = openBriefsAddressedToBea();
  if (pendingBriefCount > 0) {
    if (!validateGoal(POSTING_RULE_GOAL)) return null;
    logger.info(
      { agentUrn: args.agent.urn, pendingBriefCount },
      "bea-goal-deriver: candidate-0 — open unhandled briefs addressed to Bea — selecting posting-rule goal",
    );
    return postingRuleOutcome(
      `Candidate 0: ${pendingBriefCount} open brief(s) addressed to Bea (older than 30min) not yet started or completed. "${POSTING_RULE_GOAL}" is Bea's broadest in-scope accounting-engineering decision covering open posting / classification / projection work. Picking up pending briefs.`,
    );
  }

  // Candidate 1 (cadence): if no AccountingReadinessSnapshot in last 24h,
  // select posting-rule goal. This is the build-phase proxy for "Generate
  // trial balance snapshot" and the only event bea:accounting-readiness emits.
  const lastSnapshot = lastAccountingReadinessSnapshotMs();
  const needsSnapshot =
    lastSnapshot === undefined || Date.now() - lastSnapshot > TWENTY_FOUR_HOURS_MS;

  if (needsSnapshot) {
    if (!validateGoal(POSTING_RULE_GOAL)) return null;
    return postingRuleOutcome(
      `Candidate 1 (cadence): no AccountingReadinessSnapshot in the last 24h (last seen: ${lastSnapshot ? new Date(lastSnapshot).toISOString() : "never"}). In build phase the AccountingReadinessSnapshot is the trial-balance equivalent: it validates the posting-rule substrate and surfaces accounting cycle gaps. Selecting posting-rule goal to trigger the bea:accounting-readiness handler and produce the daily readiness attestation.`,
    );
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      pendingBriefCount,
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
// Live: when the goal-loop selects a decision, the bea:accounting-readiness
// handler runs for real and emits. The handler is dry-run only when the loop
// deferred/escalated (no decision to execute) or when ctx.dryRun is set
// (--dry-run flag). Goal-loop events (AgentGoalEvaluated / AgentGoalSelected /
// AgentGoalDeferred) are always emitted regardless.
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

  // Run the handler live when the loop selected a decision; dry-run only when
  // it deferred/escalated (nothing to execute) or --dry-run was passed.
  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  const handlerCtx: AgentRunContext = {
    ...ctx,
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
