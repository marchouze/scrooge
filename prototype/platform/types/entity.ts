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
}
