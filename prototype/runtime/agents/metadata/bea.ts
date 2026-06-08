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
  // B-2 — Bea universal GL posting engine — the SOLE live FX + non-FX posting
  // path. FX lifecycle posts via the rules-as-data SLA interpreter
  // (D-SLA-ENGINE-RULES-AS-DATA Phase 3). The separate `bea:fx-posting-engine`
  // (D-MARKETS-CAPITAL-TIME-SHAPE) was retired under WS-SLA-FULL-RETIREMENT
  // (D-SLA-ENGINE-RULES-AS-DATA) — it duplicated the FX event subscriptions
  // below and was a latent double-posting path. Authority: PROC-PAY-RBH-01.
  entry("Bea", "gl-posting-engine", "event-driven", {
    subscribesTo: [
      "PaymentInitiated",
      "PaymentSettled",
      "SettlementInstructionReceived",
      "RepoTradeOpened",
      "DepositTaken",
      "InterbankLoanPlaced",
      "FxTradeExecuted",
      "FxPositionRevalued",
      "TradeMatured",
      "FxTradeCancelled",
    ],
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
  // BA-310 (market / position risk) period-close return — event-driven on
  // AccountingPeriodClosed (emitted by bea:period-close above). Generates the
  // BA-310 FX-NOP return from the live event flow and records a SARB submission
  // attempt via the local simulator (mode "simulator"; live transport is
  // licence-day). Closes FX functionality domain review gap #1 (the BA-310
  // generator + subscriber were built-but-inert, not runtime-wired).
  // Form numbering: BA 310 (Reg 28(5)) + BA 110 attestation (Reg 29(3)); no
  // BA 320/325. Authority: D-BA-RETURN-FORM-NUMBERING-RECON;
  //            D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
  // Brief: brief:mira:close-fx-gap-wire-ba-310-fx-nop-return-into-runt:2026-06-08.
  entry("Bea", "ba310-period-close", "event-driven", {
    subscribesTo: ["AccountingPeriodClosed"],
  }),
  // Daily product-control run — wires the three product-control engines
  // (daily P&L, P&L attribution; valuation-adjustment via Rohan's MTM) into a
  // live daily cadence. Cron: 19:00 UTC weekdays = after Rohan's 18:00 UTC MTM
  // so the P&L engines read the freshest EOD marks.
  // Authority: Camille (CFO) R1/R3; D-TRUSTED-FIGURES-PROGRAM-V1; Principle 6.
  // Brief: brief:bea:wire-product-control-engines-into-daily-cadence:2026-05-31.
  entry("Bea", "product-control-daily", "scheduled", {
    cadenceHours: 24,
    cronExpression: "0 19 * * 1-5",
  }),
];
