// platform/event-store/event-types/obligation-equivalence.ts
//
// Obligation-equivalence event family — the SA↔BCBS same-outcome / divergent
// model. For any SA (`ORG-*`) ↔ BCBS obligation pair, a classifier asserts
// whether the two require the SAME OUTCOME (`equivalent`), the SA position is
// the same outcome but STRICTER (`sa-stricter-gold-plates`), or the two are
// MATERIALLY DIVERGENT (`materially-divergent`).
//
// This is the typed source-of-truth (Principle 1) that the regulatory-graph
// projection folds into Obl→Obl edges:
//   - `equivalent`                → EQUIVALENT_TO
//   - `sa-stricter-gold-plates`   → EQUIVALENT_TO + metadata.divergence='sa-stricter' + delta
//   - `materially-divergent`      → CONFLICTS_WITH
// (see platform/regulatory/graph/seed-projection.ts; modelled exactly on the
// ObligationConceptLinked → EXPRESSES fold). The recon gate
// `recon:obligation-divergence` enumerates the expected-overlap set from the
// ADOPTION_EDGES Basel-provision spine and reports pairs with no classification
// event (advisory).
//
// The verdicts are between two BANK OBLIGATION IDs (`saObligationId` is an
// `ORG-*`; `bcbsObligationId` is a `BCBS-<STD>-s<para>`), NOT between Basel
// provision URNs — that layer is `AdoptionEdge` in basel-adoption.ts and is
// deliberately NOT overloaded here.
//
// Authoring discipline: the substrate (this event, the fold, the gate, the
// query hop) is Atlas's. The actual verdict corpus is Mira's standing
// classification work — do not bulk-author verdicts in the substrate PR.
//
// Authority:
//   - D-OBLIGATIONS-REGISTER-CLEANUP (CEO-approved) — WS-OBLIGATIONS-CLEANUP P5.
//   - P2-SINGLE-GRAPH-DISCIPLINE (Principle 2 — one citable bidirectional graph;
//     SA↔BCBS bridge is a typed edge, not free text).
//   - P1-EVENTS-AS-TRUTH (Principle 1).
//
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Verdict enum
// ---------------------------------------------------------------------------

/**
 * The same-outcome / divergent verdict for an SA↔BCBS obligation pair.
 *
 * - `equivalent`               same regulatory outcome; no material delta.
 * - `sa-stricter-gold-plates`  same outcome, but the SA position is stricter
 *                              (a national gold-plate); `delta` describes how.
 * - `materially-divergent`     the two require materially different outcomes;
 *                              projects to CONFLICTS_WITH, not EQUIVALENT_TO.
 */
export const obligationEquivalenceVerdictSchema = z.enum([
  "equivalent",
  "sa-stricter-gold-plates",
  "materially-divergent",
]);
export type ObligationEquivalenceVerdict = z.infer<typeof obligationEquivalenceVerdictSchema>;

// ---------------------------------------------------------------------------
// ObligationEquivalenceClassified
// ---------------------------------------------------------------------------

export const obligationEquivalenceClassifiedPayloadSchema = z
  .object({
    /** The SA obligation id (`ORG-*`) — the bank-internal register row. */
    saObligationId: z.string().min(1),
    /** The BCBS obligation id (`BCBS-<STD>-s<para>`) — the Basel-derived row. */
    bcbsObligationId: z.string().min(1),
    /** Same-outcome / divergent verdict. */
    verdict: obligationEquivalenceVerdictSchema,
    /**
     * Typed description of the divergence. Required for
     * `sa-stricter-gold-plates` and `materially-divergent`; optional (and
     * usually absent) for `equivalent`.
     */
    delta: z.string().min(1).optional(),
    /** One-line rationale; survives in the audit trail. */
    rationale: z.string().min(1),
    /** Classifying agent name + seat (e.g. "Mira (Compliance / RegTech engineer)"). */
    classifiedBy: z.string().min(1),
    /** 0..1 — classifier confidence in the verdict. */
    confidence: z.number().min(0).max(1),
    /** ISO date the classification is asserted as-of. */
    asOf: z.string().min(1),
  })
  .refine((p) => p.verdict !== "sa-stricter-gold-plates" || p.delta !== undefined, {
    message: "delta is required when verdict is sa-stricter-gold-plates",
    path: ["delta"],
  })
  .refine((p) => p.verdict !== "materially-divergent" || p.delta !== undefined, {
    message: "delta is required when verdict is materially-divergent",
    path: ["delta"],
  });
export type ObligationEquivalenceClassifiedPayload = z.infer<
  typeof obligationEquivalenceClassifiedPayloadSchema
>;

export function makeObligationEquivalenceClassified(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ObligationEquivalenceClassifiedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ObligationEquivalenceClassified",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: obligationEquivalenceClassifiedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Domain barrel
// ---------------------------------------------------------------------------

export const OBLIGATION_EQUIVALENCE_TYPED_EVENT_TYPES = [
  "ObligationEquivalenceClassified",
] as const;
export type ObligationEquivalenceEventType =
  (typeof OBLIGATION_EQUIVALENCE_TYPED_EVENT_TYPES)[number];
