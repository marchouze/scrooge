// runtime/agents/metadata/eitan.ts
// Per-agent handler metadata for Eitan (Liquidity / Capital Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const EITAN_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Eitan", "liquidity-snapshot", "scheduled", {
    cadenceHours: 24,
    cronExpression: "53 6 * * *",
  }),
  // eitan:goal-loop — daily 07:13 UTC; autonomous promotion (risk/treasury pilot),
  // placed after eitan:liquidity-snapshot (06:53) so a same-day LiquiditySnapshot exists.
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3; D-AGENT-AUTONOMY-RISK-TREASURY-PILOT.
  entry("Eitan", "goal-loop", "scheduled", {
    cadenceHours: 24,
    cronExpression: "13 7 * * *",
  }),
  entry("Eitan", "event-triage", "event-driven", {
    subscribesTo: [
      "IRRBBExcursion",
      "FXPositionBreach",
      "LCRRatioProjection",
      "NSFRRatioProjection",
      "CapitalActionTrigger",
      "AgentEscalation",
      "PolicyChange",
    ],
  }),
];
