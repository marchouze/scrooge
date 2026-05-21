// runtime/agents/sade-agent-retirement.ts
//
// Sade's agent-retirement handler.
//
// On-request handler. Emits an `AgentRetired` event for a named agent.
// When `agentUrn` is provided via the trigger context's triggering events
// payload, retires that specific agent. When invoked without a specific
// target, reports the current retirement-candidate roster (paused agents
// listed in Team/_team-roster.json with buildPhaseStatus "paused") — these
// are NOT retired; they activate at licence-day.
//
// The handler does NOT emit AgentRetired for paused agents — those are
// licence-day candidates, not decommissioned agents. Retirement requires
// explicit invocation with the target agent's name and position.
//
// Build-phase posture:
//   Paused agents (Niko, Imani human-HR slice, Sade human-HR slice) are
//   correctly silent. Their `buildPhaseStatus: "paused"` means future
//   activation, not retirement. The handler reports them as candidates to
//   distinguish the two states clearly.
//
// Closes the substrate gap surfaced in sade-agentops-readiness.ts § 16:
//   "Agent retirement substrate — no AgentRetired producer".
//
// Procedure: Procedures/by-policy/agent-retirement.md (PROC-AGENTOPS-RETIREMENT-001)
// Authority: COO (Devon, Chief Operations Officer) + AgentOps (Sade)
// Author: Sade (AgentOps & Token Efficiency Engineer, engineering)

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { clock, eventStore, logger } from "../../platform/composition";
import { makeAgentRetired } from "../../platform/event-store/event-types/agent-substrate-extended";
import type { AgentRunContext, AgentRunOutput } from "../types";

const EVENT_CITATIONS = ["PROC-AGENTOPS-RETIREMENT-001", "PRINCIPLE-6"];

interface RosterEntry {
  name: string;
  position?: string;
  buildPhaseStatus?: string;
}

interface Roster {
  agents?: RosterEntry[];
}

function readRoster(repoRoot: string): RosterEntry[] {
  const path = resolve(repoRoot, "Team", "_team-roster.json");
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as Roster;
    return Array.isArray(parsed.agents) ? parsed.agents : [];
  } catch {
    return [];
  }
}

function hasExistingRetirementEvent(agentName: string): boolean {
  for (const e of eventStore.replay({ type: "AgentRetired" })) {
    const payload = e.payload as { agentName?: string };
    if (payload?.agentName === agentName) return true;
  }
  return false;
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  // Extract optional target from triggering event payload or trigger id.
  // Convention: trigger id "agent-retirement:<agentName>:<agentPosition>"
  // allows on-request invocation with a specific target.
  let targetName: string | null = null;
  let targetPosition: string | null = null;

  const triggerParts = ctx.trigger.id.split(":");
  if (triggerParts.length >= 3 && triggerParts[0] === "agent-retirement") {
    targetName = triggerParts[1] ?? null;
    targetPosition = triggerParts.slice(2).join(":") || null;
  }

  const roster = readRoster(ctx.repoRoot);
  const pausedAgents = roster.filter((a) => a.buildPhaseStatus === "paused");
  const retiredAgents = roster.filter((a) => a.buildPhaseStatus === "retired");

  // If no specific target, report state and return — do NOT auto-retire.
  if (!targetName) {
    logger.info(
      {
        pausedCount: pausedAgents.length,
        retiredCount: retiredAgents.length,
        paused: pausedAgents.map((a) => a.name),
        retired: retiredAgents.map((a) => a.name),
        trigger: ctx.trigger.id,
        asOf: ctx.asOf,
        dryRun: ctx.dryRun,
      },
      "sade:agent-retirement — no target specified; reporting roster state. Paused agents are licence-day candidates, not retirement candidates. Invoke with trigger id 'agent-retirement:<name>:<position>' to retire a specific agent.",
    );

    return {
      eventsEmitted: 0,
      summary: `agent-retirement: no target. ${pausedAgents.length} paused (licence-day candidates); ${retiredAgents.length} already retired. Specify trigger 'agent-retirement:<name>:<position>' to retire.`,
      ok: true,
    };
  }

  // Validate target is not a paused (licence-day candidate) agent.
  const isPaused = pausedAgents.some(
    (a) => a.name.toLowerCase() === (targetName ?? "").toLowerCase(),
  );
  if (isPaused) {
    logger.warn(
      { targetName, trigger: ctx.trigger.id },
      "sade:agent-retirement — target agent is paused (licence-day candidate), not a retirement candidate. Refusing to emit AgentRetired. To retire a paused agent, first update their buildPhaseStatus in Team/_team-roster.json to 'retiring' and re-invoke.",
    );
    return {
      eventsEmitted: 0,
      summary: `agent-retirement REFUSED: ${targetName} is a paused (licence-day candidate) agent. Update roster status before retiring.`,
      ok: false,
    };
  }

  // Check for duplicate retirement.
  if (hasExistingRetirementEvent(targetName)) {
    logger.warn(
      { targetName, trigger: ctx.trigger.id },
      "sade:agent-retirement — AgentRetired event already exists for this agent. Skipping to avoid duplicate.",
    );
    return {
      eventsEmitted: 0,
      summary: `agent-retirement SKIPPED: ${targetName} already has an AgentRetired event in the store.`,
      ok: true,
    };
  }

  const position = targetPosition ?? "unknown";
  const asOf = ctx.asOf;

  logger.info(
    { targetName, position, asOf, dryRun: ctx.dryRun },
    "sade:agent-retirement — emitting AgentRetired",
  );

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append(
      makeAgentRetired({
        asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: {
          type: "service",
          id: "agent:sade:agent-retirement",
        },
        citations: EVENT_CITATIONS,
        payload: {
          agentName: targetName,
          agentPosition: position,
          retiredAt: clock.now(),
          reason: "retired-via-agentops-retirement-handler",
        },
      }),
    );
    eventsEmitted = 1;
  }

  return {
    eventsEmitted,
    summary: `agent-retirement: emitted AgentRetired for ${targetName} (${position}). Procedure: update Team/_team-roster.json buildPhaseStatus to 'retired' and archive persona file.`,
    ok: true,
  };
};

export default handler;
