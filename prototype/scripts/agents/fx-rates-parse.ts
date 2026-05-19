// scripts/agents/fx-rates-parse.ts
//
// Pure parsing logic for open.er-api.com FX rate responses.
// Extracted into a separate module to enable unit testing without network calls.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION
// Author: Devon (Chief Operating Officer, engineering)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RawFxRate {
  pair: string; // "USD/ZAR"
  mid: number; // 1 / rates[quoteCcy]
  bid: number; // mid * 0.9998
  ask: number; // mid * 1.0002
  updateUtc: string; // time_last_update_utc from API response
}

// ---------------------------------------------------------------------------
// Target pairs
// ---------------------------------------------------------------------------

// Pairs to extract — base is always ZAR, quote is the foreign currency key
// in the API response. For USD/ZAR: mid = 1 / rates.USD.
const TARGET_QUOTE_CCYS = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD"] as const;

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse the open.er-api.com /v6/latest/ZAR JSON response and return
 * a RawFxRate for each of the six target pairs.
 *
 * Throws on malformed or unexpected input.
 */
export function parseFxRatesFromApiResponse(json: unknown): RawFxRate[] {
  if (typeof json !== "object" || json === null) {
    throw new Error("parseFxRatesFromApiResponse: input is not an object");
  }

  const obj = json as Record<string, unknown>;

  if (obj.result !== "success") {
    throw new Error(
      `parseFxRatesFromApiResponse: API result is not "success" — got ${String(obj.result)}`,
    );
  }

  if (obj.base_code !== "ZAR") {
    throw new Error(
      `parseFxRatesFromApiResponse: expected base_code "ZAR" — got ${String(obj.base_code)}`,
    );
  }

  const updateUtc = obj.time_last_update_utc;
  if (typeof updateUtc !== "string" || updateUtc.trim() === "") {
    throw new Error("parseFxRatesFromApiResponse: missing or invalid time_last_update_utc");
  }

  const rates = obj.rates;
  if (typeof rates !== "object" || rates === null) {
    throw new Error("parseFxRatesFromApiResponse: missing or invalid rates object");
  }

  const ratesMap = rates as Record<string, unknown>;
  const results: RawFxRate[] = [];

  for (const quoteCcy of TARGET_QUOTE_CCYS) {
    const raw = ratesMap[quoteCcy];
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
      throw new Error(
        `parseFxRatesFromApiResponse: invalid rate for ${quoteCcy} — got ${String(raw)}`,
      );
    }

    // API gives: 1 ZAR = raw <quoteCcy>
    // Conventional quote: <quoteCcy>/ZAR means "how many ZAR per 1 <quoteCcy>"
    const mid = 1 / raw;
    const bid = mid * 0.9998;
    const ask = mid * 1.0002;

    results.push({
      pair: `${quoteCcy}/ZAR`,
      mid,
      bid,
      ask,
      updateUtc: updateUtc.trim(),
    });
  }

  return results;
}
