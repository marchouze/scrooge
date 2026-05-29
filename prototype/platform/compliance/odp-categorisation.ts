// platform/compliance/odp-categorisation.ts
//
// ODP client / counterparty categorisation rules engine.
//
// Every OTC derivative entered into by the bank requires that the trading
// party be classified as either a "client" or a "counterparty" per
// CS 2/2018 §4 before the trade is executed. The classification determines
// which FSCA conduct protections apply.
//
// Counterparty criteria (CS 2/2018 §1 definitions + §4):
//   - Regulated financial institutions (banks, insurers, FSPs, CCPs, exchanges)
//   - Sovereigns, central banks, multilateral development banks
//   - Parties that elect up-categorisation from client to counterparty
//     (written notice + confirmation required; CS 2/2018 §4(3))
//
// Client: any party that does not meet the counterparty criteria, or a
//   counterparty that has been re-categorised back to client status.
//
// Citations:
//   CS 2/2018 §4 + ORG-ODP-COND-002
//   FAIS Act 37/2002 §45; FAIS General Code of Conduct §2(1)
//   Financial Sector Regulation Act 9/2017 §131 (FSCA mandate)
//
// Author: Atlas (Core banking platform architect, engineering)

// ---------------------------------------------------------------------------
// Core type
// ---------------------------------------------------------------------------

/**
 * ODP party category per CS 2/2018 §4.
 *
 * "counterparty" — regulated financial institution, sovereign/central bank,
 *   multilateral development bank, or a party that has validly elected
 *   up-categorisation under CS 2/2018 §4(3).
 * "client" — any other party, including parties re-categorised back from
 *   counterparty status.
 *
 * CS 2/2018 §4 + ORG-ODP-COND-002
 */
export type OdpPartyCategory = "client" | "counterparty";

// ---------------------------------------------------------------------------
// Entity-type constants
// ---------------------------------------------------------------------------

/**
 * Entity types that qualify as counterparties under CS 2/2018 §4 by virtue
 * of their regulatory status — regardless of FAIS category.
 *
 * CS 2/2018 §1 (definitions) + §4(1)(a)–(c).
 */
const COUNTERPARTY_ENTITY_TYPES = new Set([
  // Regulated deposit-taking institutions
  "bank",
  "mutual-bank",
  "co-operative-bank",
  // Insurance
  "long-term-insurer",
  "short-term-insurer",
  "reinsurer",
  // FAIS-authorised FSPs (institutional grade)
  "fsp",
  "authorised-fsp",
  "discretionary-fsp",
  // Market infrastructure
  "ccp", // central counterparty clearing house
  "exchange",
  "licensed-exchange",
  "csd", // central securities depository
  // Supranationals / sovereigns
  "sovereign",
  "central-bank",
  "multilateral-development-bank",
  "mdb",
  "bis", // Bank for International Settlements
  "imf",
]);

/**
 * FAIS market-counterparty category maps directly to ODP counterparty.
 * CS 2/2018 §4(1)(b) cross-references the FAIS GCC §2(1) classification.
 */
const FAIS_MARKET_COUNTERPARTY = "market-counterparty";

// ---------------------------------------------------------------------------
// Decision record
// ---------------------------------------------------------------------------

/**
 * ODP categorisation decision — immutable record capturing the outcome.
 * Produced by `determineOdpCategory` and suitable for embedding in an
 * `OdpCounterpartyCategorised` event payload.
 *
 * CS 2/2018 §4 + ORG-ODP-COND-002
 */
export interface OdpCategoriationDecision {
  /** Party identifier — counterparty ID or client ID. */
  readonly partyId: string;
  /** ODP category assigned. */
  readonly category: OdpPartyCategory;
  /** Human-readable reason citing the applicable rule. */
  readonly reason: string;
  /** ISO 8601 timestamp of determination. */
  readonly determinedAt: string;
  /** True if the counterparty category arose from an explicit election. */
  readonly electedUpCategorisation: boolean;
}

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

/**
 * Minimum party attributes required to run the CS 2/2018 §4 rules engine.
 *
 * `faisCategory`      — outcome of FAIS classification (CounterpartyFaisClassified).
 * `entityType`        — optional: legal-entity type string (case-insensitive).
 * `electedCounterparty` — optional: true when the party has delivered written
 *   notice of up-categorisation per CS 2/2018 §4(3).
 * `recategorisedToClient` — optional: true when a previously categorised
 *   counterparty has been re-categorised back to client status.
 */
export interface OdpPartyInput {
  readonly faisCategory: string;
  readonly entityType?: string;
  readonly electedCounterparty?: boolean;
  readonly recategorisedToClient?: boolean;
}

// ---------------------------------------------------------------------------
// Rules engine
// ---------------------------------------------------------------------------

/**
 * Determine the ODP party category for a trading party under CS 2/2018 §4.
 *
 * Rules applied in priority order:
 *   R1. Re-categorised back to client → "client" (terminal; CS 2/2018 §4(4)).
 *   R2. Elected up-categorisation (written notice confirmed) → "counterparty"
 *       (CS 2/2018 §4(3)).
 *   R3. FAIS `market-counterparty` → "counterparty"
 *       (CS 2/2018 §4(1)(b) via FAIS GCC §2(1)).
 *   R4. Entity type is in the regulated-institution set → "counterparty"
 *       (CS 2/2018 §4(1)(a)–(c)).
 *   R5. Default → "client".
 *
 * This is a pure function — no I/O, no side-effects.
 *
 * CS 2/2018 §4 + ORG-ODP-COND-002
 */
export function determineOdpCategory(party: OdpPartyInput): OdpPartyCategory {
  // R1 — explicit re-categorisation back to client overrides everything.
  if (party.recategorisedToClient === true) {
    return "client";
  }

  // R2 — written election to be treated as a counterparty.
  if (party.electedCounterparty === true) {
    return "counterparty";
  }

  // R3 — FAIS market-counterparty classification.
  if (party.faisCategory === FAIS_MARKET_COUNTERPARTY) {
    return "counterparty";
  }

  // R4 — regulated-institution entity type.
  const normalised = (party.entityType ?? "").toLowerCase().trim();
  if (normalised.length > 0 && COUNTERPARTY_ENTITY_TYPES.has(normalised)) {
    return "counterparty";
  }

  // R5 — default to client.
  return "client";
}

// ---------------------------------------------------------------------------
// Decision factory
// ---------------------------------------------------------------------------

/**
 * Run the CS 2/2018 §4 rules engine and return a full decision record.
 *
 * CS 2/2018 §4 + ORG-ODP-COND-002
 */
export function makeOdpCategoriationDecision(
  partyId: string,
  party: OdpPartyInput,
  determinedAt: string,
): OdpCategoriationDecision {
  const category = determineOdpCategory(party);
  const reason = buildReason(party, category);

  return {
    partyId,
    category,
    reason,
    determinedAt,
    electedUpCategorisation: party.electedCounterparty === true,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildReason(party: OdpPartyInput, category: OdpPartyCategory): string {
  if (party.recategorisedToClient === true) {
    return "CS 2/2018 §4(4): party re-categorised back to client status";
  }
  if (party.electedCounterparty === true) {
    return "CS 2/2018 §4(3): party elected up-categorisation to counterparty via written notice";
  }
  if (party.faisCategory === FAIS_MARKET_COUNTERPARTY) {
    return `CS 2/2018 §4(1)(b): FAIS market-counterparty classification (faisCategory="${party.faisCategory}")`;
  }
  const normalised = (party.entityType ?? "").toLowerCase().trim();
  if (normalised.length > 0 && COUNTERPARTY_ENTITY_TYPES.has(normalised)) {
    return `CS 2/2018 §4(1)(a)–(c): regulated financial institution (entityType="${party.entityType}")`;
  }
  if (category === "client") {
    return `CS 2/2018 §4: party does not meet counterparty criteria (faisCategory="${party.faisCategory}", entityType="${party.entityType ?? ""}") — classified as client`;
  }
  return "CS 2/2018 §4: category determined by rules engine";
}
