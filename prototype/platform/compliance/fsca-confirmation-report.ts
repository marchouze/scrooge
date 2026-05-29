// platform/compliance/fsca-confirmation-report.ts
//
// FSCA Monthly Trade Confirmation Report — CS 2/2018 §8 (ORG-ODP-COND-006)
//
// CS 2/2018 §8(7) requires the bank to submit a monthly report to the FSCA
// within 10 business days of month-end showing, per product type and per
// client/counterparty, the number of OTC derivative transactions not confirmed
// within the Annexure A timelines:
//   - Standard products: T+1 business day
//   - Complex products:  T+5 business days
//
// "Standard products" are those listed in Annexure A of CS 2/2018 with a
// T+1 deadline: interest rate swaps (vanilla), FX forwards (vanilla), FX spot,
// equity securities, and debt securities (bonds).
//
// "Complex products" are those listed in Annexure A with a T+5 deadline:
// exotic options, structured products, and non-vanilla derivatives.
//
// This module is a pure function — it does not access the event store directly.
// The CLI script at scripts/render-fsca-confirmation-report.ts drives the
// event-store query and passes results in.
//
// Citations: CS 2/2018 §8 + ORG-ODP-COND-006
//
// Authority: ORG-ODP-COND-006 (CS 2/2018 §8(1)–(8))
// Authors: Mira (Compliance / RegTech engineer, engineering — reports to
//   Zara (Chief Compliance Officer, governance))

// ---------------------------------------------------------------------------
// Annexure A product classification
// CS 2/2018 §8 + Annexure A
// ---------------------------------------------------------------------------

/**
 * Standard products per CS 2/2018 Annexure A: T+1 business day confirmation
 * deadline. Vanilla IRS, vanilla FX forwards, FX spot, equities, bonds.
 * Citations: CS 2/2018 §8 + ORG-ODP-COND-006
 */
const STANDARD_PRODUCT_TYPES = new Set([
  "equity",
  "bond",
  "fx-spot",
  "fx-forward-vanilla",
  "irs-vanilla",
  "interest-rate-swap",
  "fx-spot",
  "fx-forward",
]);

/**
 * Complex products per CS 2/2018 Annexure A: T+5 business days confirmation
 * deadline. Exotic options, structured products, non-vanilla derivatives.
 * Citations: CS 2/2018 §8 + ORG-ODP-COND-006
 */
const COMPLEX_PRODUCT_TYPES = new Set([
  "exotic-option",
  "structured-product",
  "fx-option",
  "irs-exotic",
  "irs-non-vanilla",
  "swaption",
  "inflation-swap",
  "cross-currency-swap",
  "total-return-swap",
  "credit-default-swap",
  "cds",
  "trs",
  "variance-swap",
]);

/** Cutoff in business days per product complexity class. */
const CONFIRMATION_CUTOFF_DAYS: Record<"standard" | "complex", number> = {
  standard: 1,
  complex: 5,
};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * One row in the FSCA monthly confirmation report.
 * Per CS 2/2018 §8(7): grouped by product type and client/counterparty.
 * Citations: CS 2/2018 §8 + ORG-ODP-COND-006
 */
export interface FscaConfirmationReportLine {
  /** Period in YYYY-MM format. */
  readonly period: string;
  /** OTC product type (e.g. "irs-vanilla", "fx-spot", "exotic-option"). */
  readonly productType: string;
  /** Internal counterparty or client identifier. */
  readonly counterpartyId: string;
  /** Classification per CS 2/2018 §4: "client" or "counterparty". */
  readonly counterpartyCategory: "client" | "counterparty";
  /** Total OTC derivative transactions in the period for this group. */
  readonly tradesTotal: number;
  /** Transactions not confirmed within Annexure A timelines. */
  readonly tradesLateConfirmation: number;
}

/**
 * One trade confirmation record passed to the generator.
 * Derived from TradeBooked + ConfirmationMatched events in the event store.
 * Citations: CS 2/2018 §8 + ORG-ODP-COND-006
 */
export interface TradeConfirmationRecord {
  /** Internal trade identifier. */
  readonly tradeId: string;
  /** OTC product type (must match Annexure A taxonomy). */
  readonly productType: string;
  /** Internal counterparty or client identifier. */
  readonly counterpartyId: string;
  /** Classification per CS 2/2018 §4: "client" or "counterparty". */
  readonly counterpartyCategory: "client" | "counterparty";
  /**
   * ISO 8601 UTC timestamp of trade booking (TradeBooked.as_of).
   * T+0 starts from this timestamp.
   */
  readonly bookedAt: string;
  /**
   * ISO 8601 UTC timestamp of trade confirmation (ConfirmationMatched.as_of).
   * null when no ConfirmationMatched event exists for this trade in the period.
   */
  readonly confirmedAt: string | null;
}

/**
 * Input to the FSCA confirmation report generator.
 * Citations: CS 2/2018 §8 + ORG-ODP-COND-006
 */
export interface FscaConfirmationReportInput {
  /** Reporting period in YYYY-MM format (e.g. "2026-05"). */
  readonly period: string;
  /** Trade confirmation records for the period. */
  readonly trades: readonly TradeConfirmationRecord[];
}

// ---------------------------------------------------------------------------
// Business-day helpers
// CS 2/2018 §8: "business day" — standard calendar days excluding weekends.
// South African public holidays are not yet codified in the substrate;
// the implementation currently counts only weekend exclusions (conservative:
// may under-count late confirmations on public-holiday adjacencies).
// Substrate gap: integrate SA public-holiday calendar (reserve-bank calendar)
// to make business-day counting fully accurate.
// ---------------------------------------------------------------------------

/**
 * Return true if the given Date is a weekend (Saturday or Sunday).
 * Citations: CS 2/2018 §8 + ORG-ODP-COND-006
 */
function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Count the number of business days elapsed between two ISO 8601 UTC
 * timestamps. The count is inclusive of the end date if it is a business day.
 *
 * "Business days elapsed" per CS 2/2018 §8: if trade is booked Monday
 * and confirmed Tuesday, that is T+1. If booked Friday and confirmed the
 * following Monday, that is also T+1 (weekend excluded).
 *
 * Edge: if bookedAt > confirmedAt the function returns 0 (treated as same-day).
 *
 * Citations: CS 2/2018 §8 + ORG-ODP-COND-006
 */
export function businessDaysElapsed(bookedAt: string, confirmedAt: string): number {
  const start = new Date(bookedAt);
  const end = new Date(confirmedAt);
  if (end <= start) return 0;

  let count = 0;
  const cursor = new Date(start);
  // Move to next day after booking (T+0 = booking day, T+1 = next business day)
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  while (cursor <= end) {
    if (!isWeekend(cursor)) {
      count++;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Product complexity classification
// ---------------------------------------------------------------------------

/**
 * Classify a product type as "standard" or "complex" per CS 2/2018 Annexure A.
 * Unrecognised product types default to "complex" (conservative — assumes T+5).
 * Citations: CS 2/2018 §8 + ORG-ODP-COND-006
 */
export function classifyProductComplexity(productType: string): "standard" | "complex" {
  const normalised = productType.toLowerCase().trim();
  if (STANDARD_PRODUCT_TYPES.has(normalised)) return "standard";
  if (COMPLEX_PRODUCT_TYPES.has(normalised)) return "complex";
  // Default conservative: treat unknown as complex (T+5 cutoff)
  return "complex";
}

/**
 * Return true if the trade was confirmed late per CS 2/2018 Annexure A.
 *   - Standard products: late if confirmedAt is more than T+1 business days after bookedAt
 *   - Complex products:  late if confirmedAt is more than T+5 business days after bookedAt
 *   - Not yet confirmed (confirmedAt = null): always late
 *
 * Citations: CS 2/2018 §8 + ORG-ODP-COND-006
 */
export function isLateConfirmation(trade: TradeConfirmationRecord): boolean {
  if (trade.confirmedAt === null) return true;
  const complexity = classifyProductComplexity(trade.productType);
  const cutoff = CONFIRMATION_CUTOFF_DAYS[complexity];
  const elapsed = businessDaysElapsed(trade.bookedAt, trade.confirmedAt);
  return elapsed > cutoff;
}

// ---------------------------------------------------------------------------
// Generator (pure function)
// ---------------------------------------------------------------------------

/**
 * Generate the FSCA monthly trade confirmation report per CS 2/2018 §8(7).
 *
 * Pure function — no I/O. Aggregates trade confirmation records by
 * (productType, counterpartyId, counterpartyCategory) and counts how many
 * were confirmed late per Annexure A timelines.
 *
 * Returns one row per unique (productType, counterpartyId, counterpartyCategory)
 * combination, sorted by productType then counterpartyId.
 *
 * Citations: CS 2/2018 §8 + ORG-ODP-COND-006
 */
export function generateFscaConfirmationReport(
  input: FscaConfirmationReportInput,
): FscaConfirmationReportLine[] {
  const { period, trades } = input;

  // Group by (productType, counterpartyId, counterpartyCategory)
  type GroupKey = string;
  interface GroupAccumulator {
    productType: string;
    counterpartyId: string;
    counterpartyCategory: "client" | "counterparty";
    tradesTotal: number;
    tradesLateConfirmation: number;
  }

  const groups = new Map<GroupKey, GroupAccumulator>();

  for (const trade of trades) {
    const key: GroupKey = `${trade.productType}|${trade.counterpartyId}|${trade.counterpartyCategory}`;
    const existing = groups.get(key);
    const late = isLateConfirmation(trade) ? 1 : 0;
    if (existing) {
      existing.tradesTotal += 1;
      existing.tradesLateConfirmation += late;
    } else {
      groups.set(key, {
        productType: trade.productType,
        counterpartyId: trade.counterpartyId,
        counterpartyCategory: trade.counterpartyCategory,
        tradesTotal: 1,
        tradesLateConfirmation: late,
      });
    }
  }

  // Convert to output rows, sorted for deterministic output
  const lines: FscaConfirmationReportLine[] = [...groups.values()]
    .sort((a, b) => {
      const byProduct = a.productType.localeCompare(b.productType);
      if (byProduct !== 0) return byProduct;
      return a.counterpartyId.localeCompare(b.counterpartyId);
    })
    .map((g) => ({
      period,
      productType: g.productType,
      counterpartyId: g.counterpartyId,
      counterpartyCategory: g.counterpartyCategory,
      tradesTotal: g.tradesTotal,
      tradesLateConfirmation: g.tradesLateConfirmation,
    }));

  return lines;
}
