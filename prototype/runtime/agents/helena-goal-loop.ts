// runtime/agents/helena-goal-loop.ts
//
// Helena (Chief Risk Officer, governance) goal-loop — autonomous (risk/treasury pilot).
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Helena is wired into
// the goal-loop substrate as a governance-seat agent. This run-handler:
//   1. Materialises a WorldStateSnapshot for agent:helena.
//   2. Runs Helena's rule-engine goal deriver (no LLM calls — rule-engine
//      constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   - Candidate 0 (event-reactive): open unhandled briefs addressed to Helena
//     (>30 min old) → select "Approve appetite-line operationalisation within
//     Board-approved framework" (§9 row 1; Helena's broadest in-scope risk
//     decision). Mirrors Bea's candidate-0.
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
// Three-way coherence (the Bea unjam): every candidate routes to the wired
// helena:risk-appetite-watch handler, whose primary emitted event is
// RiskAppetiteSnapshot. Each candidate therefore declares plannedEvents:
// [RiskAppetiteSnapshot] — keeping its distinct §9 goal label but the event
// the handler actually emits. Candidates 2 and 3 previously declared
// AppetiteBreachDisposed / IcaapSnapshot — events the handler never emits —
// which would jam the loop. RiskAppetiteSnapshot is now also declared in §11
// (Team/Helena.md), without which the §11 permission-gate pre-check rejects
// every candidate (the layer that kept this loop silently deferring). The
// real breach/ICAAP events return when handlers that emit them are wired (§16).
//
// Goal candidates use Helena's §9 decisions-in-scope row labels exactly as
// they appear in Team/Helena.md (the spec's closed-set per T-NEW).
//
// Live: when the goal-loop selects a decision the helena:risk-appetite-watch
// handler runs for real and emits; it is dry-run ONLY when the loop
// deferred/escalated or when --dry-run is passed explicitly.
// Authority: D-AGENT-AUTONOMY-RISK-TREASURY-PILOT.
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
import type { AgentBriefIssuedPayload } from "../../platform/event-store/event-types/agent";
import type { EventStore } from "../../platform/event-store/store";
import type { AgentRunContext, AgentRunOutput } from "../types";
import {
  type GoalLoopBriefDispatchConfig,
  dispatchBriefBoundRun,
  dispatchCadenceRun,
  isSelfExecutableBrief,
  openBriefsListForAgent,
} from "./goal-loop-brief-dispatch";
// Import the underlying risk-appetite-watch handler directly to avoid the
// circular dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import helenaRiskAppetiteWatch from "./helena-risk-appetite-watch";

// Threshold: if unmeasured lines persist for this many consecutive runs,
// Helena's goal-loop surfaces the gap as a formal escalation candidate.
const UNMEASURED_ESCALATION_THRESHOLD = 3;

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

/**
 * Count of consecutive tail RiskAppetiteSnapshot runs that reported
 * unmeasuredCount > 0. Used to detect chronic substrate gaps that
 * have not been escalated or remediated.
 *
 * Returns 0 if all recent snapshots are fully measured, or if no
 * snapshots exist yet.
 */
export function consecutiveUnmeasuredRunCount(store: EventStore = eventStore): number {
  const counts: number[] = [];
  for (const e of store.replay({ type: "RiskAppetiteSnapshot" })) {
    const p = e.payload as Record<string, unknown>;
    counts.push(typeof p.unmeasuredCount === "number" ? p.unmeasuredCount : 0);
  }
  let consecutive = 0;
  for (let i = counts.length - 1; i >= 0; i--) {
    if ((counts[i] ?? 0) > 0) {
      consecutive++;
    } else {
      break;
    }
  }
  return consecutive;
}

/**
 * Returns the open (not yet started/completed) briefs addressed to Helena,
 * older than `minAgeMs` (default 30 min), oldest-first. Delegates to the
 * shared `openBriefsListForAgent` (goal-loop-brief-dispatch.ts) so the
 * open-brief semantics exist once across all goal-loops.
 * Authority: D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN.
 */
export function openBriefsListForHelena(
  store: EventStore = eventStore,
  minAgeMs = 30 * 60 * 1000,
): AgentBriefIssuedPayload[] {
  return openBriefsListForAgent("helena", store, minAgeMs);
}

/** Count of open briefs addressed to Helena. Drives candidate-0. */
export function openBriefsAddressedToHelena(
  store: EventStore = eventStore,
  minAgeMs = 30 * 60 * 1000,
): number {
  return openBriefsListForHelena(store, minAgeMs).length;
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

  // Candidate 0 (event-reactive): open unhandled briefs addressed to Helena.
  // Checked before cadence candidates so Helena reacts to her real backlog.
  // Routes to helena:risk-appetite-watch (event: RiskAppetiteSnapshot) under
  // her broadest in-scope decision. Mirrors Bea's candidate-0.
  const pendingBriefCount = openBriefsAddressedToHelena();
  if (pendingBriefCount > 0 && spec.decisionsInScope.includes(RAS_CALIBRATION_GOAL)) {
    logger.info(
      { agentUrn: args.agent.urn, pendingBriefCount },
      "helena-goal-deriver: candidate-0 — open unhandled briefs addressed to Helena — selecting RAS calibration goal",
    );
    return {
      kind: "decision",
      chosen: RAS_CALIBRATION_GOAL,
      rationale: `Candidate 0: ${pendingBriefCount} open brief(s) addressed to Helena (older than 30min) not yet started or completed. "${RAS_CALIBRATION_GOAL}" is Helena's broadest in-scope risk decision covering open appetite / breach / model-risk work. Picking up pending briefs.`,
      mandateCitations: [
        { section: "9-decisions-in-scope", rowKey: RAS_CALIBRATION_GOAL, specHash },
      ],
      procedureCitations: [buildProcedureCitation(HELENA_RMF_PROCEDURE_PATH, HELENA_RMF_STEP_ID)],
      plannedEvents: [
        {
          type: "RiskAppetiteSnapshot",
          payloadPreview: { agentUrn: args.agent.urn, trigger: "helena-goal-loop:candidate-0" },
        },
      ],
    };
  }

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
      // Three-way coherence: helena:risk-appetite-watch emits RiskAppetiteSnapshot
      // (the snapshot surfaces the open breach; it also emits AgentEscalation for
      // Tier-1). A dedicated AppetiteBreachDisposed-emitting handler is a §16 gap,
      // at which point this candidate's plannedEvent returns to AppetiteBreachDisposed.
      plannedEvents: [
        {
          type: "RiskAppetiteSnapshot",
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
      // Three-way coherence: helena:risk-appetite-watch's emitted event is
      // RiskAppetiteSnapshot. The real IcaapSnapshot event returns when an
      // ICAAP engine that emits it is wired (§16 gap — ICAAP not yet built).
      plannedEvents: [
        {
          type: "RiskAppetiteSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "helena-goal-loop:icaap-review",
          },
        },
      ],
    };
  }

  // Candidate 4: Persistent unmeasured appetite lines → formal escalation.
  // Helena's mandate (§3, §9) requires she govern the framework completeness;
  // §16 names the gap owners (Senna + Atlas for cyber; validation function +
  // Atlas for model). If the gap persists for >= THRESHOLD consecutive runs
  // without a dispatched engineering brief, Helena selects the RAS calibration
  // goal so the risk-appetite-watch handler can emit a scoped AgentEscalation
  // routing Scrooge to dispatch the build work.
  //
  // Three-way coherence: still declares RiskAppetiteSnapshot as plannedEvent
  // (the watch handler always emits it); the escalation is an *additional*
  // event emitted by the watch handler when the persistent-gap flag is set.
  const unmeasuredRunCount = consecutiveUnmeasuredRunCount();
  if (
    unmeasuredRunCount >= UNMEASURED_ESCALATION_THRESHOLD &&
    spec.decisionsInScope.includes(RAS_CALIBRATION_GOAL)
  ) {
    logger.info(
      { agentUrn: args.agent.urn, unmeasuredRunCount, threshold: UNMEASURED_ESCALATION_THRESHOLD },
      "helena-goal-deriver: candidate-4 — persistent unmeasured appetite lines — selecting RAS calibration goal for escalation",
    );
    return {
      kind: "decision",
      chosen: RAS_CALIBRATION_GOAL,
      rationale: `${unmeasuredRunCount} consecutive RiskAppetiteSnapshot runs have reported unmeasured appetite lines with no engineering dispatch observed. Helena's mandate (§3, §16) requires she surface this as a formal substrate-gap escalation to Scrooge. Selecting "${RAS_CALIBRATION_GOAL}" so the risk-appetite-watch handler emits a scoped AgentEscalation routing the measurement-substrate build to the responsible engineers (Senna + Atlas for RAS §B6 cyber line; independent validation function + Atlas for RAS §B7 model-tier line).`,
      mandateCitations: [
        { section: "9-decisions-in-scope", rowKey: RAS_CALIBRATION_GOAL, specHash },
      ],
      procedureCitations: [buildProcedureCitation(HELENA_RMF_PROCEDURE_PATH, HELENA_RMF_STEP_ID)],
      plannedEvents: [
        {
          type: "RiskAppetiteSnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "helena-goal-loop:persistent-unmeasured-escalation",
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

// ---------------------------------------------------------------------------
// Brief-bound dispatch — shared module (goal-loop-brief-dispatch.ts)
//
// Self-executable risk-appetite attestations close delivered (live handler);
// everything else closes blocked with the substrate gap surfaced and
// followOnRoutes: []. Blocked is TERMINAL — the legacy auto-routing of blocked
// briefs into the brief-router is removed (it re-issued briefs without an
// executor: the phantom-backlog failure mode of PR #1182). A Scrooge-
// coordinated / LLM-backed dispatched run picks the gap up. Never fakes
// delivery.
//
// Run-lifecycle citations come from GOAL_LOOP_RUN_LIFECYCLE_AUTHORITIES in the
// shared module. Helena's cohort behaviour (candidate set, classifier pattern)
// still derives from D-AGENT-AUTONOMY-RISK-TREASURY-PILOT.
// Authority: D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN
// (CEO-approved 2026-06-11).
// ---------------------------------------------------------------------------

/**
 * Title pattern for the attestation class Helena's deterministic handler
 * genuinely delivers. The only deterministic deliverable Helena's goal-loop
 * owns today is the RiskAppetiteSnapshot.
 */
const HELENA_SELF_EXECUTABLE_PATTERN = /risk[\s-]?appetite|appetite|\bras\b/i;

/**
 * Self-executable only if the brief asks for the risk-appetite / RAS readiness
 * attestation AND needs no code-PR.
 */
export function isSelfExecutableByHelena(brief: AgentBriefIssuedPayload): boolean {
  return isSelfExecutableBrief(brief, HELENA_SELF_EXECUTABLE_PATTERN);
}

/** Shared brief-dispatch config — the delivered class (risk-appetite attestation) stays live. */
export const HELENA_BRIEF_DISPATCH: GoalLoopBriefDispatchConfig = {
  agentSlug: "helena",
  selfExecutablePattern: HELENA_SELF_EXECUTABLE_PATTERN,
  deliveredClassLabel: "risk-appetite attestation",
  runHandler: helenaRiskAppetiteWatch,
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
// Live: when the goal-loop selects a decision the helena:risk-appetite-watch
// handler runs for real and emits. The handler is dry-run only when the loop
// deferred/escalated or when ctx.dryRun is set. Goal-loop events are always
// emitted regardless.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "helena:goal-loop — starting goal-loop run",
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

  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  // Brief-bound dispatch path: when the loop selected a decision and there is
  // an open brief addressed to Helena, bind a run to the oldest brief and emit
  // its run lifecycle (terminal blocked, never auto-routed). Skipped under --dry-run.
  const openBriefs = shouldRunHandler && !ctx.dryRun ? openBriefsListForHelena() : [];
  const [brief] = openBriefs;
  if (brief) {
    const dispatch = await dispatchBriefBoundRun(
      ctx,
      brief,
      iterationId,
      openBriefs.length - 1,
      HELENA_BRIEF_DISPATCH,
    );
    logger.info(
      { agent: ctx.agent, iterationId, briefId: brief.briefId, openBriefs: openBriefs.length },
      "helena:goal-loop — run complete (brief-bound dispatch)",
    );
    return {
      eventsEmitted: dispatch.eventsEmitted + goalEventsEmitted,
      ok: true,
      summary: `goal-loop: iteration=${iterationId} outcome=decision dispatch=${dispatch.summary}`,
    };
  }

  // Cadence path: no open brief — wrap with run-lifecycle when the loop selected
  // a decision; dry-run only when deferred (no lifecycle events on deferred).
  if (shouldRunHandler && !ctx.dryRun) {
    const cadence = await dispatchCadenceRun(ctx, iterationId, HELENA_BRIEF_DISPATCH);
    logger.info(
      { agent: ctx.agent, iterationId },
      "helena:goal-loop — run complete (cadence, instrumented)",
    );
    return {
      eventsEmitted: cadence.eventsEmitted + goalEventsEmitted,
      ok: cadence.handlerOutput.ok,
      summary: `goal-loop: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${cadence.handlerOutput.summary}`,
      ...(cadence.handlerOutput.deliverable
        ? { deliverable: cadence.handlerOutput.deliverable }
        : {}),
    };
  }

  const handlerCtx: AgentRunContext = {
    ...ctx,
    dryRun: true,
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
    "helena:goal-loop — run complete (deferred)",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
