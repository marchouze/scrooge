// platform/simulation/fx-counterparty-registry.ts
//
// Derives the live list of FX-eligible counterparties from the KYC client
// register. A client is eligible if it has `authorisedProducts` containing
// "fx-spot" and a `bic` field set.
//
// This is the single canonical source for `SimCounterparty[]` consumed by
// `generateSimTrade` and the sim-hub counterparty FX request module.
// The hardcoded `REAL_COUNTERPARTIES` list in fx-sim-counterparties.ts is
// superseded by this function.
//
// Authority: D-KYC-ONBOARDING-BUILD; D-FX-SALES-TRADING-FRONTEND.
// Author: Devon (Chief Operating Officer, engineering)

import { nowUtc } from "../core/types";
import type { EventStore } from "../event-store/store";
import { LocalProjector } from "../projections";
import { clientsProjection } from "../projections/kyc/clients-projection";
import { SIM_COUNTERPARTIES, type SimCounterparty } from "./fx-sim-counterparties";

/**
 * Build the list of FX-eligible counterparties from the KYC register.
 *
 * Filters to non-simulated clients that:
 *   - have `bic` set
 *   - include "fx-spot" in `authorisedProducts`
 *
 * Maps each to `SimCounterparty` shape. The `eligiblePairs` field comes from
 * the client's `eligibleFxPairs` (or falls back to all standard pairs if empty).
 *
 * Falls back to `SIM_COUNTERPARTIES` when no KYC-derived counterparties are
 * found — prevents the sim loop stalling in a fresh/empty event store.
 */
export function getActiveFxCounterparties(store: Pick<EventStore, "replay">): SimCounterparty[] {
  const projector = new LocalProjector(store as EventStore);
  const stateMap = projector.build(clientsProjection);

  const result: SimCounterparty[] = [];

  for (const client of stateMap.values()) {
    if (client.simulated) continue;
    if (!client.bic) continue;
    if (!client.authorisedProducts?.includes("fx-spot")) continue;

    const eligiblePairs =
      client.eligibleFxPairs && client.eligibleFxPairs.length > 0
        ? [...client.eligibleFxPairs]
        : ["USD/ZAR", "EUR/ZAR", "GBP/ZAR", "EUR/USD", "GBP/USD"];

    result.push({
      partyId: client.clientId,
      name: client.entityName,
      role: "counterparty",
      jurisdiction: client.jurisdiction,
      bic: client.bic,
      ...(client.lei !== undefined ? { lei: client.lei } : {}),
      isSim: false,
      eligiblePairs,
      // minNotionalMinor / maxNotionalMinor are legacy fields used only in the
      // old per-counterparty range path. The sim engine now uses notionalUsdMin/Max
      // from hub config, so these are set to 0 and are not consulted.
      minNotionalMinor: 0,
      maxNotionalMinor: 0,
    });
  }

  // Safety fallback: if no KYC clients are yet onboarded, use the fictional
  // sim banks so the engine can still run during early build-phase.
  return result.length > 0 ? result : [...SIM_COUNTERPARTIES];
}

/** Snapshot timestamp for cache-invalidation checks. */
export function getActiveFxCounterpartiesAsOf(): string {
  return nowUtc();
}
