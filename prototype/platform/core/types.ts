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
export const BANK_ZA_001 = "LE-ZA-HOZ-BANK" as LegalEntity;

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
