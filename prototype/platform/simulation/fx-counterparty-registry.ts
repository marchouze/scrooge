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
 * Preference order:
 *   1. Real (non-sim) KYC-registered parties — when any exist, use only these.
 *   2. All register entries (real + sim) — when the register has entries but none are real.
 *   3. Static SIM_COUNTERPARTIES fallback — when the register is empty (test / cold start).
 *
 * This prevents sim banks (buildPhaseStatus="sim") from appearing as trade
 * counterparties once real KYC clients are registered.
 */
export function getActiveFxCounterparties(store: Pick<EventStore, "replay">): SimCounterparty[] {
  const projection = buildPartyProjection(store as EventStore);
  const fromRegister = fxCounterpartiesFromPartyRegister(projection);
  if (fromRegister.length === 0) return [...SIM_COUNTERPARTIES];
  const realOnly = fromRegister.filter((c) => !c.isSim);
  return realOnly.length > 0 ? realOnly : fromRegister;
}
