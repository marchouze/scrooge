// platform/core/iso4217.ts
//
// Complete ISO 4217 minor-unit exponent table. This is the single authority
// for WHERE rounding lands on a money amount (the boundary scale). It replaces
// the incomplete 4-entry `DECIMALS` stub in the legacy `core/money.ts`, which
// *threw* on every currency outside ZAR/USD/EUR/GBP (including JPY, KRW, BHD).
//
// Design spec: `2026-06-13_atlas_decimal-money-redenomination-design-spec.md`,
// §1.3 ("ISO 4217 exponent table as boundary authority"). Authority:
// D-MONEY-DECIMAL-REDENOMINATION, D-MONEY-DECIMAL-BUILD-PROCEED.
//
// Author: Atlas (Core banking platform architect, engineering).

import type { Currency } from "./types";

/**
 * ISO 4217 minor-unit exponents.
 *
 * The exponent is the number of decimal places the currency's minor unit
 * occupies (e.g. USD cents → 2; JPY → 0; BHD fils → 3). It is the canonical
 * boundary scale: full-precision arithmetic carries an arbitrary number of
 * decimals, and the exponent says how many survive at a settlement/display/
 * validation boundary.
 *
 * Source: ISO 4217:2015 Table A.1 (current funds & national currencies). Codes
 * not present here fall through to `EXPONENT_NO_MINOR_UNIT` and the policy
 * default (`DEFAULT_NO_MINOR_UNIT_EXPONENT`) — NEVER a throw (the legacy stub's
 * behaviour, which the redenomination removes).
 *
 * @see https://www.iso.org/iso-4217-currency-codes.html
 * @see https://spec.edmcouncil.org/fibo/ontology/FND/Accounting/ISO4217-CurrencyCodes/ (FIBO FND)
 */

/** Sentinel for currencies with no decimal minor unit (metals, some funds). */
export const EXPONENT_NO_MINOR_UNIT = "N.A." as const;

/**
 * Policy default scale applied to a no-minor-unit currency at a rounding
 * boundary. Metals (XAU/XAG/…) and unit-of-account codes (XDR) have no fixed
 * minor unit; rather than throw, the boundary degrades to this scale. The
 * design spec (§1.3) mandates "exponent absent → policy default, never
 * silent-throw". A call site may always override via an explicit
 * `RoundingContext.scale`.
 */
export const DEFAULT_NO_MINOR_UNIT_EXPONENT = 2;

export type Iso4217Exponent = 0 | 2 | 3 | 4 | typeof EXPONENT_NO_MINOR_UNIT;

/**
 * Currency → minor-unit exponent. Exhaustive over the active ISO 4217 set as
 * of 2026; new currencies are a one-line addition. Grouped by exponent for
 * auditability.
 */
export const ISO4217_EXPONENTS: Readonly<Record<string, Iso4217Exponent>> = Object.freeze({
  // ---- 0 decimal places (no minor unit in circulation) ----
  BIF: 0, // Burundi Franc
  CLP: 0, // Chilean Peso
  DJF: 0, // Djibouti Franc
  GNF: 0, // Guinea Franc
  ISK: 0, // Iceland Krona
  JPY: 0, // Yen
  KMF: 0, // Comorian Franc
  KRW: 0, // Won
  PYG: 0, // Guarani
  RWF: 0, // Rwanda Franc
  UGX: 0, // Uganda Shilling
  UYI: 0, // Uruguay Peso en Unidades Indexadas
  VND: 0, // Dong
  VUV: 0, // Vatu
  XAF: 0, // CFA Franc BEAC
  XOF: 0, // CFA Franc BCEAO
  XPF: 0, // CFP Franc

  // ---- 2 decimal places (the vast majority) ----
  AED: 2,
  AFN: 2,
  ALL: 2,
  AMD: 2,
  ANG: 2,
  AOA: 2,
  ARS: 2,
  AUD: 2,
  AWG: 2,
  AZN: 2,
  BAM: 2,
  BBD: 2,
  BDT: 2,
  BGN: 2,
  BMD: 2,
  BND: 2,
  BOB: 2,
  BRL: 2,
  BSD: 2,
  BTN: 2,
  BWP: 2,
  BYN: 2,
  BZD: 2,
  CAD: 2,
  CDF: 2,
  CHF: 2,
  CNY: 2,
  COP: 2,
  CRC: 2,
  CUP: 2,
  CVE: 2,
  CZK: 2,
  DKK: 2,
  DOP: 2,
  DZD: 2, // (Algerian Dinar — 2dp per ISO 4217)
  EGP: 2,
  ERN: 2,
  ETB: 2,
  EUR: 2,
  FJD: 2,
  FKP: 2,
  GBP: 2,
  GEL: 2,
  GHS: 2,
  GIP: 2,
  GMD: 2,
  GTQ: 2,
  GYD: 2,
  HKD: 2,
  HNL: 2,
  HRK: 2,
  HTG: 2,
  HUF: 2,
  IDR: 2,
  ILS: 2,
  INR: 2,
  IRR: 2,
  JMD: 2,
  KES: 2,
  KGS: 2,
  KHR: 2,
  KPW: 2,
  KYD: 2,
  KZT: 2,
  LAK: 2,
  LBP: 2,
  LKR: 2,
  LRD: 2,
  LSL: 2,
  MAD: 2,
  MDL: 2,
  MGA: 2,
  MKD: 2,
  MMK: 2,
  MNT: 2,
  MOP: 2,
  MRU: 2,
  MUR: 2,
  MVR: 2,
  MWK: 2,
  MXN: 2,
  MYR: 2,
  MZN: 2,
  NAD: 2,
  NGN: 2,
  NIO: 2,
  NOK: 2,
  NPR: 2,
  NZD: 2,
  PAB: 2,
  PEN: 2,
  PGK: 2,
  PHP: 2,
  PKR: 2,
  PLN: 2,
  QAR: 2,
  RON: 2,
  RSD: 2,
  RUB: 2,
  SAR: 2,
  SBD: 2,
  SCR: 2,
  SDG: 2,
  SEK: 2,
  SGD: 2,
  SHP: 2,
  SLE: 2,
  SOS: 2,
  SRD: 2,
  SSP: 2,
  STN: 2,
  SVC: 2,
  SYP: 2,
  SZL: 2,
  THB: 2,
  TJS: 2,
  TMT: 2,
  TOP: 2,
  TRY: 2,
  TTD: 2,
  TWD: 2,
  TZS: 2,
  UAH: 2,
  USD: 2,
  UYU: 2,
  UZS: 2,
  VES: 2,
  WST: 2,
  XCD: 2,
  YER: 2,
  ZAR: 2,
  ZMW: 2,
  ZWL: 2,

  // ---- 3 decimal places ----
  BHD: 3, // Bahraini Dinar
  IQD: 3, // Iraqi Dinar
  JOD: 3, // Jordanian Dinar
  KWD: 3, // Kuwaiti Dinar
  LYD: 3, // Libyan Dinar
  OMR: 3, // Rial Omani
  TND: 3, // Tunisian Dinar

  // ---- 4 decimal places (funds / units of account) ----
  CLF: 4, // Unidad de Fomento (Chile)
  UYW: 4, // Unidad Previsional (Uruguay)

  // ---- no minor unit (precious metals, units of account) ----
  XAU: EXPONENT_NO_MINOR_UNIT, // Gold (one troy ounce)
  XAG: EXPONENT_NO_MINOR_UNIT, // Silver
  XPT: EXPONENT_NO_MINOR_UNIT, // Platinum
  XPD: EXPONENT_NO_MINOR_UNIT, // Palladium
  XDR: EXPONENT_NO_MINOR_UNIT, // SDR (IMF special drawing right)
  XBA: EXPONENT_NO_MINOR_UNIT, // Bond Markets Unit European Composite Unit
  XBB: EXPONENT_NO_MINOR_UNIT,
  XBC: EXPONENT_NO_MINOR_UNIT,
  XBD: EXPONENT_NO_MINOR_UNIT,
  XTS: EXPONENT_NO_MINOR_UNIT, // reserved for testing
  XXX: EXPONENT_NO_MINOR_UNIT, // "no currency"
});

/**
 * The minor-unit exponent for a currency, as a sentinel-or-number. Use this
 * when you need to distinguish "no minor unit" from a numeric scale.
 */
export function iso4217Exponent(currency: Currency): Iso4217Exponent | undefined {
  return ISO4217_EXPONENTS[currency as string];
}

/**
 * The boundary SCALE (number of decimal places) for a currency. Never throws:
 *
 *  - known 0/2/3/4-dp currency → that exponent;
 *  - no-minor-unit currency (metals/funds) → `DEFAULT_NO_MINOR_UNIT_EXPONENT`;
 *  - unknown code → `DEFAULT_NO_MINOR_UNIT_EXPONENT` (logged-policy default,
 *    never the legacy throw).
 *
 * This is the function rounding boundaries call when they don't carry an
 * explicit `RoundingContext.scale`.
 */
export function scaleFor(currency: Currency): number {
  const exp = ISO4217_EXPONENTS[currency as string];
  if (exp === undefined || exp === EXPONENT_NO_MINOR_UNIT) {
    return DEFAULT_NO_MINOR_UNIT_EXPONENT;
  }
  return exp;
}

/** True if the currency code is present in the ISO 4217 table. */
export function isKnownCurrency(currency: Currency): boolean {
  return ISO4217_EXPONENTS[currency as string] !== undefined;
}

/** True if the currency has no decimal minor unit (metals / units of account). */
export function hasNoMinorUnit(currency: Currency): boolean {
  return ISO4217_EXPONENTS[currency as string] === EXPONENT_NO_MINOR_UNIT;
}
