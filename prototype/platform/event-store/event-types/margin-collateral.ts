// platform/event-store/event-types/margin-collateral.ts
//
// Margin-call + collateral-posting event family (WS-FX-V2-SIMULATOR Phase 2, M8).
//
// The variation-margin workflow under a CSA: the bank computes the day's
// uncollateralised mark-to-market, and where it exceeds the CSA threshold + MTA
// it ISSUES a margin call. The counterparty (the OUTSIDE WORLD, simulated)
// responds — post / dispute / fail. On a met call the bank records the posted
// collateral, which reduces the next day's SA-CCR replacement cost
// (RC = max(V − C, …)). On a dispute/fail the call is unmet (no collateral).
//
// Split by side of the simulator↔SUT boundary:
//   SUT-INTERNAL (the bank's own acts) — this family:
//     MarginCallIssued     — the bank issues a variation-margin call.
//     CollateralPosted     — the bank records collateral received into the set.
//     CollateralReturned    — the bank returns excess collateral (call shrinks).
//     MarginCallSettled    — the bank closes a met call (collateral in).
//   EXTERNAL (the counterparty's response) — `MarginCallResponded`, lives in the
//     simulator's margin-call-response event family (margin-call-response.ts).
//
// Born V2 (D-V1-REMOVAL-PHASE-1) — never v1-only. THREE-SITE REGISTRATION (F-032):
//   1. event-types  → this file (schemas + make* + kind list)
//   2. registry     → registry/margin-collateral.ts (EventTypeMetadata rows)
//   3. provenance   → provenance-category.ts (each kind → category)
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20); ISDA CSA;
//   BCBS d317 §136 / CRE52 §52.10 (collateral in the RC formula). Principle 1.
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// MarginCallIssued — the bank issues a variation-margin call under a CSA.
// ---------------------------------------------------------------------------

export const marginCallIssuedPayloadSchema = z.object({
  /** Margin call id (`MC-<nettingSetId>-<computationDate>`). */
  marginCallId: z.string().min(1),
  /** Netting set the call is raised against. */
  nettingSetId: z.string().min(1),
  /** Counterparty the call is issued to. */
  counterpartyId: z.string().min(1),
  /** Called amount in MAJOR units of `currency` (the variation margin demanded). */
  callAmountMajor: z.number().nonnegative(),
  /** The uncollateralised net MtM (V − C) MAJOR units that drove the call. */
  exposureMajor: z.number(),
  /** CSA threshold (TH) MAJOR units applied. */
  thresholdMajor: z.number().nonnegative(),
  /** CSA minimum transfer amount (MTA) MAJOR units applied. */
  mtaMajor: z.number().nonnegative(),
  /** ISO-4217 currency of all monetary values. */
  currency: z.string().min(3).max(3),
  /** ISO 8601 — computation/close-of-business date (T-0). */
  computationDate: z.string().min(1),
  /** ISO 8601 — when the call was issued. */
  issuedAt: z.string().min(1),
});
export type MarginCallIssuedPayload = z.infer<typeof marginCallIssuedPayloadSchema>;

export function makeMarginCallIssued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MarginCallIssuedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("MarginCallIssued requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MarginCallIssued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: marginCallIssuedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CollateralPosted — the bank records collateral received into a netting set.
// ---------------------------------------------------------------------------

export const collateralPostedPayloadSchema = z.object({
  /** The margin call this posting answers. */
  marginCallId: z.string().min(1),
  /** Netting set the collateral is held against. */
  nettingSetId: z.string().min(1),
  /** Counterparty that posted. */
  counterpartyId: z.string().min(1),
  /** Posted amount in MAJOR units of `currency` (post-haircut value). */
  amountMajor: z.number().nonnegative(),
  /** Collateral asset kind (cash / govvies). */
  collateralKind: z.enum(["cash", "government-bond"]),
  /** Haircut applied to the posted asset (fraction, e.g. 0.02 = 2%). */
  haircut: z.number().min(0).max(1),
  /** ISO-4217 currency of the posted (haircut-adjusted) amount. */
  currency: z.string().min(3).max(3),
  /** ISO 8601 — when the collateral was posted. */
  postedAt: z.string().min(1),
});
export type CollateralPostedPayload = z.infer<typeof collateralPostedPayloadSchema>;

export function makeCollateralPosted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CollateralPostedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("CollateralPosted requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CollateralPosted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: collateralPostedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CollateralReturned — the bank returns excess collateral (the call shrinks).
// ---------------------------------------------------------------------------

export const collateralReturnedPayloadSchema = z.object({
  nettingSetId: z.string().min(1),
  counterpartyId: z.string().min(1),
  /** Returned amount in MAJOR units of `currency`. */
  amountMajor: z.number().nonnegative(),
  currency: z.string().min(3).max(3),
  /** ISO 8601 — when the collateral was returned. */
  returnedAt: z.string().min(1),
});
export type CollateralReturnedPayload = z.infer<typeof collateralReturnedPayloadSchema>;

export function makeCollateralReturned(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CollateralReturnedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("CollateralReturned requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CollateralReturned",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: collateralReturnedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// MarginCallSettled — the bank closes a margin call (met or unmet outcome).
// ---------------------------------------------------------------------------

export const marginCallSettledPayloadSchema = z.object({
  marginCallId: z.string().min(1),
  nettingSetId: z.string().min(1),
  counterpartyId: z.string().min(1),
  /** Outcome: the call was MET (collateral posted), DISPUTED, or FAILED. */
  outcome: z.enum(["met", "disputed", "failed"]),
  /** Collateral posted in MAJOR units (0 on dispute/fail). */
  collateralPostedMajor: z.number().nonnegative(),
  currency: z.string().min(3).max(3),
  /** ISO 8601 — when the call was closed. */
  settledAt: z.string().min(1),
});
export type MarginCallSettledPayload = z.infer<typeof marginCallSettledPayloadSchema>;

export function makeMarginCallSettled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MarginCallSettledPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("MarginCallSettled requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MarginCallSettled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: marginCallSettledPayloadSchema.parse(args.payload),
  });
}

export const MARGIN_COLLATERAL_EVENT_TYPES = [
  "MarginCallIssued",
  "CollateralPosted",
  "CollateralReturned",
  "MarginCallSettled",
] as const;
export type MarginCollateralEventType = (typeof MARGIN_COLLATERAL_EVENT_TYPES)[number];
