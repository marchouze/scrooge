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
import {
  SIM_COUNTERPARTIES,
  type SimCounterparty,
  fxCounterpartiesFromPartyRegister,
} from "./fx-sim-counterparties";

/**
 * Resolve the live list of FX-eligible counterparties from the party register.
 *
 * Returns all legal-entity parties with bic + "fx-spot" in authorisedProducts
 * (both real production parties and build-phase sim parties).
 *
 * Falls back to SIM_COUNTERPARTIES when the party register yields no results —
 * prevents the sim engine stalling in an empty event store (e.g. test runs).
 */
export function getActiveFxCounterparties(store: Pick<EventStore, "replay">): SimCounterparty[] {
  const projection = buildPartyProjection(store as EventStore);
  const fromRegister = fxCounterpartiesFromPartyRegister(projection);
  return fromRegister.length > 0 ? fromRegister : [...SIM_COUNTERPARTIES];
}
