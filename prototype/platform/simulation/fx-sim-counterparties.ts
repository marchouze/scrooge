// platform/simulation/fx-sim-counterparties.ts
//
// Seeded fictional counterparties for the FX market-making simulation engine.
// These are synthetic institutional banks used exclusively in build-phase
// simulation runs. No real LEIs, no real counterparties.
//
// Authority: D-FX-SALES-TRADING-FRONTEND (D-FX-BOOK-BOUNDARY — bookType
//   required on every FX TradeExecuted); D-MARKETS-SCHEMA-FOUNDATION.
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
    eligiblePairs: ["ZAR/USD", "ZAR/EUR", "ZAR/GBP"],
    minNotionalMinor: 100_000_00, // 1M ZAR in cents
    maxNotionalMinor: 5_000_000_00, // 50M ZAR in cents
  },
  {
    partyId: "SIMASAZA000000002ZA",
    name: "Absa Simulated Bank SA",
    role: "counterparty",
    jurisdiction: "ZA",
    bic: "ABSAZAJJXXX",
    eligiblePairs: ["ZAR/USD", "ZAR/EUR"],
    minNotionalMinor: 50_000_00, // 500K ZAR in cents
    maxNotionalMinor: 2_000_000_00, // 20M ZAR in cents
  },
  {
    partyId: "SIMBCLGB0000000003GB",
    name: "Barclays Simulated London",
    role: "counterparty",
    jurisdiction: "GB",
    bic: "BARCGB22XXX",
    eligiblePairs: ["ZAR/USD", "GBP/ZAR", "EUR/USD"],
    minNotionalMinor: 200_000_00, // 2M GBP/ZAR minor (using cents as representative)
    maxNotionalMinor: 10_000_000_00, // 100M
  },
  {
    partyId: "SIMDBKDE0000000004DE",
    name: "Deutsche Simulated Frankfurt",
    role: "counterparty",
    jurisdiction: "DE",
    bic: "DEUTDEDBXXX",
    eligiblePairs: ["EUR/ZAR", "EUR/USD", "ZAR/EUR"],
    minNotionalMinor: 100_000_00, // 1M EUR/ZAR minor
    maxNotionalMinor: 8_000_000_00, // 80M
  },
  {
    partyId: "SIMJPMUS0000000005US",
    name: "JPMorgan Simulated New York",
    role: "counterparty",
    jurisdiction: "US",
    bic: "CHASUS33XXX",
    eligiblePairs: ["ZAR/USD", "USD/EUR", "ZAR/EUR"],
    minNotionalMinor: 500_000_00, // 5M ZAR minor
    maxNotionalMinor: 20_000_000_00, // 200M
  },
  {
    partyId: "SIMNEDSA0000000006ZA",
    name: "Nedbank Simulated SA",
    role: "counterparty",
    jurisdiction: "ZA",
    bic: "NEDSZAJJXXX",
    eligiblePairs: ["ZAR/USD", "ZAR/GBP"],
    minNotionalMinor: 50_000_00, // 500K ZAR minor
    maxNotionalMinor: 3_000_000_00, // 30M ZAR
  },
];
