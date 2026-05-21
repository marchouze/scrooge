// runtime/agents/metadata/bea.ts
// Per-agent handler metadata for Bea (Accounting & Financial Reporting Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const BEA_HANDLER_METADATA: readonly HandlerMetadata[] = [
  // bea:goal-loop — daily 06:00 UTC; cohort-1 activation per D-T-01-PERMISSION-GATE-SECURE-DEFAULT.
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  entry("Bea", "goal-loop", "scheduled", {
    cadenceHours: 24,
    cronExpression: "0 6 * * *",
  }),
  entry("Bea", "accounting-readiness", "scheduled", {
    cadenceHours: 24,
    cronExpression: "47 5 * * *",
  }),
  // B-1 — Bea FX posting engine. Authority: D-MARKETS-CAPITAL-TIME-SHAPE.
  entry("Bea", "fx-posting-engine", "event-driven", {
    subscribesTo: ["FxTradeExecuted", "FxPositionRevalued", "TradeMatured", "FxTradeCancelled"],
  }),
  // B-2 — Bea universal GL posting engine. Authority: PROC-PAY-RBH-01.
  entry("Bea", "gl-posting-engine", "event-driven", {
    subscribesTo: ["PaymentInitiated", "PaymentSettled", "SettlementInstructionReceived"],
  }),
  // M1 — Bea IFRS-9 classification rules.
  entry("Bea", "m1-ifrs-classification-rules", "event-driven", {
    subscribesTo: [
      "CeoDecision",
      "CdmBindingsRegenerated",
      "EquityTradeBooked",
      "EquitySettlementInstructed",
      "EquityCorporateActionApplied",
    ],
  }),
  entry("Bea", "event-triage", "event-driven", {
    subscribesTo: [
      "TradePosted",
      "FundingDrawn",
      "PaymentSettled",
      "AccrualBooked",
      "IFRS9ECLPublished",
      "TaxClassificationPublished",
      "RestatementProposed",
    ],
  }),
  // M2 Slice 2 — period-close handler. Emits AccountingPeriodOpened,
  // TrialBalanceSnapshotted, AccountingPeriodClosed.
  // Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
  entry("Bea", "period-close", "scheduled", {
    cadenceHours: 24,
    cronExpression: "30 5 * * *",
  }),
];
