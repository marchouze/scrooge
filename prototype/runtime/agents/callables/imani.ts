// runtime/agents/callables/imani.ts
// Per-agent callable map for Imani (Legal / ISDA / Contract Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import imaniEventTriage from "../imani-event-triage";
import imaniGoalLoop from "../imani-goal-loop";
import imaniLegalReadiness from "../imani-legal-readiness";

export const IMANI_CALLABLES: Record<string, AgentRunHandler> = {
  "imani:legal-readiness": imaniLegalReadiness,
  "imani:goal-loop": imaniGoalLoop,
  "imani:event-triage": imaniEventTriage,
};
