// platform/event-store/registry/repo-mmd-ibl-v2.ts
//
// EVENT_TYPE_REGISTRY rows for the V2-PARALLEL money-market lifecycle events
// (Repo / MMD / Funding Line / Interbank Loan). These run dual-parallel to the
// V1 rows in `registry/repo-mmd-ibl.ts` (D-V1-REMOVAL-PHASE-3B): the V1 rows
// stay `v1-only`; these 14 rows are `v2-parallel` and back the V2 GL posting
// handlers + the V1↔V2 BA-300 LCR-denominator parity gate.
//
// 14 events registered:
//   Repo (3):      RepoTradeOpenedV2, RepoTradeTerminatedV2, RepoTradeTerminatedEarlyV2
//   MMD (5):       DepositTakenV2, DepositInterestAccruedV2, DepositMaturedV2,
//                  DepositWithdrawnEarlyV2, DepositRolledOverV2
//   Funding (2):   FundingLineDrawnV2, FundingLineRepaidV2
//   IBL (4):       InterbankLoanPlacedV2, InterbankLoanInterestAccruedV2,
//                  InterbankLoanMaturedV2, InterbankLoanRecalledEarlyV2
//
// Authority: D-V1-REMOVAL-PHASE-3B (CEO-approved 2026-06-16);
//            D-ENGINEERING-INTEGRITY-CHARTER;
//            IFRS 9 §3.1.1, §4.1.2, §4.2.1, §5.4.1; IAS 39 §27; Reg 26/27; BA 300.
//
// Retention: RETENTION_JSE_TRADE_7Y (mirrors the V1 treasury-trade retention).
//
// Author: Atlas (Core banking platform architect, engineering).

import {
  depositInterestAccruedV2PayloadSchema,
  depositMaturedV2PayloadSchema,
  depositRolledOverV2PayloadSchema,
  depositTakenV2PayloadSchema,
  depositWithdrawnEarlyV2PayloadSchema,
  fundingLineDrawnV2PayloadSchema,
  fundingLineRepaidV2PayloadSchema,
  interbankLoanInterestAccruedV2PayloadSchema,
  interbankLoanMaturedV2PayloadSchema,
  interbankLoanPlacedV2PayloadSchema,
  interbankLoanRecalledEarlyV2PayloadSchema,
  repoTradeOpenedV2PayloadSchema,
  repoTradeTerminatedEarlyV2PayloadSchema,
  repoTradeTerminatedV2PayloadSchema,
} from "../event-types/repo-mmd-ibl-v2";
import { RETENTION_JSE_TRADE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const SOURCE = "platform/event-store/event-types/repo-mmd-ibl-v2.ts";

/**
 * Registry rows for the V2-parallel money-market lifecycle event types.
 *
 * Subscribers mirror the V1 rows:
 *   Ravi (Treasury/ALM Engineer) — lifecycle and ALM wiring.
 *   Bea (Accounting) — V2 GL posting rules (PR-MMD / PR-FUNDING / PR-REPO / PR-IBL).
 *   Helena (CRO) — LCR/NSFR/IRRBB exposure aggregation.
 *   Atlas (platform) — substrate / parity-gate monitoring.
 */
export const REPO_MMD_IBL_V2_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  // ── Repo ───────────────────────────────────────────────────────────────────
  {
    type: "RepoTradeOpenedV2",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: repoTradeOpenedV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3B", "IAS39-27", "IFRS9-3-2-4"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "RepoTradeTerminatedV2",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: repoTradeTerminatedV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3B", "IFRS9-3-2-3"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "RepoTradeTerminatedEarlyV2",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: repoTradeTerminatedEarlyV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3B", "IFRS9-3-2-3"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },

  // ── MMD / Money Market Deposit ──────────────────────────────────────────────
  {
    type: "DepositTakenV2",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: depositTakenV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3B", "IFRS9-4-2-1", "BA300"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "DepositInterestAccruedV2",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: depositInterestAccruedV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3B", "IFRS9-B5-4-1"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "DepositMaturedV2",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: depositMaturedV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3B", "IFRS9-3-3-1"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "DepositWithdrawnEarlyV2",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: depositWithdrawnEarlyV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3B", "IFRS9-3-3-1"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "DepositRolledOverV2",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: depositRolledOverV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3B"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },

  // ── Funding Line ────────────────────────────────────────────────────────────
  {
    type: "FundingLineDrawnV2",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: fundingLineDrawnV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3B", "IFRS9-4-2-1", "BA300"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "FundingLineRepaidV2",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: fundingLineRepaidV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3B", "IFRS9-3-3-1"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },

  // ── Interbank Loan ──────────────────────────────────────────────────────────
  {
    type: "InterbankLoanPlacedV2",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: interbankLoanPlacedV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3B", "IFRS9-4-1-2", "BA300"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "InterbankLoanInterestAccruedV2",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: interbankLoanInterestAccruedV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3B", "IFRS9-B5-4-1"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "InterbankLoanMaturedV2",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: interbankLoanMaturedV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3B", "IFRS9-3-2-3"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "InterbankLoanRecalledEarlyV2",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Bea", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: interbankLoanRecalledEarlyV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3B", "IFRS9-3-2-3"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
];
