// platform/simulation-v2/sim-modules/trade-confirmation.ts
//
// M3 — trade-confirmation seam (BUILD). Ends the instant-booking assumption:
// the simulated counterparty AFFIRMS or REJECTS a trade, and SUT settlement is
// gated on affirmation.
//
// Two sides, cleanly separated by the simulator↔SUT boundary:
//
//   SIMULATOR (external party) — emits the COUNTERPARTY's confirmation response:
//     · TradeConfirmationSent     (the bank sent a confirmation — modelled as the
//        counterparty's view of receipt, an external-party fact in the sim feed)
//     · TradeAffirmed / TradeRejected  (the counterparty's decision)
//   These are typed, born-V2 (provenance simulated, scenario-bound). They are NOT
//   SUT-internal — they are what the OUTSIDE party does. The boundary gate allows
//   them (they are in SIMULATOR_EXTERNAL_EVENT_TYPES).
//
//   SUT (the bank) — on an AFFIRMED trade, books the FIL FX instrument. That
//     booking (`FilInstrumentCreated`) is SUT-internal and lives OUTSIDE this
//     package, in `platform/markets/products/book-affirmed-fx-trade.ts`. The
//     simulator↔SUT boundary gate forbids this simulator module from emitting
//     `FilInstrumentCreated` — booking is the bank's action, not the sim's.
//
// The confirmation events live in this package as a self-contained typed family
// (Zod-validated) carried on the scenario event store. They are deliberately NOT
// yet promoted to the global 3-site event registry — that promotion is a tracked
// follow-on (see the PR body) so the parity/coverage gates adopt them in one
// coherent slice rather than piecemeal.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20). Every new event
// born V2 (v2status v2-parallel) — never v1-only (D-V1-REMOVAL-PHASE-1).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { simulatedTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";
import type { ScenarioTradeAction } from "../scenario-manifest";

const ENTITY = "LE-ZA-HOZ-BANK";

// ---------------------------------------------------------------------------
// Typed confirmation event family (born V2, simulator-emitted)
// ---------------------------------------------------------------------------

export const TRADE_CONFIRMATION_EVENT_TYPES = [
  "TradeConfirmationSent",
  "TradeAffirmed",
  "TradeRejected",
] as const;

export const tradeConfirmationPayloadSchema = z.object({
  tradeId: z.string().min(1),
  counterpartyId: z.string().min(1),
  /** Confirmation channel (modelled — SWIFT MT300 in a real flow). */
  channel: z.literal("MT300"),
});
export type TradeConfirmationPayload = z.infer<typeof tradeConfirmationPayloadSchema>;

export const tradeRejectedPayloadSchema = tradeConfirmationPayloadSchema.extend({
  reason: z.string().min(1),
});
export type TradeRejectedPayload = z.infer<typeof tradeRejectedPayloadSchema>;

function simProvenance(scenarioId: string) {
  return simulatedTag({
    scenario: scenarioId,
    sourceLineage: "simulation-v2:trade-confirmation",
  });
}

const SIM_ACTOR = { type: "service" as const, id: "agent:env:fx-trade-confirmation-sim" };
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST"];

/**
 * SIMULATOR — emit the counterparty's confirmation flow for a trade. The
 * counterparty affirms unless its behaviour profile is "fail" (reject) — the
 * decision is deterministic given the manifest seed (passed via `affirm`).
 * Returns the terminal confirmation event type emitted.
 */
export function emitCounterpartyConfirmation(args: {
  readonly store: EventStore;
  readonly scenarioId: string;
  readonly asOf: string;
  readonly trade: ScenarioTradeAction;
  /** Whether the counterparty affirms (true) or rejects (false). */
  readonly affirm: boolean;
}): "TradeAffirmed" | "TradeRejected" {
  const { store, scenarioId, asOf, trade, affirm } = args;
  const provenance = simProvenance(scenarioId);
  const base = {
    tradeId: trade.tradeId,
    counterpartyId: trade.counterpartyId,
    channel: "MT300" as const,
  };

  // The bank sent a confirmation; the counterparty received it (external fact).
  store.append({
    event_id: `${scenarioId}:${trade.tradeId}:confirm-sent`,
    type: "TradeConfirmationSent",
    as_of: asOf,
    entity: ENTITY,
    actor: SIM_ACTOR,
    citations: CITATIONS,
    payload: tradeConfirmationPayloadSchema.parse(base),
    provenance,
  });

  if (affirm) {
    store.append({
      event_id: `${scenarioId}:${trade.tradeId}:affirmed`,
      type: "TradeAffirmed",
      as_of: asOf,
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      payload: tradeConfirmationPayloadSchema.parse(base),
      provenance,
    });
    return "TradeAffirmed";
  }

  store.append({
    event_id: `${scenarioId}:${trade.tradeId}:rejected`,
    type: "TradeRejected",
    as_of: asOf,
    entity: ENTITY,
    actor: SIM_ACTOR,
    citations: CITATIONS,
    payload: tradeRejectedPayloadSchema.parse({
      ...base,
      reason: "counterparty-credit-or-settlement-fail-profile",
    }),
    provenance,
  });
  return "TradeRejected";
}
