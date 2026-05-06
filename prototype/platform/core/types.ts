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
export type Currency = Brand<string, "Currency">;
export const ZAR = "ZAR" as Currency;
export const USD = "USD" as Currency;
export const EUR = "EUR" as Currency;
export const GBP = "GBP" as Currency;

// ---------- Legal entity ----------
// Every event, account, position, and contract belongs to a specific legal
// entity in a versioned legal-entity tree.
export type LegalEntity = Brand<string, "LegalEntity">;
export const BANK_ZA_001 = "BANK-ZA-001" as LegalEntity;

// ---------- Jurisdiction ----------
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
export type ActorType = "system" | "human" | "service";
export interface Actor {
  readonly type: ActorType;
  readonly id: string; // staff-id, service-name, system-component-id
}

// ---------- Common time ----------
// ISO 8601 UTC. Internal timestamps are always UTC; presentation can localise.
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
