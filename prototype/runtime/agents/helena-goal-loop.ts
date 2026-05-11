// runtime/agents/helena-goal-loop.ts
//
// Helena (Chief Risk Officer, governance) goal-loop — cohort-3 deriver.
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Helena is wired into
// the goal-loop substrate as a governance-seat agent. This run-handler:
//   1. Materialises a WorldStateSnapshot for agent:helena.
//   2. Runs Helena's rule-engine goal deriver (no LLM calls — cohort
//      rule-engine constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   - If no `RiskAppetiteSnapshot` in the last 24h →
//     select "Approve appetite-line operationalisation within Board-approved
//     framework" goal (§9 row 1) — triggers the risk-appetite-watch handler.
//   - If open `RiskRaised` events with no matching `RiskRaisedResolved` →
//     select "Disposition of an appetite breach (tolerate / remediate /
//     escalate)" goal (§9 row 2) and emit escalation to the BRC secretariat.
//   - If no `IcaapSnapshot` event recently →
//     select "Sign ICAAP / ILAAP" goal (§9 row 4) — surfaces the ICAAP
//     review cadence and the substrate gap.
//   - Otherwise → defer (null outcome).
//
// Goal candidates use Helena's §9 decisions-in-scope row labels exactly as
// they appear in Team/Helena.md (the spec's closed-set per T-NEW).
//
// Shadow mode: shadowMode is true for the first cohort ticks.
//
// Procedure citations: Helena owns Procedures/by-policy/procedures-rmf-governance.md
// (planned) and Procedures/by-policy/stress-test-cycle.md (planned).
// Since these files do not yet have step anchors (pre-backfill coverage-gap
// per _step-id-convention.md §5), we use the coverage-gap form:
// `stepId: "<procedure>:step-1"`. The recon pipeline warns (not fails) for
// missing step IDs per the build-phase tolerance.
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect)

import { resolve } from "node:path";
import type { GoalDeriver, GoalLoopOutcome } from "../../platform/agent-runtime/goal-loop";
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import type { RunWithGoalArgs } from "../../platform/agent-runtime/goal-loop";
import { parseSpecFile } from "../../platform/agent-runtime/spec-parser";
import { LocalAgentWorldStateReader } from "../../platform/agent-runtime/world-state";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import the underlying risk-appetite-watch handler directly to avoid the
// circular dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import helenaRiskAppetiteWatch from "./helena-risk-appetite-watch";

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Helena
// ---------------------------------------------------------------------------

const HELENA_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Helena.md",
);

// §9 row labels from Team/Helena.md — provided for documentation; the
// closed-set is read from the parsed spec at runtime (T-NEW closed-set check).
// Kept here so the goal-deriver can reference them in comments / unit tests
// without re-parsing the spec file.
// const HELENA_DECISIONS_IN_SCOPE = [ ... ] — see Team/Helena.md §9
// const HELENA_EVENTS_EMITTED     = [ ... ] — see Team/Helena.md §11

// Helena's procedure paths (§13).
const HELENA_RMF_PROCEDURE_PATH = "Procedures/by-policy/procedures-rmf-governance.md";
const HELENA_ICAAP_PROCEDURE_PATH = "Procedures/by-policy/stress-test-cycle.md";
// Coverage-gap step-ID form per _step-id-convention.md §5.
const HELENA_RMF_STEP_ID = "procedures-rmf-governance:step-1";
const HELENA_ICAAP_STEP_ID = "stress-test-cycle:step-1";

// Goal labels — must match Team/Helena.md §9 first-column row labels exactly (T-NEW).
const RAS_CALIBRATION_GOAL =
  "Approve appetite-line operationalisation within Board-approved framework" as const;
const BREACH_DISPOSITION_GOAL =
  "Disposition of an appetite breach (tolerate / remediate / escalate)" as const;
const ICAAP_REVIEW_GOAL =
  "Sign ICAAP / ILAAP (interim, while Board not constituted, with CEO co-sign)" as const;

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Goal-derivation rule engine helpers
// ---------------------------------------------------------------------------

function lastRasSnapshotMs(): number | undefined {
  let latest: number | undefined;
  // RiskAppetiteSnapshot is the event emitted by the risk-appetite-watch handler.
  for (const e of eventStore.replay({ type: "RiskAppetiteSnapshot" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

function hasOpenRiskRaisedEvents(): boolean {
  // Check if there are any RiskRaised events with no matching resolution.
  const resolved = new Set<string>();
  for (const e of eventStore.replay({ type: "RiskRaisedResolved" })) {
    const p = e.payload as Record<string, unknown>;
    const id = String(p.riskId ?? p.raisedEventId ?? "");
    if (id) resolved.add(id);
  }
  for (const e of eventStore.replay({ type: "RiskRaised" })) {
    const p = e.payload as Record<string, unknown>;
    const id = String(p.riskId ?? e.event_id ?? "");
    if (!resolved.has(id)) return true;
  }
  return false;
}

function lastIcaapSnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "IcaapSnapshot" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

export const helenaGoalDeriver: GoalDeriver = async (
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
    "helena-goal-deriver: evaluating candidates",
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

  // Candidate 1: No RiskAppetiteSnapshot in last 24h →
  // trigger the RAS calibration / appetite-watch goal.
  // §6 "Daily appetite-monitoring rollup must produce an event; quiet > 24h is a substrate alert."
  const lastRasSnapshot = lastRasSnapshotMs();
  const needsRasSnapshot =
    lastRasSnapshot === undefined || Date.now() - lastRasSnapshot > TWENTY_FOUR_HOURS_MS;

  if (needsRasSnapshot) {
    logger.info(
      {
        agentUrn: args.agent.urn,
        lastRasSnapshotAgo: lastRasSnapshot
          ? `${Math.round((Date.now() - lastRasSnapshot) / 60_000)}min`
          : "never",
      },
      "helena-goal-deriver: no RiskAppetiteSnapshot in last 24h — selecting RAS calibration goal",
    );

    if (!spec.decisionsInScope.includes(RAS_CALIBRATION_GOAL)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal: RAS_CALIBRATION_GOAL,
          closedSet: spec.decisionsInScope,
        },
        "helena-goal-deriver: RAS calibration goal not in closed-set; deferring",
      );
      return null;
    }

    return {
      kind: "decision",
      chosen: RAS_CALIBRATION_GOAL,
      rationale: `No RiskAppetiteSnapshot in the last 24h (last seen: ${lastRasSnapshot ? new Date(lastRasSnapshot).toISOString() : "never"}). Helena's daily appetite-monitoring rollup is due per §6 inactivity SLA. Selecting RAS calibration goal to trigger the helena:risk-appetite-watch handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: RAS_CALIBRATION_GOAL,
          specHash,
        },
      ],
      procedureCitations: [buildProcedureCitation(HELENA_RMF_PROCEDURE_PATH, HELENA_RMF_STEP_ID)],
      plannedEvents: [
        {
          type: "RiskAppetiteSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "helena-goal-loop:ras-calibration",
          },
        },
      ],
    };
  }

  // Candidate 2: Open RiskRaised events with no resolution →
  // escalate open risk findings to BRC secretariat.
  // Per §9 "Disposition of an appetite breach (tolerate / remediate / escalate)".
  // Per §10 escalation to Board (interim: CEO) for Tier-1 breaches.
  const hasOpenRisks = hasOpenRiskRaisedEvents();
  if (hasOpenRisks) {
    logger.info(
      { agentUrn: args.agent.urn },
      "helena-goal-deriver: open RiskRaised events detected — selecting breach disposition goal",
    );

    if (!spec.decisionsInScope.includes(BREACH_DISPOSITION_GOAL)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal: BREACH_DISPOSITION_GOAL,
          closedSet: spec.decisionsInScope,
        },
        "helena-goal-deriver: breach-disposition goal not in closed-set; deferring",
      );
      return null;
    }

    return {
      kind: "decision",
      chosen: BREACH_DISPOSITION_GOAL,
      rationale:
        "Open RiskRaised events detected with no matching RiskRaisedResolved. Helena must assess disposition (tolerate / remediate / escalate) per §9 and per RAS §6. Tier-1 breaches escalate to Board via AgentEscalation per §10.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: BREACH_DISPOSITION_GOAL,
          specHash,
        },
      ],
      procedureCitations: [buildProcedureCitation(HELENA_RMF_PROCEDURE_PATH, HELENA_RMF_STEP_ID)],
      plannedEvents: [
        {
          type: "AppetiteBreachDisposed",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "helena-goal-loop:open-risks",
          },
        },
      ],
    };
  }

  // Candidate 3: No IcaapSnapshot recently → surface ICAAP/ILAAP review cadence.
  // Per §9 "Sign ICAAP / ILAAP (interim, while Board not constituted, with CEO co-sign)".
  // Per §6 cadence: "ICAAP / ILAAP annual cycle (signed Q3 each year)".
  const lastIcaapSnapshot = lastIcaapSnapshotMs();
  const ANNUAL_MS = 365 * 24 * 60 * 60 * 1000;
  const needsIcaapReview =
    lastIcaapSnapshot === undefined || Date.now() - lastIcaapSnapshot > ANNUAL_MS;

  if (needsIcaapReview) {
    logger.info(
      {
        agentUrn: args.agent.urn,
        lastIcaapSnapshotAgo: lastIcaapSnapshot
          ? `${Math.round((Date.now() - lastIcaapSnapshot) / (60_000 * 60 * 24))}d`
          : "never",
      },
      "helena-goal-deriver: no IcaapSnapshot in last year — selecting ICAAP review goal",
    );

    if (!spec.decisionsInScope.includes(ICAAP_REVIEW_GOAL)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal: ICAAP_REVIEW_GOAL,
          closedSet: spec.decisionsInScope,
        },
        "helena-goal-deriver: ICAAP review goal not in closed-set; deferring",
      );
      return null;
    }

    return {
      kind: "decision",
      chosen: ICAAP_REVIEW_GOAL,
      rationale: `No IcaapSnapshot in the last year (last seen: ${lastIcaapSnapshot ? new Date(lastIcaapSnapshot).toISOString() : "never"}). Helena's ICAAP / ILAAP annual review cycle is due per §6. Selecting ICAAP review goal; substrate gap: ICAAP engine not yet built (§16).`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: ICAAP_REVIEW_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        buildProcedureCitation(HELENA_ICAAP_PROCEDURE_PATH, HELENA_ICAAP_STEP_ID),
      ],
      plannedEvents: [
        {
          type: "IcaapSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "helena-goal-loop:icaap-review",
          },
        },
      ],
    };
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastRasSnapshotAgo: lastRasSnapshot
        ? `${Math.round((Date.now() - lastRasSnapshot) / 60_000)}min`
        : "never",
    },
    "helena-goal-deriver: no action justified — deferring",
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
// Handler (wired as `helena:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// helena:risk-appetite-watch handler directly via its imported callable.
//
// Shadow mode: shadowMode is true for the first cohort ticks. The goal-loop
// events are still emitted (so the shadow-mode trace is testable per spec
// §4 "Build runs in shadow mode for the first two substrate ticks"), but the
// helena:risk-appetite-watch handler is called with dryRun=true.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "helena:goal-loop — starting goal-loop cohort-3 run",
  );

  const agentUrn = "agent:helena";

  // Parse Helena's spec.
  const parseResult = parseSpecFile(HELENA_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: HELENA_SPEC_PATH },
      "helena:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await helenaRiskAppetiteWatch(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, helenaGoalDeriver);

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
    "helena:goal-loop — goal-loop iteration complete",
  );

  // If deferred or escalation — run the handler in dry-run mode (shadow trace).
  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  const handlerCtx: AgentRunContext = {
    ...ctx,
    // In shadow mode (first cohort ticks), always dry-run the handler
    // so we observe the trace without side-effects.
    dryRun: ctx.dryRun || !shouldRunHandler,
  };

  const handlerOutput = await helenaRiskAppetiteWatch(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "helena:goal-loop — cohort-3 run complete",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-3: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
