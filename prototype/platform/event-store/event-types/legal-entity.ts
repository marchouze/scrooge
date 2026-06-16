// platform/event-store/event-types/legal-entity.ts
//
// Legal-entity event-payload schemas.
//
// Covers:
//   - LegalEntityRegistered, LegalEntityChanged
//   - IntraGroupArrangementSigned
//
// Authority: D-LEGAL-ENTITY-TREE-V0 + D-REGULATORY-PERIMETER.
// F-020 split from the god-file `../event-types.ts`.
// Authors: Imani (Legal-as-code engineer), Owen (Company Secretary, governance),
//          Atlas (substrate)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// LegalEntityRegistered
// ---------------------------------------------------------------------------

export const legalEntityRegisteredPayloadSchema = z.object({
  entityId: z.string().min(1),
  legalName: z.string().min(1),
  registeredForm: z.enum(["Ltd", "RF", "Pty"]),
  jurisdiction: z.string().length(2),
  registeredOffice: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    country: z.string().length(2),
  }),
  parentEntityId: z.string().min(1).nullable(),
  regulatoryRegime: z.object({
    primaryRegulator: z.enum(["PA", "JSE", "FSCA", "none-companies-act-only", "other"]),
    regimeAnchor: z.array(z.string().min(1)).min(1),
  }),
  directors: z.array(
    z.object({
      name: z.string().min(1),
      fitAndProperFileId: z.string().min(1),
      appointmentDate: z.string().min(1),
    }),
  ),
  registrationDate: z.string().min(1),
});

export type LegalEntityRegisteredPayload = z.infer<typeof legalEntityRegisteredPayloadSchema>;

export function makeLegalEntityRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LegalEntityRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LegalEntityRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: legalEntityRegisteredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LegalEntityChanged
// ---------------------------------------------------------------------------

export const legalEntityChangedPayloadSchema = z.object({
  entityId: z.string().min(1),
  changeType: z.enum([
    "renamed",
    "parent-changed",
    "director-added",
    "director-removed",
    "regulatory-regime-updated",
    "registered-office-changed",
  ]),
  priorValue: z.unknown().refine((v) => v !== undefined, {
    message: "priorValue is required (use null for explicit absence; undefined is rejected)",
  }),
  newValue: z.unknown().refine((v) => v !== undefined, {
    message: "newValue is required (use null for explicit absence; undefined is rejected)",
  }),
  effectiveDate: z.string().min(1),
});

export type LegalEntityChangedPayload = z.infer<typeof legalEntityChangedPayloadSchema>;

export function makeLegalEntityChanged(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LegalEntityChangedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LegalEntityChanged",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: legalEntityChangedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IntraGroupArrangementSigned
// ---------------------------------------------------------------------------

export const intraGroupArrangementSignedPayloadSchema = z
  .object({
    arrangementId: z.string().min(1),
    arrangementType: z.enum([
      "services",
      "ip-licensing",
      "capital-injection",
      "intra-group-exposure",
      "other-related-party",
    ]),
    fromEntityId: z.string().min(1),
    toEntityId: z.string().min(1),
    effectiveDate: z.string().min(1),
    terminationDate: z.string().min(1).optional(),
    armsLengthRationale: z.string().min(1),
    "IAS24-disclosure-ref": z.string().min(1),
  })
  .refine((p) => p.fromEntityId !== p.toEntityId, {
    message: "fromEntityId and toEntityId must differ (no self-arrangements)",
    path: ["toEntityId"],
  });

export type IntraGroupArrangementSignedPayload = z.infer<
  typeof intraGroupArrangementSignedPayloadSchema
>;

export function makeIntraGroupArrangementSigned(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IntraGroupArrangementSignedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IntraGroupArrangementSigned",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: intraGroupArrangementSignedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// EntityFunctionalCurrencyAssigned
//
// Event-sources the FUNCTIONAL currency (IAS-21) of a legal entity / branch
// (Principle 1, Principle 5; WS-MULTI-BASE-CURRENCY, D-MULTI-BASE-CURRENCY-
// FOUNDATION). The functional currency is the currency the entity keeps its own
// books in; "foreign vs. domestic" is a view-time comparison against THIS value,
// never an instrument property. A re-assignment (rare, IAS-21 §35 — change in
// functional currency) emits a new event carrying the prior value, so the axis
// is versioned and replay-safe rather than a silent seed edit.
// ---------------------------------------------------------------------------

export const entityFunctionalCurrencyAssignedPayloadSchema = z.object({
  /** Canonical legal-entity identifier (e.g. `urn:legal-entity:hoz:hoz-bank:v1`). */
  entityId: z.string().min(1),
  /** The assigned functional currency, ISO-4217 alpha-3. */
  functionalCurrency: z.string().length(3),
  /**
   * The prior functional currency, or `null` for the FIRST assignment. Required
   * (explicit `null`, never `undefined`) so the change axis is unambiguous.
   */
  priorFunctionalCurrency: z.string().length(3).nullable(),
  /** Date the functional-currency assignment takes effect. */
  effectiveDate: z.string().min(1),
  /** Human-readable rationale (IAS-21 basis: primary economic environment). */
  rationale: z.string().min(1),
});

export type EntityFunctionalCurrencyAssignedPayload = z.infer<
  typeof entityFunctionalCurrencyAssignedPayloadSchema
>;

export function makeEntityFunctionalCurrencyAssigned(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: EntityFunctionalCurrencyAssignedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "EntityFunctionalCurrencyAssigned",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: entityFunctionalCurrencyAssignedPayloadSchema.parse(args.payload),
  });
}

export const LEGAL_ENTITY_TYPED_EVENT_TYPES = [
  "LegalEntityRegistered",
  "LegalEntityChanged",
  "IntraGroupArrangementSigned",
  "EntityFunctionalCurrencyAssigned",
] as const;
export type LegalEntityEventType = (typeof LEGAL_ENTITY_TYPED_EVENT_TYPES)[number];
