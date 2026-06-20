// platform/event-store/registry/fx-settlement-lifecycle.ts
//
// F-032 typed registry rows for the FX settlement-lifecycle event family
// (WS-FX-V2-SIMULATOR, M5). These external-party events model the
// correspondent/counterparty's settlement behaviour (instructed → failed/retry →
// confirmed) for an affirmed FX trade; the SUT materialises the settled cash leg
// + reconciles the nostro in response.
//
// Born V2 (v2-parallel) — never v1-only (D-V1-REMOVAL-PHASE-1). Scenario-confined
// simulator emissions carrying `simulated` provenance; never the production read
// path.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   D-CASH-ASSET-CLASS-V1.
// Author: Atlas (Core banking platform architect, engineering).

import {
  fxSimSettlementConfirmedPayloadSchema,
  fxSimSettlementFailedPayloadSchema,
  fxSimSettlementInstructedPayloadSchema,
} from "../event-types/fx-settlement-lifecycle";
import { type EventTypeMetadata, RETENTION_BANKING_5Y } from "./types";

const SOURCE = "platform/event-store/event-types/fx-settlement-lifecycle.ts";
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST", "D-CASH-ASSET-CLASS-V1"];

export const FX_SIM_SETTLEMENT_LIFECYCLE_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "FxSimSettlementInstructed",
    class: "markets",
    issuer: "substrate",
    subscribers: ["Tomas", "Saskia", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: fxSimSettlementInstructedPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS,
    v2Status: "v2-parallel",
  },
  {
    type: "FxSimSettlementFailed",
    class: "markets",
    issuer: "substrate",
    subscribers: ["Tomas", "Saskia", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: fxSimSettlementFailedPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS,
    v2Status: "v2-parallel",
  },
  {
    type: "FxSimSettlementConfirmed",
    class: "markets",
    issuer: "substrate",
    subscribers: ["Tomas", "Saskia", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: fxSimSettlementConfirmedPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS,
    v2Status: "v2-parallel",
  },
];
