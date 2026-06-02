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
import type { AgentBriefIssuedPayload } from "../../platform/event-store/event-types/agent";
import type { EventStore } from "../../platform/event-store/store";
import { recordAgentRunCompleted, recordAgentRunStarted } from "../../platform/records/helpers";
import { routeBlockedBrief } from "../../platform/records/brief-router";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import the underlying accounting-readiness handler directly to avoid the
// circular dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import beaAccountingReadiness from "./bea-accounting-readiness";

// Authority cited on the brief-bound run-lifecycle events this loop emits.
const COHORT_2_AUTHORITY = "D-AGENT-AUTONOMY-COHORT-2-PILOT" as const;

// ---------------------------------------------------------------------------
// Single-flight guard
// ---------------------------------------------------------------------------

/**
 * Returns runIds for `AgentRunStarted` events for the given agentId that have
 * no matching `AgentRunCompleted` and whose `startedAt` is less than
 * `maxAgeMs` old. Uses `new Date(payload.startedAt).getTime()` for the age
 * comparison — elapsed-time arithmetic against a stored timestamp, the same
 * pattern as the cadence-floor check in goal-loop.ts. Allowed per the
 * wall-clock exemption for elapsed-ms guards.
 *
 * Authority: D-BEA-GOAL-LOOP-SINGLE-FLIGHT (CEO-approved 2026-05-31).
 */
export function findOpenRunIdsForAgent(
  store: EventStore,
  agentId: string,
  maxAgeMs = 2 * 60 * 60 * 1000,
): string[] {
  const startedRunIds = new Map<string, number>(); // runId → startedAt ms
  for (const e of store.replay({ type: "AgentRunStarted" })) {
    const p = e.payload as Record<string, unknown>;
    const runId = String(p.runId ?? "");
    if (!runId) continue;
    // Match agent by agentId field (if present) or by runId prefix convention.
    // The agent reference in AgentRunStarted is {name, position}, not agentId;
    // we fall back to matching the agentId embedded in the runId string.
    const agentRef = p.agent as Record<string, unknown> | undefined;
    const payloadAgentId = String(agentRef?.agentId ?? "");
    // The dispatch CLI embeds agent:bea in runId prefix; also accept explicit agentId field.
    if (payloadAgentId !== agentId && !runId.includes(agentId.replace("agent:", ""))) continue;
    const startedAt = String(p.startedAt ?? e.as_of);
    const t = new Date(startedAt).getTime();
    if (!Number.isNaN(t)) {
      startedRunIds.set(runId, t);
    }
  }

  const completedRunIds = new Set<string>();
  for (const e of store.replay({ type: "AgentRunCompleted" })) {
    const p = e.payload as Record<string, unknown>;
    const runId = String(p.runId ?? "");
    if (runId) completedRunIds.add(runId);
  }

  const nowMs = Date.now(); // elapsed-time guard: how long ago did the run start?
  const openRunIds: string[] = [];
  for (const [runId, startedAtMs] of startedRunIds) {
    if (completedRunIds.has(runId)) continue;
    if (nowMs - startedAtMs > maxAgeMs) continue; // too old — likely a phantom; skip
    openRunIds.push(runId);
  }
  return openRunIds;
}

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
export function openBriefsListForBea(
  store: EventStore = eventStore,
  minAgeMs = 30 * 60 * 1000,
): AgentBriefIssuedPayload[] {
  const handledBriefIds = new Set<string>();
  for (const e of store.replay({ type: "AgentRunCompleted" })) {
    const id = String((e.payload as Record<string, unknown>).briefId ?? "");
    if (id) handledBriefIds.add(id);
  }
  for (const e of store.replay({ type: "AgentRunStarted" })) {
    const id = String((e.payload as Record<string, unknown>).briefId ?? "");
    if (id) handledBriefIds.add(id);
  }
  const open: Array<{ asOfMs: number; payload: AgentBriefIssuedPayload }> = [];
  for (const e of store.replay({ type: "AgentBriefIssued" })) {
    const p = e.payload as AgentBriefIssuedPayload;
    const briefId = String(p.briefId ?? e.event_id);
    if (
      !String(p.issuedTo?.name ?? "")
        .toLowerCase()
        .includes("bea")
    )
      continue;
    if (handledBriefIds.has(briefId)) continue;
    const t = new Date(e.as_of).getTime();
    if (Number.isNaN(t) || Date.now() - t <= minAgeMs) continue;
    open.push({ asOfMs: t, payload: p });
  }
  // Oldest first — FIFO drain.
  open.sort((a, b) => a.asOfMs - b.asOfMs);
  return open.map((o) => o.payload);
}

/**
 * Count of open (not yet started/completed) briefs addressed to Bea, older than
 * `minAgeMs`. Mirrors Atlas's `openBriefsAddressedToAtlas`: a brief is "handled"
 * once any AgentRunStarted or AgentRunCompleted carries its briefId. Drives the
 * deriver's candidate-0. Authority: D-AGENT-AUTONOMY-COHORT-2-PILOT.
 */
export function openBriefsAddressedToBea(
  store: EventStore = eventStore,
  minAgeMs = 30 * 60 * 1000,
): number {
  return openBriefsListForBea(store, minAgeMs).length;
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

// ---------------------------------------------------------------------------
// Brief-bound dispatch (D-AGENT-AUTONOMY-COHORT-2-PILOT — triage-and-route)
//
// When candidate-0 fires (open briefs addressed to Bea), the loop binds a run
// to the specific oldest brief and emits the dispatch lifecycle so the brief is
// no longer re-picked every tick. The rule engine NEVER fakes delivery:
//
//   - Self-executable (readiness-attestation class): runs the readiness handler
//     live and closes outcome="delivered".
//   - Everything else (code / engineering work the rule engine cannot perform):
//     closes outcome="blocked", surfaces the substrate gap, and routes the brief
//     to the engineering-execution substrate via followOnRoutes. The brief is
//     handed off, not silently dropped — the blocked run + route is the audit
//     trail an executor (Scrooge-coordinated or future LLM substrate) picks up.
// ---------------------------------------------------------------------------

// Emit run-lifecycle events under Bea's parent agent identity (matches the
// dispatch CLI's `agent:${slug}` actor). agent:bea has a published permission
// policy, so the non-privileged AgentRunStarted/Completed types take the
// Option-C allow-by-default path with NO legacy bypass — keeping the F-031
// permission-gate-default recon at zero bypasses. (An unpublished sub-actor
// like agent:bea:goal-loop would instead record a legacy bypass.)
const BEA_GOAL_LOOP_ACTOR = { type: "service", id: "agent:bea" } as const;

/**
 * A brief is self-executable by Bea's wired rule-engine capability only if it
 * explicitly asks for the accounting-readiness attestation AND requires no
 * code-PR output. Deliberately narrow: the only deterministic deliverable Bea's
 * goal-loop owns today is the AccountingReadinessSnapshot. Everything else is
 * routed. (BSS / reconciliation handlers extend this set when wired — §16.)
 */
export function isSelfExecutableByBea(brief: AgentBriefIssuedPayload): boolean {
  const needsCode = brief.expectedOutputs.some((o) => o.kind === "code-pr");
  if (needsCode) return false;
  return /readiness|accounting[\s-]?readiness/i.test(brief.title);
}

/**
 * Bind a run to one open brief and emit AgentRunStarted → AgentRunCompleted.
 * Returns the number of run-lifecycle events emitted plus a summary fragment.
 */
async function dispatchBriefBoundRun(
  ctx: AgentRunContext,
  brief: AgentBriefIssuedPayload,
  iterationId: string,
  remainingOpen: number,
): Promise<{ eventsEmitted: number; summary: string }> {
  const runId = `run:bea:goal-loop:${iterationId}`;
  const agent = brief.issuedTo; // issuedTo IS Bea — keep the ref consistent.

  recordAgentRunStarted(
    {
      runId,
      briefId: brief.briefId,
      agent,
      startedAt: ctx.asOf,
      substrate: "agent-runtime",
      citations: [COHORT_2_AUTHORITY],
      actor: BEA_GOAL_LOOP_ACTOR,
    },
    ctx.asOf,
  );

  let eventsEmitted = 1;

  if (isSelfExecutableByBea(brief)) {
    // Genuinely completable — run the readiness handler live and deliver.
    const handlerOutput = await beaAccountingReadiness({ ...ctx, dryRun: false });
    eventsEmitted += handlerOutput.eventsEmitted;
    recordAgentRunCompleted(
      {
        runId,
        briefId: brief.briefId,
        agent,
        completedAt: ctx.asOf,
        outcome: "delivered",
        deliverableBodies: [
          `Bea goal-loop delivered the accounting-readiness attestation for brief ${brief.briefId} ("${brief.title}"). ${handlerOutput.summary}`,
        ],
        substrateGapsSurfaced: [],
        deliverableCitations: [COHORT_2_AUTHORITY],
        followOnRoutes: [],
        citations: [COHORT_2_AUTHORITY],
        actor: BEA_GOAL_LOOP_ACTOR,
      },
      ctx.asOf,
    );
    eventsEmitted += 1;
    logger.info(
      { briefId: brief.briefId, runId, remainingOpen },
      "bea:goal-loop — brief delivered (readiness-attestation class)",
    );
    return {
      eventsEmitted,
      summary: `brief ${brief.briefId} delivered (readiness); ${remainingOpen} open brief(s) remain`,
    };
  }

  // Not executable by the rule engine — triage, block, and route to the
  // engineering-execution substrate. NEVER faked as delivered.
  const routeKind = brief.expectedOutputs.some((o) => o.kind === "code-pr") ? "code-pr" : "agent";
  const gap = `Bea goal-loop (rule-engine, cohort-2) triaged brief ${brief.briefId} ("${brief.title}") but cannot execute it autonomously — it requires engineering/judgement work outside the rule-engine capability. Routed to the engineering-execution substrate (LLM-backed dispatched run). This is the cohort-2 goal-loop→dispatched-run substrate gap.`;
  const followOnRoutes = [
    {
      kind: routeKind as "code-pr" | "agent",
      target: "engineering-execution-substrate",
      directive: `Execute brief ${brief.briefId}: ${brief.title}${
        brief.workstreamId ? ` (workstream ${brief.workstreamId})` : ""
      }. Triaged and routed by Bea's autonomous goal-loop; requires an engineering-execution run.`,
    },
  ];
  recordAgentRunCompleted(
    {
      runId,
      briefId: brief.briefId,
      agent,
      completedAt: ctx.asOf,
      outcome: "blocked",
      deliverableBodies: [],
      substrateGapsSurfaced: [gap],
      deliverableCitations: [COHORT_2_AUTHORITY],
      followOnRoutes,
      citations: [COHORT_2_AUTHORITY],
      actor: BEA_GOAL_LOOP_ACTOR,
    },
    ctx.asOf,
  );
  eventsEmitted += 1;

  // Auto-issue follow-on briefs for each blocked route so the next executor
  // picks them up on its next tick (D-AGENT-AUTONOMY-COHORT-2-PILOT).
  let followOnBriefsIssued = 0;
  for (const route of followOnRoutes) {
    const routeResult = routeBlockedBrief({
      blockedRunId: runId,
      route,
      parentBriefId: brief.briefId,
      parentBriefTitle: brief.title,
      issuedBy: agent,
      asOf: ctx.asOf,
    });
    if (!routeResult.alreadyExists) {
      followOnBriefsIssued++;
      logger.info(
        { blockedRunId: runId, routeBriefId: routeResult.briefId, routeKind: route.kind },
        "bea:goal-loop — follow-on brief issued for blocked route",
      );
    }
  }
  eventsEmitted += followOnBriefsIssued; // AgentBriefIssued counts as emitted event

  logger.info(
    { briefId: brief.briefId, runId, routeKind, remainingOpen },
    "bea:goal-loop — brief triaged + routed to engineering-execution substrate (blocked, gap surfaced)",
  );
  return {
    eventsEmitted,
    summary: `brief ${brief.briefId} routed→executor (blocked); followOnBriefs=${followOnBriefsIssued}; ${remainingOpen} open brief(s) remain`,
  };
}

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
  // Single-flight guard: abort if a run for agent:bea is already open.
  // Authority: D-BEA-GOAL-LOOP-SINGLE-FLIGHT (CEO-approved 2026-05-31).
  const openRunIds = findOpenRunIdsForAgent(eventStore, "agent:bea");
  if (openRunIds.length > 0) {
    logger.warn(
      { openRunIds },
      "bea:goal-loop — single-flight guard: open run(s) detected, aborting tick",
    );
    return {
      eventsEmitted: 0,
      ok: true,
      summary: `single-flight guard: aborted; open run(s) already exist: ${openRunIds.join(", ")}`,
    };
  }

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

  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  // Brief-bound dispatch path: when the loop selected a decision and there is
  // an open brief addressed to Bea, bind a run to the oldest brief and emit its
  // dispatch lifecycle (triage-and-route) instead of only the cadence
  // attestation. Skipped under --dry-run (no real run-lifecycle side-effects).
  const openBriefs = shouldRunHandler && !ctx.dryRun ? openBriefsListForBea() : [];
  const [brief] = openBriefs;
  if (brief) {
    const dispatch = await dispatchBriefBoundRun(ctx, brief, iterationId, openBriefs.length - 1);
    logger.info(
      { agent: ctx.agent, iterationId, briefId: brief.briefId, openBriefs: openBriefs.length },
      "bea:goal-loop — cohort-2 run complete (brief-bound dispatch)",
    );
    return {
      eventsEmitted: dispatch.eventsEmitted + goalEventsEmitted,
      ok: true,
      summary: `goal-loop cohort-2: iteration=${iterationId} outcome=decision dispatch=${dispatch.summary}`,
    };
  }

  // Cadence path: no open brief — run the readiness attestation live when the
  // loop selected a decision; dry-run only when it deferred or --dry-run was set.
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
    "bea:goal-loop — cohort-2 run complete (cadence)",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-2: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
