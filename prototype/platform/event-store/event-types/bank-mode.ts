// platform/event-store/event-types/bank-mode.ts
//
// D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE PR2 — the settable, event-sourced
// bank-wide provenance policy.
//
// `BankModePolicySet` records the bank-wide prod/sim mode and the per-category
// granularity (which event categories default to `production` vs `simulated`
// under the current mode). It replaces the scattered env vars
// (BANK_LIFECYCLE_PHASE / BANK_PHASE / BANK_PROVENANCE_SUBSTRATE_ACTIVE) with a
// single canonical, queryable, auditable policy (Principle 1).
//
//   - bankMode "sim"  → build phase: the bank operates on simulated data; the
//                       3rd-party sandbox simulator is enabled; governance and
//                       build/substrate events stay `production` (real
//                       commitments / real code) per the category policy.
//   - bankMode "prod" → commencement: production data only; the simulator is
//                       disabled.
//
// Author: Scrooge (Chief of Staff / Orchestrator), on behalf of Marc (CEO).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

/** Bank-wide prod/sim mode. Maps to the lifecycle phase (sim=build-phase, prod=commencement). */
export const BANK_MODES = ["sim", "prod"] as const;
export type BankMode = (typeof BANK_MODES)[number];

// Provenance categories — the granularity axis for the per-category policy.
// Canonical taxonomy lives in the low-level provenance-category module (so the
// event-store provenance layer can consult it without a cycle); re-exported here
// for the schema + payload callers.
export {
  PROVENANCE_CATEGORIES,
  type ProvenanceCategory,
} from "../provenance-category";
import { PROVENANCE_CATEGORIES } from "../provenance-category";

export const categoryProvenanceSchema = z.object({
  category: z.enum(PROVENANCE_CATEGORIES),
  provenance: z.enum(["production", "simulated"]),
});
export type CategoryProvenance = z.infer<typeof categoryProvenanceSchema>;

export const bankModePolicySetPayloadSchema = z.object({
  bankMode: z.enum(BANK_MODES),
  /** Per-category default provenance under this mode. Must cover every category. */
  categoryPolicy: z.array(categoryProvenanceSchema).min(1),
  /** Free-text note explaining the change (audit context). */
  note: z.string().min(1).optional(),
  /** The principal authorising the change (e.g. "marc@tgv.co.za"). */
  setBy: z.string().min(1),
});

export type BankModePolicySetPayload = z.infer<typeof bankModePolicySetPayloadSchema>;

export function makeBankModePolicySet(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BankModePolicySetPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BankModePolicySet",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bankModePolicySetPayloadSchema.parse(args.payload),
  });
}
