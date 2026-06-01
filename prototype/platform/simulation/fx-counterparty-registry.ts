// platform/simulation/fx-counterparty-registry.ts
//
// Live FX counterparty resolver — derives SimCounterparty[] from the party
// register (the single master counterparty store, Principle 2).
//
// Every counterparty must be registered in the party register before it can
// trade. BIC, authorised products, and FX pair eligibility are attributes of
// the party register entry, not of any downstream process (KYC, credit, etc.).
//
// Authority: D-FX-SALES-TRADING-FRONTEND; D-MARKETS-SCHEMA-FOUNDATION.
// Author: Devon (Chief Operating Officer, engineering)

import type { EventStore } from "../event-store/store";
import { buildPartyProjection } from "../identity/party-projection";
import { type SimCounterparty, fxCounterpartiesFromPartyRegister } from "./fx-sim-counterparties";

/**
 * Resolve the live list of FX-eligible counterparties from the party register.
 *
 * Returns real (non-sim) KYC-registered parties only. Falls back to the full
 * register (including sim-tagged parties) only when no real parties exist yet.
 * Returns an empty array when the party register has no FX-eligible entries at
 * all — callers (sim engine fireTrade) must handle the empty case gracefully.
 */
export function getActiveFxCounterparties(store: Pick<EventStore, "replay">): SimCounterparty[] {
  const projection = buildPartyProjection(store as EventStore);
  const fromRegister = fxCounterpartiesFromPartyRegister(projection);
  if (fromRegister.length === 0) return [];
  const realOnly = fromRegister.filter((c) => !c.isSim);
  return realOnly.length > 0 ? realOnly : fromRegister;
}
