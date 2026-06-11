// platform/market-data/feed-adapters.ts
//
// FTP live market-data feed adapter interfaces + stubs for the four rate
// families required by the FTP curve:
//
//   - ZaroniaFeedAdapter         — ZARONIA overnight rate (SARB)
//   - ZaroniaTermRateFeedAdapter — ZARONIA compounded term rates (SARB)
//   - JibarFeedAdapter           — JIBAR legacy fixing (AFMA/SARB CPD)
//   - OisCurveFeedAdapter        — OIS swap curve (JSE YieldX via rbond)
//   - SagbYieldFeedAdapter       — SA Government Bond benchmark yields (JSE YieldX)
//
// JIBAR CESSATION NOTE:
//   JIBAR new-trade cessation was May 2026; full cessation December 2026.
//   `JibarFeedAdapter` is retained as a legacy calibration anchor ONLY —
//   it supports existing JIBAR-linked trades during the transition window.
//   DO NOT use JIBAR as the basis for any new FTP curve design.
//   ZARONIA is the SA risk-free rate (RFR) replacement; all forward-looking
//   FTP logic must be ZARONIA-first.
//
// PRE-GO-LIVE CONCRETE ADAPTER:
//   `SarbRbondMarketDataAdapter` — a concrete, usable build-phase adapter
//   backed by two free, unauthenticated public SA data sources:
//     1. SARB SarbWebApi  — ZARONIA spot + repo rate + JIBAR CPD fixings
//     2. rbond.co.za      — SAGB benchmark yields, OIS curve, ZARONIA term rates
//   No authentication or commercial contract required for either source.
//   At vendor selection: replace with `BloombergMarketDataAdapter` or
//   `LsegMarketDataAdapter` (see stub injection contract comments below).
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE
// Author: Ravi (Treasury / ALM engineer, engineering)

// ---------------------------------------------------------------------------
// ZARONIA overnight rate
//
// SARB publishes ZARONIA daily at 10:00 SAST (resbank.co.za/ZARONIA).
// ZARONIA is the SA risk-free rate (RFR) — replacement for JIBAR from Dec 2026.
// Bloomberg field: "ZARONIA Index"
// ---------------------------------------------------------------------------

export interface ZaroniaFeedAdapter {
  /** Fetch the ZARONIA overnight rate for the given date (YYYY-MM-DD).
   *  Returns null when no rate is available (weekend / holiday / network failure). */
  fetchRate(
    asOf: string,
  ): Promise<{ rate: number; publicationDate: string; source: string } | null>;
}

// ---------------------------------------------------------------------------
// ZARONIA compounded term rates
//
// SARB publishes backward-looking compounded ZARONIA averages at 10:00 SAST.
// These are the preferred floating-leg inputs for FTP curve construction —
// use these, not JIBAR fixings, for any new trade or curve design.
// Bloomberg field: "ZARC3M Index" (3M), "ZARC1M Index" (1M), etc.
// ---------------------------------------------------------------------------

export interface ZaroniaTermRateFeedAdapter {
  /** Fetch a ZARONIA compounded term rate for the given tenor and date.
   *  Returns null when unavailable. */
  fetchTermRate(
    tenor: "1W" | "1M" | "3M" | "6M" | "9M" | "12M",
    asOf: string,
  ): Promise<{ rate: number; tenor: string; publicationDate: string; source: string } | null>;
}

// ---------------------------------------------------------------------------
// JIBAR legacy fixing
//
// WIND-DOWN: new JIBAR-linked trades ceased May 2026; full cessation Dec 2026.
// This interface is retained ONLY as a legacy calibration anchor for existing
// JIBAR-referenced instruments during the transition window.
// DO NOT use for new FTP curve design or new trade structuring.
// Bloomberg field: "JIBAR3M Index" (3M)
// ---------------------------------------------------------------------------

export interface JibarFeedAdapter {
  /** Fetch the JIBAR fixing for the given tenor and date.
   *  Returns null when unavailable.
   *  @deprecated Legacy calibration anchor only — JIBAR cessation Dec 2026. */
  fetchFixing(
    tenor: "1M" | "3M" | "6M" | "12M",
    asOf: string,
  ): Promise<{ rate: number; tenor: string; fixingDate: string; source: string } | null>;
}

// ---------------------------------------------------------------------------
// OIS / swap curve
//
// ZARONIA-based overnight index swap rates, bootstrapped from JSE YieldX data.
// rbond.co.za provides daily JSON snapshots from the JSE YieldX composite.
// Bloomberg curve: "ZAOIS" curve
// ---------------------------------------------------------------------------

export interface OisCurveFeedAdapter {
  /** Fetch the OIS curve for the given date.
   *  Returns null when unavailable. */
  fetchCurve(asOf: string): Promise<{
    pillars: Array<{ tenor: string; rate: number }>;
    curveDate: string;
    source: string;
  } | null>;
}

// ---------------------------------------------------------------------------
// SA Government Bond benchmark yields
//
// JSE YieldX daily close for SAGB benchmarks (1Y–30Y).
// rbond.co.za /api/v1/generics endpoint provides standard-tenor grid.
// Bloomberg generics: "GSAB 1 Govt" (1Y) … "GSAB 30 Govt" (30Y)
// ---------------------------------------------------------------------------

export interface SagbYieldFeedAdapter {
  /** Fetch SA Government Bond benchmark yields for the given date.
   *  Returns null when unavailable. */
  fetchBenchmarkYields(asOf: string): Promise<{
    yields: Array<{ tenor: string; yieldPct: number; isin?: string }>;
    settleDate: string;
    source: string;
  } | null>;
}

// ---------------------------------------------------------------------------
// Stub implementations — "wire-up only at unlock"
//
// Each stub implements the interface by returning null with a comment
// documenting the injection contract (which commercial vendor field maps
// to each method at go-live: Bloomberg or LSEG).
//
// At vendor selection:
//   - Replace `SarbRbondMarketDataAdapter` (build-phase) with a concrete
//     `BloombergMarketDataAdapter` or `LsegMarketDataAdapter` that implements
//     all five interfaces identically — zero changes to the ingest handlers.
// ---------------------------------------------------------------------------

/**
 * Stub ZARONIA overnight adapter.
 * Go-live: swap for a concrete adapter reading Bloomberg "ZARONIA Index"
 * or LSEG RIC "ZARONIA=SARB".
 */
export class StubZaroniaFeedAdapter implements ZaroniaFeedAdapter {
  // Injection contract: Bloomberg "ZARONIA Index" → override-daily field value
  async fetchRate(_asOf: string): Promise<{ rate: number; publicationDate: string; source: string } | null> {
    return null;
  }
}

/**
 * Stub ZARONIA term-rate adapter.
 * Go-live: swap for a concrete adapter reading Bloomberg "ZARC3M Index",
 * "ZARC1M Index", "ZARC6M Index", etc. per tenor.
 */
export class StubZaroniaTermRateFeedAdapter implements ZaroniaTermRateFeedAdapter {
  // Injection contract: Bloomberg "ZARC{tenor} Index" → rate field
  async fetchTermRate(
    _tenor: "1W" | "1M" | "3M" | "6M" | "9M" | "12M",
    _asOf: string,
  ): Promise<{ rate: number; tenor: string; publicationDate: string; source: string } | null> {
    return null;
  }
}

/**
 * Stub JIBAR fixing adapter (legacy — cessation Dec 2026).
 * Go-live: swap for a concrete adapter reading Bloomberg "JIBAR3M Index"
 * or AFMA API for remaining legacy-calibration needs.
 * @deprecated Legacy calibration anchor only — JIBAR cessation Dec 2026.
 */
export class StubJibarFeedAdapter implements JibarFeedAdapter {
  // Injection contract: Bloomberg "JIBAR{tenor} Index" → last field value
  async fetchFixing(
    _tenor: "1M" | "3M" | "6M" | "12M",
    _asOf: string,
  ): Promise<{ rate: number; tenor: string; fixingDate: string; source: string } | null> {
    return null;
  }
}

/**
 * Stub OIS curve adapter.
 * Go-live: swap for a concrete adapter reading Bloomberg "ZAOIS" OIS curve
 * or LSEG ZAR OIS swap composite.
 */
export class StubOisCurveFeedAdapter implements OisCurveFeedAdapter {
  // Injection contract: Bloomberg ZAOIS curve → pillars array (tenor, rate)
  async fetchCurve(_asOf: string): Promise<{
    pillars: Array<{ tenor: string; rate: number }>;
    curveDate: string;
    source: string;
  } | null> {
    return null;
  }
}

/**
 * Stub SAGB yield adapter.
 * Go-live: swap for a concrete adapter reading Bloomberg "GSAB" generics
 * (e.g. "GSAB 1 Govt" through "GSAB 30 Govt") or JSE Debt Market feed.
 */
export class StubSagbYieldFeedAdapter implements SagbYieldFeedAdapter {
  // Injection contract: Bloomberg GSAB generics → yields array (tenor, yieldPct, ISIN)
  async fetchBenchmarkYields(_asOf: string): Promise<{
    yields: Array<{ tenor: string; yieldPct: number; isin?: string }>;
    settleDate: string;
    source: string;
  } | null> {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SarbRbondMarketDataAdapter
//
// Build-phase concrete adapter — SARB SarbWebApi + rbond.co.za.
//
// Two free, unauthenticated public SA data sources:
//
//   1. SARB SarbWebApi (https://custom.resbank.co.za/SarbWebApi/WebIndicators/)
//      - CurrentMarketRates  — ZARONIA overnight + repo rate spot
//      - CPDRates            — JIBAR fixings (CPD = Capital Price Discovery)
//      No authentication required. JSON format.
//
//   2. rbond.co.za (https://rbond.co.za/api/v1/)
//      - rates/latest        — all instruments incl. ZARONIA, SAGB, OIS
//      - generics            — SAGB yields at standard tenors (1Y–30Y)
//      - curve/{date}        — full sovereign curve on any date
//      60 req/min unauthenticated. JSON. History from 2018.
//
// Strategy per method:
//   fetchRate        — SARB SarbWebApi CurrentMarketRates (primary),
//                      falls back to rbond rates/latest
//   fetchTermRate    — rbond rates/latest ZARONIA compounded averages
//   fetchFixing      — SARB SarbWebApi CPDRates (JIBAR legacy)
//   fetchCurve       — rbond curve/{date} OIS pillars
//   fetchBenchmarkYields — rbond generics SAGB tenors
//
// Every method has a try/catch; returns null on parse error, network failure,
// or missing field. Ingest handlers fall back to fixture data when null.
//
// At vendor selection: replace with BloombergMarketDataAdapter or
// LsegMarketDataAdapter implementing the same five interfaces.
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE
// ---------------------------------------------------------------------------

const SARB_BASE = "https://custom.resbank.co.za/SarbWebApi/WebIndicators";
const RBOND_BASE = "https://rbond.co.za/api/v1";

export class SarbRbondMarketDataAdapter
  implements
    ZaroniaFeedAdapter,
    ZaroniaTermRateFeedAdapter,
    JibarFeedAdapter,
    OisCurveFeedAdapter,
    SagbYieldFeedAdapter
{
  // -------------------------------------------------------------------------
  // ZaroniaFeedAdapter.fetchRate
  // Primary: SARB SarbWebApi CurrentMarketRates → ZARONIA field
  // Fallback: rbond rates/latest → ZARONIA overnight
  // -------------------------------------------------------------------------

  async fetchRate(
    asOf: string,
  ): Promise<{ rate: number; publicationDate: string; source: string } | null> {
    // Primary: SARB SarbWebApi
    try {
      const res = await fetch(`${SARB_BASE}/CurrentMarketRates`);
      if (res.ok) {
        const data = (await res.json()) as unknown;
        const rate = extractSarbZaronia(data);
        if (rate !== null) {
          return { rate, publicationDate: asOf, source: "sarb-sarbwebapi" };
        }
      }
    } catch {
      // fall through to rbond
    }

    // Fallback: rbond rates/latest
    try {
      const res = await fetch(`${RBOND_BASE}/rates/latest`);
      if (res.ok) {
        const data = (await res.json()) as unknown;
        const rate = extractRbondZaroniaON(data);
        if (rate !== null) {
          return { rate, publicationDate: asOf, source: "rbond-rates-latest" };
        }
      }
    } catch {
      // give up
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // ZaroniaTermRateFeedAdapter.fetchTermRate
  // Source: rbond rates/latest → ZARONIA compounded averages by tenor
  // -------------------------------------------------------------------------

  async fetchTermRate(
    tenor: "1W" | "1M" | "3M" | "6M" | "9M" | "12M",
    asOf: string,
  ): Promise<{ rate: number; tenor: string; publicationDate: string; source: string } | null> {
    try {
      const res = await fetch(`${RBOND_BASE}/rates/latest`);
      if (!res.ok) return null;
      const data = (await res.json()) as unknown;
      const rate = extractRbondZaroniaTermRate(data, tenor);
      if (rate === null) return null;
      return { rate, tenor, publicationDate: asOf, source: "rbond-rates-latest" };
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // JibarFeedAdapter.fetchFixing (legacy — cessation Dec 2026)
  // Source: SARB SarbWebApi CPDRates → JIBAR fixing by tenor
  // -------------------------------------------------------------------------

  async fetchFixing(
    tenor: "1M" | "3M" | "6M" | "12M",
    asOf: string,
  ): Promise<{ rate: number; tenor: string; fixingDate: string; source: string } | null> {
    try {
      const res = await fetch(`${SARB_BASE}/CPDRates`);
      if (!res.ok) return null;
      const data = (await res.json()) as unknown;
      const rate = extractSarbJibar(data, tenor);
      if (rate === null) return null;
      return { rate, tenor, fixingDate: asOf, source: "sarb-cpd-rates" };
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // OisCurveFeedAdapter.fetchCurve
  // Source: rbond curve/{date} → OIS swap pillars
  // -------------------------------------------------------------------------

  async fetchCurve(asOf: string): Promise<{
    pillars: Array<{ tenor: string; rate: number }>;
    curveDate: string;
    source: string;
  } | null> {
    try {
      const res = await fetch(`${RBOND_BASE}/curve/${asOf}`);
      if (!res.ok) return null;
      const data = (await res.json()) as unknown;
      const pillars = extractRbondOisPillars(data);
      if (pillars === null || pillars.length === 0) return null;
      return { pillars, curveDate: asOf, source: "rbond-curve" };
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // SagbYieldFeedAdapter.fetchBenchmarkYields
  // Source: rbond generics → SAGB benchmark yields
  // -------------------------------------------------------------------------

  async fetchBenchmarkYields(asOf: string): Promise<{
    yields: Array<{ tenor: string; yieldPct: number; isin?: string }>;
    settleDate: string;
    source: string;
  } | null> {
    try {
      const res = await fetch(`${RBOND_BASE}/generics`);
      if (!res.ok) return null;
      const data = (await res.json()) as unknown;
      const yields = extractRbondSagbYields(data);
      if (yields === null || yields.length === 0) return null;
      return { yields, settleDate: asOf, source: "rbond-generics" };
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Parser helpers — isolated per source, each defensive (returns null on error)
// ---------------------------------------------------------------------------

/**
 * Extract the ZARONIA overnight rate from SARB SarbWebApi CurrentMarketRates.
 * The API returns an array of objects; we look for a record whose Description
 * (or Name) field contains "ZARONIA" and extract the numeric rate.
 */
function extractSarbZaronia(data: unknown): number | null {
  try {
    if (!Array.isArray(data)) return null;
    for (const item of data) {
      if (typeof item !== "object" || item === null) continue;
      const obj = item as Record<string, unknown>;
      const desc = String(obj["Description"] ?? obj["Name"] ?? "").toUpperCase();
      if (desc.includes("ZARONIA")) {
        const raw = obj["Value"] ?? obj["Rate"] ?? obj["CurrentValue"];
        const n = Number(raw);
        if (!Number.isNaN(n) && n > 0) return n / 100; // API returns percentage
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract ZARONIA overnight from rbond rates/latest.
 * rbond returns a JSON object keyed by instrument name.
 */
function extractRbondZaroniaON(data: unknown): number | null {
  try {
    if (typeof data !== "object" || data === null) return null;
    const obj = data as Record<string, unknown>;
    // Try common key patterns for ZARONIA overnight
    for (const key of Object.keys(obj)) {
      if (key.toUpperCase().includes("ZARONIA") && !key.toUpperCase().includes("COMP")) {
        const n = Number(obj[key]);
        if (!Number.isNaN(n) && n > 0) return n > 1 ? n / 100 : n; // normalise %
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract ZARONIA compounded term rate from rbond rates/latest.
 * Looks for keys matching the tenor pattern (e.g. "ZARONIA_3M", "ZARC3M", etc.)
 */
function extractRbondZaroniaTermRate(data: unknown, tenor: string): number | null {
  try {
    if (typeof data !== "object" || data === null) return null;
    const obj = data as Record<string, unknown>;
    const tenorUpper = tenor.toUpperCase();
    for (const key of Object.keys(obj)) {
      const k = key.toUpperCase();
      if ((k.includes("ZARONIA") || k.includes("ZARC")) && k.includes(tenorUpper)) {
        const n = Number(obj[key]);
        if (!Number.isNaN(n) && n > 0) return n > 1 ? n / 100 : n;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract JIBAR fixing from SARB SarbWebApi CPDRates.
 * CPDRates returns capital price discovery rates including JIBAR fixings.
 */
function extractSarbJibar(data: unknown, tenor: string): number | null {
  try {
    if (!Array.isArray(data)) return null;
    const tenorUpper = tenor.toUpperCase();
    for (const item of data) {
      if (typeof item !== "object" || item === null) continue;
      const obj = item as Record<string, unknown>;
      const desc = String(obj["Description"] ?? obj["Name"] ?? "").toUpperCase();
      if (desc.includes("JIBAR") && desc.includes(tenorUpper)) {
        const raw = obj["Value"] ?? obj["Rate"] ?? obj["CurrentValue"];
        const n = Number(raw);
        if (!Number.isNaN(n) && n > 0) return n / 100;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract OIS swap pillars from rbond curve/{date}.
 * rbond curve response includes a "ois" or "swaps" section with tenor/rate pairs.
 */
function extractRbondOisPillars(data: unknown): Array<{ tenor: string; rate: number }> | null {
  try {
    if (typeof data !== "object" || data === null) return null;
    const obj = data as Record<string, unknown>;
    // Try "ois" section first, then "swaps", then top-level array
    const section = obj["ois"] ?? obj["swaps"] ?? obj["oisSwaps"];
    if (Array.isArray(section)) {
      return parsePillarArray(section);
    }
    // Fallback: look for keys matching OIS tenors
    const pillars: Array<{ tenor: string; rate: number }> = [];
    for (const key of Object.keys(obj)) {
      const k = key.toUpperCase();
      if (k.includes("OIS") || k.includes("SWAP")) {
        const n = Number(obj[key]);
        if (!Number.isNaN(n) && n > 0) {
          pillars.push({ tenor: key, rate: n > 1 ? n / 100 : n });
        }
      }
    }
    return pillars.length > 0 ? pillars : null;
  } catch {
    return null;
  }
}

/**
 * Extract SAGB benchmark yields from rbond generics.
 * rbond generics returns yields at standard tenors (1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 15Y, 20Y, 30Y).
 */
function extractRbondSagbYields(
  data: unknown,
): Array<{ tenor: string; yieldPct: number; isin?: string }> | null {
  try {
    if (Array.isArray(data)) {
      return parseSagbArray(data);
    }
    if (typeof data !== "object" || data === null) return null;
    const obj = data as Record<string, unknown>;
    // Try "generics" or "sagb" section
    const section = obj["generics"] ?? obj["sagb"] ?? obj["bonds"];
    if (Array.isArray(section)) {
      return parseSagbArray(section);
    }
    // Fallback: keys matching year tenors
    const yields: Array<{ tenor: string; yieldPct: number; isin?: string }> = [];
    for (const key of Object.keys(obj)) {
      if (/^\d{1,2}Y$/i.test(key)) {
        const n = Number(obj[key]);
        if (!Number.isNaN(n) && n > 0) {
          yields.push({ tenor: key.toUpperCase(), yieldPct: n > 1 ? n : n * 100 });
        }
      }
    }
    return yields.length > 0 ? yields : null;
  } catch {
    return null;
  }
}

function parsePillarArray(arr: unknown[]): Array<{ tenor: string; rate: number }> {
  const out: Array<{ tenor: string; rate: number }> = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    const tenor = String(obj["tenor"] ?? obj["term"] ?? obj["Tenor"] ?? "");
    const raw = obj["rate"] ?? obj["value"] ?? obj["Rate"];
    const n = Number(raw);
    if (tenor && !Number.isNaN(n) && n > 0) {
      out.push({ tenor, rate: n > 1 ? n / 100 : n });
    }
  }
  return out;
}

function parseSagbArray(arr: unknown[]): Array<{ tenor: string; yieldPct: number; isin?: string }> {
  const out: Array<{ tenor: string; yieldPct: number; isin?: string }> = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    const tenor = String(obj["tenor"] ?? obj["term"] ?? obj["maturity"] ?? "");
    const raw = obj["yield"] ?? obj["yieldPct"] ?? obj["rate"] ?? obj["Rate"];
    const n = Number(raw);
    const isin = obj["isin"] != null ? String(obj["isin"]) : undefined;
    if (tenor && !Number.isNaN(n) && n > 0) {
      out.push({ tenor, yieldPct: n > 1 ? n : n * 100, isin });
    }
  }
  return out;
}
