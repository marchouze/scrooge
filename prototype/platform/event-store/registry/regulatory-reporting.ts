// platform/event-store/registry/regulatory-reporting.ts
//
// Event-type registry rows for regulatory reporting events.
//
// Covers:
//   - TradeReportSubmitted — FinSurv cross-border FX trade report submission
//     (build-phase: stub emits "pending"; production: live API)
//   - SarbSubmissionAttempted — BA-return submission attempt to SARB prudential
//     portal (build-phase: local simulator; production: SARB BankServ portal)
//
// Authority:
//   - D-FX-AD-STATUS (Authorised Dealer; FinSurv reporting required)
//   - EXCON-SARB-CIRC-3-2020 (FX reporting obligations)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
//   - Banks Act 94/1990 §70 + §73; Regulations Relating to Banks Reg 26
//
// Authors: Mira (Compliance / RegTech engineer, engineering),
//          Anya (Data / analytics engineer, engineering),
//          Atlas (Core banking platform architect, engineering)

import {
  RwaComputedPayloadSchema,
  SarbSubmissionAttemptedPayloadSchema,
  TradeReportSubmittedPayloadSchema,
} from "../event-types/regulatory-reporting";
import { type EventTypeMetadata, RETENTION_ACCOUNTING_7Y, RETENTION_JSE_TRADE_7Y } from "./types";

export const REGULATORY_REPORTING_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "TradeReportSubmitted",
    class: "governance",
    payloadSchema: TradeReportSubmittedPayloadSchema,
    issuer: "Mira",
    subscribers: ["Mira", "Zara", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["D-FX-AD-STATUS", "EXCON-SARB-CIRC-3-2020", "ORG-EXCON-ODP-001"],
    // Regulatory submissions — 7-year retention per SARB inspection requirements.
    // Cross-reference: EXCON-SARB-CIRC-3-2020 reporting record obligations;
    // FSCA inspection / Banks Act s.91 audit requirements.
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/regulatory/finsurv-stub.ts (build-phase); live FinSurv API (post-licence)",
  },
  {
    // D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 5 — local SARB portal simulator.
    // Emitted by `simulators/sarb-prudential.ts` for every BA-return submission
    // attempt (BA 110 / LCR, BA 100 / Capital Adequacy, and future BA-forms).
    // Both successes and failures are recorded so the audit trail is complete
    // (Principle 1). Mode field disambiguates simulator from live submissions.
    // M8 migration: swaps the simulator implementation for a real HTTPS POST to
    // the SARB BankServ prudential portal; this registry row is unchanged.
    type: "SarbSubmissionAttempted",
    class: "governance",
    payloadSchema: SarbSubmissionAttemptedPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Mira", "Bea", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "Banks Act 94 of 1990 §70",
      "Banks Act 94 of 1990 §73",
      "Regulations Relating to Banks Reg 26",
      "[citation: TBC — SARB portal submission procedure PROC-SARB-SUBMIT-01]",
    ],
    // Regulatory submissions — 7-year retention per SARB inspection requirements.
    // Banks Act §73 + §91 require 7-year record-keeping for regulatory returns.
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "simulators/sarb-prudential.ts (build-phase simulator); SARB BankServ portal (post-licence)",
  },
  {
    // D-RWA-ENGINE-W2-SLICE-3 — Pillar-1 RWA decomposition emitted at period
    // close, feeding the BA 700 capital-adequacy denominator. Credit + market
    // RWA are event-sourced (CRE20 over readDebtExposures; 12.5 × BA 320
    // market-risk capital incl. Reg 28(3)(a) disallowances); operational RWA is
    // an explicit gross-income-blocked placeholder until licence-day. The
    // `source` field makes the partial-real composition legible.
    type: "RwaComputed",
    class: "governance",
    payloadSchema: RwaComputedPayloadSchema,
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "D-RWA-ENGINE-W2-SLICE-3",
      "D-REGULATORY-READINESS-W2-SLICE-3",
      "Banks Act 94 of 1990 §70",
      "Regulations Relating to Banks Reg 23",
      "Regulations Relating to Banks Reg 28",
      "BCBS Basel III/IV (CRE20, MAR)",
    ],
    // Capital-adequacy basis records — 7-year accounting retention per Banks
    // Act §73/§91 + IFRS audit-trail requirements.
    retention: RETENTION_ACCOUNTING_7Y,
    source:
      "platform/risk/rwa-computed-engine.ts (emitRwaComputed); runtime/agents/bea-rwa-period-close.ts (period-close emitter)",
  },
];
