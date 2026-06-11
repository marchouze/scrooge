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
  // BA 300 (LCR) period-close return — event-driven on AccountingPeriodClosed.
  // Generates the consolidated functional-currency LCR (foreign-currency legs
  // FX-enriched into the denominator per D-BA300-LCR-FX-ENRICHMENT) and records
  // a SarbSubmissionAttempted{formId:"BA300"} via the SARB simulator.
  // Authority: D-RETURNS-SUBMISSION-WIRING-WORKSTREAM; D-BA300-LCR-FX-ENRICHMENT;
  //            D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (LCR = BA 300).
  entry("Bea", "ba300-lcr-period-close", "event-driven", {
    subscribesTo: ["AccountingPeriodClosed"],
  }),
  // RWA-computed period-close — event-driven on AccountingPeriodClosed. Emits a
  // RwaComputed event of record (Pillar-1 RWA decomposition) feeding the BA 700
  // capital-adequacy denominator: credit RWA event-sourced via CRE20 over
  // readDebtExposures (Reg 23); market RWA = 12.5 × BA 320 capital incl. Reg
  // 28(3)(a) disallowances; operational RWA an explicit gross-income-blocked
  // placeholder (licence-day). BA 700 threads rwaComputationEventId.
  // Authority: D-RWA-ENGINE-W2-SLICE-3.
  // Brief: brief:bea:rwacomputed-engine-w2-slice-3-credit-market-rwa-:2026-06-09.
  entry("Bea", "rwa-period-close", "event-driven", {
    subscribesTo: ["AccountingPeriodClosed"],
  }),
  // BA 700 (Capital Adequacy) period-close return — event-driven on
  // AccountingPeriodClosed. Generates the BA 700 return from the live event
  // flow (capital stack from SubLedgerPostingEmitted + CapitalContribution-
  // Recorded; RWA from the RwaComputed event of record, rwaComputationEventId
  // threaded for chain-of-custody) and records a
  // SarbSubmissionAttempted{formId:"BA700"} via the SARB simulator.
  // Operational RWA is a named tracked deferred gap
  // (GAP-RETURNS-BA700-OPERATIONAL-RWA — gross-income-blocked pre-licence; the
  // zero is the correct BIA value for a pre-commencement bank, so the
  // submitted denominator is not understated today).
  // Authority: D-RETURNS-SUBMISSION-WIRING-WORKSTREAM (Wave B);
  //            D-RWA-ENGINE-W2-SLICE-3;
  //            D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (capital = BA 700).
  // Brief: brief:mira:returns-submission-wiring-wave-b-wire-remaining-:2026-06-10.
  entry("Bea", "ba700-period-close", "event-driven", {
    subscribesTo: ["AccountingPeriodClosed"],
  }),
  // BA 400 (Operational Risk, BIA) period-close return — event-driven on
  // AccountingPeriodClosed. Generates the BA 400 return using the Basic
  // Indicator Approach (empty gross-income rows pre-commencement; zero IS the
  // correct BIA value for a bank that has not yet commenced trading) and records
  // a SarbSubmissionAttempted{formId:"BA400"} via the SARB simulator.
  // Gross-income source is a named tracked component deferral
  // (GAP-RETURNS-BA400-GROSS-INCOME — re-opens at commencement-of-trading when
  // RevenueRecognitionEmitted events start accruing).
  // Authority: D-TREASURER-WAVE2-SUBSTRATE (CEO session-delegation 2026-06-11);
  //            D-RETURNS-SUBMISSION-WIRING-WORKSTREAM;
  //            D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (op-risk = BA 400).
  // Brief: brief:bea:w2-2-wire-ba-400-operational-risk-return-bia-gro:2026-06-11.
  entry("Bea", "ba400-period-close", "event-driven", {
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
