// platform/identity/entity-short-ids.ts
//
// Canonical short-id ↔ Party URN registry for legal-entity Parties.
//
// The event-store `entity` field is a denormalised short-id by design
// (see `prototype/platform/event-store/types.ts`). The Party register
// (`Regulations/_party-register.md`, `prototype/seeds/party-register.json`)
// is the canonical identity authority — each legal-entity Party has a
// Party URN of the form `urn:party:legal-entity:<slug>` per
// D-PARTY-REGISTER (CEO-approved 2026-05-11). This module is the single
// authoritative mapping from the short-id form used in event payloads
// to the canonical Party URN.
//
// Authority for the unification:
//   - D-PARTY-REGISTER (CEO-approved 2026-05-11)
//   - Entity-identity unification PR (Atlas + Imani, 2026-05-21) —
//     retires the legacy `BANK-ZA-001` short-id; canonical short-id is
//     `LE-ZA-HOZ-BANK` mapping to `urn:party:legal-entity:hoz-bank`.
//
// Authors: Atlas (Core banking platform architect, engineering) ·
// Imani (Chief Legal Counsel, governance — legal-entity-tree authority).

import { HOZ_BANK_ENTITY, type LegalEntity } from "../core/types";

/**
 * Canonical Party URN for a legal-entity short-id used in event payloads.
 *
 * The short-id is the denormalised label that appears on the
 * `event.entity` field of every event. The URN is the canonical identity
 * resolvable against the Party register
 * (`Regulations/_party-register.md` + `prototype/seeds/party-register.json`).
 */
export interface LegalEntityShortIdEntry {
  /** The short-id used on the `event.entity` field. */
  readonly shortId: LegalEntity;
  /** The canonical Party URN (`urn:party:legal-entity:<slug>`). */
  readonly partyUrn: string;
  /** Human-readable legal name (mirrors Party register `legalName`). */
  readonly legalName: string;
  /** Lifecycle status — short-ids removed from rotation are marked `retired`. */
  readonly status: "active" | "retired";
}

/**
 * Canonical short-id ↔ Party URN registry. Every legal entity that
 * appears on `event.entity` MUST have a row here; recon
 * `entity-identity-coherence` asserts coverage.
 *
 * To add a new legal entity:
 *   1. Add the Party register row (`Regulations/_party-register.md`).
 *   2. Add the seed JSON entry (`prototype/seeds/party-register.json`).
 *   3. Add the short-id row below.
 *   4. Emit `PartyRegistered{kind: "legal-entity"}`.
 */
export const LEGAL_ENTITY_SHORT_ID_REGISTRY: readonly LegalEntityShortIdEntry[] = [
  {
    shortId: HOZ_BANK_ENTITY, // "LE-ZA-HOZ-BANK"
    partyUrn: "urn:party:legal-entity:hoz-bank",
    legalName: "Hoz Bank Limited",
    status: "active",
  },
] as const;

/**
 * Resolve a short-id to its canonical Party URN. Returns `null` if the
 * short-id is not in the registry — callers MUST treat this as a
 * coherence violation, not a soft warning.
 */
export function resolvePartyUrn(shortId: string): string | null {
  const entry = LEGAL_ENTITY_SHORT_ID_REGISTRY.find((e) => e.shortId === shortId);
  return entry ? entry.partyUrn : null;
}

/**
 * Returns the registry entry for a short-id, or `null` if unknown.
 */
export function lookupShortId(shortId: string): LegalEntityShortIdEntry | null {
  return LEGAL_ENTITY_SHORT_ID_REGISTRY.find((e) => e.shortId === shortId) ?? null;
}

/**
 * Returns true iff the short-id is in the registry AND has status
 * `active`. Used by `recon:entity-identity-coherence` as the assertion
 * predicate over every `event.entity` value.
 */
export function isActiveShortId(shortId: string): boolean {
  const entry = lookupShortId(shortId);
  return entry !== null && entry.status === "active";
}

/**
 * The complete set of active short-ids. Useful for whitelist-style
 * assertions and for migrating legacy hardcoded whitelists onto the
 * canonical registry.
 */
export const ACTIVE_SHORT_IDS: readonly string[] = LEGAL_ENTITY_SHORT_ID_REGISTRY.filter(
  (e) => e.status === "active",
).map((e) => e.shortId);
