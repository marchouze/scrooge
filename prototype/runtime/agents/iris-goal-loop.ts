// runtime/agents/iris-goal-loop.ts
//
// Iris (Information Officer under POPIA s.56) goal-loop — cohort-3 deriver.
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Iris is a cohort-3
// agent deriving goals autonomously from her POPIA / privacy mandate.
// This run-handler is the integration point that:
//   1. Materialises a WorldStateSnapshot for agent:iris.
//   2. Runs Iris's rule-engine goal deriver (no LLM calls — cohort rule-engine
//      constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   Rule 1 — No POPIAControlsSnapshot in last 24h →
//     select "POPIA controls snapshot" goal (priority HIGH).
//   Rule 2 — Open DataBreachDetected or DataSubjectRequestReceived event with
//     no response dispatch in 1h → select "breach-notification-dispatch" or
//     "dsr-response-dispatch" goal (priority CRITICAL).
//   Rule 3 — No RetentionScheduleReview in last 30 days →
//     select "Approve retention-schedule changes" goal (priority MEDIUM).
//   Rule 4 — No PrivacyByDesignGateResult in last 7 days →
//     select "privacy-design-gate-review" goal (priority MEDIUM).
//   Otherwise → defer (null outcome).
//
// Goal candidates use Iris's §9 decisions-in-scope row labels exactly as
// they appear in Team/Iris.md (the spec's closed-set per T-NEW).
//
// Procedure citations: Iris owns Procedures/by-policy/popia-breach-notification.md
// and Procedures/by-policy/popia-dsar.md and related POPIA procedures.
// Since these files may not yet have step anchors (pre-backfill coverage-gap
// per _step-id-convention.md §5), we use the coverage-gap form:
// `stepId: "<procedure>:step-1"` as a placeholder. The recon
// pipeline warns (not fails) for missing step IDs per the build-phase
// tolerance.
//
// Shadow mode: shadowMode is true until cohort validation passes.
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Iris (Information Officer, privacy) / Atlas (Core banking platform architect)

import { resolve } from "node:path";
import type { GoalDeriver, GoalLoopOutcome } from "../../platform/agent-runtime/goal-loop";
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import type { RunWithGoalArgs } from "../../platform/agent-runtime/goal-loop";
import { parseSpecFile } from "../../platform/agent-runtime/spec-parser";
import { LocalAgentWorldStateReader } from "../../platform/agent-runtime/world-state";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import the underlying popia-controls-snapshot handler directly to avoid the
// circular dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import irisPopiaControlsSnapshot from "./iris-popia-controls-snapshot";

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Iris
// ---------------------------------------------------------------------------

const IRIS_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Iris.md",
);

// §9 row labels from Team/Iris.md — provided for documentation; the
// closed-set is read from the parsed spec at runtime (T-NEW closed-set check).
// Kept here so the goal-deriver can reference them in comments / unit tests
// without re-parsing the spec file.
// const IRIS_DECISIONS_IN_SCOPE = [ ... ] — see Team/Iris.md §9
// const IRIS_EVENTS_EMITTED     = [ ... ] — see Team/Iris.md §11

// Iris's procedure paths (§13).
const IRIS_BREACH_NOTIFICATION_PROCEDURE_PATH = "Procedures/by-policy/popia-breach-notification.md";
const IRIS_DSAR_PROCEDURE_PATH = "Procedures/by-policy/popia-dsar.md";
const IRIS_RETENTION_SCHEDULE_PROCEDURE_PATH = "Procedures/by-policy/retention-schedule-cycle.md";
// Coverage-gap step-ID form per _step-id-convention.md §5.
const IRIS_BREACH_STEP_ID = "popia-breach-notification:step-1";
const IRIS_DSAR_STEP_ID = "popia-dsar:step-1";
const IRIS_RETENTION_STEP_ID = "retention-schedule-cycle:step-1";

// Goal labels — must match Team/Iris.md §9 first-column row labels exactly (T-NEW).
// Rule 1 — POPIA controls snapshot (mapped to the closest §9 decision; snapshot
// is the standing-duty trigger for register maintenance).
const POPIA_CONTROLS_SNAPSHOT_GOAL = "Approve / refuse a new processing purpose" as const;
// Rule 2 — Breach notification / DSAR dispatch.
const BREACH_NOTIFICATION_GOAL = "Sign Information-Regulator notifications under s.22" as const;
const DSR_RESPONSE_GOAL = "DSAR disposition (grant / partial / refuse)" as const;
// Rule 3 — Retention schedule review.
const RETENTION_SCHEDULE_GOAL = "Approve retention-schedule changes" as const;
// Rule 4 — Privacy-by-design gate review (mapped to processing-purpose approval —
// closest §9 decision covering a design-gate finding).
const PRIVACY_DESIGN_GATE_GOAL = "Approve / refuse a new processing purpose" as const;

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Goal-derivation rule engine helpers
// ---------------------------------------------------------------------------

function lastEventMs(eventType: string): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: eventType })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

function hasOpenUnrespondedBreaches(): boolean {
  // Any DataBreachDetected event within the last 1h with no corresponding
  // BreachNotificationDispatched in the same window.
  const breachResponses = new Set<string>();
  for (const e of eventStore.replay({ type: "BreachNotificationDispatched" })) {
    const p = e.payload as Record<string, unknown>;
    const ref = String(p.breachEventId ?? p.eventRef ?? "");
    if (ref) breachResponses.add(ref);
  }

  for (const e of eventStore.replay({ type: "DataBreachDetected" })) {
    const t = new Date(e.as_of).getTime();
    if (Number.isNaN(t)) continue;
    if (Date.now() - t <= ONE_HOUR_MS) {
      // Open within the last 1h — check if a response has been dispatched.
      if (!breachResponses.has(e.event_id)) return true;
    }
  }
  // Also check PersonalInformationCompromiseSuspected as a breach trigger.
  for (const e of eventStore.replay({ type: "PersonalInformationCompromiseSuspected" })) {
    const t = new Date(e.as_of).getTime();
    if (Number.isNaN(t)) continue;
    if (Date.now() - t <= ONE_HOUR_MS) {
      if (!breachResponses.has(e.event_id)) return true;
    }
  }
  return false;
}

function hasOpenUnrespondedDsarRequests(): boolean {
  // Any DSARReceived event within the last 1h with no corresponding DSARClosed.
  const dsarResponses = new Set<string>();
  for (const e of eventStore.replay({ type: "DSARClosed" })) {
    const p = e.payload as Record<string, unknown>;
    const ref = String(p.dsarEventId ?? p.eventRef ?? p.requestId ?? "");
    if (ref) dsarResponses.add(ref);
  }

  for (const e of eventStore.replay({ type: "DSARReceived" })) {
    const t = new Date(e.as_of).getTime();
    if (Number.isNaN(t)) continue;
    if (Date.now() - t <= ONE_HOUR_MS) {
      if (!dsarResponses.has(e.event_id)) return true;
    }
  }
  // Also check DataSubjectRequestReceived as an alias.
  for (const e of eventStore.replay({ type: "DataSubjectRequestReceived" })) {
    const t = new Date(e.as_of).getTime();
    if (Number.isNaN(t)) continue;
    if (Date.now() - t <= ONE_HOUR_MS) {
      if (!dsarResponses.has(e.event_id)) return true;
    }
  }
  return false;
}

export const irisGoalDeriver: GoalDeriver = async (
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
    "iris-goal-deriver: evaluating candidates",
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

  // ---------------------------------------------------------------------------
  // Rule 2 (CRITICAL) — Open DataBreachDetected or DataSubjectRequestReceived
  // with no response dispatch in 1h.
  // Evaluated before Rule 1 because breach / DSAR obligations have statutory
  // clocks and cannot be deferred (POPIA s.22 breach-notification window;
  // POPIA Reg 4 DSAR response window).
  // ---------------------------------------------------------------------------

  const openBreach = hasOpenUnrespondedBreaches();
  if (openBreach) {
    logger.info(
      { agentUrn: args.agent.urn },
      "iris-goal-deriver: open unresponded breach detected — selecting breach-notification-dispatch goal (CRITICAL)",
    );

    if (!spec.decisionsInScope.includes(BREACH_NOTIFICATION_GOAL)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal: BREACH_NOTIFICATION_GOAL,
          closedSet: spec.decisionsInScope,
        },
        "iris-goal-deriver: breach-notification goal not in closed-set; deferring",
      );
      return null;
    }

    return {
      kind: "decision",
      chosen: BREACH_NOTIFICATION_GOAL,
      rationale:
        "Open DataBreachDetected or PersonalInformationCompromiseSuspected event detected with no BreachNotificationDispatched response within the last 1h. Iris must initiate breach-notification dispatch under POPIA s.22 — the statutory notification clock starts at the point of reasonable belief of compromise. Priority: CRITICAL.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: BREACH_NOTIFICATION_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        buildProcedureCitation(IRIS_BREACH_NOTIFICATION_PROCEDURE_PATH, IRIS_BREACH_STEP_ID),
      ],
      plannedEvents: [
        {
          type: "BreachNotificationDispatched",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "iris-goal-loop:breach-notification-dispatch",
          },
        },
      ],
    };
  }

  const openDsar = hasOpenUnrespondedDsarRequests();
  if (openDsar) {
    logger.info(
      { agentUrn: args.agent.urn },
      "iris-goal-deriver: open unresponded DSAR detected — selecting dsr-response-dispatch goal (CRITICAL)",
    );

    if (!spec.decisionsInScope.includes(DSR_RESPONSE_GOAL)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal: DSR_RESPONSE_GOAL,
          closedSet: spec.decisionsInScope,
        },
        "iris-goal-deriver: dsr-response goal not in closed-set; deferring",
      );
      return null;
    }

    return {
      kind: "decision",
      chosen: DSR_RESPONSE_GOAL,
      rationale:
        "Open DSARReceived or DataSubjectRequestReceived event with no DSARClosed response within the last 1h. Iris must process the DSAR queue per POPIA Regulation 4 (acknowledge within 5 working days; respond within 30 days). Priority: CRITICAL.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: DSR_RESPONSE_GOAL,
          specHash,
        },
      ],
      procedureCitations: [buildProcedureCitation(IRIS_DSAR_PROCEDURE_PATH, IRIS_DSAR_STEP_ID)],
      plannedEvents: [
        {
          type: "DSARClosed",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "iris-goal-loop:dsr-response-dispatch",
          },
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 1 (HIGH) — No POPIAControlsSnapshot in the last 24h.
  // ---------------------------------------------------------------------------

  const lastPopiaSnapshot = lastEventMs("POPIAControlsSnapshot");
  const needsPopiaSnapshot =
    lastPopiaSnapshot === undefined || Date.now() - lastPopiaSnapshot > TWENTY_FOUR_HOURS_MS;

  if (needsPopiaSnapshot) {
    logger.info(
      {
        agentUrn: args.agent.urn,
        lastPopiaSnapshotAgo: lastPopiaSnapshot
          ? `${Math.round((Date.now() - lastPopiaSnapshot) / 60_000)}min`
          : "never",
      },
      "iris-goal-deriver: no POPIAControlsSnapshot in last 24h — selecting popia-controls-snapshot goal (HIGH)",
    );

    if (!spec.decisionsInScope.includes(POPIA_CONTROLS_SNAPSHOT_GOAL)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal: POPIA_CONTROLS_SNAPSHOT_GOAL,
          closedSet: spec.decisionsInScope,
        },
        "iris-goal-deriver: popia-controls-snapshot goal not in closed-set; deferring",
      );
      return null;
    }

    return {
      kind: "decision",
      chosen: POPIA_CONTROLS_SNAPSHOT_GOAL,
      rationale: `No POPIAControlsSnapshot in the last 24h (last seen: ${lastPopiaSnapshot ? new Date(lastPopiaSnapshot).toISOString() : "never"}). Iris's POPIA standing-duty heartbeat is due. Selecting popia-controls-snapshot goal to trigger the iris:popia-controls-snapshot handler and refresh the lawful-processing-register coverage state. Priority: HIGH.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: POPIA_CONTROLS_SNAPSHOT_GOAL,
          specHash,
        },
      ],
      procedureCitations: [buildProcedureCitation(IRIS_DSAR_PROCEDURE_PATH, IRIS_DSAR_STEP_ID)],
      plannedEvents: [
        {
          type: "POPIAControlsSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "iris-goal-loop:popia-controls-snapshot",
          },
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 3 (MEDIUM) — No RetentionScheduleReview in the last 30 days.
  // ---------------------------------------------------------------------------

  const lastRetentionReview = lastEventMs("RetentionScheduleApproved");
  const needsRetentionReview =
    lastRetentionReview === undefined || Date.now() - lastRetentionReview > THIRTY_DAYS_MS;

  if (needsRetentionReview) {
    logger.info(
      {
        agentUrn: args.agent.urn,
        lastRetentionReviewAgo: lastRetentionReview
          ? `${Math.round((Date.now() - lastRetentionReview) / 60_000 / 60 / 24)}d`
          : "never",
      },
      "iris-goal-deriver: no RetentionScheduleApproved in last 30 days — selecting retention-schedule-review goal (MEDIUM)",
    );

    if (!spec.decisionsInScope.includes(RETENTION_SCHEDULE_GOAL)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal: RETENTION_SCHEDULE_GOAL,
          closedSet: spec.decisionsInScope,
        },
        "iris-goal-deriver: retention-schedule goal not in closed-set; deferring",
      );
      return null;
    }

    return {
      kind: "decision",
      chosen: RETENTION_SCHEDULE_GOAL,
      rationale: `No RetentionScheduleApproved event in the last 30 days (last seen: ${lastRetentionReview ? new Date(lastRetentionReview).toISOString() : "never"}). Iris's retention-schedule review cycle is due. Retention schedules must be maintained against statutory minima (Banks Act, FIC Act, Tax Administration Act, Companies Act) per §9. Priority: MEDIUM.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: RETENTION_SCHEDULE_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        buildProcedureCitation(IRIS_RETENTION_SCHEDULE_PROCEDURE_PATH, IRIS_RETENTION_STEP_ID),
      ],
      plannedEvents: [
        {
          type: "RetentionScheduleApproved",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "iris-goal-loop:retention-schedule-review",
          },
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 4 (MEDIUM) — No PrivacyByDesignGateResult in the last 7 days.
  // ---------------------------------------------------------------------------

  const lastPrivacyGate = lastEventMs("PrivacyByDesignGateResult");
  const needsPrivacyGateReview =
    lastPrivacyGate === undefined || Date.now() - lastPrivacyGate > SEVEN_DAYS_MS;

  if (needsPrivacyGateReview) {
    logger.info(
      {
        agentUrn: args.agent.urn,
        lastPrivacyGateAgo: lastPrivacyGate
          ? `${Math.round((Date.now() - lastPrivacyGate) / 60_000 / 60 / 24)}d`
          : "never",
      },
      "iris-goal-deriver: no PrivacyByDesignGateResult in last 7 days — selecting privacy-design-gate-review goal (MEDIUM)",
    );

    if (!spec.decisionsInScope.includes(PRIVACY_DESIGN_GATE_GOAL)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal: PRIVACY_DESIGN_GATE_GOAL,
          closedSet: spec.decisionsInScope,
        },
        "iris-goal-deriver: privacy-design-gate goal not in closed-set; deferring",
      );
      return null;
    }

    return {
      kind: "decision",
      chosen: PRIVACY_DESIGN_GATE_GOAL,
      rationale: `No PrivacyByDesignGateResult in the last 7 days (last seen: ${lastPrivacyGate ? new Date(lastPrivacyGate).toISOString() : "never"}). Iris's weekly privacy-by-design gate review is due. New processing purposes and system designs entering the pipeline require a POPIA s.13 specific-purpose test and a privacy-by-design gate sign-off before proceeding. Priority: MEDIUM.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: PRIVACY_DESIGN_GATE_GOAL,
          specHash,
        },
      ],
      procedureCitations: [buildProcedureCitation(IRIS_DSAR_PROCEDURE_PATH, IRIS_DSAR_STEP_ID)],
      plannedEvents: [
        {
          type: "ProcessingPurposeApproved",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "iris-goal-loop:privacy-design-gate-review",
          },
        },
      ],
    };
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastPopiaSnapshotAgo: lastPopiaSnapshot
        ? `${Math.round((Date.now() - lastPopiaSnapshot) / 60_000)}min`
        : "never",
    },
    "iris-goal-deriver: no action justified — deferring",
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
// Handler (wired as `iris:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// iris:popia-controls-snapshot handler directly via its imported callable.
//
// Shadow mode: shadowMode is true for the first cohort ticks. The goal-loop
// events are still emitted (so the shadow-mode trace is testable per spec
// §4 "Build runs in shadow mode for the first two substrate ticks"), but the
// iris:popia-controls-snapshot handler is called with dryRun=true.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "iris:goal-loop — starting goal-loop cohort-3 run",
  );

  const agentUrn = "agent:iris";

  // Parse Iris's spec.
  const parseResult = parseSpecFile(IRIS_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: IRIS_SPEC_PATH },
      "iris:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await irisPopiaControlsSnapshot(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, irisGoalDeriver);

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
    "iris:goal-loop — goal-loop iteration complete",
  );

  // If deferred or escalation — run the handler in dry-run mode (shadow trace).
  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  const handlerCtx: AgentRunContext = {
    ...ctx,
    // In shadow mode (first cohort ticks), always dry-run the handler
    // so we observe the trace without side-effects.
    dryRun: ctx.dryRun || !shouldRunHandler,
  };

  const handlerOutput = await irisPopiaControlsSnapshot(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "iris:goal-loop — cohort-3 run complete",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-3: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
