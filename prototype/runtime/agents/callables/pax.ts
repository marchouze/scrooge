// runtime/agents/callables/pax.ts
// Per-agent callable map for PAX (Research Assistant).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import paxEventTriage from "../pax-event-triage";
import paxRoleResearchQueue from "../pax-role-research-queue";

export const PAX_CALLABLES: Record<string, AgentRunHandler> = {
  "pax:role-research-queue": paxRoleResearchQueue,
  "pax:event-triage": paxEventTriage,
};
