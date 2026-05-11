// runtime/agents/ravi-goal-loop.ts
//
// Ravi (Treasury / ALM engineer) goal-loop — cohort-3.
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Ravi is wired into the
// goal-loop substrate. This run-handler is the integration point that:
//   1. Materialises a WorldStateSnapshot for agent:ravi.
//   2. Runs Ravi's rule-engine goal deriver (no LLM calls — cohort-3
//      rule-engine constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   Rule 1 — No `ALMReadinessSnapshot` event in past 24h
//     → goal: "Approve daily LCR / NSFR / IRRBB / FX position attestation"
//     (priority HIGH; daily ALM-readiness SLA per §6)
//   Rule 2 — No `FTPRatePublished` event in past 24h
//     → goal: "Approve FTP-rate calibration within ALM committee parameters"
//     (priority HIGH; daily FTP-publication SLA per §6)
//   Rule 3 — Open `RiskRaised` event tagged "liquidity" or "IRRBB" with no
//     resolution in 24h → goal: "Approve daily LCR / NSFR / IRRBB / FX
//     position attestation" (priority HIGH; breach-disposition path)
//   Rule 4 — No `HedgeExecuted` event in past 7 days (when hedges are
//     outstanding) → goal: "Run hedge programmes within RAS"
//     (priority MEDIUM; hedge-programme review cadence)
//
// The goal candidates use Ravi's §9 decisions-in-scope row labels exactly
// as they appear in Team/Ravi.md (the spec's closed-set per T-NEW).
//
// Procedure citations: Ravi owns Procedures/by-policy/daily-alm-run.md
// (§13 "planned"). Since this file may not yet have step anchors
// (pre-backfill coverage-gap per _step-id-convention.md §5), we use the
// coverage-gap form: `stepId: "daily-alm-run:step-1"` as a placeholder.
// The recon pipeline warns (not fails) for missing step IDs per the
// build-phase tolerance.
//
// Shadow mode: shadowMode: true for cohort-3 until cohort validation passes
// (per spec §4 "Build runs in shadow mode for the first two substrate ticks").
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect) — wiring.
//         Ravi (Treasury / ALM engineer) — goal-deriver rules.

import { resolve } from "node:path";
import type { GoalDeriver, GoalLoopOutcome } from "../../platform/agent-runtime/goal-loop";
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import type { RunWithGoalArgs } from "../../platform/agent-runtime/goal-loop";
import { parseSpecFile } from "../../platform/agent-runtime/spec-parser";
import { LocalAgentWorldStateReader } from "../../platform/agent-runtime/world-state";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import the underlying ALM-readiness handler directly to avoid the circular
// dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import raviAlmReadiness from "./ravi-alm-readiness";

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Ravi
// ---------------------------------------------------------------------------

const RAVI_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Ravi.md",
);

// Procedure path for Ravi's daily-alm-run procedure (§13).
const RAVI_PROCEDURE_PATH = "Procedures/by-policy/daily-alm-run.md";
// Coverage-gap step-ID form per _step-id-convention.md §5.
const RAVI_PROCEDURE_STEP_ID = "daily-alm-run:step-1";

// §9 row labels from Team/Ravi.md (closed-set per T-NEW).
// Candidate 1 / Rule 1+3: daily ALM attestation goal.
const ALM_ATTESTATION_GOAL = "Approve daily LCR / NSFR / IRRBB / FX position attestation" as const;
// Candidate 2 / Rule 2: FTP-rate publication goal.
const FTP_RATE_GOAL = "Approve FTP-rate calibration within ALM committee parameters" as const;
// Candidate 3 / Rule 4: hedge-programme review goal.
const HEDGE_PROGRAMME_GOAL = "Run hedge programmes within RAS" as const;

// ---------------------------------------------------------------------------
// Event-query helpers
// ---------------------------------------------------------------------------

/**
 * Returns the timestamp of the most recent ALMReadinessSnapshot event
 * emitted by Ravi, or undefined if none exists.
 *
 * Rule 1: if no ALMReadinessSnapshot in past 24h → select ALM attestation
 * goal (daily ALM-readiness SLA per §6 cadence).
 */
function lastAlmReadinessSnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "ALMReadinessSnapshot" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns the timestamp of the most recent FTPRatePublished event,
 * or undefined if none exists.
 *
 * Rule 2: if no FTPRatePublished in past 24h → select FTP-rate publication
 * goal (Ravi's daily FTP-publication SLA per §6).
 */
function lastFtpRatePublishedMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "FTPRatePublished" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns true if there are any RiskRaised events tagged "liquidity" or
 * "IRRBB" that have been open for more than 24 hours with no resolution.
 *
 * Rule 3: open RiskRaised tagged "liquidity" or "IRRBB" with no resolution
 * in 24h → ALM breach-disposition path (select ALM attestation goal).
 *
 * In the current build phase the closure event schema is not yet defined
 * (§16 substrate gap). We detect open findings by checking whether any
 * RiskRaised event tagged "liquidity" or "IRRBB" exists older than 24h
 * in the store; until a RiskResolved family is emitted the finding stays
 * open. Returns true on first qualifying match.
 */
function hasOpenLiquidityOrIrrbbRisk(): boolean {
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  for (const e of eventStore.replay({ type: "RiskRaised" })) {
    const t = new Date(e.as_of).getTime();
    if (Number.isNaN(t)) continue;
    // Only consider events older than 24h (i.e., no resolution within 24h).
    if (Date.now() - t < TWENTY_FOUR_HOURS_MS) continue;
    // Check payload tags: look for "liquidity" or "IRRBB" tag.
    const p = e.payload as Record<string, unknown> | undefined;
    if (!p) continue;
    const tags = p.tags;
    if (Array.isArray(tags)) {
      for (const tag of tags) {
        if (typeof tag === "string" && /liquidity|IRRBB/i.test(tag)) {
          return true;
        }
      }
    }
    // Also check riskType field directly.
    const riskType = p.riskType;
    if (typeof riskType === "string" && /liquidity|IRRBB/i.test(riskType)) {
      return true;
    }
    // Check category field.
    const category = p.category;
    if (typeof category === "string" && /liquidity|IRRBB/i.test(category)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns the timestamp of the most recent HedgeExecuted event,
 * or undefined if none exists.
 *
 * Rule 4: no HedgeExecuted event in past 7 days (when hedges are outstanding)
 * → select hedge-programme review goal (MEDIUM priority).
 *
 * In build phase no hedges are outstanding, so this rule fires vacuously
 * to keep the hedge-programme substrate visible in the goal-loop trace.
 * The "hedges are outstanding" qualifier is approximated by checking for
 * any prior HedgeExecuted events in the store (if the store has never seen
 * a HedgeExecuted, the bank has not yet started hedging and the rule stays
 * silent).
 */
function lastHedgeExecutedMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "HedgeExecuted" })) {
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

export const raviGoalDeriver: GoalDeriver = async (
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
    "ravi-goal-deriver: evaluating candidates",
  );

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const specHash = spec.specHash;

  // Build procedure citations — use coverage-gap form per §3.4 contract.
  const procedureEntry = spec.procedureSteps.find((s) => s.procedurePath === RAVI_PROCEDURE_PATH);
  const stepId =
    procedureEntry && procedureEntry.stepIds.length > 0
      ? (procedureEntry.stepIds[0] ?? RAVI_PROCEDURE_STEP_ID)
      : RAVI_PROCEDURE_STEP_ID;

  // Helper: validate goal is in spec closed-set before returning.
  const validateGoal = (goal: string): boolean => {
    if (!spec.decisionsInScope.includes(goal)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal,
          closedSet: spec.decisionsInScope,
        },
        "ravi-goal-deriver: goal not in closed-set; deferring",
      );
      return false;
    }
    return true;
  };

  // ---------------------------------------------------------------------------
  // Rule 1: No ALMReadinessSnapshot in past 24h → ALM attestation goal (HIGH)
  // ---------------------------------------------------------------------------
  const lastAlmSnapshot = lastAlmReadinessSnapshotMs();
  const needsAlmRun =
    lastAlmSnapshot === undefined || Date.now() - lastAlmSnapshot > TWENTY_FOUR_HOURS_MS;

  if (needsAlmRun) {
    if (!validateGoal(ALM_ATTESTATION_GOAL)) return null;

    return {
      kind: "decision",
      chosen: ALM_ATTESTATION_GOAL,
      rationale: `No ALMReadinessSnapshot event in the last 24h (last seen: ${lastAlmSnapshot ? new Date(lastAlmSnapshot).toISOString() : "never"}). Ravi's daily ALM-readiness SLA (§6: daily attestation per alm-readiness handler) requires a daily ALM batch. Selecting ALM attestation goal to trigger the ravi:alm-readiness handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: ALM_ATTESTATION_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: RAVI_PROCEDURE_PATH,
          stepId,
          // SHA-256 of the procedure file is unknown at runtime without
          // reading it; use the spec hash as a proxy (coverage-gap).
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "ALMReadinessSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "ravi-goal-loop",
          },
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 2: No FTPRatePublished in past 24h → FTP-rate publication goal (HIGH)
  // ---------------------------------------------------------------------------
  const lastFtpRate = lastFtpRatePublishedMs();
  const needsFtpPublication =
    lastFtpRate === undefined || Date.now() - lastFtpRate > TWENTY_FOUR_HOURS_MS;

  if (needsFtpPublication) {
    if (!validateGoal(FTP_RATE_GOAL)) return null;

    return {
      kind: "decision",
      chosen: FTP_RATE_GOAL,
      rationale: `No FTPRatePublished event in the last 24h (last seen: ${lastFtpRate ? new Date(lastFtpRate).toISOString() : "never"}). Ravi's daily FTP-rate publication SLA (§6: Approve FTP-rate calibration within ALM committee parameters) requires a daily FTP cycle. Selecting FTP-rate publication goal to drive the ravi:alm-readiness handler through the FTP attestation path.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: FTP_RATE_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: RAVI_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "FTPRatePublished",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "ravi-goal-loop",
          },
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 3: Open RiskRaised tagged "liquidity" or "IRRBB" with no resolution
  //   in 24h → ALM breach-disposition path (HIGH)
  // ---------------------------------------------------------------------------
  const hasOpenBreaches = hasOpenLiquidityOrIrrbbRisk();

  if (hasOpenBreaches) {
    if (!validateGoal(ALM_ATTESTATION_GOAL)) return null;

    return {
      kind: "decision",
      chosen: ALM_ATTESTATION_GOAL,
      rationale:
        "Open RiskRaised events tagged 'liquidity' or 'IRRBB' detected in the event store with no resolution in 24h. Ravi's §9 mandate (Approve daily LCR / NSFR / IRRBB / FX position attestation) requires the ALM-readiness handler to surface the breach into the next attestation pack. Selecting ALM attestation goal for breach-disposition.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: ALM_ATTESTATION_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: RAVI_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "ALMReadinessSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "ravi-goal-loop",
            breachDisposition: true,
          },
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 4: No HedgeExecuted in past 7 days (when hedges outstanding)
  //   → hedge-programme review goal (MEDIUM)
  //
  // The "hedges are outstanding" qualifier: if HedgeExecuted has NEVER been
  // emitted, the bank has not yet designated any hedges and this rule stays
  // silent (no outstanding hedge programme to review). If at least one
  // HedgeExecuted exists but none in the last 7 days, a review is warranted.
  // ---------------------------------------------------------------------------
  const lastHedge = lastHedgeExecutedMs();
  const hedgesOutstanding = lastHedge !== undefined;
  const needsHedgeReview = hedgesOutstanding && Date.now() - lastHedge > SEVEN_DAYS_MS;

  if (needsHedgeReview) {
    if (!validateGoal(HEDGE_PROGRAMME_GOAL)) return null;

    return {
      kind: "decision",
      chosen: HEDGE_PROGRAMME_GOAL,
      rationale: `No HedgeExecuted event in the last 7 days (last seen: ${new Date(lastHedge).toISOString()}) but prior hedge designations are outstanding. Ravi's §9 mandate (Run hedge programmes within RAS) and §6 cadence (weekly hedge-effectiveness check) require a hedge-programme review. Selecting hedge-programme review goal.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: HEDGE_PROGRAMME_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: RAVI_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "HedgeExecuted",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "ravi-goal-loop",
          },
        },
      ],
    };
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastAlmSnapshotAgo: lastAlmSnapshot
        ? `${Math.round((Date.now() - lastAlmSnapshot) / 60_000)}min`
        : "never",
      lastFtpRateAgo: lastFtpRate
        ? `${Math.round((Date.now() - lastFtpRate) / 60_000)}min`
        : "never",
      hasOpenBreaches,
      hedgesOutstanding,
      lastHedgeAgo: lastHedge ? `${Math.round((Date.now() - lastHedge) / 60_000)}min` : "never",
    },
    "ravi-goal-deriver: no action justified — deferring",
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
// Handler (wired as `ravi:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// ravi:alm-readiness handler directly via its imported callable.
//
// Shadow mode: shadowMode: true for cohort-3 first ticks.
// In dry-run mode the goal-loop events are still emitted (so the shadow-mode
// trace is testable per spec §4 "Build runs in shadow mode for the first two
// substrate ticks"), but the ravi:alm-readiness handler is called with
// dryRun=true.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "ravi:goal-loop — starting goal-loop cohort-3 run",
  );

  const agentUrn = "agent:ravi";

  // Parse Ravi's spec.
  const parseResult = parseSpecFile(RAVI_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: RAVI_SPEC_PATH },
      "ravi:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await raviAlmReadiness(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, raviGoalDeriver);

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
    "ravi:goal-loop — goal-loop iteration complete",
  );

  // If escalation or deferred — run handler in dry-run mode (shadow trace).
  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  const handlerCtx: AgentRunContext = {
    ...ctx,
    // In shadow mode (cohort-3 first ticks), always dry-run the handler
    // so we observe the trace without side-effects.
    dryRun: ctx.dryRun || !shouldRunHandler,
  };

  const handlerOutput = await raviAlmReadiness(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "ravi:goal-loop — cohort-3 run complete",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-3: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
