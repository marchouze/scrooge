// platform/simulation/fx-sim-counterparties.ts
//
// FX counterparty types and party-register-derived counterparty accessors.
//
// The party register is the single master counterparty store (Principle 2).
// This module provides:
//  - `SimCounterparty` — the interface the sim engine uses
//  - `fxCounterpartiesFromPartyRegister(projection)` — all FX-eligible
//    parties (real + sim) from the party register
//  - `SIM_COUNTERPARTIES` — build-phase sim counterparties only (static
//    fallback for tests and cold-start)
//
// Authority: D-FX-SALES-TRADING-FRONTEND; D-FX-BOOK-BOUNDARY;
//   D-MARKETS-SCHEMA-FOUNDATION.
// Author: Devon (Chief Operating Officer, engineering)

import type { PartyProjection } from "../identity/party-projection";
import type { Party } from "../markets/cdm/primitives";

// ---------------------------------------------------------------------------
// SimCounterparty — CDM Party enriched with FX sim metadata
// ---------------------------------------------------------------------------

export interface SimCounterparty extends Party {
  /** Currency pairs this counterparty is eligible to trade. Format: "BASE/QUOTE". */
  eligiblePairs: string[];
  /** Minimum notional in minor units (legacy; ignored when notionalUsdMin/Max set on the engine). */
  minNotionalMinor: number;
  /** Maximum notional in minor units (legacy; ignored when notionalUsdMin/Max set on the engine). */
  maxNotionalMinor: number;
  /** SWIFT BIC (11 chars). */
  bic: string;
  /** ISO 17442 LEI. Present for real counterparties. */
  lei?: string;
  /** True = build-phase fictitious counterparty (party register buildPhaseStatus: "sim"). */
  isSim?: boolean;
}

// ---------------------------------------------------------------------------
// Party-register-derived accessors
// ---------------------------------------------------------------------------

/**
 * All FX-eligible counterparties from the party register — real + sim.
 *
 * Includes any legal-entity Party that has:
 *   - bic set
 *   - "fx-spot" in authorisedProducts
 */
export function fxCounterpartiesFromPartyRegister(projection: PartyProjection): SimCounterparty[] {
  const result: SimCounterparty[] = [];

  for (const record of projection.parties.values()) {
    if (record.kind !== "legal-entity") continue;
    const attrs = record.kindAttributes;
    if (attrs.kind !== "legal-entity") continue;
    if (!attrs.bic) continue;
    if (!attrs.authorisedProducts?.includes("fx-spot")) continue;

    const eligiblePairs =
      attrs.eligibleFxPairs && attrs.eligibleFxPairs.length > 0
        ? [...attrs.eligibleFxPairs]
        : ["USD/ZAR", "EUR/ZAR", "GBP/ZAR", "EUR/USD", "GBP/USD"];

    result.push({
      partyId: record.partyId,
      name: record.displayName,
      role: "counterparty",
      jurisdiction: record.jurisdictions[0] ?? "ZA",
      bic: attrs.bic,
      ...(attrs.lei !== undefined ? { lei: attrs.lei } : {}),
      isSim: attrs.buildPhaseStatus === "sim",
      eligiblePairs,
      minNotionalMinor: 0,
      maxNotionalMinor: 0,
    });
  }

  return result;
}

/**
 * Production-only FX counterparties (buildPhaseStatus absent or "active").
 * Used when provenance = "production" trades must not reference sim banks.
 */
export function realFxCounterpartiesFromPartyRegister(
  projection: PartyProjection,
): SimCounterparty[] {
  return fxCounterpartiesFromPartyRegister(projection).filter((c) => !c.isSim);
}

// ---------------------------------------------------------------------------
// Static fallback — mirrors the 6 sim banks in the party register seed.
// Used directly in tests (no live event store) and as the cold-start
// fallback when getActiveFxCounterparties finds no party register entries.
// ---------------------------------------------------------------------------

export const SIM_COUNTERPARTIES: SimCounterparty[] = [
  {
    partyId: "urn:party:legal-entity:std-sim-za",
    name: "Standard Simulated Bank SA",
    role: "counterparty",
    jurisdiction: "ZA",
    bic: "SBZAZAJJXXX",
    isSim: true,
    eligiblePairs: ["USD/ZAR", "EUR/ZAR", "GBP/ZAR"],
    minNotionalMinor: 100_000_00,
    maxNotionalMinor: 5_000_000_00,
  },
  {
    partyId: "urn:party:legal-entity:absa-sim-za",
    name: "Absa Simulated Bank SA",
    role: "counterparty",
    jurisdiction: "ZA",
    bic: "ABSAZAJJXXX",
    isSim: true,
    eligiblePairs: ["USD/ZAR", "EUR/ZAR"],
    minNotionalMinor: 50_000_00,
    maxNotionalMinor: 2_000_000_00,
  },
  {
    partyId: "urn:party:legal-entity:barclays-sim-gb",
    name: "Barclays Simulated London",
    role: "counterparty",
    jurisdiction: "GB",
    bic: "BARCGB22XXX",
    isSim: true,
    eligiblePairs: ["USD/ZAR", "GBP/ZAR", "EUR/USD"],
    minNotionalMinor: 200_000_00,
    maxNotionalMinor: 10_000_000_00,
  },
  {
    partyId: "urn:party:legal-entity:deutsche-sim-de",
    name: "Deutsche Simulated Frankfurt",
    role: "counterparty",
    jurisdiction: "DE",
    bic: "DEUTDEDBXXX",
    isSim: true,
    eligiblePairs: ["EUR/ZAR", "EUR/USD"],
    minNotionalMinor: 100_000_00,
    maxNotionalMinor: 8_000_000_00,
  },
  {
    partyId: "urn:party:legal-entity:jpm-sim-us",
    name: "JPMorgan Simulated New York",
    role: "counterparty",
    jurisdiction: "US",
    bic: "CHASUS33XXX",
    isSim: true,
    eligiblePairs: ["USD/ZAR", "EUR/USD", "EUR/ZAR"],
    minNotionalMinor: 500_000_00,
    maxNotionalMinor: 20_000_000_00,
  },
  {
    partyId: "urn:party:legal-entity:nedbank-sim-za",
    name: "Nedbank Simulated SA",
    role: "counterparty",
    jurisdiction: "ZA",
    bic: "NEDSZAJJXXX",
    isSim: true,
    eligiblePairs: ["USD/ZAR", "GBP/ZAR"],
    minNotionalMinor: 50_000_00,
    maxNotionalMinor: 3_000_000_00,
  },
];
