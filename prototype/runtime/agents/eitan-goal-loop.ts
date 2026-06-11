// runtime/agents/eitan-goal-loop.ts
//
// Eitan (Treasurer) goal-loop — autonomous (risk/treasury pilot).
//
// Phase 3 of D-AGENT-AUTONOMY-OPERATIONAL Slice 3: Eitan is wired into the
// goal-loop substrate. This run-handler is the integration point that:
//   1. Materialises a WorldStateSnapshot for agent:eitan.
//   2. Runs Eitan's rule-engine goal deriver (no LLM calls — rule-engine
//      constraint per spec §3.4 "MUST NOT — LLM cost-cap").
//   3. Passes the result through `runWithGoal`, which wraps it with the
//      AgentGoalLoopRunner's validation + event emission + handler dispatch.
//
// Rule-engine logic (§3.4 "MAY use: pure rule engine"):
//   - Candidate 0 (event-reactive): open unhandled briefs addressed to Eitan
//     (>30 min old) → select "Sign LCR / NSFR / IRRBB submissions to Camille"
//     (Eitan's broadest in-scope treasury decision). Mirrors Bea's candidate-0.
//   - Rule 1: If no LiquiditySnapshot event from Eitan in the last 24h
//     → select "Sign LCR / NSFR / IRRBB submissions to Camille" (priority HIGH,
//       mapped to `liquidity-snapshot` goal driving the liquidity-snapshot handler).
//   - Rule 2: If no FTPRatePublished event in the last 7 days
//     → select "Approve FTP curve refresh" (priority HIGH).
//   - Rule 3: If any open RiskRaised event tagged "liquidity" or "IRRBB" with no
//     resolution in 48h → select "Sign LCR / NSFR / IRRBB submissions to Camille"
//     (priority HIGH, breach-disposition path — `liquidity-breach-disposition` goal).
//   - Rule 4: If no ALCOMinutesApproved event in the last 30 days
//     → select "Chair ALCO; approve treasury limits within Helena's RAS"
//     (priority MEDIUM — `alco-cycle-prep` goal).
//
// Three-way coherence (the Bea unjam): every candidate routes to the wired
// eitan:liquidity-snapshot handler, whose sole emitted event is LiquiditySnapshot.
// Each candidate therefore declares plannedEvents: [LiquiditySnapshot] — keeping
// its distinct §9 goal label but the event the handler actually emits. Rules 2
// and 4 previously declared FTPRatePublished / ALCOMinutesApproved — events the
// handler never emits — which would jam the loop. LiquiditySnapshot is now also
// declared in §11 (Team/Eitan.md), without which the §11 permission-gate
// pre-check rejects every candidate (the layer that kept this loop silently
// deferring). The real FTP/ALCO events return when handlers that emit them are
// wired (§16 gaps).
//
// The goal candidates use Eitan's §9 decisions-in-scope row labels exactly
// as they appear in Team/Eitan.md (the spec's closed-set per T-NEW).
//
// Procedure citations: Eitan owns no procedure file with step anchors yet
// (pre-backfill coverage-gap per _step-id-convention.md §5). We use the
// coverage-gap form: `stepId: "alco-cycle:step-1"` as a placeholder.
// The recon pipeline warns (not fails) for missing step IDs per the
// build-phase tolerance.
//
// Live: when the goal-loop selects a decision the eitan:liquidity-snapshot
// handler runs for real and emits; it is dry-run ONLY when the loop
// deferred/escalated or when --dry-run is passed explicitly.
// Authority: D-AGENT-AUTONOMY-RISK-TREASURY-PILOT.
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect) — wiring.
//         Eitan (Treasurer) — goal-deriver rules.

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
// Import the underlying liquidity-snapshot handler directly to avoid the circular
// dependency that would arise from importing run.ts here.
// (run.ts imports handler-callables.ts which imports this file.)
import eitanLiquiditySnapshot from "./eitan-liquidity-snapshot";
import {
  type GoalLoopBriefDispatchConfig,
  dispatchBriefBoundRun,
  dispatchCadenceRun,
  isSelfExecutableBrief,
  openBriefsListForAgent,
} from "./goal-loop-brief-dispatch";

// ---------------------------------------------------------------------------
// Rule-engine goal deriver for Eitan
// ---------------------------------------------------------------------------

const EITAN_SPEC_PATH = resolve(
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", ".."),
  "Team",
  "Eitan.md",
);

// Procedure path placeholder — Eitan's ALCO / liquidity procedure is not yet
// filed with step anchors (build-phase coverage gap). Use coverage-gap form.
const EITAN_PROCEDURE_PATH = "Procedures/by-policy/alco-cycle.md";
// Coverage-gap step-ID form per _step-id-convention.md §5.
const EITAN_PROCEDURE_STEP_ID = "alco-cycle:step-1";

// §9 row labels from Team/Eitan.md (closed-set per T-NEW).
// Candidate 1 / Rule 1: daily liquidity snapshot / LCR-NSFR-IRRBB sign-off goal.
const LCR_NSFR_IRRBB_GOAL = "Sign LCR / NSFR / IRRBB submissions to Camille" as const;
// Candidate 2 / Rule 2: FTP curve refresh goal.
const FTP_CURVE_REFRESH_GOAL = "Approve FTP curve refresh" as const;
// Candidate 3 / Rule 4: ALCO chair / treasury-limits goal.
const ALCO_CHAIR_GOAL = "Chair ALCO; approve treasury limits within Helena's RAS" as const;

// ---------------------------------------------------------------------------
// Event-query helpers
// ---------------------------------------------------------------------------

/**
 * Returns the timestamp of the most recent LiquiditySnapshot event,
 * or undefined if none exists.
 */
function lastLiquiditySnapshotMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "LiquiditySnapshot" })) {
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
 */
function lastFTPRatePublishedMs(): number | undefined {
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
 * Returns true if there is any open RiskRaised event tagged with "liquidity"
 * or "IRRBB" that has no corresponding RiskResolved event and is older than
 * 48 hours.
 *
 * In the current build phase the closure event schema is not yet fully
 * defined (§16 "risk engine modules in build-only"). We detect open findings
 * tagged with "liquidity" or "IRRBB" by inspecting the RiskRaised event
 * payload tags field (if present); older than 48h means the breach-disposition
 * goal fires.
 */
function hasOpenLiquidityOrIRRBBRiskRaised(): boolean {
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
  for (const e of eventStore.replay({ type: "RiskRaised" })) {
    // Check tags field in payload for "liquidity" or "IRRBB"
    const payload = e.payload as Record<string, unknown> | undefined;
    const tags: unknown = payload?.tags;
    const tagsStr = Array.isArray(tags) ? tags.join(" ") : typeof tags === "string" ? tags : "";
    const category: unknown = payload?.category;
    const categoryStr = typeof category === "string" ? category : "";

    const isLiquidityOrIRRBB =
      /liquidity|IRRBB/i.test(tagsStr) || /liquidity|IRRBB/i.test(categoryStr);
    if (!isLiquidityOrIRRBB) continue;

    // Check if older than 48h (unresolved)
    const raisedAt = new Date(e.as_of).getTime();
    if (Number.isNaN(raisedAt)) continue;
    if (Date.now() - raisedAt > FORTY_EIGHT_HOURS_MS) {
      return true;
    }
  }
  return false;
}

/**
 * Returns the timestamp of the most recent ALCOMinutesApproved event,
 * or undefined if none exists.
 */
function lastALCOMinutesApprovedMs(): number | undefined {
  let latest: number | undefined;
  for (const e of eventStore.replay({ type: "ALCOMinutesApproved" })) {
    const t = new Date(e.as_of).getTime();
    if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
      latest = t;
    }
  }
  return latest;
}

/**
 * Returns the open (not yet started/completed) briefs addressed to Eitan,
 * older than `minAgeMs` (default 30 min), oldest-first. Delegates to the
 * shared `openBriefsListForAgent` (goal-loop-brief-dispatch.ts) so the
 * open-brief semantics exist once across all goal-loops.
 * Authority: D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN.
 */
export function openBriefsListForEitan(
  store: EventStore = eventStore,
  minAgeMs = 30 * 60 * 1000,
): AgentBriefIssuedPayload[] {
  return openBriefsListForAgent("eitan", store, minAgeMs);
}

/** Count of open briefs addressed to Eitan. Drives candidate-0. */
export function openBriefsAddressedToEitan(
  store: EventStore = eventStore,
  minAgeMs = 30 * 60 * 1000,
): number {
  return openBriefsListForEitan(store, minAgeMs).length;
}

// ---------------------------------------------------------------------------
// Goal deriver
// ---------------------------------------------------------------------------

export const eitanGoalDeriver: GoalDeriver = async (
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
    "eitan-goal-deriver: evaluating candidates",
  );

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const specHash = spec.specHash;

  // Build procedure citations — use coverage-gap form per §3.4 contract.
  const procedureEntry = spec.procedureSteps.find((s) => s.procedurePath === EITAN_PROCEDURE_PATH);
  const stepId =
    procedureEntry && procedureEntry.stepIds.length > 0
      ? (procedureEntry.stepIds[0] ?? EITAN_PROCEDURE_STEP_ID)
      : EITAN_PROCEDURE_STEP_ID;

  // Helper: validate goal is in spec closed-set before returning.
  const validateGoal = (goal: string): boolean => {
    if (!spec.decisionsInScope.includes(goal)) {
      logger.warn(
        {
          agentUrn: args.agent.urn,
          goal,
          closedSet: spec.decisionsInScope,
        },
        "eitan-goal-deriver: goal not in closed-set; deferring",
      );
      return false;
    }
    return true;
  };

  // Candidate 0 (event-reactive): open unhandled briefs addressed to Eitan.
  // Checked before cadence rules so Eitan reacts to his real backlog. Routes to
  // eitan:liquidity-snapshot (event: LiquiditySnapshot) under his broadest
  // in-scope decision. Mirrors Bea's candidate-0.
  const pendingBriefCount = openBriefsAddressedToEitan();
  if (pendingBriefCount > 0) {
    if (!validateGoal(LCR_NSFR_IRRBB_GOAL)) return null;
    logger.info(
      { agentUrn: args.agent.urn, pendingBriefCount },
      "eitan-goal-deriver: candidate-0 — open unhandled briefs addressed to Eitan — selecting LCR/NSFR/IRRBB goal",
    );
    return {
      kind: "decision",
      chosen: LCR_NSFR_IRRBB_GOAL,
      rationale: `Candidate 0: ${pendingBriefCount} open brief(s) addressed to Eitan (older than 30min) not yet started or completed. "${LCR_NSFR_IRRBB_GOAL}" is Eitan's broadest in-scope treasury decision covering open liquidity / FTP / ALCO work. Picking up pending briefs.`,
      mandateCitations: [
        { section: "9-decisions-in-scope", rowKey: LCR_NSFR_IRRBB_GOAL, specHash },
      ],
      procedureCitations: [
        { procedurePath: EITAN_PROCEDURE_PATH, stepId, procedureHash: specHash },
      ],
      plannedEvents: [
        {
          type: "LiquiditySnapshot",
          payloadPreview: { agentUrn: args.agent.urn, trigger: "eitan-goal-loop:candidate-0" },
        },
      ],
    };
  }

  // Rule 1: if no LiquiditySnapshot event in last 24h, select LCR/NSFR/IRRBB
  // sign-off goal. Eitan's §6 inactivity SLA: daily liquidity snapshot must
  // produce a LiquiditySnapshot event each day.
  const lastLiquiditySnapshot = lastLiquiditySnapshotMs();
  const needsLiquiditySnapshot =
    lastLiquiditySnapshot === undefined ||
    Date.now() - lastLiquiditySnapshot > TWENTY_FOUR_HOURS_MS;

  if (needsLiquiditySnapshot) {
    if (!validateGoal(LCR_NSFR_IRRBB_GOAL)) return null;

    return {
      kind: "decision",
      chosen: LCR_NSFR_IRRBB_GOAL,
      rationale: `No LiquiditySnapshot event in the last 24h (last seen: ${lastLiquiditySnapshot ? new Date(lastLiquiditySnapshot).toISOString() : "never"}). Eitan's daily liquidity SLA (§6: daily LCR / NSFR projection review) requires a LiquiditySnapshot event each day. Selecting liquidity-snapshot goal to trigger the eitan:liquidity-snapshot handler.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: LCR_NSFR_IRRBB_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: EITAN_PROCEDURE_PATH,
          stepId,
          // SHA-256 of the procedure file is unknown at runtime without
          // reading it; use the spec hash as a proxy (coverage-gap).
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "LiquiditySnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "eitan-goal-loop",
          },
        },
      ],
    };
  }

  // Rule 2: if no FTPRatePublished event in last 7 days, select FTP curve
  // refresh goal. Eitan's §6 cadence: quarterly FTP review; the 7-day trigger
  // here validates the pipeline end-to-end in build phase and catches any
  // missed weekly FTP heartbeat.
  const lastFTPRatePublished = lastFTPRatePublishedMs();
  const needsFTPCalibration =
    lastFTPRatePublished === undefined || Date.now() - lastFTPRatePublished > SEVEN_DAYS_MS;

  if (needsFTPCalibration) {
    if (!validateGoal(FTP_CURVE_REFRESH_GOAL)) return null;

    return {
      kind: "decision",
      chosen: FTP_CURVE_REFRESH_GOAL,
      rationale: `No FTPRatePublished event in the last 7 days (last seen: ${lastFTPRatePublished ? new Date(lastFTPRatePublished).toISOString() : "never"}). Eitan's §9 FTP curve refresh mandate requires the FTP substrate to emit FTPRatePublished at least weekly in build phase (full cadence: quarterly per §6). Selecting ftp-rate-calibration goal to trigger the eitan:liquidity-snapshot handler in FTP-calibration mode.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: FTP_CURVE_REFRESH_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: EITAN_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      // Three-way coherence: eitan:liquidity-snapshot's sole emitted event is
      // LiquiditySnapshot (the snapshot surfaces the FTP-refresh gap). The real
      // FTPRatePublished event returns when an FTP-emitting handler is wired (§16 gap).
      plannedEvents: [
        {
          type: "LiquiditySnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "eitan-goal-loop:ftp-refresh",
          },
        },
      ],
    };
  }

  // Rule 3: open RiskRaised event tagged "liquidity" or "IRRBB" with no
  // resolution in 48h → liquidity-breach-disposition goal. In build phase,
  // any un-resolved RiskRaised tagged with liquidity/IRRBB older than 48h
  // is treated as an active breach requiring Eitan's sign-off. This candidate
  // fires the LCR/NSFR/IRRBB sign-off goal which drives the liquidity-snapshot
  // handler to surface the breach-disposition trace.
  const openLiquidityOrIRRBBBreach = hasOpenLiquidityOrIRRBBRiskRaised();

  if (openLiquidityOrIRRBBBreach) {
    if (!validateGoal(LCR_NSFR_IRRBB_GOAL)) return null;

    return {
      kind: "decision",
      chosen: LCR_NSFR_IRRBB_GOAL,
      rationale:
        "Open RiskRaised event(s) tagged 'liquidity' or 'IRRBB' detected in the event store with no resolution in 48h. Eitan's §9 mandate (Sign LCR / NSFR / IRRBB submissions to Camille) requires breach-disposition sign-off within the SLA window. Selecting liquidity-breach-disposition goal to trigger the eitan:liquidity-snapshot handler.",
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: LCR_NSFR_IRRBB_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: EITAN_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      plannedEvents: [
        {
          type: "LiquiditySnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "eitan-goal-loop:breach-disposition",
          },
        },
      ],
    };
  }

  // Rule 4: if no ALCOMinutesApproved event in last 30 days, select ALCO chair
  // / treasury-limits goal. Eitan's §6 cadence: ALCO meeting at least monthly.
  // In build phase, ALCOMinutesApproved is the proxy event for a completed ALCO
  // cycle.
  const lastALCOMinutesApproved = lastALCOMinutesApprovedMs();
  const needsALCOCyclePrep =
    lastALCOMinutesApproved === undefined || Date.now() - lastALCOMinutesApproved > THIRTY_DAYS_MS;

  if (needsALCOCyclePrep) {
    if (!validateGoal(ALCO_CHAIR_GOAL)) return null;

    return {
      kind: "decision",
      chosen: ALCO_CHAIR_GOAL,
      rationale: `No ALCOMinutesApproved event in the last 30 days (last seen: ${lastALCOMinutesApproved ? new Date(lastALCOMinutesApproved).toISOString() : "never"}). Eitan's §6 cadence requires an ALCO meeting at least monthly. Selecting alco-cycle-prep goal to trigger the eitan:liquidity-snapshot handler in ALCO-prep mode.`,
      mandateCitations: [
        {
          section: "9-decisions-in-scope",
          rowKey: ALCO_CHAIR_GOAL,
          specHash,
        },
      ],
      procedureCitations: [
        {
          procedurePath: EITAN_PROCEDURE_PATH,
          stepId,
          procedureHash: specHash,
        },
      ],
      // Three-way coherence: eitan:liquidity-snapshot's sole emitted event is
      // LiquiditySnapshot (the snapshot surfaces the ALCO-cycle gap). The real
      // ALCOMinutesApproved event returns when an ALCO handler that emits it is
      // wired (§16 gap).
      plannedEvents: [
        {
          type: "LiquiditySnapshot",
          payloadPreview: {
            agentUrn: args.agent.urn,
            trigger: "eitan-goal-loop:alco-prep",
          },
        },
      ],
    };
  }

  // No goal justified.
  logger.info(
    {
      agentUrn: args.agent.urn,
      lastLiquiditySnapshotAgo: lastLiquiditySnapshot
        ? `${Math.round((Date.now() - lastLiquiditySnapshot) / 60_000)}min`
        : "never",
      lastFTPRatePublishedAgo: lastFTPRatePublished
        ? `${Math.round((Date.now() - lastFTPRatePublished) / 60_000)}min`
        : "never",
      openLiquidityOrIRRBBBreach,
      lastALCOMinutesApprovedAgo: lastALCOMinutesApproved
        ? `${Math.round((Date.now() - lastALCOMinutesApproved) / 60_000)}min`
        : "never",
    },
    "eitan-goal-deriver: no action justified — deferring",
  );
  return null;
};

// ---------------------------------------------------------------------------
// Brief-bound dispatch — shared module (goal-loop-brief-dispatch.ts)
//
// Self-executable liquidity/ALM attestations close delivered (live handler);
// everything else closes blocked with the substrate gap surfaced and
// followOnRoutes: []. Blocked is TERMINAL — the legacy auto-routing of blocked
// briefs into the brief-router is removed (it re-issued briefs without an
// executor: the phantom-backlog failure mode of PR #1182). A Scrooge-
// coordinated / LLM-backed dispatched run picks the gap up. Never fakes
// delivery.
//
// Run-lifecycle citations come from GOAL_LOOP_RUN_LIFECYCLE_AUTHORITIES in the
// shared module. Eitan's cohort behaviour (candidate set, classifier pattern)
// still derives from D-AGENT-AUTONOMY-RISK-TREASURY-PILOT.
// Authority: D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN
// (CEO-approved 2026-06-11).
// ---------------------------------------------------------------------------

/**
 * Title pattern for the attestation class Eitan's deterministic handler
 * genuinely delivers. The only deterministic deliverable Eitan's goal-loop
 * owns today is the LiquiditySnapshot.
 */
const EITAN_SELF_EXECUTABLE_PATTERN = /liquidity|lcr|nsfr|irrbb|alco|treasury/i;

/**
 * Self-executable only if the brief asks for the liquidity / LCR / NSFR / ALCO
 * readiness attestation AND needs no code-PR.
 */
export function isSelfExecutableByEitan(brief: AgentBriefIssuedPayload): boolean {
  return isSelfExecutableBrief(brief, EITAN_SELF_EXECUTABLE_PATTERN);
}

/** Shared brief-dispatch config — the delivered class (liquidity attestation) stays live. */
export const EITAN_BRIEF_DISPATCH: GoalLoopBriefDispatchConfig = {
  agentSlug: "eitan",
  selfExecutablePattern: EITAN_SELF_EXECUTABLE_PATTERN,
  deliveredClassLabel: "liquidity attestation",
  runHandler: eitanLiquiditySnapshot,
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
// Handler (wired as `eitan:goal-loop`)
//
// Directly invokes the goal-loop substrate (no runAgent call — avoids the
// circular dependency through handler-callables.ts). Calls the underlying
// eitan:liquidity-snapshot handler directly via its imported callable.
//
// Live: when the goal-loop selects a decision the eitan:liquidity-snapshot
// handler runs for real and emits. The handler is dry-run only when the loop
// deferred/escalated or when ctx.dryRun is set. Goal-loop events are always
// emitted regardless.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "eitan:goal-loop — starting goal-loop run",
  );

  const agentUrn = "agent:eitan";

  // Parse Eitan's spec.
  const parseResult = parseSpecFile(EITAN_SPEC_PATH);
  if (!parseResult.ok) {
    logger.warn(
      { reason: parseResult.reason, specPath: EITAN_SPEC_PATH },
      "eitan:goal-loop — spec parse failed; running handler without goal-loop",
    );
    const output = await eitanLiquiditySnapshot(ctx);
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
  const goalLoopResult = await getGoalLoopRunner().runWithGoal(args, eitanGoalDeriver);

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
    "eitan:goal-loop — goal-loop iteration complete",
  );

  const shouldRunHandler = goalOutcome !== null && goalOutcome.kind === "decision";

  // Brief-bound dispatch path: when the loop selected a decision and there is
  // an open brief addressed to Eitan, bind a run to the oldest brief and emit
  // its run lifecycle (terminal blocked, never auto-routed). Skipped under --dry-run.
  const openBriefs = shouldRunHandler && !ctx.dryRun ? openBriefsListForEitan() : [];
  const [brief] = openBriefs;
  if (brief) {
    const dispatch = await dispatchBriefBoundRun(
      ctx,
      brief,
      iterationId,
      openBriefs.length - 1,
      EITAN_BRIEF_DISPATCH,
    );
    logger.info(
      { agent: ctx.agent, iterationId, briefId: brief.briefId, openBriefs: openBriefs.length },
      "eitan:goal-loop — run complete (brief-bound dispatch)",
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
    const cadence = await dispatchCadenceRun(ctx, iterationId, EITAN_BRIEF_DISPATCH);
    logger.info(
      { agent: ctx.agent, iterationId },
      "eitan:goal-loop — run complete (cadence, instrumented)",
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

  const handlerOutput = await eitanLiquiditySnapshot(handlerCtx);

  logger.info(
    {
      agent: ctx.agent,
      iterationId,
      outcome: goalOutcome?.kind ?? "deferred",
      goalEventsEmitted,
      handlerEventsEmitted: handlerOutput.eventsEmitted,
      ok: handlerOutput.ok,
    },
    "eitan:goal-loop — run complete (deferred)",
  );

  return {
    eventsEmitted: handlerOutput.eventsEmitted + goalEventsEmitted,
    ok: handlerOutput.ok,
    summary: `goal-loop: iteration=${iterationId} outcome=${goalOutcome?.kind ?? "deferred"} handler=${handlerOutput.summary}`,
    ...(handlerOutput.deliverable ? { deliverable: handlerOutput.deliverable } : {}),
  };
};

export default handler;
