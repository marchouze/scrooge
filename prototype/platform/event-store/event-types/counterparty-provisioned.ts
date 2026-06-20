// platform/event-store/event-types/counterparty-provisioned.ts
//
// SUT-INTERNAL counterparty-provisioning record (WS-FX-V2-SIMULATOR, M2).
//
// This is the BANK's OWN internal record that it has provisioned a counterparty
// for FX dealing: KYC cleared, dealing mandate granted, ISDA/CSA elected (when in
// scope), and the per-currency netting set stood up (NS-<counterpartyId>-<ccy>)
// so SA-CCR can net the counterparty's exposures in Phase 2.
//
// It is emitted by the SUT side (platform/markets/counterparty/
// provision-counterparty.ts) GATED on the simulator's external-party lifecycle
// (CounterpartyMandateAccepted [+ CounterpartyAgreementAccepted when a master
// agreement is in scope]). The simulator↔SUT boundary gate forbids the simulator
// from emitting this event — provisioning is the bank's action.
//
// Born V2 (D-V1-REMOVAL-PHASE-1) — never v1-only. THREE-SITE REGISTRATION
// (F-032): event-types (this file) → registry → provenance-category.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

export const counterpartyProvisionedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  /** Reporting/base currency the netting set + mandate are denominated in. */
  baseCurrency: z.string().min(1),
  /** The stood-up netting set id (NS-<counterpartyId>-<ccy>) — feeds SA-CCR. */
  nettingSetId: z.string().min(1),
  /** Whether a master agreement (ISDA) was elected for this counterparty. */
  masterAgreementElected: z.boolean(),
  /** The elected master-agreement form (when masterAgreementElected). */
  agreementType: z.enum(["ISDA-2002", "ISDA-1992"]).optional(),
  /** Whether a CSA is in scope under the elected agreement. */
  csaInScope: z.boolean(),
});
export type CounterpartyProvisionedPayload = z.infer<typeof counterpartyProvisionedPayloadSchema>;

export function makeCounterpartyProvisioned(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CounterpartyProvisionedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CounterpartyProvisioned",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: counterpartyProvisionedPayloadSchema.parse(args.payload),
    ...(args.provenance !== undefined ? { provenance: args.provenance } : {}),
  });
}

export const COUNTERPARTY_PROVISIONED_EVENT_TYPES = ["CounterpartyProvisioned"] as const;
export type CounterpartyProvisionedEventType =
  (typeof COUNTERPARTY_PROVISIONED_EVENT_TYPES)[number];
