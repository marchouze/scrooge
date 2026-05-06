import type { Brand } from "./brand.ts";
import type { Currency } from "./currency.ts";
import type { UtcTimestamp } from "./time.ts";

export type RateSourceId = Brand<string, "RateSourceId">;

export interface FxRate {
  readonly base: Currency;
  readonly quote: Currency;
  readonly rate: bigint;
  readonly scale: number;
  readonly source: RateSourceId;
  readonly observedAt: UtcTimestamp;
}
