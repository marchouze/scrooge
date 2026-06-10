// runtime/agents/goal-loop-brief-dispatch.ts
//
// Shared brief-bound run-lifecycle dispatch for per-persona goal-loops.
//
// WHY THIS EXISTS — the dashboard autonomy run-feed reads ONLY
// `AgentRunStarted{substrate:"agent-runtime"}` (dashboard/server.ts). A
// goal-loop that emits only the planning trace (AgentGoalEvaluated /
// AgentGoalSelected / AgentGoalDeferred) is therefore INVISIBLE to the
// run-feed, which is exactly how a 5-day-stale feed masked a 48-brief phantom
// backlog on 2026-06-10 (PR #1182). PR #1182 instrumented the Atlas loop;
// rohan/helena/eitan/bea/ravi had bespoke in-file copies of the same pattern.
// This module is the single shared implementation the remaining loops wire
// into — so the emission logic exists once, not 15 times.
//
// THE PATTERN (per #1182, generalised):
//   - `openBriefsListForAgent(slug)` — open (no AgentRunStarted/Completed yet)
//     AgentBriefIssued envelopes addressed to the agent, oldest-first, with
//     duplicate envelopes sharing a briefId collapsed to one entry.
//   - `dispatchBriefBoundRun(...)` — binds a run to one open brief and emits
//     AgentRunStarted{agent-runtime} → AgentRunCompleted:
//       * outcome="delivered" ONLY when the brief matches the loop's
//         deterministic attestation class (config.selfExecutablePattern, no
//         code-PR output) AND a live runHandler is configured — the handler
//         runs for real; the rule engine never fakes delivery.
//       * outcome="blocked" otherwise, with the substrate gap surfaced. The
//         blocked run is the honest terminal autonomous record — it makes
//         "selected-but-blocked-on-LLM-execution" visible in the run-feed
//         instead of leaving the feed empty.
//   - NO auto-routing of blocked briefs. The #1182 post-mortem traced the
//     phantom `brief:atlas:route-*` backlog to auto-routing blocked code-PR
//     briefs into the brief-router (code-pr → Atlas), which re-issued them
//     without an executor. The shared helper adopts Atlas's terminal-record
//     posture for every loop: blocked + gap surfaced, picked up by a
//     Scrooge-coordinated / LLM-backed dispatched run.
//
// Shadow-mode cohorts (owen cohort-2; rashida/thandiwe/zara cohort-3): omit
// `runHandler` from the config. The dispatch then never invokes the underlying
// handler (no live side-effects — the shadow constraint holds) but still emits
// the run lifecycle, closing every brief-bound run as blocked.
//
// Permission note: every `agent:<slug>` actor has a published PermissionPolicy
// (T-12, `bun run publish:sub-agent-policies`), so the non-privileged
// AgentRunStarted/Completed types take the allow-by-default path with no
// legacy bypass.
//
// Authority: D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION (CEO-approved
// 2026-06-10, PR #1182) — extended to all goal-loops per
// D-QUEUE-CLOSEOUT-2026-06-10.
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore, logger } from "../../platform/composition";
import type { AgentBriefIssuedPayload } from "../../platform/event-store/event-types/agent";
import type { EventStore } from "../../platform/event-store/store";
import { recordAgentRunCompleted, recordAgentRunStarted } from "../../platform/records/helpers";
import type { AgentRunContext, AgentRunOutput } from "../types";

/** Citations carried on every run-lifecycle event this module emits. */
export const GOAL_LOOP_RUN_LIFECYCLE_AUTHORITIES = [
  "D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION",
  "D-QUEUE-CLOSEOUT-2026-06-10",
] as const;

/** Default minimum brief age before the loop reacts (mirrors #1182: 30 min). */
const DEFAULT_MIN_AGE_MS = 30 * 60 * 1000;

/**
 * Open (not yet started/completed) briefs addressed to the agent, older than
 * `minAgeMs`, oldest-first. Generalises `openBriefsListForAtlas` (#1182):
 * a brief is "handled" once any AgentRunStarted or AgentRunCompleted carries
 * its briefId; duplicate envelopes sharing a briefId collapse to one entry, so
 * one run-lifecycle pair against that briefId clears the whole batch.
 */
export function openBriefsListForAgent(
  agentSlug: string,
  store: EventStore = eventStore,
  minAgeMs = DEFAULT_MIN_AGE_MS,
): AgentBriefIssuedPayload[] {
  const slug = agentSlug.toLowerCase();
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
  const seenBriefIds = new Set<string>();
  for (const e of store.replay({ type: "AgentBriefIssued" })) {
    const p = e.payload as AgentBriefIssuedPayload;
    const briefId = String(p.briefId ?? e.event_id);
    const toName = String((p.issuedTo as { name?: string })?.name ?? "");
    if (!toName.toLowerCase().includes(slug)) continue;
    if (handledBriefIds.has(briefId)) continue;
    // Collapse duplicate envelopes sharing a briefId to a single open entry.
    if (seenBriefIds.has(briefId)) continue;
    const t = new Date(e.as_of).getTime();
    if (Number.isNaN(t) || Date.now() - t <= minAgeMs) continue;
    seenBriefIds.add(briefId);
    open.push({ asOfMs: t, payload: p });
  }
  // Oldest first — FIFO drain.
  open.sort((a, b) => a.asOfMs - b.asOfMs);
  return open.map((o) => o.payload);
}

export interface GoalLoopBriefDispatchConfig {
  /** Bare agent slug, e.g. "anya" — actor id `agent:<slug>`, runId prefix, brief match. */
  readonly agentSlug: string;
  /**
   * Title pattern for the attestation class the loop's deterministic handler
   * genuinely delivers (e.g. /projection[\s-]?drift/i). A brief is
   * self-executable only when this matches AND no expected output is a
   * code-PR. Omit to force the blocked path for every brief — required for
   * shadow-mode cohorts and any loop with no deterministic deliverable.
   */
  readonly selfExecutablePattern?: RegExp;
  /** Human label for the delivered class, e.g. "projection-drift attestation". */
  readonly deliveredClassLabel?: string;
  /**
   * The loop's underlying deterministic handler, run live (dryRun=false) on
   * the delivered path. Omit for shadow-mode cohorts — the dispatch then
   * never invokes a handler and every brief-bound run closes blocked.
   */
  readonly runHandler?: (ctx: AgentRunContext) => Promise<AgentRunOutput>;
}

/**
 * True only when the brief matches the loop's deterministic attestation class
 * and requires no code-PR output. No pattern → never self-executable.
 */
export function isSelfExecutableBrief(
  brief: AgentBriefIssuedPayload,
  pattern: RegExp | undefined,
): boolean {
  if (!pattern) return false;
  const needsCode = brief.expectedOutputs.some((o) => o.kind === "code-pr");
  if (needsCode) return false;
  return pattern.test(brief.title);
}

/**
 * Bind a run to one open brief and emit AgentRunStarted{agent-runtime} →
 * AgentRunCompleted. Returns the number of run-lifecycle events emitted plus
 * a summary fragment for the goal-loop handler's AgentRunOutput.
 */
export async function dispatchBriefBoundRun(
  ctx: AgentRunContext,
  brief: AgentBriefIssuedPayload,
  iterationId: string,
  remainingOpen: number,
  config: GoalLoopBriefDispatchConfig,
): Promise<{ eventsEmitted: number; summary: string }> {
  const { agentSlug } = config;
  const runId = `run:${agentSlug}:goal-loop:${iterationId}`;
  const agent = brief.issuedTo; // issuedTo IS this agent — keep the ref consistent.
  const actor = { type: "service", id: `agent:${agentSlug}` } as const;
  const citations = [...GOAL_LOOP_RUN_LIFECYCLE_AUTHORITIES];

  recordAgentRunStarted(
    {
      runId,
      briefId: brief.briefId,
      agent,
      startedAt: ctx.asOf,
      substrate: "agent-runtime",
      citations,
      actor,
    },
    ctx.asOf,
  );

  let eventsEmitted = 1;

  if (config.runHandler && isSelfExecutableBrief(brief, config.selfExecutablePattern)) {
    // Genuinely completable — run the deterministic handler live and deliver.
    // Failure coverage: a thrown handler MUST still close the run. An
    // unclosed AgentRunStarted permanently marks the brief "handled" in
    // openBriefsListForAgent (started counts as handled) with no completion —
    // a silent brief-drop. On throw, close blocked with the failure surfaced.
    let handlerOutput: AgentRunOutput;
    try {
      handlerOutput = await config.runHandler({ ...ctx, dryRun: false });
    } catch (err) {
      const failureGap = `${agent.name} goal-loop bound run ${runId} to brief ${brief.briefId} ("${brief.title}") but the deterministic handler threw: ${err instanceof Error ? err.message : String(err)}. Run closed blocked so the brief is not silently dropped (an unclosed AgentRunStarted would mark it handled forever).`;
      recordAgentRunCompleted(
        {
          runId,
          briefId: brief.briefId,
          agent,
          completedAt: ctx.asOf,
          outcome: "blocked",
          deliverableBodies: [],
          substrateGapsSurfaced: [failureGap],
          deliverableCitations: citations,
          followOnRoutes: [],
          citations,
          actor,
        },
        ctx.asOf,
      );
      eventsEmitted += 1;
      logger.error(
        { agentSlug, briefId: brief.briefId, runId, err: String(err) },
        `${agentSlug}:goal-loop — handler threw during brief-bound run; closed blocked (failure surfaced)`,
      );
      return {
        eventsEmitted,
        summary: `brief ${brief.briefId} handler-failed → blocked (failure surfaced); ${remainingOpen} open brief(s) remain`,
      };
    }
    eventsEmitted += handlerOutput.eventsEmitted;
    const classLabel = config.deliveredClassLabel ?? "deterministic attestation";
    recordAgentRunCompleted(
      {
        runId,
        briefId: brief.briefId,
        agent,
        completedAt: ctx.asOf,
        outcome: "delivered",
        deliverableBodies: [
          `${agent.name} goal-loop delivered the ${classLabel} for brief ${brief.briefId} ("${brief.title}"). ${handlerOutput.summary}`,
        ],
        substrateGapsSurfaced: [],
        deliverableCitations: citations,
        followOnRoutes: [],
        citations,
        actor,
      },
      ctx.asOf,
    );
    eventsEmitted += 1;
    logger.info(
      { agentSlug, briefId: brief.briefId, runId, remainingOpen },
      `${agentSlug}:goal-loop — brief delivered (${classLabel})`,
    );
    return {
      eventsEmitted,
      summary: `brief ${brief.briefId} delivered (${classLabel}); ${remainingOpen} open brief(s) remain`,
    };
  }

  // Not executable by the rule engine — bind the run, close it blocked, and
  // surface the substrate gap. NEVER faked as delivered, and NEVER auto-routed
  // (the #1182 post-mortem traced the phantom route-brief backlog to
  // auto-routing blocked briefs without an executor). The blocked run is the
  // honest terminal autonomous record; an LLM-backed dispatched run executes it.
  const gap = `${agent.name} goal-loop (rule-engine) triaged brief ${brief.briefId} ("${brief.title}") but cannot execute it autonomously — it requires engineering/judgement work outside the rule-engine capability. This is the goal-loop→LLM-backed-dispatched-run substrate gap: the autonomous substrate cannot author this deliverable; a Scrooge-coordinated or future LLM-backed run picks it up. Not auto-routed (routing blocked briefs without an executor is the phantom-backlog failure mode of PR #1182).`;
  recordAgentRunCompleted(
    {
      runId,
      briefId: brief.briefId,
      agent,
      completedAt: ctx.asOf,
      outcome: "blocked",
      deliverableBodies: [],
      substrateGapsSurfaced: [gap],
      deliverableCitations: citations,
      followOnRoutes: [],
      citations,
      actor,
    },
    ctx.asOf,
  );
  eventsEmitted += 1;

  logger.info(
    { agentSlug, briefId: brief.briefId, runId, remainingOpen },
    `${agentSlug}:goal-loop — brief triaged + blocked-on-LLM (gap surfaced, not auto-routed)`,
  );
  return {
    eventsEmitted,
    summary: `brief ${brief.briefId} blocked-on-LLM (gap surfaced); ${remainingOpen} open brief(s) remain`,
  };
}
