// scripts/agents/fx-twelvedata-parse.ts
//
// Pure parsing logic for Twelve Data /quote responses (batched, multi-symbol).
// Extracted into a separate module to enable unit testing without network calls.
//
// Twelve Data is the second free FX market-data source, added alongside
// open.er-api.com to give the tape intraday motion and to enable two-source
// IPV cross-checks. Free tier returns `close` as the live price (string)
// and a unix `timestamp`; bid/ask are paid-tier features, so the parser
// synthesises them from mid using the same 20bp spread convention as
// fx-rates-parse.ts.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RawTwelveDataQuote {
  pair: string; // "USD/ZAR"
  mid: number;
  bid: number;
  ask: number;
  /** Unix epoch seconds from the Twelve Data response. */
  timestamp: number;
  /** ISO-8601 UTC string derived from `timestamp`. */
  asOf: string;
}

// ---------------------------------------------------------------------------
// Target pairs
// ---------------------------------------------------------------------------

export const TWELVE_DATA_TARGET_PAIRS = [
  "USD/ZAR",
  "EUR/ZAR",
  "GBP/ZAR",
  "JPY/ZAR",
  "CHF/ZAR",
  "AUD/ZAR",
] as const;

// Same synthetic bid/ask spread as fx-rates-parse.ts — the free Twelve Data
// tier returns `close` only, no bid/ask depth.
const BID_FACTOR = 0.9998;
const ASK_FACTOR = 1.0002;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function parseNumber(v: unknown, field: string, pair: string): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  throw new Error(`parseTwelveDataQuoteResponse: invalid ${field} for ${pair} — got ${String(v)}`);
}

function parseOptionalNumber(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/**
 * Parse a Twelve Data multi-symbol /quote response.
 *
 * Expected input shape (free-tier, comma-separated `symbol` query):
 *   {
 *     "USD/ZAR": { symbol, close, timestamp, datetime, ... },
 *     "EUR/ZAR": { ... },
 *     ...
 *   }
 *
 * For single-symbol responses Twelve Data returns the quote object directly
 * (no symbol wrapper); this parser only supports the batched form because
 * the ingester always passes 6 symbols.
 *
 * Throws if the response is an API error envelope, the symbol map is
 * malformed, or any target pair is missing/invalid.
 */
export function parseTwelveDataQuoteResponse(json: unknown): RawTwelveDataQuote[] {
  if (typeof json !== "object" || json === null) {
    throw new Error("parseTwelveDataQuoteResponse: input is not an object");
  }
  const obj = json as Record<string, unknown>;

  // Twelve Data signals errors with { code, message, status: "error" }
  if (obj.status === "error" || typeof obj.code === "number") {
    throw new Error(`parseTwelveDataQuoteResponse: API error — ${String(obj.message ?? obj.code)}`);
  }

  const results: RawTwelveDataQuote[] = [];

  for (const pair of TWELVE_DATA_TARGET_PAIRS) {
    const entry = obj[pair];
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`parseTwelveDataQuoteResponse: missing entry for ${pair}`);
    }
    const quote = entry as Record<string, unknown>;

    // Per-symbol error envelopes carry { status: "error" } too.
    if (quote.status === "error") {
      throw new Error(
        `parseTwelveDataQuoteResponse: per-symbol error for ${pair} — ${String(quote.message ?? "unknown")}`,
      );
    }

    const mid = parseNumber(quote.close, "close", pair);
    const tsRaw = quote.timestamp;
    if (typeof tsRaw !== "number" || !Number.isFinite(tsRaw) || tsRaw <= 0) {
      throw new Error(
        `parseTwelveDataQuoteResponse: invalid timestamp for ${pair} — got ${String(tsRaw)}`,
      );
    }
    const timestamp = Math.floor(tsRaw);

    const bidActual = parseOptionalNumber(quote.bid);
    const askActual = parseOptionalNumber(quote.ask);

    results.push({
      pair,
      mid,
      bid: bidActual ?? mid * BID_FACTOR,
      ask: askActual ?? mid * ASK_FACTOR,
      timestamp,
      asOf: new Date(timestamp * 1000).toISOString(),
    });
  }

  return results;
}
