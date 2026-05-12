// platform/forward-obligations/types.ts
//
// Core types for the Forward Obligations projection.
//
// The Forward Obligations projection is a multi-source derived view of future
// events and obligations. It folds across existing event types and canonical
// registers rather than maintaining its own append-only register.
//
// Sources:
//   - regulatory-filing  : obligations register scheduled returns (daily/monthly/quarterly)
//   - trade-settlement   : booked FxTradeExecuted events, settlement date = T+2 business days
//   - policy-review      : policy review cycle triggers (future substrate)
//   - manual             : ForwardObligationRegistered events (ad-hoc items only)
//
// Design principles:
//   P1 — projection is a query over the event log; the event log is truth.
//   P2 — every obligation carries a relatedRef citing its source artefact.
//   P5 — cashflow amounts carry explicit ISO 4217 currency codes.
//   P6 — owner is an agent URN or role; no implied human actors.
//
// Author: Atlas (Core banking platform architect, engineering)

// ---------------------------------------------------------------------------
// Certainty spectrum
// ---------------------------------------------------------------------------

/** How certain is it that this obligation will materialise? */
export type ObligationCertainty = "certain" | "probable" | "estimated";

/**
 * Probability weights used by the liquidity view when netting cashflows.
 * certain=100%, probable=90%, estimated=60%.
 */
export const CERTAINTY_WEIGHTS: Record<ObligationCertainty, number> = {
  certain: 1.0,
  probable: 0.9,
  estimated: 0.6,
};

// ---------------------------------------------------------------------------
// Source discriminator
// ---------------------------------------------------------------------------

/** Which source system generated this forward obligation. */
export type ObligationSource =
  | "regulatory-filing" // obligations register — scheduled SARB / PA return
  | "trade-settlement" // booked trade pending physical settlement
  | "policy-review" // periodic policy review cycle trigger
  | "manual"; // manually registered ad-hoc item

// ---------------------------------------------------------------------------
// Core forward obligation shape
// ---------------------------------------------------------------------------

export interface ForwardObligation {
  /** Stable unique identifier for this obligation instance. */
  id: string;
  /** Human-readable description (e.g. "BA325 daily SARB return"). */
  title: string;
  /** Source system. */
  source: ObligationSource;
  /** ISO date (YYYY-MM-DD) when the obligation is due or settles. */
  dueDate: string;
  /** Certainty that this obligation will materialise. */
  certainty: ObligationCertainty;
  /** Agent URN (e.g. "agent:bea") or role string (e.g. "Camille (CFO, governance)"). */
  owner: string;
  /**
   * Financial impact — present only for obligations with a cashflow
   * (trade settlements, fee payments, etc.). Absent for regulatory
   * filings that carry no direct cash impact.
   */
  cashflow?: {
    /** Gross amount (before probability weighting). */
    amount: number;
    /** ISO 4217 currency code. */
    currency: string;
    direction: "inflow" | "outflow";
  };
  /**
   * Reference to the source artefact (Principle 2 citation chain).
   * e.g. trade ID, ORG-* obligation ID, policy ID.
   */
  relatedRef?: string;
  /** Optional free-text description. */
  description?: string;
}

// ---------------------------------------------------------------------------
// Horizon options
// ---------------------------------------------------------------------------

/**
 * Time horizon for the projection query.
 * Either a number of days from asOf, or an explicit from/to window.
 */
export type HorizonOpts =
  | { kind: "days"; days: number }
  | { kind: "range"; from: string; to: string };

// ---------------------------------------------------------------------------
// Pluggable view interface
// ---------------------------------------------------------------------------

/**
 * Every view implements this interface. Adding a third view (e.g. regulatory-
 * calendar, counterparty-exposure) requires only a new implementation here —
 * the projection core and the HTTP layer are untouched.
 */
export interface ForwardObligationView<T> {
  /** Stable view name used as the query param value (`?view=planning`). */
  name: string;
  /** Human-readable label for UI tab rendering. */
  label: string;
  /**
   * Fold all obligations in the horizon into the view's output shape.
   * @param obligations Sorted by dueDate ASC; filtered to horizon.
   * @param asOf        ISO datetime string of the projection run.
   */
  fold(obligations: ForwardObligation[], asOf: string): T;
}

// ---------------------------------------------------------------------------
// Planning view output
// ---------------------------------------------------------------------------

/** Date bucket for grouping items in the planning view. */
export type PlanningBucket = "today" | "this-week" | "this-month" | "later";

export interface PlanningViewRow {
  dueDate: string;
  title: string;
  owner: string;
  certainty: ObligationCertainty;
  source: ObligationSource;
  bucket: PlanningBucket;
  relatedRef?: string;
  description?: string;
}

export interface PlanningViewOutput {
  rows: PlanningViewRow[];
  /** Count by bucket for the summary panel. */
  bucketCounts: Record<PlanningBucket, number>;
  totalCount: number;
}

// ---------------------------------------------------------------------------
// Liquidity view output
// ---------------------------------------------------------------------------

export interface LiquidityViewItem {
  title: string;
  amount: number;
  /** Probability-weighted amount (amount × certainty weight). */
  weightedAmount: number;
  direction: "inflow" | "outflow";
  certainty: ObligationCertainty;
}

/**
 * Cashflows bucketed by date. Net flow is the probability-weighted sum:
 * positive = net inflow, negative = net outflow.
 */
export interface LiquidityViewBucket {
  date: string;
  /** ISO 4217 currency code (buckets are single-currency). */
  currency: string;
  /** Probability-weighted net flow for this date (+ inflow / − outflow). */
  netFlow: number;
  /** Sum of unweighted gross outflows (absolute). */
  grossOutflow: number;
  /** Sum of unweighted gross inflows. */
  grossInflow: number;
  items: LiquidityViewItem[];
}

export interface LiquidityViewOutput {
  buckets: LiquidityViewBucket[];
  /** Aggregate probability-weighted net flow across the entire horizon. */
  totalNetFlow: number;
  /** The reporting currency (first currency seen; multi-currency noted in buckets). */
  primaryCurrency: string;
  /** Number of obligations with cashflow in the horizon. */
  cashflowItemCount: number;
}
