// runtime/agents/callables/nolan.ts
// Per-agent callable map for Nolan (HR / Hiring Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import nolanEventTriage from "../nolan-event-triage";
import nolanHiringCycle from "../nolan-hiring-cycle";

export const NOLAN_CALLABLES: Record<string, AgentRunHandler> = {
  "nolan:event-triage": nolanEventTriage,
  "nolan:hiring-cycle": nolanHiringCycle,
};
