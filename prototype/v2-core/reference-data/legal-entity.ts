// v2-core/reference-data/legal-entity.ts
//
// Canonical anchor legal-entity identifier — single source for the bank's own
// legal-entity id, so no consumer transcribes the literal "LE-ZA-HOZ-BANK"
// (or, worse, a legacy alias like "LE-BANK-SA" / "BANK-ZA-001") inline.
//
// The redenomination cutover (D-MONEY-DECIMAL-REDENOMINATION;
// D-LEGAL-ENTITY-NAME-HOZ-BANK) fixed the canonical anchor identity at
// "LE-ZA-HOZ-BANK" / "Hoz Bank Limited"; `recon:no-legacy-le-identity` asserts
// the event store and (as of D-NPA-PAGE-DE-INVENTION) the source trees carry no
// legacy ids. This constant is that gate's source-of-truth literal, so product
// fixtures and the proposal-synthesis fallback read the value instead of
// shadowing it (Engineering-Charter cmd 4 — source, don't hardcode).
//
// PACKAGE BOUNDARY: inside `v2-core/` — no imports from `platform/`, `runtime/`,
// `domains/` (enforced by `recon:v2-no-v1-import`). Pure data.
//
// Authority: D-NPA-PAGE-DE-INVENTION (CEO-approved 2026-06-23);
//   D-LEGAL-ENTITY-NAME-HOZ-BANK; D-MONEY-DECIMAL-REDENOMINATION.
// Author: Atlas (Core banking platform architect, engineering).

/**
 * Canonical legal-entity id for the bank's own anchor entity. The single home
 * any source-tree consumer reads instead of writing the literal inline.
 */
export const CANONICAL_LEGAL_ENTITY_ID = "LE-ZA-HOZ-BANK" as const;

/** Human-readable name of the canonical anchor legal entity. */
export const CANONICAL_LEGAL_ENTITY_NAME = "Hoz Bank Limited" as const;
