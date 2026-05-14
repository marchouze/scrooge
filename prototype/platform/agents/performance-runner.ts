// platform/agents/performance-runner.ts
//
// Orchestrating runner — called by the scheduler or one-shot script.
// Iterates over the active agent fleet, checks idempotency, calls
// evaluateAgent(), emits AgentPerformanceEvaluated event, issues feedback,
// and emits AgentFeedbackIssued event.
//
// Idempotency: if an AgentPerformanceEvaluated event already exists for
// (agentId + evaluationPeriod), the agent is skipped.
//
// TODO: replace inline stub payload interfaces with imports from
// event-types/performance.ts once Mira's PR lands.
//
// Author: Sade (AgentOps engineer, engineering)

import { eventStore } from "../composition";
import { newEventId } from "../core/types";
import type { Actor, Event } from "../event-store/types";
import { KNOWN_AGENTS, evaluateAgent } from "./performance-evaluator";
import { issueFeedback } from "./performance-feedback";

// ---------------------------------------------------------------------------
// Active agent list — prefer AgentRegistered events; fall back to hardcoded
// ---------------------------------------------------------------------------

function getActiveAgentIds(): string[] {
  const registered = new Set<string>();

  for (const e of eventStore.replay({ type: "AgentRegistered" })) {
    const p = e.payload as Record<string, unknown>;
    const urn = String(p.agentUrn ?? "");
    // agentUrn format: "agent:<lowercased-name>"
    const name = urn.replace(/^agent:/, "");
    if (name) registered.add(name);
  }

  if (registered.size > 0) return [...registered];

  // Fallback: hardcoded fleet
  return [...KNOWN_AGENTS];
}

// ---------------------------------------------------------------------------
// Idempotency check
// ---------------------------------------------------------------------------

function alreadyEvaluated(agentId: string, evaluationPeriod: string): boolean {
  for (const e of eventStore.replay({ type: "AgentPerformanceEvaluated" })) {
    const p = e.payload as Record<string, unknown>;
    if (String(p.agentId) === agentId && String(p.evaluationPeriod) === evaluationPeriod) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PerformanceRunResult {
  evaluated: number;
  skipped: number;
}

/**
 * Run daily performance evaluations for all active agents for the given
 * evaluation period (YYYY-MM-DD).
 *
 * Returns { evaluated, skipped } counts.
 */
export async function runPerformanceEvaluations(
  evaluationPeriod: string,
  actor: Actor,
): Promise<PerformanceRunResult> {
  const agentIds = getActiveAgentIds();
  let evaluated = 0;
  let skipped = 0;

  for (const agentId of agentIds) {
    // Idempotency — skip if already evaluated this period
    if (alreadyEvaluated(agentId, evaluationPeriod)) {
      skipped++;
      continue;
    }

    // Run evaluation
    const result = await evaluateAgent(agentId, evaluationPeriod);

    // Emit AgentPerformanceEvaluated event
    // TODO: replace payload cast with typed makeAgentPerformanceEvaluated() once
    // Mira's event-types/performance.ts PR lands.
    const evalEvent: Event = {
      event_id: newEventId(),
      type: "AgentPerformanceEvaluated",
      as_of: new Date().toISOString(),
      entity: "LE-ZA-HOZ-BANK",
      actor,
      citations: ["D-AGENT-AUTONOMY-OPERATIONAL"],
      payload: { ...result, evaluatedBy: actor.id } as unknown as Record<string, unknown>,
    };
    eventStore.append(evalEvent);

    // Issue feedback file
    const { artifactPath, feedbackText } = await issueFeedback(result, evalEvent.event_id);

    // Emit AgentFeedbackIssued event
    // TODO: replace payload cast with typed makeAgentFeedbackIssued() once
    // Mira's event-types/performance.ts PR lands.
    const feedbackEvent: Event = {
      event_id: newEventId(),
      type: "AgentFeedbackIssued",
      as_of: new Date().toISOString(),
      entity: "LE-ZA-HOZ-BANK",
      actor,
      citations: ["D-AGENT-AUTONOMY-OPERATIONAL"],
      payload: {
        agentId,
        evaluationPeriod,
        evaluationEventId: evalEvent.event_id,
        deliveredVia: "team-inbox",
        artifactPath,
        feedbackText,
        issuedBy: actor.id,
      } as Record<string, unknown>,
    };
    eventStore.append(feedbackEvent);

    evaluated++;
  }

  return { evaluated, skipped };
}
