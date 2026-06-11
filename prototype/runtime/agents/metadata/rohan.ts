// runtime/agents/metadata/rohan.ts
// Per-agent handler metadata for Rohan (Risk Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const ROHAN_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Rohan", "risk-run", "scheduled", {
    cadenceHours: 24,
    cronExpression: "43 3 * * *",
  }),
  // Daily MTM (mark-to-market) — EOD revaluation of open FX positions.
  // Cron: 18:00 UTC weekdays = ~20:00 SAST, after the JSE 17:00 SAST close.
  // Skips Sat/Sun (no JSE close); operator-triggered runs available via the
  // on-request path (`bun run agent:rohan-daily-mtm`).
  // Authority: D-MARKETS-SCHEMA-FOUNDATION; D-FX-SALES-TRADING-FRONTEND;
  //            D-EVENT-VIEW-BOUNDARY-WIRE Slice B.1.
  // Brief: brief:rohan:wire-daily-mtm-cadence-fix-reversal-without-reva:2026-05-21.
  entry("Rohan", "daily-mtm", "scheduled", {
    cadenceHours: 24,
    cronExpression: "0 18 * * 1-5",
  }),
  // Daily market-risk measure (VaR / SVaR / ES — MR-1-FX, RAS B3 review R8).
  // Cron: 18:30 UTC weekdays = 30 min AFTER the daily MTM (18:00 UTC) so the
  // open book is marked-to-market before VaR reads the position set. Closes
  // FX functionality domain review gap #4: the MarketRiskMeasureComputed emitter
  // was on-request-only (`bun run mr:measure-run`) and could go stale. The
  // staleness watchdog (expected-event-watchdog `mr-1-fx-var-measure`,
  // maxAgeBusinessDays 1) raises a SubstrateAlert if the measure is older than
  // one business day. Idempotent: one measure per entity per UTC day.
  // Authority: D-B3-5 (R8); D-BRC-INTERIM-MR-1-FX; WS-MARKET-RISK-PROCEDURES.
  // Brief: brief:rohan:close-fx-gap-schedule-var-mr-1-fx-market-risk-me:2026-06-08.
  entry("Rohan", "market-risk-measure", "scheduled", {
    cadenceHours: 24,
    cronExpression: "30 18 * * 1-5",
  }),
  // rohan:goal-loop — daily 06:17 UTC; autonomous promotion (risk/treasury pilot),
  // placed after rohan:risk-run (03:43) so a same-day RiskRunCompleted exists.
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3; D-AGENT-AUTONOMY-RISK-TREASURY-PILOT.
  entry("Rohan", "goal-loop", "scheduled", {
    cadenceHours: 24,
    cronExpression: "17 6 * * *",
  }),
  // S7-Targeted #4 — Rohan's backtest harness (v0). Event-driven on BacktestRequested.
  entry("Rohan", "backtest-harness", "event-driven", {
    subscribesTo: ["BacktestRequested"],
  }),
  // Slice 4 — market risk limit check handler (pre-trade gateway).
  // Authority: ORG-PR-01 (ICAAP), RAS-B1, RAS-B2.
  entry("Rohan", "market-risk-limit-check", "event-driven", {
    subscribesTo: ["GatewayCheckRequested"],
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
  // M3 Slice 9 — conduct risk events handler.
  // Evaluates best execution, FAIS suitability, and conflict-of-interest on
  // every FxTradeExecuted event.
  // Authority: FAIS Act 37/2002 §§16–17; D-MARKET-CONDUCT;
  //            D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
  entry("Rohan", "conduct-risk-events", "event-driven", {
    subscribesTo: ["FxTradeExecuted"],
  }),
  // FX conduct surveillance sweep — the reliable dispatch path for best-
  // execution + FAIS-suitability + conflict surveillance. The event-driven
  // conduct-risk-events handler fires only when an FxTradeExecuted lands inside
  // an agent run; FX trades are booked by the operator / pre-trade-gateway path
  // (not an agent run), so they never reached the handler. This scheduled sweep
  // scans the store for any FxTradeExecuted lacking a surveillance outcome and
  // evaluates it (same pattern as the BA310/BA300 period-close handlers). Daily
  // 18:45 UTC = 15 min after rohan:market-risk-measure (18:30 UTC). Idempotent.
  // Authority: D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH (CEO session-
  //            delegation 2026-06-11); D-MARKET-CONDUCT; FAIS Act 37/2002 §§16–17.
  // Brief: brief:zara:otc-vanilla-fx-conduct-dimension-wire-inert-cond:2026-06-11.
  entry("Rohan", "conduct-surveillance-sweep", "scheduled", {
    cadenceHours: 24,
    cronExpression: "45 18 * * 1-5",
  }),
];
