// runtime/agents/callables/linnea.ts
// Per-agent callable map for Linnea (COO / Operations Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import linneaEventTriage from "../linnea-event-triage";
import linneaOpsCycle from "../linnea-ops-cycle";

export const LINNEA_CALLABLES: Record<string, AgentRunHandler> = {
  "linnea:event-triage": linneaEventTriage,
  "linnea:ops-cycle": linneaOpsCycle,
};
