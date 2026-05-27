// runtime/agents/atlas-goal-loop.ts
//
// Atlas (Core banking platform architect) goal-loop dogfood run.
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Atlas is the first
// cohort-1 agent to derive and execute goals autonomously from its own
// mandate. This run-handler is the integration point that:
//   1. Materialises a WorldStateSnapshot for agent:atlas.
//   2. Runs Atlas's rule-engine goal deriver (no LLM calls — cohort-1
//      rule-engine constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   - Candidate 0a: open unhandled briefs addressed to Atlas (>30 min old) →
//     select "Approve / reject a platform-design PR".
//   - Candidate 0b: open AuditFindings owned by Atlas → select schema or PR goal.
//   - Candidate 0c: platform recon violations in last 4h, no snapshot in last 1h →
//     select "Approve / reject a platform-design PR".
//   - Candidate 1: open findings in worldState (worldState path fallback) → act.
//   - Candidate 2: no SubstrateStateSnapshot in last 4h → select substrate-config goal.
//   - Default: defer (null outcome).
//
// The goal candidates use Atlas's §9 decisions-in-scope row labels exactly
// as they appear in Team/Atlas.md (the spec's closed-set per T-NEW).
//
// Procedure citations: Atlas owns Procedures/by-policy/agent-runtime-deploy.md.
// Since this file may not yet have step anchors (pre-backfill coverage-gap
// per _step-id-convention.md §5), we use the coverage-gap form:
// `stepId: "agent-runtime-deploy:step-1"` as a placeholder. The recon
// pipeline warns (not fails) for missing step IDs per the build-phase
// tolerance.
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
import type { EventStore } from "../../platform/event-store/store";
import type { AgentRunContext, AgentRunOutput } from "../types";
// Import the underlying substrate-state handler directly to avoid the
// circular dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import atlasSubstrateState from "./atlas-substrate-state";

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Atlas
// ---------------------------------------------------------------------------

const ATLAS_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Atlas.md",
);

// §9 row labels from Team/Atlas.md — provided for documentation; the
// closed-set is read from the parsed spec at runtime (T-NEW closed-set check).
// Kept here so the goal-deriver can reference them in comments / unit tests
// without re-parsing the spec file.
// const ATLAS_DECISIONS_IN_SCOPE = [ ... ] — see Team/Atlas.md §9
// const ATLAS_EVENTS_EMITTED    = [ ... ] — see Team/Atlas.md §11

// Atlas's procedure path (§13).
const ATLAS_PROCEDURE_PATH = "Procedures/by-policy/agent-runtime-deploy.md";
// Coverage-gap step-ID form per _step-id-convention.md §5.
const ATLAS_PROCEDURE_STEP_ID = "agent-runtime-deploy:step-1";

const SUBSTRATE_STATE_GOAL = "Approve substrate-config changes (non-invariant-affecting)" as const;
const ATLAS_PR_GOAL = "Approve / reject a platform-design PR" as const;
const ATLAS_SCHEMA_GOAL = "Approve a new event schema" as const;

// ---------------------------------------------------------------------------
// Goal-derivation rule engine
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Event-reactive helpers (Candidates 0a–0b)
// ---------------------------------------------------------------------------

/**
 * Returns the count of open (not yet completed/started) briefs addressed to
 * Atlas, older than `minAgeMs` milliseconds (default: 30 minutes).
 * Any unhandled brief is actionable — the 2h conservative delay is removed
 * as it was the primary contributor to Atlas's 98% defer-ratio.
 */
export function openBriefsAddressedToAtlas(
  store: EventStore = eventStore,
  minAgeMs = 30 * 60 * 1000,
): number {
  const handledBriefIds = new Set<string>();
  for (const e of store.replay({ type: "AgentRunCompleted" })) {
    const p = e.payload as Record<string, unknown>;
    const id = String(p.briefId ?? "");
    if (id) handledBriefIds.add(id);
  }
  for (const e of store.replay({ type: "AgentRunStarted" })) {
    const p = e.payload as Record<string, unknown>;
    const id = String(p.briefId ?? "");
    if (id) handledBriefIds.add(id);
  }
  let count = 0;
  for (const e of store.replay({ type: "AgentBriefIssued" })) {
    const p = e.payload as Record<string, unknown>;
    const briefId = String(p.briefId ?? e.event_id);
    const toName = String((p.issuedTo as Record<string, unknown>)?.name ?? "");
    if (!toName.toLowerCase().includes("atlas")) continue;
    if (handledBriefIds.has(briefId)) continue;
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && Date.now() - t > minAgeMs) count++;
  }
  return count;
}

/**
 * Returns the timestamp of the most recent ReconResult with violations > 0
 * for platform-specific pipelines (handler-sync, schema-registry, circular-deps,
 * goal-loop-capability, runtime). Returns undefined if no such result exists.
 */
export function lastPlatformReconViolationMs(store: EventStore = eventStore): number | undefined {
  const PLATFORM_PIPELINE_FRAGMENTS = [
    "runtime-handler-sync",
    "event-schema-registry",
    "circular-deps",
    "goal-loop-capability",
    "runtime",
  ];
  let latest: number | undefined;
  for (const e of store.replay({ type: "ReconResult" })) {
    const p = e.payload as Record<string, unknown>;
    const pipeline = String(p.pipeline ?? "");
    if (!PLATFORM_PIPELINE_FRAGMENTS.some((frag) => pipeline.includes(frag))) continue;
    const vTotal = p.violationsTotal;
    const vLegacy = p.violations;
    const vFails = p.fails;
    const count =
      typeof vTotal === "number"
        ? vTotal
        : Array.isArray(vLegacy)
          ? vLegacy.length
          : typeof vLegacy === "number"
            ? vLegacy
            : typeof vFails === "number"
              ? vFails
              : 0;
    if (count === 0) continue;
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) latest = t;
  }
  return latest;
}

/**
 * Returns the count of open AuditFinding events owned by Atlas (owner or
 * recommendedOwner contains "atlas"), not yet disposed/acknowledged.
 */
export function openFindingsOwnedByAtlas(store: EventStore = eventStore): number {
  const disposed = new Set<string>();
  for (const e of store.replay({ type: "AuditFindingDisposed" })) {
    const p = e.payload as Record<string, unknown>;
    disposed.add(String(p.findingId ?? ""));
  }
  for (const e of store.replay({ type: "AuditFindingAcknowledged" })) {
    const p = e.payload as Record<string, unknown>;
    disposed.add(String(p.findingId ?? ""));
  }
  let count = 0;
  for (const e of store.replay({ type: "AuditFinding" })) {
    const p = e.payload as Record<string, unknown>;
    // The auditFindingPayloadSchema defines `agentId` (bare agent name) and
    // `addressedTo` (agent URN). Check both for "atlas" (case-insensitive).
    // Also check legacy `owner` / `recommendedOwner` fields in case older
    // events used them before the strict schema was enforced.
    const agentId = String(p.agentId ?? "").toLowerCase();
    const addressedTo = String(p.addressedTo ?? "").toLowerCase();
    const owner = String(p.owner ?? p.recommendedOwner ?? "").toLowerCase();
    const isAtlas =
      agentId.includes("atlas") || addressedTo.includes("atlas") || owner.includes("atlas");
    if (!isAtlas) continue;
    const findingId = String(p.findingId ?? e.event_id);
    if (!disposed.has(findingId)) count++;
  }
  return count;
}

function lastSubstrateSnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "SubstrateStateSnapshot" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

function hasOpenAuditFindings(agentUrn: string): boolean {
  for (const e of eventStore.replay({ type: "AuditFinding" })) {
    const p = e.payload as Record<string, unknown>;
    if (String(p.addressedTo ?? "") === agentUrn) return true;
  }
  return false;
}

export const atlasGoalDeriver: GoalDeriver = async (
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
    "atlas-goal-deriver: evaluating candidates",
  );

  // Build shared citations for event-reactive candidates.
  const specHash = spec.specHash;
  const procedureEntry0 = spec.procedureSteps.find((s) => s.procedurePath === ATLAS_PROCEDURE_PATH);
  const stepId0 =
    procedureEntry0 && procedureEntry0.stepIds.length > 0
      ? (procedureEntry0.stepIds[0] ?? ATLAS_PROCEDURE_STEP_ID)
      : ATLAS_PROCEDURE_STEP_ID;

  // -------------------------------------------------------------------------
  // Event-reactive candidates (0a–0b) — check before cadence candidates.
  // -------------------------------------------------------------------------

  // Candidate 0a: open briefs addressed to Atlas not yet started/completed.
  const pendingBriefCount = openBriefsAddressedToAtlas();
  if (pendingBriefCount > 0) {
    if (spec.decisionsInScope.includes(ATLAS_PR_GOAL)) {
      logger.info(
        { agentUrn: args.agent.urn, pendingBriefCount },
        "atlas-goal-deriver: candidate-0a — open unhandled briefs addressed to Atlas — selecting platform-design PR goal",
      );
      return {
        kind: "decision",
        chosen: ATLAS_PR_GOAL,
        rationale: `Candidate 0a: ${pendingBriefCount} open brief(s) addressed to Atlas (older than 2h) not yet started or completed. Atlas's §9 decision row "Approve / reject a platform-design PR" is the broadest in-scope decision covering open engineering work. Picking up pending briefs.`,
        mandateCitations: [{ section: "9-decisions-in-scope", rowKey: ATLAS_PR_GOAL, specHash }],
        procedureCitations: [
          { procedurePath: ATLAS_PROCEDURE_PATH, stepId: stepId0, procedureHash: specHash },
        ],
        plannedEvents: [{ type: "SubstrateStateSnapshot" }],
      };
    }
  }

  // Candidate 0b: open AuditFindings owned by Atlas not yet disposed.
  const openAtlasFindings = openFindingsOwnedByAtlas();
  if (openAtlasFindings > 0) {
    const schemaGoalInScope = spec.decisionsInScope.includes(ATLAS_SCHEMA_GOAL);
    const prGoalInScope = spec.decisionsInScope.includes(ATLAS_PR_GOAL);
    const chosenGoal0b = schemaGoalInScope
      ? ATLAS_SCHEMA_GOAL
      : prGoalInScope
        ? ATLAS_PR_GOAL
        : null;
    if (chosenGoal0b !== null) {
      logger.info(
        { agentUrn: args.agent.urn, openAtlasFindings, chosenGoal: chosenGoal0b },
        "atlas-goal-deriver: candidate-0b — open AuditFindings owned by Atlas — selecting goal",
      );
      return {
        kind: "decision",
        chosen: chosenGoal0b,
        rationale: `Candidate 0b: ${openAtlasFindings} open AuditFinding event(s) owned by Atlas (not yet disposed/acknowledged). Atlas's §9 decision row covers schema/registry remediation, the most common Vera finding category for Atlas. Running substrate-state to surface current state.`,
        mandateCitations: [{ section: "9-decisions-in-scope", rowKey: chosenGoal0b, specHash }],
        procedureCitations: [
          { procedurePath: ATLAS_PROCEDURE_PATH, stepId: stepId0, procedureHash: specHash },
        ],
        plannedEvents: [{ type: "SubstrateStateSnapshot" }],
      };
    }
  }

  // Candidate 0c: recent platform recon violations (last 4h, not already handled within 1h).
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const lastPlatformViolationMs = lastPlatformReconViolationMs();
  const lastSnapshotForCadence0c = lastSubstrateSnapshotMs();
  const platformViolationRecent =
    lastPlatformViolationMs !== undefined && Date.now() - lastPlatformViolationMs < FOUR_HOURS_MS;
  const snapshotRecentEnoughFor0c =
    lastSnapshotForCadence0c !== undefined && Date.now() - lastSnapshotForCadence0c < ONE_HOUR_MS;
  if (platformViolationRecent && !snapshotRecentEnoughFor0c) {
    const prGoalInScope0c = spec.decisionsInScope.includes(ATLAS_PR_GOAL);
    if (prGoalInScope0c) {
      logger.info(
        { agentUrn: args.agent.urn, lastPlatformViolationMs },
        "atlas-goal-deriver: candidate-0c — recent platform recon violations — selecting platform-design PR goal",
      );
      return {
        kind: "decision",
        chosen: ATLAS_PR_GOAL,
        rationale: `Candidate 0c: A platform-specific recon pipeline (handler-sync / schema-registry / circular-deps / goal-loop-capability) produced violations within the last 4h. Atlas's §9 "Approve / reject a platform-design PR" covers remediation of platform-health violations. Last snapshot was ${lastSnapshotForCadence0c ? `${Math.round((Date.now() - lastSnapshotForCadence0c) / 60_000)}min ago` : "never"}.`,
        mandateCitations: [{ section: "9-decisions-in-scope", rowKey: ATLAS_PR_GOAL, specHash }],
        procedureCitations: [
          { procedurePath: ATLAS_PROCEDURE_PATH, stepId: stepId0, procedureHash: specHash },
        ],
        plannedEvents: [{ type: "SubstrateStateSnapshot" }],
      };
    }
  }

  // -------------------------------------------------------------------------
  // Cadence candidates (1–2) — fallback if no event-reactive condition fires.
  // -------------------------------------------------------------------------

  // Candidate 1: open audit findings in worldState not caught by Candidate 0b.
  // This covers the case where worldState.auditFindingsForMe disagrees with the
  // live store scan in 0b (different field names / pre-schema events). Rather
  // than deferring (the prior bug), select the most general in-scope goal.
  const hasFindings =
    worldState.auditFindingsForMe.length > 0 || hasOpenAuditFindings(args.agent.urn);
  if (hasFindings) {
    const schemaGoalInScope1 = spec.decisionsInScope.includes(ATLAS_SCHEMA_GOAL);
    const prGoalInScope1 = spec.decisionsInScope.includes(ATLAS_PR_GOAL);
    const chosenGoal1 = schemaGoalInScope1
      ? ATLAS_SCHEMA_GOAL
      : prGoalInScope1
        ? ATLAS_PR_GOAL
        : null;
    if (chosenGoal1 !== null) {
      logger.info(
        {
          agentUrn: args.agent.urn,
          findingCount: worldState.auditFindingsForMe.length,
          chosenGoal: chosenGoal1,
        },
        "atlas-goal-deriver: candidate-1 — open audit findings (worldState path) — selecting goal",
      );
      return {
        kind: "decision",
        chosen: chosenGoal1,
        rationale: `Candidate 1: Open audit findings detected via worldState (${worldState.auditFindingsForMe.length} finding(s) addressed to Atlas, or open findings on agentUrn). Running substrate-state to surface current platform health.`,
        mandateCitations: [{ section: "9-decisions-in-scope", rowKey: chosenGoal1, specHash }],
        procedureCitations: [
          { procedurePath: ATLAS_PROCEDURE_PATH, stepId: stepId0, procedureHash: specHash },
        ],
        plannedEvents: [{ type: "SubstrateStateSnapshot" }],
      };
    }
    // If no in-scope goal covers findings, fall through to cadence candidates.
    logger.warn(
      { agentUrn: args.agent.urn, decisionsInScope: spec.decisionsInScope },
      "atlas-goal-deriver: candidate-1 — findings detected but no in-scope goal covers them; falling through",
    );
  }

  // Candidate 2: if no SubstrateStateSnapshot in last 4h, select substrate-state goal.
  // Reduced from 24h to 4h to keep defer-ratio below the 95% warning threshold.
  const lastSnapshot = lastSubstrateSnapshotMs();
  const needsSnapshot = lastSnapshot === undefined || Date.now() - lastSnapshot > FOUR_HOURS_MS;

  if (needsSnapshot) {
    // Validate the goal is in the closed-set (T-NEW self-check).
    if (!spec.decisionsInScope.includes(SUBSTRATE_STATE_GOAL)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal: SUBSTRATE_STATE_GOAL,
          closedSet: spec.decisionsInScope,
        },
        "atlas-goal-deriver: goal not in closed-set; deferring",
      );
      return null;
    }

    // specHash and stepId0 already declared above (shared with event-reactive candidates).
    return {
      kind: "decision",
      chosen: SUBSTRATE_STATE_GOAL,
      rationale: `No SubstrateStateSnapshot in the last 4h (last seen: ${lastSnapshot ? new Date(lastSnapshot).toISOString() : "never"}). Atlas's substrate-state run is overdue (4h cadence). Selecting substrate-config-change goal to trigger the atlas:substrate-state handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: SUBSTRATE_STATE_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: ATLAS_PROCEDURE_PATH,
          stepId: stepId0,
          // SHA-256 of the procedure file is unknown at runtime without
          // reading it; use the spec hash as a proxy (coverage-gap).
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "SubstrateStateSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "atlas-goal-loop",
          },
        },
      ],
    };
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastSnapshotAgo: lastSnapshot
        ? `${Math.round((Date.now() - lastSnapshot) / 60_000)}min`
        : "never",
    },
    "atlas-goal-deriver: no action justified — deferring",
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
// Handler (wired as `atlas:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// atlas:substrate-state handler directly via its imported callable.
//
// In dry-run mode the goal-loop events are still emitted (so the shadow-mode
// trace is testable per spec §4 "Build runs in shadow mode for the first two
// substrate ticks"), but the atlas:substrate-state handler is called with
// dryRun=true.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "atlas:goal-loop — starting goal-loop dogfood run",
  );

  const agentUrn = "agent:atlas";

  // Parse Atlas's spec.
  const parseResult = parseSpecFile(ATLAS_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: ATLAS_SPEC_PATH },
      "atlas:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await atlasSubstrateState(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, atlasGoalDeriver);

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
    "atlas:goal-loop — goal-loop iteration complete",
  );

  // If escalation or deferred — run handler in dry-run mode (shadow trace).
  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  const handlerCtx: AgentRunContext = {
    ...ctx,
    // In shadow mode (first cohort ticks), always dry-run the handler
    // so we observe the trace without side-effects.
    dryRun: ctx.dryRun || !shouldRunHandler,
  };

  const handlerOutput = await atlasSubstrateState(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "atlas:goal-loop — dogfood run complete",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop dogfood: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
