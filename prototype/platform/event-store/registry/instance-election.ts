// platform/event-store/registry/instance-election.ts
//
// Registry row for the per-instance accounting election event family:
//   - FilInstanceTreatmentElected — a per-instance accounting election (FVOCI
//     per-instrument election IFRS 9 §5.7.5, hedge designation, business-model
//     override) recorded with its statutory citation. The election overrides
//     the instance's PRODUCT-DEFAULT treatment for the elected facet; the FX
//     fold (`platform/accounting/posting-rules-v2/fx-fold.ts`) joins elections
//     to instances by instance URN.
//
// The election register is a projection over these events
// (`v2-core/reporting-treatments/instance-election.ts`,
// `foldInstanceElectionRegister`). LATEST election per (instance, facet) wins (P1).
//
// v2Status: "v2-parallel" — the v2-core schema is canonical and the register is
// a v2 projection; this is NOT a v1-only row (it does NOT enter the
// `recon:v1-removal-ratchet` v1-only count). Mirrors the reporting-treatments row.
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17),
//   citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST.
// Author: Atlas (Substrate Architect, engineering).

import type { z } from "zod";
import { filInstanceTreatmentElectedPayloadSchema } from "../event-types/instance-election";
import { RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const CITATIONS = [
  "D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD",
  "D-DERIVED-EVENT-IRREDUCIBILITY-TEST",
  "IFRS-9-§5.7.5",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
] as const;

export const INSTANCE_ELECTION_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "FilInstanceTreatmentElected",
    class: "governance",
    issuer: "Bea",
    subscribers: ["Atlas", "Bea", "Nadia", "Vera", "Scrooge"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: filInstanceTreatmentElectedPayloadSchema as unknown as z.ZodType<
      Record<string, unknown>
    >,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/instance-election.ts",
    v2Status: "v2-parallel",
  },
];
