// platform/event-store/registry/operating-income-statement.ts
//
// EVENT_TYPE_REGISTRY row for the BORN-V2 operating-income-statement snapshot
// (D-BA-RETURN-SIMULATOR-FIRST). This event feeds the BA 400 (Operational Risk)
// SMA fold — the income-statement Business Indicator components the
// Standardised Measurement Approach (OPE25) needs to compute op-capital +
// op-RWA, which in turn drives the BA 700 capital-ratio op-RWA leg (previously
// the hardcoded `operationalRwa: 0` placeholder, GAP-BA700-OPERATIONAL-RWA).
//
// Born V2 — tagged `v2-parallel` (never `v1-only`): the SMA fold reads this
// event directly; there is no V1 income-statement stream and none is created
// (V1-retirement directive — never widen the v1-only estate).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-CAPITAL-ASSET-CLASS-V1; D-MONEY-DECIMAL-REDENOMINATION;
//   OPE25 / BCBS SCO (SMA Business Indicator); SARB Reg 33 revised;
//   SARB PA Directive D5/2025 §2.1.18 (form BA 400).
//
// Retention: RETENTION_ACCOUNTING_7Y (income-statement / regulatory-return
//   source-record retention norm).
//
// Author: Atlas (Core banking platform architect, engineering).

import { operatingIncomeStatementSnapshottedPayloadSchema } from "../event-types/operating-income-statement";
import { RETENTION_ACCOUNTING_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const SOURCE = "platform/event-store/event-types/operating-income-statement.ts";

/**
 * Registry row for the born-V2 operating-income-statement snapshot event type.
 *
 * Subscribers:
 *   Bea (Accounting & financial reporting engineer) — income-statement source.
 *   Mira (Regulatory reporting engineer) — BA 400 SMA fold + cell mapping.
 *   Helena (Chief Risk Officer) — op-risk SMA methodology owner.
 *   Camille (Chief Financial Officer) — income-statement governance.
 *   Atlas (platform) — substrate / recon monitoring.
 *   Vera (internal audit engineer) — third-line assurance.
 */
export const OPERATING_INCOME_STATEMENT_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "OperatingIncomeStatementSnapshotted",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Mira", "Helena", "Camille", "Atlas", "Vera"],
    replay: "cumulative-fold",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: operatingIncomeStatementSnapshottedPayloadSchema,
    citationsHint: [
      "D-BA-RETURN-SIMULATOR-FIRST",
      "urn:reg:za:regs-relating-to-banks:reg33",
      "urn:reg:bcbs:ope25",
    ],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
];
