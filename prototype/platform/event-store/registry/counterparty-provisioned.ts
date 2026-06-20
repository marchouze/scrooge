// platform/event-store/registry/counterparty-provisioned.ts
//
// F-032 typed registry row for the SUT-internal CounterpartyProvisioned event
// (WS-FX-V2-SIMULATOR, M2). The bank's own record that a counterparty is
// provisioned for FX dealing (KYC cleared, mandate granted, ISDA/CSA elected,
// netting set stood up). SUT-internal — NOT a simulator emission.
//
// Born V2 (v2-parallel) — never v1-only (D-V1-REMOVAL-PHASE-1).
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20).
// Author: Atlas (Core banking platform architect, engineering).

import { counterpartyProvisionedPayloadSchema } from "../event-types/counterparty-provisioned";
import { type EventTypeMetadata, RETENTION_BANKING_5Y } from "./types";

const SOURCE = "platform/event-store/event-types/counterparty-provisioned.ts";
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST"];

export const COUNTERPARTY_PROVISIONED_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "CounterpartyProvisioned",
    class: "markets",
    issuer: "substrate",
    subscribers: ["Tomas", "Imani", "Rohan", "Vera"],
    replay: "idempotent-terminal",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: counterpartyProvisionedPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS,
    v2Status: "v2-parallel",
  },
];
