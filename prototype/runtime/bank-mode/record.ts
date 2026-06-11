// runtime/bank-mode/record.ts
//
// D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE PR2 — the sanctioned authoring path
// for the bank-wide provenance policy. `recordBankModePolicy` is the only
// supported way to emit a `BankModePolicySet` event. Mirrors the
// `recordDecision` recorder: validates, attaches production provenance (a
// bank-mode change is a real governance commitment, never simulated), and
// appends to the shared event store.
//
// Author: Scrooge (Chief of Staff / Orchestrator), on behalf of Marc (CEO).

import { clock, eventStore } from "../../platform/composition";
import {
  type BankModePolicySetPayload,
  makeBankModePolicySet,
} from "../../platform/event-store/event-types/bank-mode";
import { provenanceForEmit } from "../../platform/event-store/provenance";
import type { Actor, Event } from "../../platform/event-store/types";

export interface RecordBankModePolicyInput {
  readonly payload: BankModePolicySetPayload;
  readonly entity?: string;
  readonly actor?: Actor;
  readonly citations?: readonly string[];
}

export interface RecordBankModePolicyResult {
  readonly event: Event;
  readonly eventId: string;
}

const DEFAULT_ACTOR: Actor = { type: "service", id: "agent:scrooge:chief-of-staff" };

/**
 * Record a `BankModePolicySet` event. Authority for a bank-mode change is
 * CEO-level (it crosses the build-phase/commencement boundary and the
 * sandbox-simulator gate); callers pass the authorising principal in
 * `payload.setBy`.
 */
export function recordBankModePolicy(
  input: RecordBankModePolicyInput,
  asOf?: string,
): RecordBankModePolicyResult {
  const ts = asOf ?? clock.now();
  const event = makeBankModePolicySet({
    asOf: ts,
    entity: input.entity ?? "LE-ZA-HOZ-BANK",
    actor: input.actor ?? DEFAULT_ACTOR,
    citations: [...(input.citations ?? ["D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE"])],
    payload: input.payload,
  });
  const withProvenance: Event = {
    ...event,
    // Policy-routed (PR6): 'BankModePolicySet' is governance → production under
    // the default category policy — byte-identical to the legacy
    // productionTag({ sourceLineage: "bank-mode-policy" }).
    provenance: provenanceForEmit("BankModePolicySet", { sourceLineage: "bank-mode-policy" }),
  };

  // Idempotency guard: identical (bankMode, as_of) already recorded → no-op.
  for (const existing of eventStore.replay({ type: "BankModePolicySet" })) {
    const p = existing.payload as { bankMode?: string };
    if (p.bankMode === input.payload.bankMode && existing.as_of === ts) {
      return { event: existing, eventId: existing.event_id };
    }
  }

  eventStore.append(withProvenance);
  return { event: withProvenance, eventId: withProvenance.event_id };
}
