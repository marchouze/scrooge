// platform/event-store/event-types/v2-banking.ts
//
// make<Type> factories for the four V2 S4 anchor-bank standing-data event kinds.
//
// These factories live on the v1 side of the package boundary (inside
// `platform/event-store/event-types/`) and import the Zod payload schemas
// from `v2-core/banking/events` — that direction of import is permitted: the
// v1 registry wiring imports FROM v2-core, never the reverse (see the
// no-v1-import boundary enforced by `recon:v2-no-v1-import`).
//
// F-032 discipline: every registry row with a `payloadSchema` must have a
// corresponding `make<Type>` factory here so the typed-factory contract
// (return-type discipline, citation wiring) is exercised.
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-MODEL-BINDING-CONTRACT-V1.
// Author: Bea (Financial Controller, accounting).

import {
  type V2AccountTypeRegistered,
  type V2ProductDeprecated,
  type V2ProductRegistered,
  type V2RiskAppetiteSet,
  v2AccountTypeRegisteredSchema,
  v2ProductDeprecatedSchema,
  v2ProductRegisteredSchema,
  v2RiskAppetiteSetSchema,
} from "../../../v2-core/banking/events";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// Re-export payload types so downstream consumers can import from a single
// event-types surface without a direct v2-core import.
export type {
  V2AccountTypeRegistered,
  V2ProductDeprecated,
  V2ProductRegistered,
  V2RiskAppetiteSet,
};

// ---------------------------------------------------------------------------
// V2ProductRegistered
// ---------------------------------------------------------------------------

export function makeV2ProductRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: V2ProductRegistered;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "V2ProductRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: v2ProductRegisteredSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// V2ProductDeprecated
// ---------------------------------------------------------------------------

export function makeV2ProductDeprecated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: V2ProductDeprecated;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "V2ProductDeprecated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: v2ProductDeprecatedSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// V2AccountTypeRegistered
// ---------------------------------------------------------------------------

export function makeV2AccountTypeRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: V2AccountTypeRegistered;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "V2AccountTypeRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: v2AccountTypeRegisteredSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// V2RiskAppetiteSet
// ---------------------------------------------------------------------------

export function makeV2RiskAppetiteSet(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: V2RiskAppetiteSet;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "V2RiskAppetiteSet",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: v2RiskAppetiteSetSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event-type constants (F-032 typed-surface registration).
// ---------------------------------------------------------------------------

export const V2_BANKING_TYPED_EVENT_TYPES = [
  "V2ProductRegistered",
  "V2ProductDeprecated",
  "V2AccountTypeRegistered",
  "V2RiskAppetiteSet",
] as const;
