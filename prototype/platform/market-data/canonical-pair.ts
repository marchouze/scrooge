// platform/market-data/canonical-pair.ts
//
// FX-pair canonicalisation for **aggregation / display** sites.
//
// Problem: product control was showing `USD/ZAR` and `ZAR/USD` as
// separate buckets. They are economically the same pair quoted in
// opposite directions, and must aggregate together (Marc, 2026-05-21).
//
// This utility maps any (base, quote) input to a canonical
// (base, quote) representation per the CEO-approved precedence below,
// returning an `inverted` flag so callers can flip side-dependent
// quantities (P&L sign, buy/sell semantics, rate units).
//
// **Aggregation / display only.** Do NOT use this to rewrite stored
// events or market-data ingest direction — the event log is immutable
// (Principle 1) and the market-data store correctly preserves source
// direction (`sourceDirection: "direct" | "inverse"` at
// `prototype/platform/market-data/store.ts:223`). Canonicalisation is
// strictly a presentation/aggregation concern.
//
// Canonicalisation convention (CEO-approved 2026-05-21, market-convention
// default; brief: `brief:bea:fx-pair-canonicalisation-in-product-control-aggr:
// 2026-05-21`):
//
//   1. ZAR pairs: the **foreign** currency is base.
//      → USD/ZAR stays USD/ZAR; ZAR/USD → USD/ZAR (inverted).
//   2. Non-ZAR pairs: standard FX-market precedence —
//        EUR > GBP > AUD > NZD > USD > CHF > CAD > JPY > everything-else
//      The higher-precedence currency is base.
//   3. Tiebreak (currencies of equal precedence — rare in practice):
//      lexicographic-ascending.
//   4. Identity (base === quote): throws — degenerate input, callers
//      should never pass this.
//
// Note: this hierarchy differs from the ACI advisory ordering in
// `platform/recon/fx-pair-direction.ts` (CAD > CHF > JPY). The two
// coexist: this utility is the **aggregation** authority for buckets;
// `fx-pair-direction.ts` is the **wire convention** advisory for sim/
// seed pairs. For the only material divergence (CHF vs CAD), both
// agree that USD-based pairs canonicalise as USD/CHF and USD/CAD —
// the difference only matters for the (currently non-existent) cross
// CHF/CAD or CAD/CHF, which is flagged as a follow-on if it ever lands.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - brief:bea:fx-pair-canonicalisation-in-product-control-aggr:2026-05-21
//     (CEO-approved 2026-05-21, market-convention default)
//   - ACI Model Code §2 (currency-pair quotation convention; reference)
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

// ---------------------------------------------------------------------------
// Precedence table
// ---------------------------------------------------------------------------

/**
 * CEO-approved precedence (2026-05-21). Currency listed earlier outranks
 * (i.e. is base against) currency listed later. Currencies not in the list
 * sit below every listed currency.
 *
 * Special-case: ZAR is included explicitly so that ZAR/non-ZAR pairs
 * always resolve with the foreign currency as base. Every non-ZAR currency
 * not in the table outranks ZAR by the trailing "everything else > ZAR"
 * rule encoded below.
 */
const PRECEDENCE: readonly string[] = [
  "EUR",
  "GBP",
  "AUD",
  "NZD",
  "USD",
  "CHF",
  "CAD",
  "JPY",
];

/**
 * Returns the rank of a currency in the precedence table.
 * Lower number = higher precedence (more likely to be base).
 *
 * - Currencies in PRECEDENCE: 0..N-1
 * - ZAR: a sentinel "below everything" value (Number.MAX_SAFE_INTEGER)
 *   so any non-ZAR currency (listed or not) outranks ZAR.
 * - All other unlisted currencies: a single "unranked" tier just above
 *   ZAR, broken by lexicographic-ascending order in the tiebreak.
 */
function precedenceRank(ccy: string): number {
  const i = PRECEDENCE.indexOf(ccy);
  if (i !== -1) return i;
  if (ccy === "ZAR") return Number.MAX_SAFE_INTEGER;
  // All other unranked currencies share one tier (immediately above ZAR),
  // broken by lex order at the tiebreak step. Use a large but finite
  // sentinel below ZAR's sentinel.
  return Number.MAX_SAFE_INTEGER - 1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CanonicalPair {
  /** Base currency in canonical form. */
  readonly base: string;
  /** Quote currency in canonical form. */
  readonly quote: string;
  /** Slash-separated key suitable for use as a Map key or display string. */
  readonly pairKey: string;
  /**
   * True iff the input (base, quote) was the *inverse* of canonical. When
   * true, callers aggregating side-dependent quantities (P&L sign, buy/sell)
   * must flip those before bucketing.
   *
   * Example: input ("ZAR", "USD") → canonical ("USD", "ZAR"), inverted=true.
   * A trade booked as "buy ZAR/USD" should aggregate into the USD/ZAR bucket
   * with the side flipped to "sell" — economically the same as a sell USD/ZAR.
   */
  readonly inverted: boolean;
}

/**
 * Resolve the canonical (base, quote) for an FX pair.
 *
 * @throws RangeError if `base === quote` (degenerate identity pair).
 */
export function toCanonicalPair(base: string, quote: string): CanonicalPair {
  if (!base || !quote) {
    throw new RangeError(
      `toCanonicalPair: base and quote must be non-empty strings (got base="${base}", quote="${quote}")`,
    );
  }
  if (base === quote) {
    throw new RangeError(
      `toCanonicalPair: identity pair "${base}/${quote}" is degenerate — base and quote must differ`,
    );
  }

  const rb = precedenceRank(base);
  const rq = precedenceRank(quote);

  if (rb < rq) {
    return {
      base,
      quote,
      pairKey: `${base}/${quote}`,
      inverted: false,
    };
  }
  if (rb > rq) {
    return {
      base: quote,
      quote: base,
      pairKey: `${quote}/${base}`,
      inverted: true,
    };
  }

  // Equal precedence (both unranked, neither is ZAR). Lex-ascending tiebreak.
  if (base < quote) {
    return {
      base,
      quote,
      pairKey: `${base}/${quote}`,
      inverted: false,
    };
  }
  return {
    base: quote,
    quote: base,
    pairKey: `${quote}/${base}`,
    inverted: true,
  };
}

/**
 * Convenience: returns just the canonical pair-key string.
 * Use `toCanonicalPair(...).pairKey` directly if you also need the
 * `inverted` flag.
 */
export function toCanonicalPairKey(base: string, quote: string): string {
  return toCanonicalPair(base, quote).pairKey;
}

/**
 * Side-aware: returns the canonical side ("buy" | "sell") for a trade
 * whose (base, quote) was either kept or inverted by `toCanonicalPair`.
 *
 * When the pair is inverted, a "buy" of the input pair is economically
 * a "sell" of the canonical pair (and vice versa) — because buying X/Y
 * is selling Y/X.
 *
 * Use at aggregation sites that bucket by canonical pair and need to
 * preserve P&L sign / direction across pair-direction flips.
 */
export function canonicalSide(
  side: "buy" | "sell",
  canonical: Pick<CanonicalPair, "inverted">,
): "buy" | "sell" {
  if (!canonical.inverted) return side;
  return side === "buy" ? "sell" : "buy";
}
