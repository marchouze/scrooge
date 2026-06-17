// platform/event-store/registry/reporting-treatments.ts
//
// Registry row for the reporting-treatment menu declaration event family:
//   - ReportingTreatmentDeclared — declares a reporting-treatment MODULE: a
//     versioned, citable treatment of one accounting/regulatory dimension (IFRS
//     classification, posting-rule set, prudential treatment, tax treatment, or
//     a disclosure lens) over a taxonomy scope. A Product composes its full
//     treatment by picking modules from this registry.
//
// The reporting-treatment register is a projection over these events
// (`v2-core/reporting-treatments/registry.ts`, folded by
// `recon:reporting-treatment-registry-conflict`). LATEST declaration per
// (treatmentId, category, scope, version) wins (P1).
//
// v2Status: "v2-parallel" — the v2-core schema is canonical and the register is
// a v2 projection; this is NOT a v1-only row (it does NOT enter the
// `recon:v1-removal-ratchet` v1-only count). Mirrors the fil-models row.
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17),
//   citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST.
// Author: Atlas (Substrate Architect, engineering).

import type { z } from "zod";
import { reportingTreatmentDeclaredPayloadSchema } from "../event-types/reporting-treatments";
import { RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const CITATIONS = [
  "D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD",
  "D-DERIVED-EVENT-IRREDUCIBILITY-TEST",
  "D-V2-REPO-STRATEGY-REEXAMINATION",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
] as const;

export const REPORTING_TREATMENT_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "ReportingTreatmentDeclared",
    class: "governance",
    issuer: "Atlas",
    subscribers: ["Atlas", "Bea", "Nadia", "Vera", "Scrooge"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: reportingTreatmentDeclaredPayloadSchema as unknown as z.ZodType<
      Record<string, unknown>
    >,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/reporting-treatments.ts",
    v2Status: "v2-parallel",
  },
];
