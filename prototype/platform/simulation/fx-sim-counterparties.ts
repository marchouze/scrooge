// platform/simulation/fx-sim-counterparties.ts
//
// Seeded fictional counterparties for the FX market-making simulation engine.
// These are synthetic institutional banks used exclusively in build-phase
// simulation runs. No real LEIs, no real counterparties.
//
// Authority: D-FX-SALES-TRADING-FRONTEND (D-FX-BOOK-BOUNDARY — bookType
//   required on every FX TradeExecuted); D-MARKETS-SCHEMA-FOUNDATION;
//   ACI Model Code §2 (currency-pair quotation convention).
//
// Pair representation: all `eligiblePairs` entries are major-first per the
// ACI hierarchy (EUR > GBP > AUD > NZD > USD > CAD > CHF > JPY > others).
// e.g. `USD/ZAR`, not `ZAR/USD`. Asserted by `recon:fx-pair-direction`.
//
// Author: Devon (Chief Operating Officer, engineering)

import type { Party } from "../markets/cdm/primitives";

// ---------------------------------------------------------------------------
// SimCounterparty — extends the CDM Party with simulation metadata.
// ---------------------------------------------------------------------------

export interface SimCounterparty extends Party {
  /** Currency pairs this counterparty is eligible to trade. Format: "BASE/QUOTE". */
  eligiblePairs: string[];
  /** Minimum notional for a single trade, in the first pair's base currency minor units. */
  minNotionalMinor: number;
  /** Maximum notional for a single trade, in the first pair's base currency minor units. */
  maxNotionalMinor: number;
  /** SWIFT BIC (11 chars) for this counterparty. Used in MT300 FX confirmation. */
  bic: string;
  /** ISO 17442 LEI. Populated for real (non-sim) counterparties; absent for fictional ones. */
  lei?: string;
  /** True = fictional build-phase counterparty; false/absent = real onboarded counterparty. */
  isSim?: boolean;
}

// ---------------------------------------------------------------------------
// SIM_COUNTERPARTIES — 6 fictional institutional banks.
// LEIs are 20 alphanumeric characters (ISO 17442 standard).
// All are fictional; no real institution is represented.
// ---------------------------------------------------------------------------

export const SIM_COUNTERPARTIES: SimCounterparty[] = [
  {
    partyId: "SIMSAZA0000000001ZA",
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
    partyId: "SIMASAZA000000002ZA",
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
    partyId: "SIMBCLGB0000000003GB",
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
    partyId: "SIMDBKDE0000000004DE",
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
    partyId: "SIMJPMUS0000000005US",
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
    partyId: "SIMNEDSA0000000006ZA",
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

/**
 * Real (onboarded) counterparties from the party register.
 * Used when provenance = "production" or alongside sim counterparties in the
 * combined list.
 */
export const REAL_COUNTERPARTIES: SimCounterparty[] = [
  {
    partyId: "urn:party:legal-entity:standard-bank-za",
    name: "Standard Bank Corporate Treasury",
    role: "counterparty",
    jurisdiction: "ZA",
    bic: "SBZAZAJJXXX",
    lei: "QFC8ZCW3Q5PRXU1XTM60",
    isSim: false,
    eligiblePairs: ["USD/ZAR", "EUR/ZAR", "GBP/ZAR", "EUR/USD", "GBP/USD"],
    minNotionalMinor: 500_000_00,
    maxNotionalMinor: 20_000_000_00,
  },
  {
    partyId: "urn:party:legal-entity:investec-bank-za",
    name: "Investec Bank Treasury",
    role: "counterparty",
    jurisdiction: "ZA",
    bic: "IVESZAJJXXX",
    lei: "549300RH5FFHO48FXT69",
    isSim: false,
    eligiblePairs: ["USD/ZAR", "EUR/ZAR", "GBP/ZAR", "EUR/USD"],
    minNotionalMinor: 200_000_00,
    maxNotionalMinor: 10_000_000_00,
  },
];

/** All FX counterparties: sim + real. Use this in the sim engine. */
export const ALL_FX_COUNTERPARTIES: SimCounterparty[] = [
  ...SIM_COUNTERPARTIES,
  ...REAL_COUNTERPARTIES,
];
