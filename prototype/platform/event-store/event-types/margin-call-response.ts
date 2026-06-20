// platform/event-store/event-types/margin-call-response.ts
//
// Margin-call response event family (WS-FX-V2-SIMULATOR Phase 2, M8). The OUTSIDE
// WORLD's response to a bank-issued variation-margin call: the counterparty
// posts, disputes, or fails to meet the call. EXTERNAL-party facts the simulator
// emits (tagged `simulated`, scenario-bound); the bank's recording of posted
// collateral (`CollateralPosted` / `MarginCallSettled`) is the SUT-internal
// response and lives in margin-collateral.ts.
//
//   MarginCallResponded — the counterparty's decision (post / dispute / fail).
//
// Born V2 (D-V1-REMOVAL-PHASE-1) — never v1-only. THREE-SITE REGISTRATION (F-032):
//   1. event-types  → this file (schema + make* + kind list)
//   2. registry     → registry/margin-call-response.ts (EventTypeMetadata row)
//   3. provenance   → provenance-category.ts (kind → category)
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20); ISDA CSA.
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

export const marginCallResponseSchema = z.enum(["post", "dispute", "fail"]);
export type MarginCallResponse = z.infer<typeof marginCallResponseSchema>;

export const marginCallRespondedPayloadSchema = z.object({
  /** The margin call this response answers (`MC-<nettingSetId>-<date>`). */
  marginCallId: z.string().min(1),
  /** Netting set the call relates to. */
  nettingSetId: z.string().min(1),
  /** The responding counterparty. */
  counterpartyId: z.string().min(1),
  /** The counterparty's decision: post / dispute / fail. */
  response: marginCallResponseSchema,
  /** Posted amount in MAJOR units (the called amount on `post`; 0 otherwise). */
  postedAmountMajor: z.number().nonnegative(),
  /** Collateral asset kind the counterparty posts (cash / govvies). */
  collateralKind: z.enum(["cash", "government-bond"]),
  /** ISO-4217 currency of the posted amount. */
  currency: z.string().min(3).max(3),
  /** Reason where the response is a dispute/fail (prose). Optional. */
  reason: z.string().min(1).optional(),
  /** ISO 8601 — when the counterparty responded. */
  respondedAt: z.string().min(1),
});
export type MarginCallRespondedPayload = z.infer<typeof marginCallRespondedPayloadSchema>;

export function makeMarginCallResponded(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MarginCallRespondedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("MarginCallResponded requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MarginCallResponded",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: marginCallRespondedPayloadSchema.parse(args.payload),
    ...(args.provenance !== undefined ? { provenance: args.provenance } : {}),
  });
}

export const MARGIN_CALL_RESPONSE_EVENT_TYPES = ["MarginCallResponded"] as const;
export type MarginCallResponseEventType = (typeof MARGIN_CALL_RESPONSE_EVENT_TYPES)[number];
