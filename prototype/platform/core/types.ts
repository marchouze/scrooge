// platform/core/types.ts
//
// Branded type primitives that encode P5 (multi-currency, multi-entity,
// multi-jurisdiction) at the type level. Values that should never be mixed
// (e.g. ZAR with USD, Bank entity with Subsidiary entity) are non-assignable
// without an explicit, registered transformation.
//
// Author: Atlas

declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

// ---------- Currency ----------
/**
 * ISO 4217 currency code, branded to prevent accidental mixing of ZAR/USD amounts.
 * @see https://spec.edmcouncil.org/fibo/ontology/FND/Accounting/ISO4217-CurrencyCodes/ (FIBO FND)
 */
export type Currency = Brand<string, "Currency">;
export const ZAR = "ZAR" as Currency;
export const USD = "USD" as Currency;
export const EUR = "EUR" as Currency;
export const GBP = "GBP" as Currency;

// ---------- Legal entity ----------
// Every event, account, position, and contract belongs to a specific legal
// entity in a versioned legal-entity tree.
/**
 * Branded legal entity identifier — ties every event to a specific legal entity.
 * @see https://spec.edmcouncil.org/fibo/ontology/BE/LegalEntities/LegalPersons/LegalPerson (FIBO BE)
 */
export type LegalEntity = Brand<string, "LegalEntity">;

/**
 * Canonical short-id for the bank's banking entity — Hoz Bank Limited.
 *
 * Maps to Party URN `urn:party:legal-entity:hoz-bank` in
 * `Regulations/_party-register.md` (canonical authority: D-PARTY-REGISTER,
 * CEO-approved 2026-05-11). The event-store `entity` field is a
 * denormalised short-id by design; the Party register URN is the canonical
 * identity, and this constant is its canonical short-form.
 *
 * The `LE-` prefix follows the legal-entity convention. "Hoz" is the
 * bank's registered name (D-BANK-NAME-SELECTION revised 2026-05-09).
 *
 * Authority for unification: Imani (Chief Legal Counsel, governance) per
 * legal-entity-tree authority; substrate-wide rewiring by Atlas (Core
 * banking platform architect, engineering). Decision recorded in PR
 * `feat(party): entity-identity unification — single canonical
 * identifier for the bank itself (WS-MARKET-RISK-PROCEDURES)`.
 *
 * Pre-unification the substrate carried two short-id forms in parallel:
 * `LE-ZA-HOZ-BANK` (BA-return whitelists, accounting period close) and
 * `BANK-ZA-001` (FX revaluation, daily P&L, SA-CCR, agent runtime
 * defaults). Both denoted the same legal entity; the divergence forced
 * a "mirror-block" workaround in the FX-spot scenario for BA-325. The
 * `BANK_ZA_001` symbol below is retained as a deprecated alias so
 * existing imports continue to compile; new code uses `HOZ_BANK_ENTITY`.
 *
 * @see Regulations/_party-register.md
 * @see https://spec.edmcouncil.org/fibo/ontology/BE/LegalEntities/LegalPersons/LegalPerson (FIBO BE)
 */
export const HOZ_BANK_ENTITY = "LE-ZA-HOZ-BANK" as LegalEntity;

/**
 * @deprecated Use {@link HOZ_BANK_ENTITY}. Retained for backward
 * compatibility during the entity-identity unification rollout; the
 * value is identical to `HOZ_BANK_ENTITY`. The `BANK-ZA-001`
 * non-canonical short-id has been retired — this alias now points at
 * the canonical `LE-ZA-HOZ-BANK`.
 */
export const BANK_ZA_001: LegalEntity = HOZ_BANK_ENTITY;

// ---------- Jurisdiction ----------
/**
 * ISO 3166-1 alpha-2 jurisdiction code, branded to prevent cross-jurisdiction confusion.
 * @see https://spec.edmcouncil.org/fibo/ontology/FND/Law/Jurisdiction/Jurisdiction (FIBO FND)
 */
export type Jurisdiction = Brand<string, "Jurisdiction">;
export const ZA = "ZA" as Jurisdiction;
export const US = "US" as Jurisdiction;
export const GB = "GB" as Jurisdiction;
export const EU = "EU" as Jurisdiction;

// ---------- Calendars ----------
// Every date carries its calendar (jurisdictional holidays).
export type Calendar = Brand<string, "Calendar">;
export const ZA_CAL = "ZA-CAL" as Calendar;

// ---------- Identity (typed actors) ----------
/**
 * Typed actor — staff-id, service-name, or system-component-id.
 * @see https://spec.edmcouncil.org/fibo/ontology/FBC/FunctionalEntities/FinancialServicesEntities/FinancialServicesProvider (FIBO FBC — broadMatch)
 */
export type ActorType = "system" | "human" | "service";
export interface Actor {
  readonly type: ActorType;
  readonly id: string; // staff-id, service-name, system-component-id
}

// ---------- Common time ----------
// ISO 8601 UTC. Internal timestamps are always UTC; presentation can localise.
/**
 * ISO 8601 UTC timestamp string, branded to prevent naive string assignment.
 * @see https://spec.edmcouncil.org/fibo/ontology/FND/DatesAndTimes/FinancialDates/DateTime (FIBO FND)
 */
export type IsoTimestamp = Brand<string, "IsoTimestamp">;

export function nowUtc(): IsoTimestamp {
  return new Date().toISOString() as IsoTimestamp;
}

export function asIso(d: Date | string): IsoTimestamp {
  return (typeof d === "string" ? d : d.toISOString()) as IsoTimestamp;
}

// ---------- Event identifiers ----------
export type EventId = Brand<string, "EventId">;
export function newEventId(): EventId {
  return crypto.randomUUID() as EventId;
}
