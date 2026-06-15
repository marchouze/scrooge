// platform/event-store/registry/obligation-equivalence.ts
//
// Obligation-equivalence event-type registry rows.
//
// Covers:
//   - ObligationEquivalenceClassified — a verdict on an SA↔BCBS obligation
//     pair (equivalent / sa-stricter-gold-plates / materially-divergent),
//     folded into Obl→Obl EQUIVALENT_TO / CONFLICTS_WITH graph edges and
//     consumed by the advisory `recon:obligation-divergence` gate.
//
// Governance-class, append-only-audit. The verdict corpus is Mira's standing
// classification work; the substrate (event + fold + gate + query hop) is
// Atlas's.
//
// Authority:
//   - D-OBLIGATIONS-REGISTER-CLEANUP (CEO-approved) — WS-OBLIGATIONS-CLEANUP P5.
//   - P2-SINGLE-GRAPH-DISCIPLINE (Principle 2).
//   - P1-EVENTS-AS-TRUTH (Principle 1).
//
// Author: Atlas (Core banking platform architect, engineering).

import { obligationEquivalenceClassifiedPayloadSchema } from "../event-types/obligation-equivalence";
import { RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const SHARED_CITATIONS = [
  "D-OBLIGATIONS-REGISTER-CLEANUP",
  "P2-SINGLE-GRAPH-DISCIPLINE",
  "P1-EVENTS-AS-TRUTH",
] as const;

const SHARED_SUBSCRIBERS = [
  // Mira (Compliance / RegTech engineer, engineering) — authors the verdicts.
  "Mira",
  // Owen (Company Secretary, governance) — owns the obligations-register surface.
  "Owen",
  // Zara (Chief Compliance Officer, governance) — register curator.
  "Zara",
  // Vera (Internal audit engineer, engineering) — runs the advisory recon.
  "Vera",
  // Atlas (Core banking platform architect, engineering) — substrate steward.
  "Atlas",
] as const;

export const OBLIGATION_EQUIVALENCE_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "ObligationEquivalenceClassified",
    class: "governance",
    issuer: "Mira",
    subscribers: SHARED_SUBSCRIBERS,
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    // `obligationEquivalenceClassifiedPayloadSchema` is a refined Zod schema;
    // ZodEffects is still a ZodType<Record<string, unknown>> for registry
    // purposes (the .parse() surface is what the append path uses).
    payloadSchema: obligationEquivalenceClassifiedPayloadSchema,
    citationsHint: SHARED_CITATIONS,
    source: "platform/event-store/event-types/obligation-equivalence.ts",
    v2Status: "v1-only",
  },
];
