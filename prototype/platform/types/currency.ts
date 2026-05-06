import type { Brand } from "./brand.ts";

export type Currency = Brand<string, "Currency">;

export const ZAR = "ZAR" as Currency;
export const USD = "USD" as Currency;
export const EUR = "EUR" as Currency;
export const GBP = "GBP" as Currency;

export interface Money<C extends Currency = Currency> {
  readonly amount: bigint;
  readonly currency: C;
}

export const money = <C extends Currency>(amount: bigint, currency: C): Money<C> => ({
  amount,
  currency,
});

export const addSameCurrency = <C extends Currency>(a: Money<C>, b: Money<C>): Money<C> =>
  money(a.amount + b.amount, a.currency);

export const negate = <C extends Currency>(m: Money<C>): Money<C> => money(-m.amount, m.currency);

export const isZero = (m: Money): boolean => m.amount === 0n;
