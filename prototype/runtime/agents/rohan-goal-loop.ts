// runtime/agents/rohan-goal-loop.ts
//
// Rohan (Risk engineer) goal-loop — autonomous (risk/treasury pilot).
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Rohan is wired into the
// goal-loop substrate. This run-handler is the integration point that:
//   1. Materialises a WorldStateSnapshot for agent:rohan.
//   2. Runs Rohan's rule-engine goal deriver (no LLM calls — rule-engine
//      constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   - Candidate 0 (event-reactive): open unhandled briefs addressed to Rohan
//     (>30 min old) → select "Sign daily limit-utilisation" (Rohan's broadest
//     in-scope risk-engineering decision, the analog of Bea's posting-rule
//     catch-all). Mirrors Bea's candidate-0 so Rohan reacts to his real
//     backlog instead of looping on one cadence goal.
//   - Candidate 1 (cadence): no RiskRunCompleted event in the last 24 hours
//     → select "Sign daily limit-utilisation".
//   - Candidate 2: open RiskRaised events not yet resolved
//     → select "Raise a RiskRaised event on a detected risk".
//   - Candidate 3: no ICAAPSubmissionDrafted in the last 7 days
//     → select "Sign RWA / RWA-attribution submission to Camille"
//       (closest §9 equivalent to "Generate ICAAP snapshot" in build phase;
//       the ICAAP substrate is a paper exercise during build — per §16
//       "ICAAP / ILAAP run as paper exercise during build-only").
//   - Otherwise → defer (null outcome).
//
// Three-way coherence (the Bea unjam): every candidate routes to the wired
// rohan:risk-run handler, whose SOLE emitted event is RiskRunCompleted. Each
// candidate therefore declares plannedEvents: [RiskRunCompleted] — keeping its
// distinct §9 goal label but the event the handler can actually emit. The
// prior cascade declared RiskRaised (candidate 2) and ICAAPSubmissionDrafted
// (candidate 3) — events rohan:risk-run never emits — which would jam the loop
// exactly as Bea's old SubLedgerReconciled / CloseCycleCompleted did. Those
// real events return when a handler that emits them is wired (§16 gaps).
//
// The goal candidates use Rohan's §9 decisions-in-scope row labels exactly
// as they appear in Team/Rohan.md (the spec's closed-set per T-NEW).
//
// Procedure citations: Rohan owns Procedures/by-policy/daily-risk-run.md
// (§13 "planned"). Since this file may not yet have step anchors
// (pre-backfill coverage-gap per _step-id-convention.md §5), we use the
// coverage-gap form: `stepId: "daily-risk-run:step-1"` as a placeholder.
// The recon pipeline warns (not fails) for missing step IDs per the
// build-phase tolerance.
//
// Live: when the goal-loop selects a decision the rohan:risk-run handler runs
// for real and emits; it is dry-run ONLY when the loop deferred/escalated (no
// decision to execute) or when --dry-run is passed explicitly.
// Authority: D-AGENT-AUTONOMY-RISK-TREASURY-PILOT.
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect) — wiring.
//         Rohan (Risk engineer) — goal-deriver rules.

import { resolve } from "node:path";
import type { GoalDeriver, GoalLoopOutcome } from "../../platform/agent-runtime/goal-loop";
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import type { RunWithGoalArgs } from "../../platform/agent-runtime/goal-loop";
import { parseSpecFile } from "../../platform/agent-runtime/spec-parser";
import { LocalAgentWorldStateReader } from "../../platform/agent-runtime/world-state";
import { eventStore, logger } from "../../platform/composition";
import type { AgentBriefIssuedPayload } from "../../platform/event-store/event-types/agent";
import { RISK_CLOSURE_EVENT_TYPES } from "../../platform/event-store/event-types/risk";
import type { EventStore } from "../../platform/event-store/store";
import type { AgentRunContext, AgentRunOutput } from "../types";
import {
  type GoalLoopBriefDispatchConfig,
  dispatchBriefBoundRun,
  isSelfExecutableBrief,
  openBriefsListForAgent,
} from "./goal-loop-brief-dispatch";
// Import the underlying risk-run handler directly to avoid the circular
// dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import rohanRiskRun from "./rohan-risk-run";

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Rohan
// ---------------------------------------------------------------------------

const ROHAN_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Rohan.md",
);

// Procedure path for Rohan's daily-risk-run procedure (§13).
const ROHAN_PROCEDURE_PATH = "Procedures/by-policy/daily-risk-run.md";
// Coverage-gap step-ID form per _step-id-convention.md §5.
const ROHAN_PROCEDURE_STEP_ID = "daily-risk-run:step-1";

// §9 row labels from Team/Rohan.md (closed-set per T-NEW).
// Candidate 1: daily risk-run goal.
const DAILY_RISK_RUN_GOAL = "Sign daily limit-utilisation" as const;
// Candidate 2: open risk-findings goal. Must match Team/Rohan.md §9 row 7
// VERBATIM (backticks included) or the closed-set (T-NEW) check fails and the
// candidate silently defers — which also short-circuits candidate 3.
const RISK_FINDINGS_GOAL = "Raise a `RiskRaised` event on a detected risk" as const;
// Candidate 3: ICAAP snapshot goal — closest §9 equivalent in build phase
// (ICAAP as paper exercise per §16; RWA-attribution submission gates the
// capital-readiness attestation that is the build-phase ICAAP proxy).
const ICAAP_SNAPSHOT_GOAL = "Sign RWA / RWA-attribution submission to Camille" as const;

// ---------------------------------------------------------------------------
// Event-query helpers
// ---------------------------------------------------------------------------

function lastRiskRunCompletedMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "RiskRunCompleted" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns true if there are any GENUINE (production-provenance) RiskRaised
 * events whose `riskId` has NOT been paired with a closure event
 * (RiskResolved / RiskAccepted / RiskMitigated — `RISK_CLOSURE_EVENT_TYPES`).
 *
 * riskId pairing (WS-RISK-REGISTER-CLOSURE): a finding is open only while no
 * closure event carries its riskId. Closing a riskId clears every RiskRaised
 * that shares it (the Atlas substrate-gap ids, for instance, repeat each run).
 *
 * Provenance guard (mandatory for any fold over RiskRaised): build-phase-fixture
 * and simulated events are synthetic test / backtest-harness data, NOT live
 * findings. Counting them as open risks jammed candidate-2 permanently — the
 * store holds thousands of synthetic RiskRaised entries (IFRS-9 staging
 * fixtures, backtest-harness model risks, legacy Atlas substrate-status
 * records). Synthetic provenance is excluded so the candidate only fires on
 * real, unclosed findings. See the build-phase-fixture projection-pollution
 * rule.
 */
export function hasOpenRiskFindings(store: EventStore = eventStore): boolean {
  // Collect every closed riskId across the closure family.
  const closedRiskIds = new Set<string>();
  for (const closureType of RISK_CLOSURE_EVENT_TYPES) {
    for (const e of store.replay({ type: closureType })) {
      const riskId = String((e.payload as { riskId?: unknown }).riskId ?? "");
      if (riskId) closedRiskIds.add(riskId);
    }
  }

  for (const e of store.replay({ type: "RiskRaised" })) {
    const provKind = (e.provenance as { kind?: string } | null)?.kind;
    // Skip synthetic test / simulated data — only genuine production-provenance
    // findings count as open.
    if (provKind === "build-phase-fixture" || provKind === "simulated") continue;
    const riskId = String((e.payload as { riskId?: unknown }).riskId ?? "");
    // An unidentified RiskRaised cannot be closed by pairing — treat as open.
    if (!riskId || !closedRiskIds.has(riskId)) return true;
  }
  return false;
}

/**
 * Returns the timestamp of the most recent ICAAPSubmissionDrafted event,
 * or undefined if none exists.
 *
 * Build-phase note (§16): ICAAP is a paper exercise until licence-day; the
 * ICAAPSubmissionDrafted event is the substrate-level proxy for "ICAAP
 * snapshot produced". If the event has never been emitted, we treat the
 * ICAAP as overdue and fire the RWA-attribution goal as the closest §9
 * equivalent (capital-readiness attestation gate).
 */
function lastIcaapSubmissionDraftedMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "ICAAPSubmissionDrafted" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns the open (not yet started/completed) briefs addressed to Rohan,
 * older than `minAgeMs` (default 30 min), oldest-first. Delegates to the
 * shared `openBriefsListForAgent` (goal-loop-brief-dispatch.ts) so the
 * open-brief semantics exist once across all goal-loops.
 * Authority: D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN.
 */
export function openBriefsListForRohan(
  store: EventStore = eventStore,
  minAgeMs = 30 * 60 * 1000,
): AgentBriefIssuedPayload[] {
  return openBriefsListForAgent("rohan", store, minAgeMs);
}

/**
 * Count of open briefs addressed to Rohan, older than `minAgeMs`. Drives the
 * deriver's candidate-0. Authority: D-AGENT-AUTONOMY-RISK-TREASURY-PILOT.
 */
export function openBriefsAddressedToRohan(
  store: EventStore = eventStore,
  minAgeMs = 30 * 60 * 1000,
): number {
  return openBriefsListForRohan(store, minAgeMs).length;
}

// ---------------------------------------------------------------------------
// Goal deriver
// ---------------------------------------------------------------------------

export const rohanGoalDeriver: GoalDeriver = async (
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
    "rohan-goal-deriver: evaluating candidates",
  );

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const specHash = spec.specHash;

  // Build procedure citations — use coverage-gap form per §3.4 contract.
  const procedureEntry = spec.procedureSteps.find((s) => s.procedurePath === ROHAN_PROCEDURE_PATH);
  const stepId =
    procedureEntry && procedureEntry.stepIds.length > 0
      ? (procedureEntry.stepIds[0] ?? ROHAN_PROCEDURE_STEP_ID)
      : ROHAN_PROCEDURE_STEP_ID;

  // Helper: validate goal is in spec closed-set before returning.
  const validateGoal = (goal: string): boolean => {
    if (!spec.decisionsInScope.includes(goal)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal,
          closedSet: spec.decisionsInScope,
        },
        "rohan-goal-deriver: goal not in closed-set; deferring",
      );
      return false;
    }
    return true;
  };

  // Candidate 0 (event-reactive): open unhandled briefs addressed to Rohan.
  // Checked before the cadence candidates so Rohan reacts to his real backlog.
  // Routes to rohan:risk-run (sole event: RiskRunCompleted) under his broadest
  // in-scope decision. Mirrors Bea's candidate-0.
  const pendingBriefCount = openBriefsAddressedToRohan();
  if (pendingBriefCount > 0) {
    if (!validateGoal(DAILY_RISK_RUN_GOAL)) return null;
    logger.info(
      { agentUrn: args.agent.urn, pendingBriefCount },
      "rohan-goal-deriver: candidate-0 — open unhandled briefs addressed to Rohan — selecting daily risk-run goal",
    );
    return {
      kind: "decision",
      chosen: DAILY_RISK_RUN_GOAL,
      rationale: `Candidate 0: ${pendingBriefCount} open brief(s) addressed to Rohan (older than 30min) not yet started or completed. "${DAILY_RISK_RUN_GOAL}" is Rohan's broadest in-scope risk-engineering decision covering open risk-run / limit-utilisation / readiness work. Picking up pending briefs.`,
      mandateCitations: [
        { section: "9-decisions-in-scope", rowKey: DAILY_RISK_RUN_GOAL, specHash },
      ],
      procedureCitations: [
        {
          procedurePath: ROHAN_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "RiskRunCompleted",
          payloadPreview: { agentUrn: args.agent.urn, trigger: "rohan-goal-loop" },
        },
      ],
    };
  }

  // Candidate 1: if no RiskRunCompleted in last 24h, select daily risk-run
  // goal. Rohan's §6 inactivity SLA: daily risk run must produce a
  // RiskRunCompleted event by 08:00 UTC each day.
  const lastRiskRun = lastRiskRunCompletedMs();
  const needsDailyRun =
    lastRiskRun === undefined || Date.now() - lastRiskRun > TWENTY_FOUR_HOURS_MS;

  if (needsDailyRun) {
    if (!validateGoal(DAILY_RISK_RUN_GOAL)) return null;

    return {
      kind: "decision",
      chosen: DAILY_RISK_RUN_GOAL,
      rationale: `No RiskRunCompleted event in the last 24h (last seen: ${lastRiskRun ? new Date(lastRiskRun).toISOString() : "never"}). Rohan's daily risk-run SLA (§6: run at 06:00 UTC; RiskRunCompleted by 08:00 UTC) requires a daily risk batch. Selecting daily risk-run goal to trigger the rohan:risk-run handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: DAILY_RISK_RUN_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: ROHAN_PROCEDURE_PATH,
          stepId,
          // SHA-256 of the procedure file is unknown at runtime without
          // reading it; use the spec hash as a proxy (coverage-gap).
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "RiskRunCompleted",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "rohan-goal-loop",
          },
        },
      ],
    };
  }

  // Candidate 2: production-provenance RiskRaised events whose riskId has not
  // been closed by a RiskResolved / RiskAccepted / RiskMitigated event.
  // Closure pairing is by riskId (WS-RISK-REGISTER-CLOSURE); synthetic
  // provenance is excluded. This candidate fires the "Raise a RiskRaised
  // event" goal which drives the risk-run handler to surface the open finding
  // into the next run pack.
  const openRiskFindings = hasOpenRiskFindings();

  if (openRiskFindings) {
    if (!validateGoal(RISK_FINDINGS_GOAL)) return null;

    return {
      kind: "decision",
      chosen: RISK_FINDINGS_GOAL,
      rationale:
        "Open RiskRaised events detected in the event store that have not been resolved. Rohan's §9 mandate (Raise a RiskRaised event on a detected risk) requires the risk-run handler to process open risk findings into the next run pack. Selecting risk-findings goal to trigger the rohan:risk-run handler.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: RISK_FINDINGS_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: ROHAN_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      // Three-way coherence: rohan:risk-run's sole emitted event is
      // RiskRunCompleted. The run pack surfaces the open RiskRaised finding;
      // a dedicated RiskRaised-emitting handler is a §16 substrate gap, at
      // which point this candidate's plannedEvent returns to RiskRaised.
      plannedEvents: [
        {
          type: "RiskRunCompleted",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "rohan-goal-loop",
          },
        },
      ],
    };
  }

  // Candidate 3: if no ICAAPSubmissionDrafted in last 7 days, select ICAAP
  // snapshot goal. Build-phase note (§16): ICAAP is a paper exercise until
  // licence-day. The RWA-attribution submission goal is the closest §9
  // equivalent — it gates the capital-readiness attestation that the ICAAP
  // depends on. Per §6 cadence: annual ICAAP at FY-end + 90 days; weekly
  // ICAAP-readiness check (7-day trigger here) validates the pipeline
  // end-to-end in build phase.
  const lastIcaap = lastIcaapSubmissionDraftedMs();
  const needsIcaapSnapshot = lastIcaap === undefined || Date.now() - lastIcaap > SEVEN_DAYS_MS;

  if (needsIcaapSnapshot) {
    if (!validateGoal(ICAAP_SNAPSHOT_GOAL)) return null;

    return {
      kind: "decision",
      chosen: ICAAP_SNAPSHOT_GOAL,
      rationale: `No ICAAPSubmissionDrafted event in the last 7 days (last seen: ${lastIcaap ? new Date(lastIcaap).toISOString() : "never"}). In build phase the RWA-attribution submission goal is the §9 equivalent for ICAAP snapshot generation: it validates the capital-readiness substrate that feeds the ICAAP. Selecting ICAAP-snapshot goal to trigger the rohan:risk-run handler and produce the capital-readiness attestation.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: ICAAP_SNAPSHOT_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: ROHAN_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      // Three-way coherence: rohan:risk-run's sole emitted event is
      // RiskRunCompleted (the build-phase capital-readiness attestation). The
      // real ICAAPSubmissionDrafted event returns when an ICAAP-emitting
      // handler is wired (§16 gap — ICAAP is a paper exercise during build).
      plannedEvents: [
        {
          type: "RiskRunCompleted",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "rohan-goal-loop",
          },
        },
      ],
    };
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastRiskRunAgo: lastRiskRun
        ? `${Math.round((Date.now() - lastRiskRun) / 60_000)}min`
        : "never",
      openRiskFindings,
      lastIcaapAgo: lastIcaap ? `${Math.round((Date.now() - lastIcaap) / 60_000)}min` : "never",
    },
    "rohan-goal-deriver: no action justified — deferring",
  );
  return null;
};

// ---------------------------------------------------------------------------
// Brief-bound dispatch — shared module (goal-loop-brief-dispatch.ts)
//
// When candidate-0 fires (open briefs addressed to Rohan), the loop binds a run
// to the specific oldest brief and emits the run lifecycle via the shared
// `dispatchBriefBoundRun`. The rule engine NEVER fakes delivery:
//
//   - Self-executable (risk-run attestation class): runs the risk-run handler
//     live and closes outcome="delivered".
//   - Everything else (code / judgement work the rule engine cannot perform):
//     closes outcome="blocked" with the substrate gap surfaced and
//     followOnRoutes: []. Blocked is TERMINAL — the legacy auto-routing of
//     blocked briefs into the brief-router is removed (it re-issued briefs
//     without an executor: the phantom-backlog failure mode of PR #1182).
//     A Scrooge-coordinated / LLM-backed dispatched run picks the gap up.
//
// Run-lifecycle citations come from GOAL_LOOP_RUN_LIFECYCLE_AUTHORITIES in the
// shared module. Rohan's cohort behaviour (candidate set, classifier pattern)
// still derives from D-AGENT-AUTONOMY-RISK-TREASURY-PILOT.
// Authority: D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN
// (CEO-approved 2026-06-11).
// ---------------------------------------------------------------------------

/**
 * Title pattern for the attestation class Rohan's deterministic handler
 * genuinely delivers. Deliberately narrow: the only deterministic deliverable
 * Rohan's goal-loop owns today is the RiskRunCompleted attestation.
 */
const ROHAN_SELF_EXECUTABLE_PATTERN = /risk[\s-]?run|risk[\s-]?readiness|limit[\s-]?utilisation/i;

/**
 * A brief is self-executable by Rohan's wired rule-engine capability only if it
 * explicitly asks for the daily risk-run / limit-utilisation readiness
 * attestation AND requires no code-PR output.
 */
export function isSelfExecutableByRohan(brief: AgentBriefIssuedPayload): boolean {
  return isSelfExecutableBrief(brief, ROHAN_SELF_EXECUTABLE_PATTERN);
}

/** Shared brief-dispatch config — the delivered class (risk-run attestation) stays live. */
export const ROHAN_BRIEF_DISPATCH: GoalLoopBriefDispatchConfig = {
  agentSlug: "rohan",
  selfExecutablePattern: ROHAN_SELF_EXECUTABLE_PATTERN,
  deliveredClassLabel: "daily risk-run attestation",
  runHandler: rohanRiskRun,
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
// Handler (wired as `rohan:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// rohan:risk-run handler directly via its imported callable.
//
// Live: when the goal-loop selects a decision, the rohan:risk-run handler runs
// for real and emits. The handler is dry-run only when the loop
// deferred/escalated (no decision to execute) or when ctx.dryRun is set
// (--dry-run flag). Goal-loop events (AgentGoalEvaluated / AgentGoalSelected /
// AgentGoalDeferred) are always emitted regardless.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "rohan:goal-loop — starting goal-loop run",
  );

  const agentUrn = "agent:rohan";

  // Parse Rohan's spec.
  const parseResult = parseSpecFile(ROHAN_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: ROHAN_SPEC_PATH },
      "rohan:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await rohanRiskRun(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, rohanGoalDeriver);

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
    "rohan:goal-loop — goal-loop iteration complete",
  );

  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  // Brief-bound dispatch path: when the loop selected a decision and there is
  // an open brief addressed to Rohan, bind a run to the oldest brief and emit
  // its dispatch lifecycle (triage-and-route) instead of only the cadence
  // attestation. Skipped under --dry-run (no real run-lifecycle side-effects).
  const openBriefs = shouldRunHandler && !ctx.dryRun ? openBriefsListForRohan() : [];
  const [brief] = openBriefs;
  if (brief) {
    const dispatch = await dispatchBriefBoundRun(
      ctx,
      brief,
      iterationId,
      openBriefs.length - 1,
      ROHAN_BRIEF_DISPATCH,
    );
    logger.info(
      { agent: ctx.agent, iterationId, briefId: brief.briefId, openBriefs: openBriefs.length },
      "rohan:goal-loop — run complete (brief-bound dispatch)",
    );
    return {
      eventsEmitted: dispatch.eventsEmitted + goalEventsEmitted,
      ok: true,
      summary: `goal-loop: iteration=${iterationId} outcome=decision dispatch=${dispatch.summary}`,
    };
  }

  // Cadence path: no open brief — run the risk-run attestation live when the
  // loop selected a decision; dry-run only when it deferred or --dry-run was set.
  const handlerCtx: AgentRunContext = {
    ...ctx,
    dryRun: ctx.dryRun || !shouldRunHandler,
  };

  const handlerOutput = await rohanRiskRun(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "rohan:goal-loop — run complete (cadence)",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
