// runtime/agents/callables/niko.ts
// Per-agent callable map for Niko (Client Lifecycle Engineer — paused until licence-day).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import nikoClientLifecycle from "../niko-client-lifecycle";
import nikoEventTriage from "../niko-event-triage";
import type { AgentRunHandler } from "../../types";

export const NIKO_CALLABLES: Record<string, AgentRunHandler> = {
  "niko:event-triage": nikoEventTriage,
  "niko:client-lifecycle": nikoClientLifecycle,
};
