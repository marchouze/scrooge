// runtime/agents/callables/senna.ts
// Per-agent callable map for Senna (DevSecOps / Security Substrate Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import sennaEventTriage from "../senna-event-triage";
import sennaGoalLoop from "../senna-goal-loop";
import sennaM1TradingStackThreatModel from "../senna-m1-trading-stack-threat-model";
import sennaSecuritySubstrateState from "../senna-security-substrate-state";
import type { AgentRunHandler } from "../../types";

export const SENNA_CALLABLES: Record<string, AgentRunHandler> = {
  "senna:security-substrate-state": sennaSecuritySubstrateState,
  "senna:goal-loop": sennaGoalLoop,
  "senna:m1-trading-stack-threat-model": sennaM1TradingStackThreatModel,
  "senna:event-triage": sennaEventTriage,
};
