// platform/event-store/registry/fx-trade-confirmation.ts
//
// F-032 typed registry rows for the FX trade-confirmation event family
// (WS-FX-V2-SIMULATOR, M3). These external-party events model the counterparty's
// confirmation flow; SUT settlement is gated on TradeAffirmed.
//
// Born V2 (v2-parallel) — never v1-only (D-V1-REMOVAL-PHASE-1). These are
// scenario-confined simulator emissions (the simulated outside world's
// counterparty responses); they carry `simulated` provenance and never enter the
// production read path.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20).
// Author: Atlas (Core banking platform architect, engineering).

import {
  tradeConfirmationPayloadSchema,
  tradeRejectedPayloadSchema,
} from "../event-types/fx-trade-confirmation";
import { type EventTypeMetadata, RETENTION_BANKING_5Y } from "./types";

const SOURCE = "platform/event-store/event-types/fx-trade-confirmation.ts";
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST"];

export const FX_TRADE_CONFIRMATION_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "TradeConfirmationSent",
    class: "markets",
    issuer: "substrate",
    subscribers: ["Saskia", "Tomas", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: tradeConfirmationPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS,
    // Born V2 — the FX V2 simulator's external-party confirmation flow.
    v2Status: "v2-parallel",
  },
  {
    type: "TradeAffirmed",
    class: "markets",
    issuer: "substrate",
    subscribers: ["Saskia", "Tomas", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: tradeConfirmationPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS,
    v2Status: "v2-parallel",
  },
  {
    type: "TradeRejected",
    class: "markets",
    issuer: "substrate",
    subscribers: ["Saskia", "Tomas", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: tradeRejectedPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS,
    v2Status: "v2-parallel",
  },
];
