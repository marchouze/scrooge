// runtime/agents/callables/rashida.ts
// Per-agent callable map for Rashida (CISO / Cyber Resilience).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import rashidaCyberResilienceSnapshot from "../rashida-cyber-resilience-snapshot";
import rashidaEventTriage from "../rashida-event-triage";
import rashidaGoalLoop from "../rashida-goal-loop";

export const RASHIDA_CALLABLES: Record<string, AgentRunHandler> = {
  "rashida:goal-loop": rashidaGoalLoop,
  "rashida:cyber-resilience-snapshot": rashidaCyberResilienceSnapshot,
  "rashida:event-triage": rashidaEventTriage,
};
