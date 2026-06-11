// runtime/agents/tomas-goal-loop.ts
//
// Tomas (Operations & Payments Engineer) goal-loop — cohort-3.
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Tomas is wired into the
// goal-loop substrate. This run-handler is the integration point that:
//   1. Materialises a WorldStateSnapshot for agent:tomas.
//   2. Runs Tomas's rule-engine goal deriver (no LLM calls — cohort-3
//      rule-engine constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   Rule 1 — If no PaymentSettlementSnapshot event in the last 24h
//     → goal: payments-readiness (priority HIGH).
//   Rule 2 — If an open PaymentException or SettlementFail event exists
//     with no resolution event in 1h
//     → goal: payment-exception-disposition (priority CRITICAL).
//   Rule 3 — If no NostroReconciliationCompleted event in the last 24h
//     → goal: nostro-reconciliation (priority HIGH).
//   Rule 4 — If no SWIFTConnectivityCheck event in the last 7 days
//     → goal: swift-connectivity-validation (priority MEDIUM).
//   Otherwise → defer (null outcome).
//
// The goal candidates use Tomas's §9 decisions-in-scope row labels exactly
// as they appear in Team/Tomas.md (the spec's closed-set per T-NEW).
// Because the four rule goals map to operational inactivity triggers rather
// than one-to-one §9 decision rows, they are validated against the closed-set
// with a soft warn (not hard-block) so the build-phase rule can fire even as
// the §9 table is refined — consistent with the coverage-gap tolerance in
// _step-id-convention.md §5.
//
// Procedure citations: Tomas owns Procedures/by-policy/correspondent-cut-off.md (§13
// "planned"). Since these files do not yet have step anchors (pre-backfill
// coverage-gap per _step-id-convention.md §5), we use the coverage-gap form:
// `stepId: "samos-cut-off:step-1"` as a placeholder. The recon pipeline warns
// (not fails) for missing step IDs per the build-phase tolerance.
//
// Shadow mode: shadowMode: true for cohort-3 until cohort validation passes
// (per spec §4 "Build runs in shadow mode for the first two substrate ticks").
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect) — wiring.
//         Tomas (Operations & Payments Engineer) — goal-deriver rules.

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
// Import the underlying payments-readiness handler directly to avoid the
// circular dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import tomasPaymentsReadiness from "./tomas-payments-readiness";

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Tomas
// ---------------------------------------------------------------------------

const TOMAS_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Tomas.md",
);

// Procedure path for Tomas's primary owned procedure (§13).
const TOMAS_PROCEDURE_PATH = "Procedures/by-policy/correspondent-cut-off.md";
// Coverage-gap step-ID form per _step-id-convention.md §5.
const TOMAS_PROCEDURE_STEP_ID = "correspondent-cut-off:step-1";

// Rule 1 goal: payments-readiness — triggered when no PaymentSettlementSnapshot in 24h.
// Maps to Tomas's §9 row "Reconciliation-break disposition (auto-match / case open)" as
// the closest §9 equivalent for a daily payments-readiness check.
const PAYMENTS_READINESS_GOAL =
  "Reconciliation-break disposition (auto-match / case open)" as const;

// Rule 2 goal: payment-exception-disposition — triggered on open PaymentException or
// SettlementFail with no resolution within 1h.
// Maps to Tomas's §9 row "Message-retry strategy on transient scheme failure" as the
// closest §9 equivalent for exception disposition in the build phase.
const PAYMENT_EXCEPTION_GOAL = "Message-retry strategy on transient scheme failure" as const;

// Rule 3 goal: nostro-reconciliation — triggered when no NostroReconciliationCompleted in 24h.
// Maps to Tomas's §9 row "Nostro-management decision within standing limits".
const NOSTRO_RECONCILIATION_GOAL = "Nostro-management decision within standing limits" as const;

// Rule 4 goal: swift-connectivity-validation — triggered when no SWIFTConnectivityCheck in 7d.
// Maps to Tomas's §9 row "Scheme-connectivity change (within established invariants)" as the
// closest §9 equivalent for periodic connectivity validation.
const SWIFT_CONNECTIVITY_GOAL =
  "Scheme-connectivity change (within established invariants)" as const;

// ---------------------------------------------------------------------------
// Event-query helpers
// ---------------------------------------------------------------------------

/**
 * Returns the timestamp of the most recent PaymentSettlementSnapshot event,
 * or undefined if none exists.
 *
 * Rule 1 trigger: if no event in the last 24h → payments-readiness goal (HIGH).
 */
function lastPaymentSettlementSnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "PaymentSettlementSnapshot" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns the timestamp of the oldest open PaymentException or SettlementFail
 * event that has no paired resolution within the threshold window, or undefined
 * if no such open exception exists.
 *
 * Rule 2 trigger: open exception with no resolution event in 1h → goal CRITICAL.
 *
 * Build-phase note: PaymentExceptionResolved and SettlementFailResolved are not
 * yet registered event types (payments-events schema planned per §12). We detect
 * open exceptions by checking whether any PaymentException or SettlementFail event
 * was emitted more than one hour ago — i.e. the resolution window has elapsed.
 */
function oldestUnresolvedExceptionMs(): number | undefined {
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const cutoff = Date.now() - ONE_HOUR_MS;

  let oldest: number | undefined;
  for (const e of eventStore.replay({ type: "PaymentException" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && t < cutoff) {
      if (oldest === undefined || t < oldest) oldest = t;
    }
  }
  for (const e of eventStore.replay({ type: "SettlementFail" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && t < cutoff) {
      if (oldest === undefined || t < oldest) oldest = t;
    }
  }
  return oldest;
}

/**
 * Returns the timestamp of the most recent NostroReconciliationCompleted event,
 * or undefined if none exists.
 *
 * Rule 3 trigger: if no event in the last 24h → nostro-reconciliation goal (HIGH).
 */
function lastNostroReconciliationCompletedMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "NostroReconciliationCompleted" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns the timestamp of the most recent SWIFTConnectivityCheck event,
 * or undefined if none exists.
 *
 * Rule 4 trigger: if no event in the last 7 days → swift-connectivity-validation goal (MEDIUM).
 */
function lastSwiftConnectivityCheckMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "SWIFTConnectivityCheck" })) {
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

export const tomasGoalDeriver: GoalDeriver = async (
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
    "tomas-goal-deriver: evaluating candidates",
  );

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const specHash = spec.specHash;

  // Build procedure citations — use coverage-gap form per §3.4 contract.
  const procedureEntry = spec.procedureSteps.find((s) => s.procedurePath === TOMAS_PROCEDURE_PATH);
  const stepId =
    procedureEntry && procedureEntry.stepIds.length > 0
      ? (procedureEntry.stepIds[0] ?? TOMAS_PROCEDURE_STEP_ID)
      : TOMAS_PROCEDURE_STEP_ID;

  // Helper: validate goal is in spec closed-set before returning.
  // Uses soft-warn (not hard-block) per build-phase coverage-gap tolerance.
  const validateGoal = (goal: string): boolean => {
    if (!spec.decisionsInScope.includes(goal)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal,
          closedSet: spec.decisionsInScope,
        },
        "tomas-goal-deriver: goal not in closed-set; deferring",
      );
      return false;
    }
    return true;
  };

  // ---------------------------------------------------------------------------
  // Rule 2 (CRITICAL priority): open PaymentException or SettlementFail with
  // no resolution in 1h. Evaluated first — highest priority wins.
  // ---------------------------------------------------------------------------
  const oldestException = oldestUnresolvedExceptionMs();

  if (oldestException !== undefined) {
    if (!validateGoal(PAYMENT_EXCEPTION_GOAL)) {
      // Soft-warn only — do not block; fall through to lower-priority rules.
    } else {
      return {
        kind: "decision",
        chosen: PAYMENT_EXCEPTION_GOAL,
        rationale: `Open PaymentException or SettlementFail event detected with no resolution event in 1h (oldest unresolved: ${new Date(oldestException).toISOString()}). Tomas's §9 mandate (Message-retry strategy on transient scheme failure) requires disposition within standing exception thresholds. CRITICAL priority per Rule 2 of the goal-loop deriver. Selecting payment-exception-disposition goal to trigger the tomas:payments-readiness handler.`,
        mandateCitations: [
          {
            section: "9-decisions-in-scope",
            rowKey: PAYMENT_EXCEPTION_GOAL,
            specHash,
          },
        ],
        procedureCitations: [
          {
            procedurePath: TOMAS_PROCEDURE_PATH,
            stepId,
            procedureHash: specHash,
          },
        ],
        plannedEvents: [
          {
            type: "PaymentRetried",
            payloadPreview: {
              agentUrn: args.agent.urn,
              trigger: "tomas-goal-loop",
              oldestExceptionAt: new Date(oldestException).toISOString(),
            },
          },
        ],
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 1 (HIGH priority): no PaymentSettlementSnapshot in the last 24h.
  // Daily payments-readiness check — Tomas's primary cadence obligation.
  // ---------------------------------------------------------------------------
  const lastSettlementSnapshot = lastPaymentSettlementSnapshotMs();
  const needsPaymentsReadiness =
    lastSettlementSnapshot === undefined ||
    Date.now() - lastSettlementSnapshot > TWENTY_FOUR_HOURS_MS;

  if (needsPaymentsReadiness) {
    if (!validateGoal(PAYMENTS_READINESS_GOAL)) {
      // Soft-warn only — fall through to lower-priority rules.
    } else {
      return {
        kind: "decision",
        chosen: PAYMENTS_READINESS_GOAL,
        rationale: `No PaymentSettlementSnapshot event in the last 24h (last seen: ${lastSettlementSnapshot ? new Date(lastSettlementSnapshot).toISOString() : "never"}). Tomas's §6 cadence requires a daily payments-readiness run (Correspondent bank settlement open-of-day rehearsal at 06:00 SAST; correspondent bank end-of-day cut-off at 16:00 SAST per SARB NPSD). Selecting payments-readiness goal to trigger the tomas:payments-readiness handler.`,
        mandateCitations: [
          {
            section: "9-decisions-in-scope",
            rowKey: PAYMENTS_READINESS_GOAL,
            specHash,
          },
        ],
        procedureCitations: [
          {
            procedurePath: TOMAS_PROCEDURE_PATH,
            stepId,
            procedureHash: specHash,
          },
        ],
        plannedEvents: [
          {
            type: "PaymentsReadinessSnapshot",
            payloadPreview: {
              agentUrn: args.agent.urn,
              trigger: "tomas-goal-loop",
            },
          },
        ],
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 3 (HIGH priority): no NostroReconciliationCompleted in the last 24h.
  // Nostro balances must be reconciled daily; delays create counterparty risk.
  // ---------------------------------------------------------------------------
  const lastNostroRecon = lastNostroReconciliationCompletedMs();
  const needsNostroRecon =
    lastNostroRecon === undefined || Date.now() - lastNostroRecon > TWENTY_FOUR_HOURS_MS;

  if (needsNostroRecon) {
    if (!validateGoal(NOSTRO_RECONCILIATION_GOAL)) {
      // Soft-warn only — fall through to lower-priority rules.
    } else {
      return {
        kind: "decision",
        chosen: NOSTRO_RECONCILIATION_GOAL,
        rationale: `No NostroReconciliationCompleted event in the last 24h (last seen: ${lastNostroRecon ? new Date(lastNostroRecon).toISOString() : "never"}). Tomas's §9 mandate (Nostro-management decision within standing limits) requires daily nostro reconciliation to detect balance breaks before the next settlement window. Selecting nostro-reconciliation goal to trigger the tomas:payments-readiness handler.`,
        mandateCitations: [
          {
            section: "9-decisions-in-scope",
            rowKey: NOSTRO_RECONCILIATION_GOAL,
            specHash,
          },
        ],
        procedureCitations: [
          {
            procedurePath: TOMAS_PROCEDURE_PATH,
            stepId,
            procedureHash: specHash,
          },
        ],
        plannedEvents: [
          {
            type: "NostroReconciliationCompleted",
            payloadPreview: {
              agentUrn: args.agent.urn,
              trigger: "tomas-goal-loop",
            },
          },
        ],
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 4 (MEDIUM priority): no SWIFTConnectivityCheck in the last 7 days.
  // Weekly SWIFT connectivity health check (Monday 05:00 UTC per §6 cadence).
  // ---------------------------------------------------------------------------
  const lastSwiftCheck = lastSwiftConnectivityCheckMs();
  const needsSwiftValidation =
    lastSwiftCheck === undefined || Date.now() - lastSwiftCheck > SEVEN_DAYS_MS;

  if (needsSwiftValidation) {
    if (!validateGoal(SWIFT_CONNECTIVITY_GOAL)) {
      // Soft-warn only — fall through to deferred.
    } else {
      return {
        kind: "decision",
        chosen: SWIFT_CONNECTIVITY_GOAL,
        rationale: `No SWIFTConnectivityCheck event in the last 7 days (last seen: ${lastSwiftCheck ? new Date(lastSwiftCheck).toISOString() : "never"}). Tomas's §6 cadence requires weekly SWIFT connectivity health (Monday 05:00 UTC). Build-phase synthetic SWIFT generators require periodic validation to ensure the MT/MX envelope shapes match the current scheme version. Selecting swift-connectivity-validation goal to trigger the tomas:payments-readiness handler.`,
        mandateCitations: [
          {
            section: "9-decisions-in-scope",
            rowKey: SWIFT_CONNECTIVITY_GOAL,
            specHash,
          },
        ],
        procedureCitations: [
          {
            procedurePath: TOMAS_PROCEDURE_PATH,
            stepId,
            procedureHash: specHash,
          },
        ],
        plannedEvents: [
          {
            type: "SWIFTConnectivityCheck",
            payloadPreview: {
              agentUrn: args.agent.urn,
              trigger: "tomas-goal-loop",
            },
          },
        ],
      };
    }
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastSettlementSnapshotAgo: lastSettlementSnapshot
        ? `${Math.round((Date.now() - lastSettlementSnapshot) / 60_000)}min`
        : "never",
      oldestException: oldestException ? new Date(oldestException).toISOString() : "none",
      lastNostroReconAgo: lastNostroRecon
        ? `${Math.round((Date.now() - lastNostroRecon) / 60_000)}min`
        : "never",
      lastSwiftCheckAgo: lastSwiftCheck
        ? `${Math.round((Date.now() - lastSwiftCheck) / 60_000)}min`
        : "never",
    },
    "tomas-goal-deriver: no action justified — deferring",
  );
  return null;
};

// ---------------------------------------------------------------------------
// Brief-bound run-lifecycle dispatch config (shared helper — see
// goal-loop-brief-dispatch.ts). Authority:
// D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION (PR #1182); extended to all
// goal-loops per D-QUEUE-CLOSEOUT-2026-06-10.
// ---------------------------------------------------------------------------
const TOMAS_BRIEF_DISPATCH: GoalLoopBriefDispatchConfig = {
  agentSlug: "tomas",
  selfExecutablePattern: /payments[\s-]?readiness/i,
  deliveredClassLabel: "payments-readiness attestation",
  runHandler: tomasPaymentsReadiness,
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
// Handler (wired as `tomas:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// tomas:payments-readiness handler directly via its imported callable.
//
// Shadow mode: shadowMode: true for cohort-3 first ticks.
// In dry-run mode the goal-loop events are still emitted (so the shadow-mode
// trace is testable per spec §4 "Build runs in shadow mode for the first two
// substrate ticks"), but the tomas:payments-readiness handler is called with
// dryRun=true.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "tomas:goal-loop — starting goal-loop cohort-3 run",
  );

  const agentUrn = "agent:tomas";

  // Parse Tomas's spec.
  const parseResult = parseSpecFile(TOMAS_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: TOMAS_SPEC_PATH },
      "tomas:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await tomasPaymentsReadiness(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, tomasGoalDeriver);

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
    "tomas:goal-loop — goal-loop iteration complete",
  );

  // If escalation or deferred — run handler in dry-run mode (shadow trace).
  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  // Brief-bound dispatch path (D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION,
  // extended per D-QUEUE-CLOSEOUT-2026-06-10): when the loop selected a
  // decision and an open brief is addressed to this agent, bind a run to the
  // oldest brief and emit AgentRunStarted{agent-runtime} → AgentRunCompleted
  // so the iteration is visible in the autonomy run-feed and the brief stops
  // being re-selected every tick. Skipped under --dry-run.
  const openBriefs = shouldRunHandler && !ctx.dryRun ? openBriefsListForAgent("tomas") : [];
  const [brief] = openBriefs;
  if (brief) {
    const dispatch = await dispatchBriefBoundRun(
      ctx,
      brief,
      iterationId,
      openBriefs.length - 1,
      TOMAS_BRIEF_DISPATCH,
    );
    logger.info(
      { agent: ctx.agent, iterationId, briefId: brief.briefId, openBriefs: openBriefs.length },
      "tomas:goal-loop — run complete (brief-bound dispatch)",
    );
    return {
      eventsEmitted: dispatch.eventsEmitted + goalEventsEmitted,
      ok: true,
      summary: `goal-loop: iteration=${iterationId} outcome=decision dispatch=${dispatch.summary}`,
    };
  }

  const handlerCtx: AgentRunContext = {
    ...ctx,
    if (shouldRunHandler && !ctx.dryRun) {
    const cadence = await dispatchCadenceRun(ctx, iterationId, TOMAS_BRIEF_DISPATCH);
    logger.info(
      { agent: ctx.agent, iterationId },
      "tomas:goal-loop — cohort-3 run complete (cadence, instrumented)",
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

  const handlerOutput = await tomasPaymentsReadiness(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "tomas:goal-loop — cohort-3 run complete (deferred)",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-3: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
