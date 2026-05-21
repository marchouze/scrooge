// scripts/agents/fx-twelvedata-parse.ts
//
// Pure parsing logic for Twelve Data /time_series responses (batched,
// multi-symbol). The /time_series endpoint returns hourly OHLC bars, giving
// genuine intraday price motion — each bar has a unique datetime, so each
// hourly polling cycle stores a fresh tick rather than deduping against an
// unchanged EOD snapshot (the /quote endpoint's free-tier behaviour).
//
// Free-tier credit cost: 1 credit per data point returned, per symbol.
// At outputsize=2, interval=1h: 2 bars × 6 symbols = 12 credits/run.
// At hourly cadence: 12 × 24 = 288 credits/day — well under the 800/day cap.
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
  /** Unix epoch seconds derived from the bar datetime (UTC). */
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
// tier returns close only, no bid/ask depth.
const BID_FACTOR = 0.9998;
const ASK_FACTOR = 1.0002;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseNumber(v: unknown, field: string, pair: string, ctx: string): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  throw new Error(
    `parseTwelveDataTimeSeriesResponse: invalid ${field} for ${pair} (${ctx}) — got ${String(v)}`,
  );
}

/**
 * Convert a Twelve Data datetime string ("YYYY-MM-DD HH:MM:SS", UTC) to
 * Unix epoch seconds. Twelve Data uses timezone=UTC on our requests, so
 * appending "Z" is correct.
 */
function datetimeToTimestamp(datetime: string, pair: string): number {
  const iso = `${datetime.replace(" ", "T")}Z`;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new Error(
      `parseTwelveDataTimeSeriesResponse: unparseable datetime for ${pair} — got ${datetime}`,
    );
  }
  return Math.floor(ms / 1000);
}

// ---------------------------------------------------------------------------
// Parser — /time_series (batched, multi-symbol)
// ---------------------------------------------------------------------------

/**
 * Parse a Twelve Data multi-symbol /time_series response.
 *
 * Expected input shape (free-tier, timezone=UTC, comma-separated symbol query):
 *   {
 *     "USD/ZAR": {
 *       meta: { symbol, interval, ... },
 *       values: [
 *         { datetime: "2026-05-21 18:00:00", open, high, low, close },
 *         ...  // newest-first
 *       ],
 *       status: "ok"
 *     },
 *     "EUR/ZAR": { ... },
 *     ...
 *   }
 *
 * Returns all bars across all pairs as a flat list of RawTwelveDataQuote.
 * The caller's dedup logic (id = source:pair:timestamp) handles idempotency.
 *
 * Throws on top-level API error, per-symbol error, missing pair, or invalid
 * bar data.
 */
export function parseTwelveDataTimeSeriesResponse(json: unknown): RawTwelveDataQuote[] {
  if (typeof json !== "object" || json === null) {
    throw new Error("parseTwelveDataTimeSeriesResponse: input is not an object");
  }
  const obj = json as Record<string, unknown>;

  // Top-level error envelope: { code, message, status: "error" }
  if (obj.status === "error" || typeof obj.code === "number") {
    throw new Error(
      `parseTwelveDataTimeSeriesResponse: API error — ${String(obj.message ?? obj.code)}`,
    );
  }

  const results: RawTwelveDataQuote[] = [];

  for (const pair of TWELVE_DATA_TARGET_PAIRS) {
    const entry = obj[pair];
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`parseTwelveDataTimeSeriesResponse: missing entry for ${pair}`);
    }
    const symbolData = entry as Record<string, unknown>;

    // Per-symbol error envelope.
    if (symbolData.status === "error") {
      throw new Error(
        `parseTwelveDataTimeSeriesResponse: per-symbol error for ${pair} — ${String(symbolData.message ?? "unknown")}`,
      );
    }

    if (!Array.isArray(symbolData.values) || symbolData.values.length === 0) {
      throw new Error(`parseTwelveDataTimeSeriesResponse: no values array for ${pair}`);
    }

    for (const bar of symbolData.values as unknown[]) {
      if (typeof bar !== "object" || bar === null) {
        throw new Error(`parseTwelveDataTimeSeriesResponse: non-object bar entry for ${pair}`);
      }
      const b = bar as Record<string, unknown>;

      if (typeof b.datetime !== "string" || b.datetime.trim() === "") {
        throw new Error(`parseTwelveDataTimeSeriesResponse: missing datetime for ${pair} bar`);
      }

      const timestamp = datetimeToTimestamp(b.datetime, pair);
      const mid = parseNumber(b.close, "close", pair, b.datetime);

      results.push({
        pair,
        mid,
        bid: mid * BID_FACTOR,
        ask: mid * ASK_FACTOR,
        timestamp,
        asOf: new Date(timestamp * 1000).toISOString(),
      });
    }
  }

  return results;
}
