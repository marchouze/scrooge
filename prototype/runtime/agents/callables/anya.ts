// runtime/agents/callables/anya.ts
// Per-agent callable map for Anya (Data / Analytics Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import anyaEventTriage from "../anya-event-triage";
import anyaGoalLoop from "../anya-goal-loop";
import anyaLiquidityProjection from "../anya-liquidity-projection";
import anyaM1ProjectionRuntimeMapping from "../anya-m1-projection-runtime-mapping";
import anyaProjectionDrift from "../anya-projection-drift";
import anyaProjectionRefresh from "../anya-projection-refresh";

export const ANYA_CALLABLES: Record<string, AgentRunHandler> = {
  "anya:goal-loop": anyaGoalLoop,
  "anya:projection-drift": anyaProjectionDrift,
  "anya:projection-refresh": anyaProjectionRefresh,
  "anya:m1-projection-runtime-mapping": anyaM1ProjectionRuntimeMapping,
  "anya:event-triage": anyaEventTriage,
  "anya:liquidity-projection": anyaLiquidityProjection,
};
