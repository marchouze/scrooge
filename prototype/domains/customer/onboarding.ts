// domains/customer/onboarding.ts
//
// Pure event constructors for the institutional client lifecycle. Every
// constructor returns an Event ready to append to the event store.
//
// P2 — every event carries citations.
//
// Author: Niko

import { newEventId, nowUtc } from "@platform/core/types";
import type { Actor, Event } from "@platform/event-store/types";
import {
  type ActivationPayload,
  type AuthorisedSignatoryPayload,
  CUSTOMER_EVENT_TYPES,
  type CounterpartyId,
  DEFAULT_ENTITY,
  type DocumentationPayload,
  type KycCompletedPayload,
  type MandatePayload,
  type OffboardPayload,
  type ProspectPayload,
  type SoundingPayload,
} from "./types";

export interface MakeOpts {
  actor: Actor;
  citations: readonly string[]; // Principle 2 — at least one
  asOf?: string; // ISO; defaults to now
}

function base(type: string, payload: Record<string, unknown>, opts: MakeOpts): Event {
  if (opts.citations.length === 0) {
    throw new Error("Principle 2 violation: at least one citation required");
  }
  return {
    event_id: newEventId(),
    type,
    as_of: opts.asOf ?? nowUtc(),
    entity: DEFAULT_ENTITY,
    actor: opts.actor,
    citations: [...opts.citations],
    payload,
  };
}

export function soundingOpened(p: SoundingPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[0], { ...p }, opts);
}

export function prospectRegistered(p: ProspectPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[1], { ...p }, opts);
}

export function kycCompleted(p: KycCompletedPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[2], { ...p }, opts);
}

export function documentationDrafted(p: DocumentationPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[3], { ...p }, opts);
}

export function documentationReadyToExecute(p: DocumentationPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[4], { ...p }, opts);
}

export function authorisedSignatoryAdded(p: AuthorisedSignatoryPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[5], { ...p }, opts);
}

export function authorisedSignatoryRemoved(
  p: { counterpartyId: CounterpartyId; personId: string; reason: string },
  opts: MakeOpts,
): Event {
  return base(CUSTOMER_EVENT_TYPES[6], { ...p }, opts);
}

export function mandateAssigned(p: MandatePayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[7], { ...p }, opts);
}

export function mandateRevised(p: MandatePayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[8], { ...p }, opts);
}

export function mandateRevoked(
  p: { counterpartyId: CounterpartyId; reason: string },
  opts: MakeOpts,
): Event {
  return base(CUSTOMER_EVENT_TYPES[9], { ...p }, opts);
}

export function counterpartyActivated(p: ActivationPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[10], { ...p }, opts);
}

export function counterpartyOffboarded(p: OffboardPayload, opts: MakeOpts): Event {
  return base(CUSTOMER_EVENT_TYPES[11], { ...p }, opts);
}
