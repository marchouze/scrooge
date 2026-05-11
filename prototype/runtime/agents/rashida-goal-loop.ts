// runtime/agents/rashida-goal-loop.ts
//
// Rashida (Chief Information Security Officer, governance) goal-loop — cohort-3 deriver.
//
// Phase: D-AGENT-AUTONOMY-OPERATIONAL Slice 3 — per-persona goal-loop substrate.
// This handler wires Rashida into the goal-loop substrate.
// Pattern follows `thandiwe-goal-loop.ts` (cohort-3 reference implementation).
//
// Rule-engine goal derivation (no LLM calls — rule-engine-only constraint per
// spec §3.4 "MUST NOT — LLM cost-cap"):
//   1. No `CyberResilienceSnapshot` event from Rashida in the past 24h →
//      select "Sign the second-line cyber opinion to AC / Risk Forum" goal
//      (priority HIGH).
//   2. Open `SecurityIncidentRaised` event with no incident-command activation
//      in 1h (no paired `SecurityIncidentRated` from Rashida) →
//      select "Sign `SecurityIncident` severity rating" goal (priority CRITICAL).
//   3. No `ThreatModelApproved` event in the past 7 days →
//      select "Sign / refuse threat-model-gate exceptions" goal (priority MEDIUM).
//   4. No `KeyRotationCompleted` event in the past 30 days →
//      select "Sign / refuse key-rotation cadence amendments" goal (priority MEDIUM).
//   5. Otherwise → defer (null).
//
// Shadow mode: shadowMode: true — Rashida is cohort-3; first two substrate
// ticks run in shadow mode per spec §4. Goal-loop events (AgentGoalEvaluated,
// AgentGoalSelected, AgentGoalDeferred) are still emitted so the trace is
// testable; the underlying handler is always called with dryRun=true.
//
// Procedure citations: Rashida owns:
//   - `Procedures/by-policy/cyber-incident-command.md` (planned)
//   - `Procedures/by-policy/threat-model-gate-sign-off.md` (planned)
//   - `Procedures/by-policy/key-ceremony-governance.md` (planned)
//   - `Procedures/by-policy/incident-response.md` (populated; co-owner with Senna)
// Coverage-gap step-ID form per _step-id-convention.md §5 used for planned
// procedures that do not yet have step anchors.
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Rashida (Chief Information Security Officer, governance) · Atlas (Core banking platform architect)

import { resolve } from "node:path";
import type { GoalDeriver, GoalLoopOutcome } from "../../platform/agent-runtime/goal-loop";
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import type { RunWithGoalArgs } from "../../platform/agent-runtime/goal-loop";
import { parseSpecFile } from "../../platform/agent-runtime/spec-parser";
import { LocalAgentWorldStateReader } from "../../platform/agent-runtime/world-state";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import Rashida's underlying handler directly to avoid circular dependency
// (handler-callables.ts → this file → handler-callables.ts).
import rashidaCyberResilienceSnapshot from "./rashida-cyber-resilience-snapshot";

// ---------------------------------------------------------------------------
// Spec path
// ---------------------------------------------------------------------------

const RASHIDA_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Rashida.md",
);

// ---------------------------------------------------------------------------
// §9 row labels from Team/Rashida.md used by the goal deriver.
// These must match the exact row labels in Rashida's spec §9 decisions-in-scope
// for the closed-set validation (T-NEW) to pass.
// ---------------------------------------------------------------------------

const GOAL_SIGN_SECOND_LINE_CYBER_OPINION =
  "Sign the second-line cyber opinion to AC / Risk Forum" as const;
const GOAL_SIGN_INCIDENT_SEVERITY_RATING = "Sign `SecurityIncident` severity rating" as const;
const GOAL_SIGN_THREAT_MODEL_GATE_EXCEPTIONS =
  "Sign / refuse threat-model-gate exceptions" as const;
const GOAL_SIGN_KEY_ROTATION_CADENCE = "Sign / refuse key-rotation cadence amendments" as const;

// ---------------------------------------------------------------------------
// Procedure paths (§13 of Rashida's spec)
// ---------------------------------------------------------------------------

const PROCEDURE_INCIDENT_RESPONSE = "Procedures/by-policy/incident-response.md";
const PROCEDURE_THREAT_MODEL_GATE = "Procedures/by-policy/threat-model-gate-sign-off.md";
const PROCEDURE_KEY_CEREMONY = "Procedures/by-policy/key-ceremony-governance.md";
const PROCEDURE_CYBER_INCIDENT_COMMAND = "Procedures/by-policy/cyber-incident-command.md";

// Coverage-gap step-ID form per _step-id-convention.md §5 (planned procedures).
const STEP_CYBER_RESILIENCE = "incident-response:step-1";
const STEP_INCIDENT_COMMAND = "cyber-incident-command:step-1";
const STEP_THREAT_MODEL = "threat-model-gate-sign-off:step-1";
const STEP_KEY_ROTATION = "key-ceremony-governance:step-1";

// ---------------------------------------------------------------------------
// Rule-engine helpers
// ---------------------------------------------------------------------------

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Returns the timestamp (ms) of the most recent CyberResilienceSnapshot
 * event from Rashida, or undefined if none exists.
 */
function lastCyberResilienceSnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "CyberResilienceSnapshot" })) {
    const p = e.payload as Record<string, unknown>;
    const actor = String(p.agentUrn ?? p.issuingAgent ?? "");
    if (/rashida/i.test(actor) || actor === "agent:rashida") {
      const t = new Date(e.as_of).getTime();
      if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
        latest = t;
      }
    }
  }
  return latest;
}

/**
 * Returns true if there are any open SecurityIncidentRaised events that have
 * not been paired with a SecurityIncidentRated event from Rashida within 1h
 * of the incident being raised.
 *
 * Approximation: checks whether any SecurityIncidentRaised event is more than
 * 1h old without a corresponding SecurityIncidentRated from Rashida. A full
 * per-incident pairing register is a substrate gap (§16).
 */
function hasUnactivatedIncidentCommand(): boolean {
  let latestIncidentRaised: number | undefined;
  let latestIncidentRated: number | undefined;

  for (const e of eventStore.replay({ type: "SecurityIncidentRaised" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latestIncidentRaised === undefined || t > latestIncidentRaised)) {
      latestIncidentRaised = t;
    }
  }

  for (const e of eventStore.replay({ type: "SecurityIncidentRated" })) {
    const p = e.payload as Record<string, unknown>;
    const actor = String(p.agentUrn ?? p.issuingAgent ?? "");
    if (/rashida/i.test(actor) || actor === "agent:rashida") {
      const t = new Date(e.as_of).getTime();
      if (!Number.isNaN(t) && (latestIncidentRated === undefined || t > latestIncidentRated)) {
        latestIncidentRated = t;
      }
    }
  }

  // Unactivated if an incident was raised > 1h ago and no rating from Rashida
  // has been issued since the incident was raised.
  return (
    latestIncidentRaised !== undefined &&
    Date.now() - latestIncidentRaised > ONE_HOUR_MS &&
    (latestIncidentRated === undefined || latestIncidentRated < latestIncidentRaised)
  );
}

/**
 * Returns the timestamp (ms) of the most recent ThreatModelApproved event,
 * or undefined if none exists.
 */
function lastThreatModelApprovedMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "ThreatModelApproved" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns the timestamp (ms) of the most recent KeyRotationCompleted event,
 * or undefined if none exists.
 */
function lastKeyRotationCompletedMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "KeyRotationCompleted" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Goal-derivation rule engine for Rashida
// ---------------------------------------------------------------------------

export const rashidaGoalDeriver: GoalDeriver = async (
  args: RunWithGoalArgs,
): Promise<GoalLoopOutcome> => {
  const { spec } = args;

  logger.info(
    {
      agentUrn: args.agent.urn,
      worldStateHash: args.worldState.snapshotHash,
      recentRunCount: args.recentRuns.length,
      openFindings: args.worldState.auditFindingsForMe.length,
      openEscalations: args.worldState.openEscalationsAddressedToMe.length,
    },
    "rashida-goal-deriver: evaluating candidates",
  );

  const specHash = spec.specHash;

  // Helper: validate a goal is in the closed-set (T-NEW self-check).
  function inClosedSet(goal: string): boolean {
    const ok = spec.decisionsInScope.includes(goal);
    if (!ok) {
      logger.warn(
        { agentUrn: args.agent.urn, goal, closedSet: spec.decisionsInScope },
        "rashida-goal-deriver: goal not in closed-set; deferring",
      );
    }
    return ok;
  }

  // Helper: resolve a procedure step-ID from spec, with coverage-gap fallback.
  function resolveStepId(procedurePath: string, fallback: string): string {
    const entry = spec.procedureSteps.find((s) => s.procedurePath === procedurePath);
    return entry && entry.stepIds.length > 0 ? (entry.stepIds[0] ?? fallback) : fallback;
  }

  // -------------------------------------------------------------------------
  // Candidate 1: no CyberResilienceSnapshot in the past 24h from Rashida →
  // "Sign the second-line cyber opinion to AC / Risk Forum" (priority HIGH).
  // Per §6: weekly threat-model-gate review; the 24h inactivity SLA here
  // guards the continuous cyber-resilience posture channel.
  // -------------------------------------------------------------------------

  const lastSnapshot = lastCyberResilienceSnapshotMs();
  const needsSnapshot =
    lastSnapshot === undefined || Date.now() - lastSnapshot > TWENTY_FOUR_HOURS_MS;

  if (needsSnapshot) {
    if (!inClosedSet(GOAL_SIGN_SECOND_LINE_CYBER_OPINION)) return null;

    const stepId = resolveStepId(PROCEDURE_INCIDENT_RESPONSE, STEP_CYBER_RESILIENCE);

    logger.info(
      {
        agentUrn: args.agent.urn,
        lastSnapshotAgo: lastSnapshot
          ? `${Math.round((Date.now() - lastSnapshot) / 60_000)}min`
          : "never",
      },
      "rashida-goal-deriver: no CyberResilienceSnapshot in 24h — selecting second-line cyber opinion goal",
    );

    return {
      kind: "decision",
      chosen: GOAL_SIGN_SECOND_LINE_CYBER_OPINION,
      rationale: `No CyberResilienceSnapshot event from Rashida in the last 24 hours (last seen: ${lastSnapshot ? new Date(lastSnapshot).toISOString() : "never"}). Rashida's §6 continuous posture channel requires a fresh snapshot at least every 24h. Selecting second-line cyber opinion goal to trigger the rashida:cyber-resilience-snapshot handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: GOAL_SIGN_SECOND_LINE_CYBER_OPINION,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: PROCEDURE_INCIDENT_RESPONSE,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "CyberResilienceSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "rashida-goal-loop",
          },
        },
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Candidate 2: open SecurityIncidentRaised with no incident-command
  // activation in 1h → "Sign `SecurityIncident` severity rating" (priority CRITICAL).
  // Per §7: JS-1-of-2024 reportability threshold governs response windows;
  // incident command must be activated within 1h of incident raised.
  // -------------------------------------------------------------------------

  const hasUnactivated = hasUnactivatedIncidentCommand();

  if (hasUnactivated) {
    if (!inClosedSet(GOAL_SIGN_INCIDENT_SEVERITY_RATING)) return null;

    const stepId = resolveStepId(PROCEDURE_CYBER_INCIDENT_COMMAND, STEP_INCIDENT_COMMAND);

    logger.info(
      { agentUrn: args.agent.urn },
      "rashida-goal-deriver: SecurityIncidentRaised > 1h without SecurityIncidentRated — selecting incident severity rating goal",
    );

    return {
      kind: "decision",
      chosen: GOAL_SIGN_INCIDENT_SEVERITY_RATING,
      rationale:
        "Open SecurityIncidentRaised event detected without a corresponding SecurityIncidentRated from Rashida within 1 hour. §7 mandates incident-command activation within 1h per Joint-Standard 1 of 2024 notification windows. Selecting incident severity rating goal to activate command and issue severity rating.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: GOAL_SIGN_INCIDENT_SEVERITY_RATING,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: PROCEDURE_CYBER_INCIDENT_COMMAND,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "SecurityIncidentRated",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "rashida-goal-loop",
            action: "incident-command-activation",
          },
        },
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Candidate 3: no ThreatModelApproved in the past 7 days →
  // "Sign / refuse threat-model-gate exceptions" (priority MEDIUM).
  // Per §6: weekly threat-model-gate sign-off review with Senna.
  // Absence > 7 days means the gate cadence has lapsed.
  // -------------------------------------------------------------------------

  const lastThreatModel = lastThreatModelApprovedMs();
  const needsThreatModel =
    lastThreatModel === undefined || Date.now() - lastThreatModel > SEVEN_DAYS_MS;

  if (needsThreatModel) {
    if (!inClosedSet(GOAL_SIGN_THREAT_MODEL_GATE_EXCEPTIONS)) return null;

    const stepId = resolveStepId(PROCEDURE_THREAT_MODEL_GATE, STEP_THREAT_MODEL);

    logger.info(
      {
        agentUrn: args.agent.urn,
        lastThreatModelAgo: lastThreatModel
          ? `${Math.round((Date.now() - lastThreatModel) / (60_000 * 60 * 24))}d`
          : "never",
      },
      "rashida-goal-deriver: no ThreatModelApproved in 7d — selecting threat-model gate review goal",
    );

    return {
      kind: "decision",
      chosen: GOAL_SIGN_THREAT_MODEL_GATE_EXCEPTIONS,
      rationale: `No ThreatModelApproved event in the last 7 days (last seen: ${lastThreatModel ? new Date(lastThreatModel).toISOString() : "never"}). Rashida's §6 weekly threat-model-gate sign-off cadence with Senna is overdue. Selecting threat-model-gate exceptions goal to review and sign or refuse pending gate decisions.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: GOAL_SIGN_THREAT_MODEL_GATE_EXCEPTIONS,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: PROCEDURE_THREAT_MODEL_GATE,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "ThreatModelGateDecision",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "rashida-goal-loop",
          },
        },
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Candidate 4: no KeyRotationCompleted in the past 30 days →
  // "Sign / refuse key-rotation cadence amendments" (priority MEDIUM).
  // Per §6 and §9: FIPS 140-2/3 boundary discipline governs rotation cadence;
  // 30-day absence signals the rotation schedule has lapsed.
  // -------------------------------------------------------------------------

  const lastKeyRotation = lastKeyRotationCompletedMs();
  const needsKeyRotation =
    lastKeyRotation === undefined || Date.now() - lastKeyRotation > THIRTY_DAYS_MS;

  if (needsKeyRotation) {
    if (!inClosedSet(GOAL_SIGN_KEY_ROTATION_CADENCE)) return null;

    const stepId = resolveStepId(PROCEDURE_KEY_CEREMONY, STEP_KEY_ROTATION);

    logger.info(
      {
        agentUrn: args.agent.urn,
        lastKeyRotationAgo: lastKeyRotation
          ? `${Math.round((Date.now() - lastKeyRotation) / (60_000 * 60 * 24))}d`
          : "never",
      },
      "rashida-goal-deriver: no KeyRotationCompleted in 30d — selecting key-rotation cadence review goal",
    );

    return {
      kind: "decision",
      chosen: GOAL_SIGN_KEY_ROTATION_CADENCE,
      rationale: `No KeyRotationCompleted event in the last 30 days (last seen: ${lastKeyRotation ? new Date(lastKeyRotation).toISOString() : "never"}). Rashida's §9 key-rotation cadence governance requires sign-off on rotation schedule under FIPS 140-2/3 boundary discipline. Selecting key-rotation cadence amendments goal to review and approve the rotation schedule.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: GOAL_SIGN_KEY_ROTATION_CADENCE,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: PROCEDURE_KEY_CEREMONY,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "KeyRotationCadenceApproved",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "rashida-goal-loop",
          },
        },
      ],
    };
  }

  // No goal justified — defer.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastSnapshotAgo: lastSnapshot
        ? `${Math.round((Date.now() - lastSnapshot) / 60_000)}min`
        : "never",
      lastThreatModelAgo: lastThreatModel
        ? `${Math.round((Date.now() - lastThreatModel) / (60_000 * 60 * 24))}d`
        : "never",
      lastKeyRotationAgo: lastKeyRotation
        ? `${Math.round((Date.now() - lastKeyRotation) / (60_000 * 60 * 24))}d`
        : "never",
    },
    "rashida-goal-deriver: no action justified — deferring",
  );
  return null;
};

// ---------------------------------------------------------------------------
// Lazy singletons — avoid re-constructing per handler call.
// ---------------------------------------------------------------------------

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
// Handler (wired as `rashida:goal-loop`)
//
// Shadow mode: shadowMode: true — cohort-3; first two substrate ticks run in
// shadow mode per spec §4. Goal-loop events are emitted so the trace is
// testable; the underlying handler is always called with dryRun=true.
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// rashida:cyber-resilience-snapshot handler directly via its imported callable.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "rashida:goal-loop — starting goal-loop cohort-3 run (shadow mode)",
  );

  const agentUrn = "agent:rashida";

  // Parse Rashida's spec.
  const parseResult = parseSpecFile(RASHIDA_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: RASHIDA_SPEC_PATH },
      "rashida:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await rashidaCyberResilienceSnapshot(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, rashidaGoalDeriver);

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
    "rashida:goal-loop — goal-loop iteration complete",
  );

  // Shadow mode (cohort-3): always dry-run the underlying handler so we
  // observe the trace without side-effects, regardless of goal outcome.
  // The handler will be promoted to live once cohort validation passes.
  const handlerCtx: AgentRunContext = {
    ...ctx,
    dryRun: true, // shadowMode: true until cohort-3 validation passes
  };

  const handlerOutput = await rashidaCyberResilienceSnapshot(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "rashida:goal-loop — cohort-3 shadow run complete",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-3 shadow: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
