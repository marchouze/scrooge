// v2-core/fil-models/ir/money-market/shared/mm-positions.ts
//
// Typed position interfaces for Phase 3b money-market instruments (asset class
// `ir`). These carry the minimal economic terms each model needs for amortised-
// cost valuation and daily-accrual performance — v2-native, no v1 imports.
//
// AMORTISED COST (banking-book IFRS-9): each instrument values at
//   principal + accrued effective-interest (EIR)
// in ITS OWN currency. There is NO discount curve here — discounting is reserved
// for the Phase 3c FVTPL bond. The `reporting` currency a money-market position
// values into is the instrument's OWN currency; any cross-currency reporting
// translation is a view-time concern resolved via the #1382 functional-currency
// resolver, never a hardcoded `?? "ZAR"` (WS-MULTI-BASE-CURRENCY).
//
// DECIMAL-NATIVE (D-V2-CORE-MONEY-DECIMAL-NATIVE): principal + accrued are
// MAJOR-unit canonical decimal strings, never minor-unit bigints. `accrualDays`
// is always supplied by the caller — no Date.now() here (wall-clock purity).
//
// Authority: D-V1-REMOVAL-PHASE-3B; D-ENGINEERING-INTEGRITY-CHARTER;
//   brief:atlas:v1-removal-phase-3b-alm-liquidity-on-v2-money-ma:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

/**
 * Direction of a money-market instrument from the BANK's perspective:
 *   asset     — the bank lends / places cash (IBL placement, reverse repo
 *               cash-out) → interest income, debit-natural carrying balance.
 *   liability — the bank borrows / takes cash (deposit taken, funding-line
 *               drawdown, classic repo) → interest expense, credit-natural.
 */
export type MoneyMarketDirection = "asset" | "liability";

/** Fields common to every amortised-cost money-market position. */
interface MoneyMarketPositionBase {
  /** ISO-4217 alpha-3 — the instrument's OWN currency (principal currency). */
  readonly currency: string;
  /** Principal, MAJOR-unit canonical decimal string, always POSITIVE. */
  readonly principal: string;
  /**
   * Accrued effective-interest to the as-of date, MAJOR-unit canonical decimal
   * string. The carrying amount = principal + accrued (asset) / principal +
   * accrued (liability); the sign is applied by the valuation method from
   * `direction`, never stored on `accrued`.
   */
  readonly accrued: string;
  /** Annual interest rate as a decimal (e.g. 0.0795 = 7.95% p.a.). */
  readonly rateDecimal: number;
  /** asset (bank lends) | liability (bank borrows). */
  readonly direction: MoneyMarketDirection;
  /**
   * Reporting currency the position values into — for a money-market amortised-
   * cost instrument this is the instrument's OWN currency. REQUIRED + fail-
   * closed (no `?? "ZAR"`); resolved at construction via the #1382
   * functional-currency resolver / set to the instrument currency. ISO-4217.
   */
  readonly reporting: string;
}

export interface MoneyMarketUnsecuredPosition extends MoneyMarketPositionBase {
  readonly kind: "money-market-unsecured";
  /** ISO-8601 maturity of the placement / drawdown (call placements: null). */
  readonly maturityDate: string | null;
}

export interface MoneyMarketDepositPosition extends MoneyMarketPositionBase {
  readonly kind: "money-market-deposit";
  /** Fixed-term deposits are always liabilities; direction pinned by the model. */
  readonly direction: "liability";
  readonly maturityDate: string;
}

export interface MoneyMarketRepoPosition extends MoneyMarketPositionBase {
  readonly kind: "money-market-repo";
  /** ISO-8601 end-leg (repurchase) settlement date. */
  readonly endLegSettlementDate: string;
}

export type MoneyMarketPosition =
  | MoneyMarketUnsecuredPosition
  | MoneyMarketDepositPosition
  | MoneyMarketRepoPosition;
