// platform/simulation/bond-sim-counterparties.ts
//
// Bond counterparty types and party-register-derived accessors — the bond
// analogue of fx-sim-counterparties.ts.
//
// The party register is the single master counterparty store (Principle 2). A
// counterparty is bond-eligible when its legal-entity attributes carry a BIC and
// "bond" in authorisedProducts. SA government-bond eligibility is uniform across
// the three benchmark bonds, so eligibleIsins defaults to all of them.
//
// Authority: D-NPA-SAGB-BOND-INTERNAL-TEST; D-PARTY-REGISTER;
//   D-MARKETS-SCHEMA-FOUNDATION.
// Author: Devon (Chief Operating Officer, engineering)

import type { PartyProjection } from "../identity/party-projection";
import type { Party } from "../markets/cdm/primitives";
import { SA_BOND_ISINS } from "../markets/reference/sa-bond-reference";

// ---------------------------------------------------------------------------
// BondSimCounterparty — CDM Party enriched with bond sim metadata
// ---------------------------------------------------------------------------

export interface BondSimCounterparty extends Party {
  /** ISINs this counterparty is eligible to trade. Defaults to all benchmarks. */
  eligibleIsins: string[];
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
 * All bond-eligible counterparties from the party register — real + sim.
 *
 * Includes any legal-entity Party that has:
 *   - bic set
 *   - "bond" in authorisedProducts
 */
export function bondCounterpartiesFromPartyRegister(
  projection: PartyProjection,
): BondSimCounterparty[] {
  const result: BondSimCounterparty[] = [];

  for (const record of projection.parties.values()) {
    if (record.kind !== "legal-entity") continue;
    const attrs = record.kindAttributes;
    if (attrs.kind !== "legal-entity") continue;
    if (!attrs.bic) continue;
    if (!attrs.authorisedProducts?.includes("bond")) continue;

    result.push({
      partyId: record.partyId,
      name: record.displayName,
      role: "counterparty",
      jurisdiction: record.jurisdictions[0] ?? "ZA",
      bic: attrs.bic,
      ...(attrs.lei !== undefined ? { lei: attrs.lei } : {}),
      isSim: attrs.buildPhaseStatus === "sim",
      eligibleIsins: [...SA_BOND_ISINS],
    });
  }

  return result;
}

/**
 * Production-only bond counterparties (buildPhaseStatus absent or "active").
 */
export function realBondCounterpartiesFromPartyRegister(
  projection: PartyProjection,
): BondSimCounterparty[] {
  return bondCounterpartiesFromPartyRegister(projection).filter((c) => !c.isSim);
}
