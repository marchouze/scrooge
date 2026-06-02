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
import type { EventStore } from "../../platform/event-store/store";
import { routeBlockedBrief } from "../../platform/records/brief-router";
import { recordAgentRunCompleted, recordAgentRunStarted } from "../../platform/records/helpers";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import the underlying risk-run handler directly to avoid the circular
// dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import rohanRiskRun from "./rohan-risk-run";

// Authority cited on the brief-bound run-lifecycle events this loop emits.
// Rohan's autonomous (cohort) promotion mirrors Bea's cohort-2 pilot.
const RISK_TREASURY_AUTHORITY = "D-AGENT-AUTONOMY-RISK-TREASURY-PILOT" as const;

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
 * Returns true if there are any RiskRaised events that have NOT been paired
 * with a matching RiskResolved (or equivalent closure) event.
 *
 * In the current build phase the closure event schema is not yet defined
 * (§16 "risk engine modules in build-only"). We detect open findings by
 * checking whether any RiskRaised event exists in the store; until a
 * RiskResolved family is emitted the count stays open.
 */
function hasOpenRiskFindings(): boolean {
  for (const _e of eventStore.replay({ type: "RiskRaised" })) {
    // Any RiskRaised entry signals an open finding in build phase (no
    // RiskResolved event type yet registered). Return immediately on the
    // first match to avoid full-scan on large stores.
    return true;
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
 * older than `minAgeMs` (default 30 min), oldest-first. Mirrors Bea's
 * `openBriefsListForBea`: a brief is "handled" once any AgentRunStarted or
 * AgentRunCompleted carries its briefId. This is the candidate that makes
 * Rohan's loop react to his real backlog instead of looping on one cadence
 * goal. Authority: D-AGENT-AUTONOMY-RISK-TREASURY-PILOT.
 */
export function openBriefsListForRohan(
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
        .includes("rohan")
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

  // Candidate 2: open RiskRaised events not yet resolved.
  // In build phase, any un-resolved RiskRaised is treated as open (no
  // RiskResolved event type yet registered — §16 substrate gap).
  // This candidate fires the "Raise a RiskRaised event" goal which drives
  // the risk-run handler to surface the open finding into the next run pack.
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
// Brief-bound dispatch (D-AGENT-AUTONOMY-RISK-TREASURY-PILOT — triage-and-route)
//
// When candidate-0 fires (open briefs addressed to Rohan), the loop binds a run
// to the specific oldest brief and emits the dispatch lifecycle so the brief is
// no longer re-picked every tick. The rule engine NEVER fakes delivery:
//
//   - Self-executable (risk-run attestation class): runs the risk-run handler
//     live and closes outcome="delivered".
//   - Everything else (code / judgement work the rule engine cannot perform):
//     closes outcome="blocked", surfaces the substrate gap, and routes the brief
//     to the engineering-execution substrate via followOnRoutes. The brief is
//     handed off, not silently dropped — the blocked run + route is the audit
//     trail an executor (Scrooge-coordinated or future LLM substrate) picks up.
// ---------------------------------------------------------------------------

// Emit run-lifecycle events under Rohan's parent agent identity (matches the
// dispatch CLI's `agent:${slug}` actor). agent:rohan has a published permission
// policy, so the non-privileged AgentRunStarted/Completed types take the
// allow-by-default path with NO legacy bypass.
const ROHAN_GOAL_LOOP_ACTOR = { type: "service", id: "agent:rohan" } as const;

/**
 * A brief is self-executable by Rohan's wired rule-engine capability only if it
 * explicitly asks for the daily risk-run / limit-utilisation readiness
 * attestation AND requires no code-PR output. Deliberately narrow: the only
 * deterministic deliverable Rohan's goal-loop owns today is the
 * RiskRunCompleted attestation. Everything else is routed.
 */
export function isSelfExecutableByRohan(brief: AgentBriefIssuedPayload): boolean {
  const needsCode = brief.expectedOutputs.some((o) => o.kind === "code-pr");
  if (needsCode) return false;
  return /risk[\s-]?run|risk[\s-]?readiness|limit[\s-]?utilisation/i.test(brief.title);
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
  const runId = `run:rohan:goal-loop:${iterationId}`;
  const agent = brief.issuedTo; // issuedTo IS Rohan — keep the ref consistent.

  recordAgentRunStarted(
    {
      runId,
      briefId: brief.briefId,
      agent,
      startedAt: ctx.asOf,
      substrate: "agent-runtime",
      citations: [RISK_TREASURY_AUTHORITY],
      actor: ROHAN_GOAL_LOOP_ACTOR,
    },
    ctx.asOf,
  );

  let eventsEmitted = 1;

  if (isSelfExecutableByRohan(brief)) {
    // Genuinely completable — run the risk-run handler live and deliver.
    const handlerOutput = await rohanRiskRun({ ...ctx, dryRun: false });
    eventsEmitted += handlerOutput.eventsEmitted;
    recordAgentRunCompleted(
      {
        runId,
        briefId: brief.briefId,
        agent,
        completedAt: ctx.asOf,
        outcome: "delivered",
        deliverableBodies: [
          `Rohan goal-loop delivered the daily risk-run attestation for brief ${brief.briefId} ("${brief.title}"). ${handlerOutput.summary}`,
        ],
        substrateGapsSurfaced: [],
        deliverableCitations: [RISK_TREASURY_AUTHORITY],
        followOnRoutes: [],
        citations: [RISK_TREASURY_AUTHORITY],
        actor: ROHAN_GOAL_LOOP_ACTOR,
      },
      ctx.asOf,
    );
    eventsEmitted += 1;
    logger.info(
      { briefId: brief.briefId, runId, remainingOpen },
      "rohan:goal-loop — brief delivered (risk-run attestation class)",
    );
    return {
      eventsEmitted,
      summary: `brief ${brief.briefId} delivered (risk-run); ${remainingOpen} open brief(s) remain`,
    };
  }

  // Not executable by the rule engine — triage, block, and route to the
  // engineering-execution substrate. NEVER faked as delivered.
  const routeKind = brief.expectedOutputs.some((o) => o.kind === "code-pr") ? "code-pr" : "agent";
  const gap = `Rohan goal-loop (rule-engine) triaged brief ${brief.briefId} ("${brief.title}") but cannot execute it autonomously — it requires engineering/judgement work outside the rule-engine capability. Routed to the engineering-execution substrate (LLM-backed dispatched run). This is the goal-loop→dispatched-run substrate gap.`;
  const followOnRoutes = [
    {
      kind: routeKind as "code-pr" | "agent",
      target: "engineering-execution-substrate",
      directive: `Execute brief ${brief.briefId}: ${brief.title}${
        brief.workstreamId ? ` (workstream ${brief.workstreamId})` : ""
      }. Triaged and routed by Rohan's autonomous goal-loop; requires an engineering-execution run.`,
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
      deliverableCitations: [RISK_TREASURY_AUTHORITY],
      followOnRoutes,
      citations: [RISK_TREASURY_AUTHORITY],
      actor: ROHAN_GOAL_LOOP_ACTOR,
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
        "rohan:goal-loop — follow-on brief issued for blocked route",
      );
    }
  }
  eventsEmitted += followOnBriefsIssued; // AgentBriefIssued counts as emitted event

  logger.info(
    { briefId: brief.briefId, runId, routeKind, remainingOpen },
    "rohan:goal-loop — brief triaged + routed to engineering-execution substrate (blocked, gap surfaced)",
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
    const dispatch = await dispatchBriefBoundRun(ctx, brief, iterationId, openBriefs.length - 1);
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
