// runtime/agents/owen-goal-loop.ts
//
// Owen (Company Secretary, governance) goal-loop — cohort-2 deriver.
//
// Phase: D-AGENT-AUTONOMY-OPERATIONAL Slice 3 — per-persona goal-loop substrate.
// This handler wires Owen into the goal-loop substrate introduced in PR #226.
// Pattern follows `atlas-goal-loop.ts` (cohort-1 reference implementation).
//
// Rule-engine goal derivation (no LLM calls — rule-engine-only constraint per
// spec §3.4 "MUST NOT — LLM cost-cap"):
//   - If no GovernanceCyclePrep event in the last 24 hours → select
//     "Approve forum / committee agendas" goal.
//   - If open ConflictDeclared or RelatedPartyTransactionProposed events →
//     select "Approve conflicts / related-party register entries" goal.
//   - If no canonical-source registry review in the last 24 hours (no
//     CeoDecision or GovernanceCyclePrep in the last 24h) → select
//     "Approve canonical-source-registry entries" goal.
//   - Otherwise → defer (null).
//
// Shadow mode: shadowMode: true until cohort-2 validation passes.
// The goal-loop events (AgentGoalEvaluated, AgentGoalSelected, AgentGoalDeferred)
// are still emitted in shadow mode so the trace is testable per spec §4.
//
// Procedure citations: Owen owns:
//   - `Procedures/by-policy/conflicts-declaration.md` (live)
//   - `Procedures/by-policy/ceo-decision-review.md` (live, with Scrooge)
//   - `Procedures/by-policy/canonical-source-registry-cycle.md` (planned)
// Coverage-gap step-ID form per _step-id-convention.md §5 used for planned
// procedures that do not yet have step anchors.
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Owen (Company Secretary, governance) · Atlas (Core banking platform architect)

import { resolve } from "node:path";
import type { GoalDeriver, GoalLoopOutcome } from "../../platform/agent-runtime/goal-loop";
import { LocalAgentGoalLoopRunner } from "../../platform/agent-runtime/goal-loop";
import type { RunWithGoalArgs } from "../../platform/agent-runtime/goal-loop";
import { parseSpecFile } from "../../platform/agent-runtime/spec-parser";
import { LocalAgentWorldStateReader } from "../../platform/agent-runtime/world-state";
import { eventStore, logger } from "../../platform/composition";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import Owen's underlying handler directly to avoid circular dependency
// (handler-callables.ts → this file → handler-callables.ts).
import owenGovernanceCyclePrep from "./owen-governance-cycle-prep";

// ---------------------------------------------------------------------------
// Spec path
// ---------------------------------------------------------------------------

const OWEN_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Owen.md",
);

// ---------------------------------------------------------------------------
// §9 row labels from Team/Owen.md used by the goal deriver.
// These must match the exact row labels in Owen's spec §9 decisions-in-scope
// for the closed-set validation (T-NEW) to pass.
// ---------------------------------------------------------------------------

const GOAL_APPROVE_FORUM_AGENDAS = "Approve forum / committee agendas" as const;
const GOAL_APPROVE_CONFLICTS_REGISTER =
  "Approve conflicts / related-party register entries" as const;
const GOAL_APPROVE_CANONICAL_REGISTRY = "Approve canonical-source-registry entries" as const;

// ---------------------------------------------------------------------------
// Procedure paths (§13 of Owen's spec)
// ---------------------------------------------------------------------------

const PROCEDURE_CONFLICTS_DECLARATION = "Procedures/by-policy/conflicts-declaration.md";
const PROCEDURE_CEO_DECISION_REVIEW = "Procedures/by-policy/ceo-decision-review.md";
const PROCEDURE_CANONICAL_REGISTRY_CYCLE =
  "Procedures/by-policy/canonical-source-registry-cycle.md";

// Coverage-gap step-ID form per _step-id-convention.md §5 (planned procedures).
const STEP_GOVERNANCE_CYCLE = "conflicts-declaration:step-1";
const STEP_CONFLICTS_REGISTER = "conflicts-declaration:step-2";
const STEP_CANONICAL_REGISTRY = "canonical-source-registry-cycle:step-1";

// ---------------------------------------------------------------------------
// Rule-engine helpers
// ---------------------------------------------------------------------------

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/** Returns the timestamp (ms) of the most recent GovernanceCyclePrep event, or undefined. */
function lastGovernanceCyclePrepMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "GovernanceCyclePrep" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns true if there are any open ConflictDeclared or
 * RelatedPartyTransactionProposed events without a corresponding
 * ConflictRegistered / RelatedPartyRegistered closure.
 *
 * Approximation: checks whether any event of those types exists and whether
 * a corresponding closure event was emitted after it. This is a build-phase
 * heuristic; a full set-reconciliation register is a substrate gap (§16).
 */
function hasOpenConflictOrRelatedPartyItems(): boolean {
  let lastConflictDeclared: number | undefined;
  let lastRelatedPartyProposed: number | undefined;
  let lastConflictRegistered: number | undefined;
  let lastRelatedPartyRegistered: number | undefined;

  for (const e of eventStore.replay({ type: "ConflictDeclared" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (lastConflictDeclared === undefined || t > lastConflictDeclared)) {
      lastConflictDeclared = t;
    }
  }
  for (const e of eventStore.replay({ type: "RelatedPartyTransactionProposed" })) {
    const t = new Date(e.as_of).getTime();
    if (
      !Number.isNaN(t) &&
      (lastRelatedPartyProposed === undefined || t > lastRelatedPartyProposed)
    ) {
      lastRelatedPartyProposed = t;
    }
  }
  for (const e of eventStore.replay({ type: "ConflictRegistered" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (lastConflictRegistered === undefined || t > lastConflictRegistered)) {
      lastConflictRegistered = t;
    }
  }
  for (const e of eventStore.replay({ type: "RelatedPartyRegistered" })) {
    const t = new Date(e.as_of).getTime();
    if (
      !Number.isNaN(t) &&
      (lastRelatedPartyRegistered === undefined || t > lastRelatedPartyRegistered)
    ) {
      lastRelatedPartyRegistered = t;
    }
  }

  // Open if a declaration/proposal is more recent than any closure.
  const hasOpenConflict =
    lastConflictDeclared !== undefined &&
    (lastConflictRegistered === undefined || lastConflictDeclared > lastConflictRegistered);
  const hasOpenRelatedParty =
    lastRelatedPartyProposed !== undefined &&
    (lastRelatedPartyRegistered === undefined ||
      lastRelatedPartyProposed > lastRelatedPartyRegistered);

  return hasOpenConflict || hasOpenRelatedParty;
}

/**
 * Returns the timestamp (ms) of the most recent canonical-source-registry
 * activity proxy (GovernanceCyclePrep or CeoDecision), or undefined.
 *
 * The canonical-source registry is reviewed as part of Owen's weekly prep;
 * a CeoDecision event is also a proxy for canonical-registry activity since
 * Owen reviews registry entries on the back of each approved decision.
 */
function lastCanonicalRegistryActivityMs(): number | undefined {
  let latest = lastGovernanceCyclePrepMs();
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Goal-derivation rule engine for Owen
// ---------------------------------------------------------------------------

export const owenGoalDeriver: GoalDeriver = async (
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
    "owen-goal-deriver: evaluating candidates",
  );

  const specHash = spec.specHash;

  // Helper: validate a goal is in the closed-set (T-NEW self-check).
  function inClosedSet(goal: string): boolean {
    const ok = spec.decisionsInScope.includes(goal);
    if (!ok) {
      logger.warn(
        { agentUrn: args.agent.urn, goal, closedSet: spec.decisionsInScope },
        "owen-goal-deriver: goal not in closed-set; deferring",
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
  // Candidate 1: no GovernanceCyclePrep in the last 24h → forum-agenda goal.
  // Owen's weekly cadence (§6) requires a governance-cycle-prep event at
  // minimum each business week; absence > 24h in any run triggers the goal.
  // -------------------------------------------------------------------------

  const lastGovPrep = lastGovernanceCyclePrepMs();
  const needsGovPrep = lastGovPrep === undefined || Date.now() - lastGovPrep > TWENTY_FOUR_HOURS_MS;

  if (needsGovPrep) {
    if (!inClosedSet(GOAL_APPROVE_FORUM_AGENDAS)) return null;

    const stepId = resolveStepId(PROCEDURE_CEO_DECISION_REVIEW, STEP_GOVERNANCE_CYCLE);

    logger.info(
      {
        agentUrn: args.agent.urn,
        lastGovPrepAgo: lastGovPrep
          ? `${Math.round((Date.now() - lastGovPrep) / 60_000)}min`
          : "never",
      },
      "owen-goal-deriver: no governance-cycle-prep in 24h — selecting forum-agenda goal",
    );

    return {
      kind: "decision",
      chosen: GOAL_APPROVE_FORUM_AGENDAS,
      rationale: `No GovernanceCyclePrep event in the last 24h (last seen: ${lastGovPrep ? new Date(lastGovPrep).toISOString() : "never"}). Owen's weekly forum-prep cadence is overdue. Selecting forum/committee agendas goal to trigger the owen:governance-cycle-prep handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: GOAL_APPROVE_FORUM_AGENDAS,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: PROCEDURE_CEO_DECISION_REVIEW,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "GovernanceCyclePrep",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "owen-goal-loop",
          },
        },
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Candidate 2: open conflicts or related-party items → escalate register.
  // Per §7 Triggers: ConflictDeclared → within 24h; RelatedPartyTransaction-
  // Proposed → within 5 working days, pre-decision.
  // -------------------------------------------------------------------------

  const openConflictItems = hasOpenConflictOrRelatedPartyItems();

  if (openConflictItems) {
    if (!inClosedSet(GOAL_APPROVE_CONFLICTS_REGISTER)) return null;

    const stepId = resolveStepId(PROCEDURE_CONFLICTS_DECLARATION, STEP_CONFLICTS_REGISTER);

    logger.info(
      { agentUrn: args.agent.urn },
      "owen-goal-deriver: open conflict / related-party items — selecting conflicts-register goal",
    );

    return {
      kind: "decision",
      chosen: GOAL_APPROVE_CONFLICTS_REGISTER,
      rationale:
        "Open ConflictDeclared or RelatedPartyTransactionProposed events detected without corresponding closure. Owen's §7 trigger mandates a 24h response SLA for ConflictDeclared. Selecting conflicts/related-party register entries goal to trigger escalation.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: GOAL_APPROVE_CONFLICTS_REGISTER,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: PROCEDURE_CONFLICTS_DECLARATION,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "ConflictRegistered",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "owen-goal-loop",
          },
        },
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Candidate 3: no RMS/canonical-registry activity in the last 24h.
  // The canonical-source registry is Owen's standing curation responsibility
  // (§3 mandate, §9 row: "Approve canonical-source-registry entries").
  // After any new CeoDecision or GovernanceCyclePrep, Owen validates that
  // the registry still reflects the current canonical sources.
  // -------------------------------------------------------------------------

  const lastRegistryActivity = lastCanonicalRegistryActivityMs();
  const needsRegistryReview =
    lastRegistryActivity === undefined || Date.now() - lastRegistryActivity > TWENTY_FOUR_HOURS_MS;

  if (needsRegistryReview) {
    if (!inClosedSet(GOAL_APPROVE_CANONICAL_REGISTRY)) return null;

    const stepId = resolveStepId(PROCEDURE_CANONICAL_REGISTRY_CYCLE, STEP_CANONICAL_REGISTRY);

    logger.info(
      {
        agentUrn: args.agent.urn,
        lastActivityAgo: lastRegistryActivity
          ? `${Math.round((Date.now() - lastRegistryActivity) / 60_000)}min`
          : "never",
      },
      "owen-goal-deriver: no RMS status / canonical-registry activity in 24h — selecting registry goal",
    );

    return {
      kind: "decision",
      chosen: GOAL_APPROVE_CANONICAL_REGISTRY,
      rationale: `No canonical-source-registry activity (GovernanceCyclePrep or CeoDecision) in the last 24h (last seen: ${lastRegistryActivity ? new Date(lastRegistryActivity).toISOString() : "never"}). Owen's standing curation responsibility for the canonical-source registry is due. Selecting registry entries goal.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: GOAL_APPROVE_CANONICAL_REGISTRY,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: PROCEDURE_CANONICAL_REGISTRY_CYCLE,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "AgentDecision",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "owen-goal-loop",
            subject: "canonical-source-registry-review",
          },
        },
      ],
    };
  }

  // No goal justified — defer.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastGovPrepAgo: lastGovPrep
        ? `${Math.round((Date.now() - lastGovPrep) / 60_000)}min`
        : "never",
    },
    "owen-goal-deriver: no action justified — deferring",
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
// Handler (wired as `owen:goal-loop`)
//
// Shadow mode: shadowMode: true for cohort-2 until validation passes.
// Goal-loop events (AgentGoalEvaluated / AgentGoalSelected / AgentGoalDeferred)
// are emitted so the trace is testable per spec §4. The underlying
// owen:governance-cycle-prep handler is called with dryRun=true in shadow mode
// so we observe the trace without side-effects.
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// owen:governance-cycle-prep handler directly via its imported callable.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "owen:goal-loop — starting goal-loop cohort-2 run (shadow mode)",
  );

  const agentUrn = "agent:owen";

  // Parse Owen's spec.
  const parseResult = parseSpecFile(OWEN_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: OWEN_SPEC_PATH },
      "owen:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await owenGovernanceCyclePrep(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, owenGoalDeriver);

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
    "owen:goal-loop — goal-loop iteration complete",
  );

  // Shadow mode (cohort-2): always dry-run the underlying handler so we
  // observe the trace without side-effects, regardless of goal outcome.
  // The handler will be promoted to live once cohort validation passes.
  const handlerCtx: AgentRunContext = {
    ...ctx,
    dryRun: true, // shadowMode: true until cohort-2 validation passes
  };

  const handlerOutput = await owenGovernanceCyclePrep(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "owen:goal-loop — cohort-2 shadow run complete",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-2 shadow: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
