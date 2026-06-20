// platform/event-store/event-types/external-credit-rating.ts
//
// External credit-rating feed event family (WS-FX-V2-SIMULATOR Phase 2, M6).
//
// These model the OUTSIDE WORLD's credit-rating feed — a rating agency (S&P /
// Moody's / Fitch) publishing or revising a counterparty's long-term issuer
// rating. They are EXTERNAL-PARTY facts the simulator emits, tagged `simulated`
// with scenario provenance; the bank's OWN Basel-class assignment
// (`CounterpartyBaselClassAssigned`) is the SUT-internal response and lives
// outside this family (platform/markets/counterparty/assign-basel-class.ts).
//
//   ExternalCreditRatingReceived — the agency's rating for a counterparty
//     (initial publication or a mid-scenario revision; the latest-effective
//     rating drives the SUT's Basel-class mapping).
//
// The bank NEVER invents a counterparty's rating — it reads the feed, fail-
// closed: an unmapped/absent rating yields the prudent conservative Basel class,
// never a silent investment-grade default (M6 design).
//
// Born V2 (D-V1-REMOVAL-PHASE-1) — never v1-only. THREE-SITE REGISTRATION (F-032):
//   1. event-types  → this file (schema + make* + kind list)
//   2. registry     → registry/external-credit-rating.ts (EventTypeMetadata row)
//   3. provenance   → provenance-category.ts (kind → category)
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20). BCBS CRE20
//   (standardised credit risk — external-rating buckets).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Notch-level long-term issuer rating on the canonical S&P/Fitch scale. The
// bank maps these to CRE20 rating buckets (aaa-aa / a / bbb / bb / below-bb);
// the agency's own notation is preserved on the feed event for traceability.
// ---------------------------------------------------------------------------

export const longTermRatingNotchSchema = z.enum([
  "AAA",
  "AA+",
  "AA",
  "AA-",
  "A+",
  "A",
  "A-",
  "BBB+",
  "BBB",
  "BBB-",
  "BB+",
  "BB",
  "BB-",
  "B+",
  "B",
  "B-",
  "CCC+",
  "CCC",
  "CCC-",
  "CC",
  "C",
  "D",
]);
export type LongTermRatingNotch = z.infer<typeof longTermRatingNotchSchema>;

/** The rating agency publishing the rating. */
export const ratingAgencySchema = z.enum(["S&P", "Moodys", "Fitch"]);
export type RatingAgency = z.infer<typeof ratingAgencySchema>;

/**
 * Counterparty supervisory type the agency's rating applies to. The Basel-class
 * mapping (CRE20) is a function of BOTH this type AND the rating bucket
 * (a BBB bank and a BBB corporate map to different SA classes).
 */
export const ratedCounterpartyTypeSchema = z.enum([
  "sovereign-domestic-currency",
  "sovereign-foreign-currency",
  "mdb-zero-weight",
  "bank",
  "pse",
  "corporate",
]);
export type RatedCounterpartyType = z.infer<typeof ratedCounterpartyTypeSchema>;

export const externalCreditRatingReceivedPayloadSchema = z.object({
  /** Party register ID of the rated counterparty. */
  counterpartyId: z.string().min(1),
  /** The rating agency publishing the rating. */
  agency: ratingAgencySchema,
  /** The long-term issuer rating notch (S&P/Fitch scale). */
  rating: longTermRatingNotchSchema,
  /** The supervisory counterparty type the rating applies to (drives CRE20 map). */
  counterpartyType: ratedCounterpartyTypeSchema,
  /** ISO 8601 — when the agency assigned/published this rating. */
  ratedAt: z.string().min(1),
  /** `initial` publication or a `revision` (upgrade/downgrade). */
  action: z.enum(["initial", "revision"]),
  /** Optional outlook the agency attached (informational). */
  outlook: z.enum(["stable", "positive", "negative", "developing"]).optional(),
});

export type ExternalCreditRatingReceivedPayload = z.infer<
  typeof externalCreditRatingReceivedPayloadSchema
>;

export function makeExternalCreditRatingReceived(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ExternalCreditRatingReceivedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "ExternalCreditRatingReceived requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ExternalCreditRatingReceived",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: externalCreditRatingReceivedPayloadSchema.parse(args.payload),
    ...(args.provenance !== undefined ? { provenance: args.provenance } : {}),
  });
}

export const EXTERNAL_CREDIT_RATING_EVENT_TYPES = ["ExternalCreditRatingReceived"] as const;
export type ExternalCreditRatingEventType = (typeof EXTERNAL_CREDIT_RATING_EVENT_TYPES)[number];
