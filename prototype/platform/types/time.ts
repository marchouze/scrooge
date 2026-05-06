import type { Brand } from "./brand.ts";

export type UtcTimestamp = Brand<string, "UtcTimestamp">;

export const utcNow = (): UtcTimestamp => new Date().toISOString() as UtcTimestamp;

export const utcFromDate = (d: Date): UtcTimestamp => d.toISOString() as UtcTimestamp;

export const utcFromString = (s: string): UtcTimestamp => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid timestamp: ${s}`);
  }
  return d.toISOString() as UtcTimestamp;
};

export interface AsOf {
  readonly at: UtcTimestamp;
}
