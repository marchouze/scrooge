// platform/types/currency.ts
//
// Currency brand + the canonical money type. Historically this file carried a
// SECOND, divergent `Money` (scale-agnostic `bigint`, no rounding policy) that
// duplicated `platform/core/money.ts`. Under the decimal-money convergence
// (D-MONEY-DECIMAL-BUILD-PROCEED, slice 1) that duplicate is removed: the
// canonical money primitive is the exact-decimal `Money` in
// `platform/core/decimal-money.ts`, re-exported here so the two modules name
// the SAME type. (The bigint helpers previously here — `money`/`addSameCurrency`
// /`negate`/`isZero` — had no consumers and are deleted, not merely deprecated.)
//
// Author: Atlas (Core banking platform architect, engineering).

import type { Brand } from "./brand.ts";

export type Currency = Brand<string, "Currency">;

export const ZAR = "ZAR" as Currency;
export const USD = "USD" as Currency;
export const EUR = "EUR" as Currency;
export const GBP = "GBP" as Currency;

// Canonical money type — the SAME definition `platform/core/decimal-money.ts`
// exports. The two prior divergent `Money` types have converged to one. New
// code may import `Money` / `money` from either path.
export {
  type Money,
  money,
  zeroMoney,
  add as addSameCurrency,
  neg as negate,
  isZero,
} from "../core/decimal-money.ts";
