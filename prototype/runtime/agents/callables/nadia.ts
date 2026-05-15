// runtime/agents/callables/nadia.ts
// Per-agent callable map for Nadia (Model Validation Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import nadiaEventTriage from "../nadia-event-triage";
import nadiaValidationCycle from "../nadia-validation-cycle";

export const NADIA_CALLABLES: Record<string, AgentRunHandler> = {
  "nadia:event-triage": nadiaEventTriage,
  "nadia:validation-cycle": nadiaValidationCycle,
};
