import type { Brand } from "../types/brand.ts";
import type { UtcTimestamp } from "../types/time.ts";

export type Urn = Brand<string, "Urn">;

export const urn = (s: string): Urn => {
  if (!s.startsWith("oblig:")) {
    throw new Error(`URN must start with "oblig:": ${s}`);
  }
  return s as Urn;
};

export interface Citation {
  readonly urn: Urn;
  readonly symbol: string;
  readonly controlId: string;
  readonly citedAt: UtcTimestamp;
}
