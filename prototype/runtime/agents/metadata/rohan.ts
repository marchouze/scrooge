// runtime/agents/metadata/rohan.ts
// Per-agent handler metadata for Rohan (Risk Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../handlers-metadata";
import { entry } from "./_entry";

export const ROHAN_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Rohan", "risk-run", "scheduled", {
    cadenceHours: 24,
    cronExpression: "43 3 * * *",
  }),
  // rohan:goal-loop — no cron; shadow mode for cohort-3 first ticks (on-request only).
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  entry("Rohan", "goal-loop", "on-request"),
  // S7-Targeted #4 — Rohan's backtest harness (v0). Event-driven on BacktestRequested.
  entry("Rohan", "backtest-harness", "event-driven", {
    subscribesTo: ["BacktestRequested"],
  }),
  entry("Rohan", "event-triage", "event-driven", {
    subscribesTo: [
      "TradeBooked",
      "PositionAdjusted",
      "CollateralUpdated",
      "LimitBreachProposed",
      "LimitBreachActioned",
      "ModelDriftDetected",
      "PolicyChange",
      "PortfolioReclassification",
    ],
  }),
];
