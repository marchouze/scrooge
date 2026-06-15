// platform/event-store/registry/financial-instrument.ts
//
// FinancialInstrument entity event-type registry rows.
//
// Covers four lifecycle event types (D-FINANCIAL-INSTRUMENT-ENTITY Slice 1):
//   FinancialInstrumentDefined       — master record creation for any instrument
//                                      admitted to the bank's universe.
//   FinancialInstrumentClassified    — regulatory/accounting classification overlay
//                                      (HQLA tier, Basel RW, IFRS 9, SA-CCR).
//   FinancialInstrumentDecomposed    — bond-strip decomposition (parent → ≥2 ZCB children).
//   FinancialInstrumentReconstituted — inverse strip reconstitution.
//
// Retention classification:
//   All four event types → RETENTION_JSE_TRADE_7Y.
//   Rationale: instrument master records are trading-adjacent; the JSE Equities
//   Rules / Banks Act 7-year floor is the binding constraint here. The instrument
//   definition is the audit anchor for every trade that references the instrument
//   ID, so it must outlive the trade record retention floor.
//
// Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22);
//   IFRS 9 §4.1 (classification categories);
//   Banks Act 94 of 1990 (prudential record-keeping);
//   ACTUS Financial Research Foundation contract-type standard v1.1;
//   BA 110 (HQLA tiering).
//
// Author: Kai (Trading Systems Engineer, engineering)

import {
  financialInstrumentClassifiedPayloadSchema,
  financialInstrumentDecomposedPayloadSchema,
  financialInstrumentDefinedPayloadSchema,
  financialInstrumentReconstitutedPayloadSchema,
} from "../../markets/cdm/instrument";
import { RETENTION_JSE_TRADE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * FinancialInstrument entity event-type registry rows.
 *
 * Subscribers:
 *   Kai (Trading Systems Engineer, engineering) — instrument universe maintenance.
 *   Bea (Accounting & financial reporting engineer, engineering) — IFRS 9 GL classification.
 *   Helena (Chief Risk Officer, governance) — HQLA / LCR inputs.
 *   Rohan (Market risk quantitative engineer, engineering) — SA-CCR asset class routing.
 *   Atlas (Core banking platform architect, engineering) — substrate monitoring.
 */
export const FINANCIAL_INSTRUMENT_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "FinancialInstrumentDefined",
    class: "markets",
    issuer: "Kai",
    subscribers: ["Kai", "Bea", "Helena", "Rohan", "Atlas"],
    replay: "latest-wins-per-key",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: financialInstrumentDefinedPayloadSchema,
    citationsHint: ["D-FINANCIAL-INSTRUMENT-ENTITY", "IFRS9-4-1", "ACTUS-V1-1"],
    source: "platform/markets/cdm/instrument.ts",
    v2Status: "v1-only",
  },
  {
    type: "FinancialInstrumentClassified",
    class: "markets",
    issuer: "Kai",
    subscribers: ["Kai", "Bea", "Helena", "Rohan", "Atlas"],
    replay: "latest-wins-per-key",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: financialInstrumentClassifiedPayloadSchema,
    citationsHint: ["D-FINANCIAL-INSTRUMENT-ENTITY", "IFRS9-4-1", "BA-110", "BCBS-279"],
    source: "platform/markets/cdm/instrument.ts",
    v2Status: "v1-only",
  },
  {
    type: "FinancialInstrumentDecomposed",
    class: "markets",
    issuer: "Kai",
    subscribers: ["Kai", "Bea", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: financialInstrumentDecomposedPayloadSchema,
    citationsHint: ["D-FINANCIAL-INSTRUMENT-ENTITY", "ACTUS-V1-1-ZCB"],
    source: "platform/markets/cdm/instrument.ts",
    v2Status: "v1-only",
  },
  {
    type: "FinancialInstrumentReconstituted",
    class: "markets",
    issuer: "Kai",
    subscribers: ["Kai", "Bea", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: financialInstrumentReconstitutedPayloadSchema,
    citationsHint: ["D-FINANCIAL-INSTRUMENT-ENTITY", "ACTUS-V1-1-ZCB"],
    source: "platform/markets/cdm/instrument.ts",
    v2Status: "v1-only",
  },
];
