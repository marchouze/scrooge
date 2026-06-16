import type { Brand } from "./brand.ts";

export type LegalEntityId = Brand<string, "LegalEntityId">;

export type Jurisdiction = Brand<string, "Jurisdiction">;

export const ZA = "ZA" as Jurisdiction;
export const US = "US" as Jurisdiction;
export const GB = "GB" as Jurisdiction;
export const EU = "EU" as Jurisdiction;

export interface LegalEntity {
  readonly id: LegalEntityId;
  readonly name: string;
  readonly jurisdiction: Jurisdiction;
  readonly parent: LegalEntityId | null;
  /**
   * The entity/branch's FUNCTIONAL currency (IAS-21) — the currency in which it
   * keeps its own books (REQUIRED, ISO-4217 alpha-3). "Foreign vs. domestic" is a
   * view-time comparison between a cash currency and THIS field, never a property
   * of an instrument: the same GBP balance is domestic to a UK branch (functional
   * GBP) and foreign to a SA branch (functional ZAR). Branches are child entities
   * via `parent`, each with their own functional currency (Principle 5; WS-MULTI-
   * BASE-CURRENCY, D-MULTI-BASE-CURRENCY-FOUNDATION). Distinct from the GROUP
   * PRESENTATION currency, which is a consolidation/view concern, not entity state.
   * Functional-currency assignment/change is event-sourced + versioned via the
   * typed `EntityFunctionalCurrencyAssigned` event (Principle 1).
   */
  readonly functionalCurrency: string;
}
