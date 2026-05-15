// runtime/agents/callables/yael.ts
// Per-agent callable map for Yael (Tax Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import yaelEventTriage from "../yael-event-triage";
import yaelTaxReadiness from "../yael-tax-readiness";

export const YAEL_CALLABLES: Record<string, AgentRunHandler> = {
  "yael:tax-readiness": yaelTaxReadiness,
  "yael:event-triage": yaelEventTriage,
};
