// domains/party/factories.ts
//
// D-PARTY-REGISTER + D-PARTY-RELATIONSHIP-KINDS-V0 (CEO-approved 2026-05-11).
//
// `make<Type>` factories for the 10 Party event types. Mirrors the factory
// pattern in `prototype/platform/event-store/event-types.ts` — each factory
// validates its payload via the matching Zod schema in `./schemas.ts` and
// returns a fully-validated `Event` envelope.
//
// Author: Atlas (Core banking platform architect; substrate)

import { newEventId } from "../../platform/core/types";
import { type Actor, type Event, eventSchema } from "../../platform/event-store/types";

import {
  beneficialOwnerChainAssertedPayloadSchema,
  partyAttributeChangedPayloadSchema,
  partyClassifiedPayloadSchema,
  partyDeactivatedPayloadSchema,
  partyDeclassifiedPayloadSchema,
  partyRegisteredPayloadSchema,
  partyRelationshipAssertedPayloadSchema,
  partyRelationshipChangedPayloadSchema,
  partyRelationshipRevokedPayloadSchema,
  partyScreeningCompletedPayloadSchema,
} from "./schemas";
import type {
  BeneficialOwnerChainAssertedPayload,
  PartyAttributeChangedPayload,
  PartyClassifiedPayload,
  PartyDeactivatedPayload,
  PartyDeclassifiedPayload,
  PartyRegisteredPayload,
  PartyRelationshipAssertedPayload,
  PartyRelationshipChangedPayload,
  PartyRelationshipRevokedPayload,
  PartyScreeningCompletedPayload,
} from "./types";

// ---------------------------------------------------------------------------
// 1 — PartyRegistered
// ---------------------------------------------------------------------------

export function makePartyRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PartyRegisteredPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PartyRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: partyRegisteredPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// 2 — PartyAttributeChanged
// ---------------------------------------------------------------------------

export function makePartyAttributeChanged(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PartyAttributeChangedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PartyAttributeChanged",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: partyAttributeChangedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// 3 — PartyClassified
// ---------------------------------------------------------------------------

export function makePartyClassified(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PartyClassifiedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PartyClassified",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: partyClassifiedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// 4 — PartyDeclassified
// ---------------------------------------------------------------------------

export function makePartyDeclassified(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PartyDeclassifiedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PartyDeclassified",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: partyDeclassifiedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// 5 — PartyScreeningCompleted
// ---------------------------------------------------------------------------

export function makePartyScreeningCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PartyScreeningCompletedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PartyScreeningCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: partyScreeningCompletedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// 6 — PartyRelationshipAsserted
// ---------------------------------------------------------------------------

export function makePartyRelationshipAsserted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PartyRelationshipAssertedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PartyRelationshipAsserted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: partyRelationshipAssertedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// 7 — PartyRelationshipChanged
// ---------------------------------------------------------------------------

export function makePartyRelationshipChanged(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PartyRelationshipChangedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PartyRelationshipChanged",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: partyRelationshipChangedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// 8 — PartyRelationshipRevoked
// ---------------------------------------------------------------------------

export function makePartyRelationshipRevoked(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PartyRelationshipRevokedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PartyRelationshipRevoked",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: partyRelationshipRevokedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// 9 — BeneficialOwnerChainAsserted
// ---------------------------------------------------------------------------

export function makeBeneficialOwnerChainAsserted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BeneficialOwnerChainAssertedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BeneficialOwnerChainAsserted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: beneficialOwnerChainAssertedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// 10 — PartyDeactivated
// ---------------------------------------------------------------------------

export function makePartyDeactivated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PartyDeactivatedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PartyDeactivated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: partyDeactivatedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}
