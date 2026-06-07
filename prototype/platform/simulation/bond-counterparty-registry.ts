// platform/simulation/bond-counterparty-registry.ts
//
// Live bond counterparty resolver — derives BondSimCounterparty[] from the party
// register (the single master counterparty store, Principle 2). The bond
// analogue of fx-counterparty-registry.ts.
//
// Every counterparty must be registered in the party register before it can
// trade. BIC, authorised products, and bond eligibility are attributes of the
// party register entry, not of any downstream process.
//
// Authority: D-NPA-SAGB-BOND-INTERNAL-TEST; D-MARKETS-SCHEMA-FOUNDATION.
// Author: Devon (Chief Operating Officer, engineering)

import type { EventStore } from "../event-store/store";
import { buildPartyProjection } from "../identity/party-projection";
import {
  type BondSimCounterparty,
  bondCounterpartiesFromPartyRegister,
} from "./bond-sim-counterparties";

/**
 * Resolve the live list of bond-eligible counterparties from the party register.
 *
 * Returns real (non-sim) registered parties only. Falls back to the full
 * register (including sim-tagged parties) when no real parties exist yet.
 * Returns an empty array when the register has no bond-eligible entries at all —
 * callers (BondSimEngine.fireTrade) must handle the empty case gracefully.
 */
export function getActiveBondCounterparties(
  store: Pick<EventStore, "replay">,
): BondSimCounterparty[] {
  const projection = buildPartyProjection(store as EventStore);
  const fromRegister = bondCounterpartiesFromPartyRegister(projection);
  if (fromRegister.length === 0) return [];
  const realOnly = fromRegister.filter((c) => !c.isSim);
  return realOnly.length > 0 ? realOnly : fromRegister;
}
