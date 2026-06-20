// platform/event-store/registry/counterparty-provisioning.ts
//
// F-032 typed registry rows for the counterparty-provisioning event family
// (WS-FX-V2-SIMULATOR, M2). These external-party events model the outside
// counterparty's onboarding lifecycle (sounding → KYC → mandate → ISDA/CSA
// acceptance); the SUT records the agreement + netting-set readiness in response.
//
// Born V2 (v2-parallel) — never v1-only (D-V1-REMOVAL-PHASE-1). Scenario-confined
// simulator emissions carrying `simulated` provenance; never the production read
// path.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20).
// Author: Atlas (Core banking platform architect, engineering).

import {
  counterpartyAgreementAcceptedPayloadSchema,
  counterpartyKycDocumentsSubmittedPayloadSchema,
  counterpartyMandateAcceptedPayloadSchema,
  counterpartySoundingMadePayloadSchema,
} from "../event-types/counterparty-provisioning";
import { type EventTypeMetadata, RETENTION_BANKING_5Y } from "./types";

const SOURCE = "platform/event-store/event-types/counterparty-provisioning.ts";
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST"];

export const COUNTERPARTY_PROVISIONING_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "CounterpartySoundingMade",
    class: "markets",
    issuer: "substrate",
    subscribers: ["Niko", "Imani", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: counterpartySoundingMadePayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS,
    v2Status: "v2-parallel",
  },
  {
    type: "CounterpartyKycDocumentsSubmitted",
    class: "markets",
    issuer: "substrate",
    subscribers: ["Niko", "Imani", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: counterpartyKycDocumentsSubmittedPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS,
    v2Status: "v2-parallel",
  },
  {
    type: "CounterpartyMandateAccepted",
    class: "markets",
    issuer: "substrate",
    subscribers: ["Niko", "Imani", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: counterpartyMandateAcceptedPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS,
    v2Status: "v2-parallel",
  },
  {
    type: "CounterpartyAgreementAccepted",
    class: "markets",
    issuer: "substrate",
    subscribers: ["Imani", "Tomas", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: counterpartyAgreementAcceptedPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS,
    v2Status: "v2-parallel",
  },
];
