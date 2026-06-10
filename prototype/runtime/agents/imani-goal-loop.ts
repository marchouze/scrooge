// runtime/agents/imani-goal-loop.ts
//
// Imani (Legal-as-Code Engineer) goal-loop — cohort-3 deriver.
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Imani is wired into the
// goal-loop substrate. This run-handler is the integration point that:
//   1. Materialises a WorldStateSnapshot for agent:imani.
//   2. Runs Imani's rule-engine goal deriver (no LLM calls — cohort-3
//      rule-engine constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   Rule 1 — No LegalReadinessSnapshot event from Imani in the past 24h
//     → select "Clause-library minor revision" goal (legal-readiness trigger;
//       priority HIGH — Imani's §6 inactivity SLA requires a daily legal
//       surface review).
//   Rule 2 — Open ContractLifecycleAlert or AgreementExpiryWarning event with
//     no response in 24h → select "Contract-template version increment" goal
//     (CLM triage per §9 mandate; priority HIGH).
//   Rule 3 — No ClauseLibraryRevised event in the past 30 days
//     → select "Clause-library minor revision" goal (periodic library hygiene;
//       priority MEDIUM).
//   Rule 4 — New LegalEntityRegistered event in the past 24h with no
//     SigningMatrixUpdated response → select "Legal-entity-tree change within
//     current jurisdictional scope (SA-only today)" goal (signing-matrix
//     sync; priority HIGH).
//
// Goal candidates use Imani's §9 decisions-in-scope row labels exactly as
// they appear in Team/Imani.md (the spec's closed-set per T-NEW).
//
// Procedure citations: Imani owns legal-entity-tree and ECTA-execution
// procedures (§13). Since step anchors may not yet be backfilled
// (pre-backfill coverage-gap per _step-id-convention.md §5), we use the
// coverage-gap form: `stepId: "<procedure>:step-1"` as a placeholder. The
// recon pipeline warns (not fails) for missing step IDs per the build-phase
// tolerance.
//
// Shadow mode: shadowMode: true for cohort-3 until cohort validation passes
// (per spec §4 "Build runs in shadow mode for the first two substrate ticks").
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect) — wiring.
//         Imani (Legal-as-Code Engineer) — goal-deriver rules.

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
  openBriefsListForAgent,
} from "./goal-loop-brief-dispatch";
// Import the underlying legal-readiness handler directly to avoid the
// circular dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import imaniLegalReadiness from "./imani-legal-readiness";

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Imani
// ---------------------------------------------------------------------------

const IMANI_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Imani.md",
);

// Procedure path for Imani's legal-entity-tree and ECTA-execution procedures (§13).
const IMANI_CLM_PROCEDURE_PATH = "Procedures/by-policy/contract-lifecycle-management.md";
// Coverage-gap step-ID form per _step-id-convention.md §5.
const IMANI_CLM_STEP_ID = "contract-lifecycle-management:step-1";

// §9 row labels from Team/Imani.md (closed-set per T-NEW).
// Rule 1 and Rule 3: legal-readiness / clause-library goal.
const CLAUSE_LIBRARY_GOAL = "Clause-library minor revision" as const;
// Rule 2: CLM triage goal.
const CONTRACT_LIFECYCLE_GOAL = "Contract-template version increment" as const;
// Rule 4: signing-matrix update goal.
const SIGNING_MATRIX_GOAL =
  "Legal-entity-tree change within current jurisdictional scope (SA-only today)" as const;

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Event-query helpers
// ---------------------------------------------------------------------------

/**
 * Returns the timestamp of the most recent LegalReadinessSnapshot event
 * emitted by Imani, or undefined if none exists.
 */
function lastLegalReadinessSnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "LegalReadinessSnapshot" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns true if there is an open ContractLifecycleAlert or
 * AgreementExpiryWarning event within the last 24h that has no
 * corresponding ContractTemplateVersioned or ClauseLibraryRevised response.
 *
 * Build-phase: response-event pairing is approximate — absence of any
 * ContractTemplateVersioned within the alert window is treated as unresolved.
 */
function hasOpenContractLifecycleAlert(): boolean {
  const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;

  // Collect alert timestamps.
  const alertTimestamps: number[] = [];
  for (const type of ["ContractLifecycleAlert", "AgreementExpiryWarning"] as const) {
    for (const e of eventStore.replay({ type })) {
      const t = new Date(e.as_of).getTime();
      if (!Number.isNaN(t) && t >= cutoff) {
        alertTimestamps.push(t);
      }
    }
  }

  if (alertTimestamps.length === 0) return false;

  // If any alert exists in the last 24h and no ContractTemplateVersioned
  // has been emitted since the earliest alert, the alert is unresolved.
  const earliestAlert = Math.min(...alertTimestamps);
  for (const e of eventStore.replay({ type: "ContractTemplateVersioned" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && t >= earliestAlert) {
      return false; // Response found.
    }
  }
  return true;
}

/**
 * Returns the timestamp of the most recent ClauseLibraryRevised event,
 * or undefined if none exists.
 */
function lastClauseLibraryRevisedMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "ClauseLibraryRevised" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns true if there is a LegalEntityRegistered event in the past 24h
 * that has no corresponding SigningMatrixUpdated response.
 *
 * Build-phase: pairing is approximate — any LegalEntityRegistered in the
 * window with no SigningMatrixUpdated after it is treated as unresolved.
 */
function hasUnsyncedLegalEntityRegistration(): boolean {
  const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;

  // Collect LegalEntityRegistered timestamps in the window.
  const registrationTimestamps: number[] = [];
  for (const e of eventStore.replay({ type: "LegalEntityRegistered" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && t >= cutoff) {
      registrationTimestamps.push(t);
    }
  }

  if (registrationTimestamps.length === 0) return false;

  // If any registration exists in the last 24h and no SigningMatrixUpdated
  // has been emitted since the earliest registration, it is unresolved.
  const earliestRegistration = Math.min(...registrationTimestamps);
  for (const e of eventStore.replay({ type: "SigningMatrixUpdated" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && t >= earliestRegistration) {
      return false; // Signing matrix already updated.
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Goal deriver
// ---------------------------------------------------------------------------

export const imaniGoalDeriver: GoalDeriver = async (
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
    "imani-goal-deriver: evaluating candidates",
  );

  const specHash = spec.specHash;

  // Build procedure citation — use coverage-gap form per §3.4 contract.
  const procedureEntry = spec.procedureSteps.find(
    (s) => s.procedurePath === IMANI_CLM_PROCEDURE_PATH,
  );
  const stepId =
    procedureEntry && procedureEntry.stepIds.length > 0
      ? (procedureEntry.stepIds[0] ?? IMANI_CLM_STEP_ID)
      : IMANI_CLM_STEP_ID;

  // Helper: validate goal is in spec closed-set before returning.
  const validateGoal = (goal: string): boolean => {
    if (!spec.decisionsInScope.includes(goal)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal,
          closedSet: spec.decisionsInScope,
        },
        "imani-goal-deriver: goal not in closed-set; deferring",
      );
      return false;
    }
    return true;
  };

  // ---------------------------------------------------------------------------
  // Rule 1: No LegalReadinessSnapshot in the past 24h (priority HIGH)
  // → goal: legal-readiness trigger (CLAUSE_LIBRARY_GOAL as §9 proxy)
  //
  // Imani's §6 inactivity SLA: daily legal-surface review must produce a
  // LegalReadinessSnapshot event; quiet > 24h is a substrate alert. The
  // CLAUSE_LIBRARY_GOAL is the §9 trigger for the imani:legal-readiness
  // handler (which emits LegalReadinessSnapshot).
  // ---------------------------------------------------------------------------

  const lastReadiness = lastLegalReadinessSnapshotMs();
  const needsReadiness =
    lastReadiness === undefined || Date.now() - lastReadiness > TWENTY_FOUR_HOURS_MS;

  if (needsReadiness) {
    if (!validateGoal(CLAUSE_LIBRARY_GOAL)) return null;

    return {
      kind: "decision",
      chosen: CLAUSE_LIBRARY_GOAL,
      rationale: `No LegalReadinessSnapshot event from Imani in the last 24h (last seen: ${lastReadiness ? new Date(lastReadiness).toISOString() : "never"}). Imani's §6 inactivity SLA (daily legal-surface review; quiet > 24h is a substrate alert) requires an immediate legal-readiness run. Selecting clause-library goal to trigger the imani:legal-readiness handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: CLAUSE_LIBRARY_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: IMANI_CLM_PROCEDURE_PATH,
          stepId,
          // SHA-256 of the procedure file is unknown at runtime without
          // reading it; use the spec hash as a proxy (coverage-gap).
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "LegalReadinessSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "imani-goal-loop:readiness-sla",
          },
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 2: Open ContractLifecycleAlert or AgreementExpiryWarning with no
  //   response in 24h (priority HIGH)
  // → goal: contract-lifecycle-action (CONTRACT_LIFECYCLE_GOAL)
  //
  // Imani's §9 mandate covers "Contract-template version increment" for
  // CLM triage. Open contract alerts without a versioned response within 24h
  // indicate a CLM gap Imani must address before execution.
  // ---------------------------------------------------------------------------

  const openContractAlert = hasOpenContractLifecycleAlert();

  if (openContractAlert) {
    if (!validateGoal(CONTRACT_LIFECYCLE_GOAL)) return null;

    return {
      kind: "decision",
      chosen: CONTRACT_LIFECYCLE_GOAL,
      rationale:
        "Open ContractLifecycleAlert or AgreementExpiryWarning event detected in the last 24h with no ContractTemplateVersioned response. Imani's §9 mandate (Contract-template version increment) requires CLM triage to ensure no expired or flagged agreements remain unaddressed before execution. Selecting contract-lifecycle goal to trigger the imani:legal-readiness handler for CLM review.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: CONTRACT_LIFECYCLE_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: IMANI_CLM_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "ContractTemplateVersioned",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "imani-goal-loop:contract-lifecycle-alert",
          },
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 3: No ClauseLibraryRevised event in the past 30 days (priority MEDIUM)
  // → goal: clause-library-review (CLAUSE_LIBRARY_GOAL)
  //
  // Imani's §6 cadence: periodic clause-library hygiene review to ensure
  // templates remain current against ISDA / ICMA precedent. Absence beyond
  // 30 days signals the review cadence has slipped.
  // ---------------------------------------------------------------------------

  const lastClauseLibrary = lastClauseLibraryRevisedMs();
  const needsClauseReview =
    lastClauseLibrary === undefined || Date.now() - lastClauseLibrary > THIRTY_DAYS_MS;

  if (needsClauseReview) {
    if (!validateGoal(CLAUSE_LIBRARY_GOAL)) return null;

    return {
      kind: "decision",
      chosen: CLAUSE_LIBRARY_GOAL,
      rationale: `No ClauseLibraryRevised event in the last 30 days (last seen: ${lastClauseLibrary ? new Date(lastClauseLibrary).toISOString() : "never"}). Imani's §6 cadence requires periodic clause-library hygiene to keep templates aligned with ISDA / ICMA precedent. Selecting clause-library goal to trigger the imani:legal-readiness handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: CLAUSE_LIBRARY_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: IMANI_CLM_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "ClauseLibraryRevised",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "imani-goal-loop:clause-library-review",
          },
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 4: New LegalEntityRegistered in past 24h with no SigningMatrixUpdated
  //   response (priority HIGH)
  // → goal: signing-matrix-update (SIGNING_MATRIX_GOAL)
  //
  // Imani's §9 mandate covers "Legal-entity-tree change within current
  // jurisdictional scope (SA-only today)". A new legal-entity registration
  // without a corresponding signing-matrix update is a CLM integrity gap
  // that must be addressed before any execution path is opened.
  // ---------------------------------------------------------------------------

  const unsyncedRegistration = hasUnsyncedLegalEntityRegistration();

  if (unsyncedRegistration) {
    if (!validateGoal(SIGNING_MATRIX_GOAL)) return null;

    return {
      kind: "decision",
      chosen: SIGNING_MATRIX_GOAL,
      rationale:
        "A LegalEntityRegistered event was detected in the last 24h with no corresponding SigningMatrixUpdated response. Imani's §9 mandate (Legal-entity-tree change within current jurisdictional scope) requires the signing matrix to be updated whenever the legal-entity tree changes — any execution path opened before the matrix is synced is a CLM integrity gap. Selecting signing-matrix goal to trigger the imani:legal-readiness handler for matrix update.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: SIGNING_MATRIX_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: IMANI_CLM_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "LegalEntityChanged",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "imani-goal-loop:signing-matrix-update",
          },
        },
      ],
    };
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastReadinessAgo: lastReadiness
        ? `${Math.round((Date.now() - lastReadiness) / 60_000)}min`
        : "never",
      lastClauseLibraryAgo: lastClauseLibrary
        ? `${Math.round((Date.now() - lastClauseLibrary) / 60_000)}min`
        : "never",
      openContractAlert,
      unsyncedRegistration,
    },
    "imani-goal-deriver: no action justified — deferring",
  );
  return null;
};

// ---------------------------------------------------------------------------
// Brief-bound run-lifecycle dispatch config (shared helper — see
// goal-loop-brief-dispatch.ts). Authority:
// D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION (PR #1182); extended to all
// goal-loops per D-QUEUE-CLOSEOUT-2026-06-10.
// ---------------------------------------------------------------------------
const IMANI_BRIEF_DISPATCH: GoalLoopBriefDispatchConfig = {
  agentSlug: "imani",
  selfExecutablePattern: /legal[\s-]?readiness/i,
  deliveredClassLabel: "legal-readiness attestation",
  runHandler: imaniLegalReadiness,
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
// Handler (wired as `imani:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// imani:legal-readiness handler directly via its imported callable.
//
// Shadow mode: shadowMode: true for cohort-3 first ticks.
// In dry-run mode the goal-loop events are still emitted (so the shadow-mode
// trace is testable per spec §4 "Build runs in shadow mode for the first two
// substrate ticks"), but the imani:legal-readiness handler is called with
// dryRun=true.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "imani:goal-loop — starting goal-loop cohort-3 run",
  );

  const agentUrn = "agent:imani";

  // Parse Imani's spec.
  const parseResult = parseSpecFile(IMANI_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: IMANI_SPEC_PATH },
      "imani:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await imaniLegalReadiness(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, imaniGoalDeriver);

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
    "imani:goal-loop — goal-loop iteration complete",
  );

  // If escalation or deferred — run handler in dry-run mode (shadow trace).
  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  // Brief-bound dispatch path (D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION,
  // extended per D-QUEUE-CLOSEOUT-2026-06-10): when the loop selected a
  // decision and an open brief is addressed to this agent, bind a run to the
  // oldest brief and emit AgentRunStarted{agent-runtime} → AgentRunCompleted
  // so the iteration is visible in the autonomy run-feed and the brief stops
  // being re-selected every tick. Skipped under --dry-run.
  const openBriefs = shouldRunHandler && !ctx.dryRun ? openBriefsListForAgent("imani") : [];
  const [brief] = openBriefs;
  if (brief) {
    const dispatch = await dispatchBriefBoundRun(
      ctx,
      brief,
      iterationId,
      openBriefs.length - 1,
      IMANI_BRIEF_DISPATCH,
    );
    logger.info(
      { agent: ctx.agent, iterationId, briefId: brief.briefId, openBriefs: openBriefs.length },
      "imani:goal-loop — run complete (brief-bound dispatch)",
    );
    return {
      eventsEmitted: dispatch.eventsEmitted + goalEventsEmitted,
      ok: true,
      summary: `goal-loop: iteration=${iterationId} outcome=decision dispatch=${dispatch.summary}`,
    };
  }

  const handlerCtx: AgentRunContext = {
    ...ctx,
    // In shadow mode (cohort-3 first ticks), always dry-run the handler
    // so we observe the trace without side-effects.
    dryRun: ctx.dryRun || !shouldRunHandler,
  };

  const handlerOutput = await imaniLegalReadiness(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "imani:goal-loop — cohort-3 run complete",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop cohort-3: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
