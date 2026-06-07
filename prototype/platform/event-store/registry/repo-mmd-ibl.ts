// platform/event-store/registry/repo-mmd-ibl.ts
//
// EVENT_TYPE_REGISTRY rows for the three treasury instrument families
// introduced in WS1-PR1a: Repo, Money Market Deposit (bank as taker),
// Funding Line, and Interbank Loan (bank as lender).
//
// 20 events registered:
//
//   Repo (6):
//     RepoTradeOpened, RepoStartLegSettled, RepoInterestAccrued,
//     RepoMarginCallIssued, RepoEndLegSettled, RepoTradeTerminatedEarly
//
//   MMD / Deposit (5):
//     DepositTaken, DepositInterestAccrued, DepositMatured,
//     DepositWithdrawnEarly, DepositRolledOver
//
//   Funding Line (2):
//     FundingLineDrawn, FundingLineRepaid
//
//   Interbank Loan (4 + 3 synonyms → 7 distinct factory events):
//     InterbankLoanPlaced, InterbankLoanInterestAccrued,
//     InterbankLoanMatured, InterbankLoanRecalledEarly
//
// Authority: WS1-PR1a (brief:ravi:ws1-pr1a-repo-mmd-ibl-event-types-lifecycle-regi:2026-05-23);
//            D-MARKETS-SCHEMA-FOUNDATION (CEO-approved);
//            IFRS 9 §3.1.1, §4.1.2, §4.2.1, §5.4.1, §5.7.1;
//            IAS 39 §27 (repos as secured borrowings);
//            Banks Act 94 of 1990 Reg 26/27; BA 110; BA 120; BCBS d365.
//
// Retention: RETENTION_JSE_TRADE_7Y — treasury trades documented under ISDA
// / GMRA Master Agreement, mirrors bond/equity/IRD retention.
//
// Authors: Ravi (Treasury/ALM Engineer, engineering),
//          Bea (Accounting & financial reporting engineer, engineering)

import {
  depositInterestAccruedPayloadSchema,
  depositMaturedPayloadSchema,
  depositRolledOverPayloadSchema,
  depositTakenPayloadSchema,
  depositWithdrawnEarlyPayloadSchema,
  fundingLineDrawnPayloadSchema,
  fundingLineRepaidPayloadSchema,
  interbankLoanInterestAccruedPayloadSchema,
  interbankLoanMaturedPayloadSchema,
  interbankLoanPlacedPayloadSchema,
  interbankLoanRecalledEarlyPayloadSchema,
  repoEndLegSettledPayloadSchema,
  repoInterestAccruedPayloadSchema,
  repoMarginCallIssuedPayloadSchema,
  repoStartLegSettledPayloadSchema,
  repoTradeOpenedPayloadSchema,
  repoTradeTerminatedEarlyPayloadSchema,
} from "../event-types/repo-mmd-ibl";
import { RETENTION_JSE_TRADE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const SOURCE = "platform/event-store/event-types/repo-mmd-ibl.ts";

/**
 * Registry rows for Repo / MMD / Funding Line / Interbank Loan event types.
 *
 * Subscribers:
 *   Ravi (Treasury/ALM Engineer) — lifecycle and ALM wiring.
 *   Bea (Accounting) — GL posting rules (WS1-PR1a).
 *   Helena (CRO) — LCR/NSFR/IRRBB exposure aggregation.
 *   Atlas (platform) — substrate monitoring.
 */
export const REPO_MMD_IBL_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  // ── Repo ─────────────────────────────────────────────────────────────────

  {
    type: "RepoTradeOpened",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: repoTradeOpenedPayloadSchema,
    citationsHint: ["WS1-PR1a", "D-MARKETS-SCHEMA-FOUNDATION", "IAS39-27", "IFRS9-3-2-4"],
    source: SOURCE,
  },

  {
    type: "RepoStartLegSettled",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: repoStartLegSettledPayloadSchema,
    citationsHint: ["WS1-PR1a", "D-MARKETS-SCHEMA-FOUNDATION"],
    source: SOURCE,
  },

  {
    type: "RepoInterestAccrued",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: repoInterestAccruedPayloadSchema,
    citationsHint: ["WS1-PR1a", "D-MARKETS-SCHEMA-FOUNDATION", "IFRS9-B5-4-1"],
    source: SOURCE,
  },

  {
    type: "RepoMarginCallIssued",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: repoMarginCallIssuedPayloadSchema,
    citationsHint: ["WS1-PR1a", "D-MARKETS-SCHEMA-FOUNDATION", "BCBS-d365"],
    source: SOURCE,
  },

  {
    type: "RepoEndLegSettled",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: repoEndLegSettledPayloadSchema,
    citationsHint: ["WS1-PR1a", "D-MARKETS-SCHEMA-FOUNDATION", "IFRS9-3-2-3"],
    source: SOURCE,
  },

  {
    type: "RepoTradeTerminatedEarly",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: repoTradeTerminatedEarlyPayloadSchema,
    citationsHint: ["WS1-PR1a", "D-MARKETS-SCHEMA-FOUNDATION", "IFRS9-3-2-3"],
    source: SOURCE,
  },

  // ── MMD / Money Market Deposit ────────────────────────────────────────────

  {
    type: "DepositTaken",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: depositTakenPayloadSchema,
    citationsHint: ["WS1-PR1a", "D-MARKETS-SCHEMA-FOUNDATION", "IFRS9-4-2-1", "BA325"],
    source: SOURCE,
  },

  {
    type: "DepositInterestAccrued",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: depositInterestAccruedPayloadSchema,
    citationsHint: ["WS1-PR1a", "D-MARKETS-SCHEMA-FOUNDATION", "IFRS9-B5-4-1"],
    source: SOURCE,
  },

  {
    type: "DepositMatured",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: depositMaturedPayloadSchema,
    citationsHint: ["WS1-PR1a", "D-MARKETS-SCHEMA-FOUNDATION", "IFRS9-3-3-1"],
    source: SOURCE,
  },

  {
    type: "DepositWithdrawnEarly",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: depositWithdrawnEarlyPayloadSchema,
    citationsHint: ["WS1-PR1a", "D-MARKETS-SCHEMA-FOUNDATION", "IFRS9-3-3-1"],
    source: SOURCE,
  },

  {
    type: "DepositRolledOver",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: depositRolledOverPayloadSchema,
    citationsHint: ["WS1-PR1a", "D-MARKETS-SCHEMA-FOUNDATION"],
    source: SOURCE,
  },

  // ── Funding Line ──────────────────────────────────────────────────────────

  {
    type: "FundingLineDrawn",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: fundingLineDrawnPayloadSchema,
    citationsHint: ["WS1-PR1a", "D-MARKETS-SCHEMA-FOUNDATION", "IFRS9-4-2-1", "BA325"],
    source: SOURCE,
  },

  {
    type: "FundingLineRepaid",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: fundingLineRepaidPayloadSchema,
    citationsHint: ["WS1-PR1a", "D-MARKETS-SCHEMA-FOUNDATION", "IFRS9-3-3-1"],
    source: SOURCE,
  },

  // ── Interbank Loan ────────────────────────────────────────────────────────

  {
    type: "InterbankLoanPlaced",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: interbankLoanPlacedPayloadSchema,
    citationsHint: ["WS1-PR1a", "D-MARKETS-SCHEMA-FOUNDATION", "IFRS9-4-1-2", "BA326"],
    source: SOURCE,
  },

  {
    type: "InterbankLoanInterestAccrued",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: interbankLoanInterestAccruedPayloadSchema,
    citationsHint: ["WS1-PR1a", "D-MARKETS-SCHEMA-FOUNDATION", "IFRS9-B5-4-1"],
    source: SOURCE,
  },

  {
    type: "InterbankLoanMatured",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: interbankLoanMaturedPayloadSchema,
    citationsHint: ["WS1-PR1a", "D-MARKETS-SCHEMA-FOUNDATION", "IFRS9-3-2-3"],
    source: SOURCE,
  },

  {
    type: "InterbankLoanRecalledEarly",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: interbankLoanRecalledEarlyPayloadSchema,
    citationsHint: ["WS1-PR1a", "D-MARKETS-SCHEMA-FOUNDATION", "IFRS9-3-2-3"],
    source: SOURCE,
  },
];
