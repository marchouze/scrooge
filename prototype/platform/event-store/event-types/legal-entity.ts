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
