// platform/event-store/registry/regulatory.ts
//
// Regulatory horizon-scanning event-type registry rows.
//
// Covers:
//   - RegulatoryInstrumentRegistered
//   - RegulatoryInstrumentAmended
//   - RegulatoryInstrumentContextualised
//   - RegulatoryConceptExtracted
//   - ObligationConceptLinked
//
// WAVE 2 BATCH-1 FLIP (2026-06-16): all eight types flipped v1-only →
// v2-replaced. Basis: ORDINARY dual-write + byte-clean parity (NOT
// retired-by-construction). The generic store-tee mirrors every V1 append into
// the v2 control-plane store (rows in v2-core/registry/index.ts carry tee:{};
// schemas re-declared in v2-core/reference-data/events.ts) and
// recon:reference-data-v2-parity proves the V1-store ↔ v2-store event-list
// register byte-clean (ENFORCING). V1 remains emittable; the parity gate is the
// standing evidence. Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-
// BASIS-RBC (CEO-approved 2026-06-16). Flip by Atlas (Core banking platform
// architect, engineering).
//
// Authority: Mira mandate (Compliance / RegTech engineer, engineering).
// Pilot: FAIS Act 37/2002 horizon scan.
// Author: Mira (Compliance / RegTech engineer, engineering)

import {
  graphEdgeAssertedPayloadSchema,
  graphNodeAssertedPayloadSchema,
  obligationConceptLinkedPayloadSchema,
  regulatoryConceptExtractedPayloadSchema,
  regulatoryInstrumentAmendedPayloadSchema,
  regulatoryInstrumentContextualisedPayloadSchema,
  regulatoryInstrumentRegisteredPayloadSchema,
  regulatorySourceReviewedPayloadSchema,
} from "../event-types/regulatory";
import { type EventTypeMetadata, RETENTION_GOVERNANCE_7Y } from "./types";

export const REGULATORY_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "RegulatoryInstrumentRegistered",
    class: "governance",
    payloadSchema: regulatoryInstrumentRegisteredPayloadSchema,
    issuer: "Mira",
    subscribers: ["Zara", "Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["FAIS-ACT-37-2002", "ORG-CD-01"],
    // Regulatory instruments are governance-grade records — 7y retention
    // consistent with FSCA inspection / Banks Act s.91 audit requirements.
    retention: RETENTION_GOVERNANCE_7Y,
    source: "platform/regulatory/concept-extractor.ts; Mira horizon-scan pilot",
    v2Status: "v2-replaced",
  },
  {
    type: "RegulatoryInstrumentAmended",
    class: "governance",
    payloadSchema: regulatoryInstrumentAmendedPayloadSchema,
    issuer: "Mira",
    subscribers: ["Zara", "Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["FAIS-ACT-37-2002", "ORG-CD-01"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "platform/regulatory/concept-extractor.ts; Mira horizon-scan pilot",
    v2Status: "v2-replaced",
  },
  {
    type: "RegulatoryInstrumentContextualised",
    class: "governance",
    payloadSchema: regulatoryInstrumentContextualisedPayloadSchema,
    issuer: "Mira",
    subscribers: ["Zara", "Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["FAIS-ACT-37-2002", "ORG-CD-01"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "platform/regulatory/concept-extractor.ts; Mira horizon-scan pilot",
    v2Status: "v2-replaced",
  },
  {
    type: "RegulatoryConceptExtracted",
    class: "governance",
    payloadSchema: regulatoryConceptExtractedPayloadSchema,
    issuer: "Mira",
    subscribers: ["Zara", "Mira", "Vera", "dashboard"],
    // Each section extraction is a new fact — append-only.
    replay: "append-only-audit",
    citationsHint: ["FAIS-ACT-37-2002", "ORG-CD-01"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "platform/regulatory/concept-extractor.ts; Mira horizon-scan pilot",
    v2Status: "v2-replaced",
  },
  {
    type: "ObligationConceptLinked",
    class: "governance",
    payloadSchema: obligationConceptLinkedPayloadSchema,
    issuer: "Mira",
    subscribers: ["Zara", "Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["FAIS-ACT-37-2002", "ORG-CD-01"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "platform/regulatory/obligation-linker.ts; Mira horizon-scan pilot",
    v2Status: "v2-replaced",
  },
  {
    type: "RegulatorySourceReviewed",
    class: "governance",
    payloadSchema: regulatorySourceReviewedPayloadSchema,
    issuer: "Mira",
    subscribers: ["Mira", "Vera", "dashboard"],
    // Each review is a new fact keyed to the source hash at review time —
    // append-only (drift between reviews is a recon concern, not a mutation).
    replay: "append-only-audit",
    citationsHint: ["D-REGULATORY-LIBRARY-V1", "ORG-CD-01"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "scripts/backfill-regulatory-reviews.ts; platform/regulatory review-marker (Phase 1)",
    v2Status: "v2-replaced",
  },
  {
    type: "GraphNodeAsserted",
    class: "governance",
    payloadSchema: graphNodeAssertedPayloadSchema,
    issuer: "Mira",
    subscribers: ["Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["ORG-CD-01"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "platform/regulatory/graph/seed-projection.ts; Mira regulatory knowledge graph",
    v2Status: "v2-replaced",
  },
  {
    type: "GraphEdgeAsserted",
    class: "governance",
    payloadSchema: graphEdgeAssertedPayloadSchema,
    issuer: "Mira",
    subscribers: ["Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["ORG-CD-01"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "platform/regulatory/graph/seed-projection.ts; Mira regulatory knowledge graph",
    v2Status: "v2-replaced",
  },
];
