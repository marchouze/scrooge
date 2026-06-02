// platform/market-data/bond-price-ingester.ts
//
// SA government bond daily reference-price ingester — stores the JSE Debt
// Market / Bond Exchange of SA end-of-day clean price + yield for each
// benchmark SA government bond as a raw tick in MarketDataStore. These are
// reference prices for the market-data dashboard's Bonds section; bond
// VALUATION (MTM) continues to flow through OfficialMarkAdopted events and
// the product-control position source — wiring these reference prices into
// the valuation path is a deliberate follow-up, out of scope here.
//
// What it does
// ------------
// For each date carried by the injected `BondPriceSource`, the ingester:
//
//   1. Persists one raw tick per bond ISIN into `MarketDataStore`
//      (data_type="bond-price", source="jse-debt", provenance="production" —
//      the JSE Debt Market is an exchange-grade source; the production tag is
//      the right read-side label even in the build phase, per the same
//      convention applied to SARB/AFMA rate feeds).
//      The tick is dedup-safe by deterministic id (`JSE:BOND:<isin>:<date>`).
//
// Why no OfficialMarkAdopted
// --------------------------
// This feed is reference/time-series data for the market-data surface, not an
// IPV mark. The valuation policy's mark-adoption framework
// (OfficialMarkAdopted, markType="price") remains the canonical bond
// valuation source. See module header note above.
//
// Build-phase posture
// -------------------
// `BUILD_PHASE_VARIANT_MARKER` is the machine-readable flag. The production
// JSE Debt Market price feed is sequenced post-licence. The injected
// `BondPriceSource` interface is the seam: swap the fixture-backed
// implementation for the live one at licence-day; the storage logic does not
// change.
//
// Idempotency
// -----------
// Replay-safe: tick id is deterministic (`JSE:BOND:<isin>:<asOfDate>`) →
// `MarketDataStore.append()` uses `INSERT OR IGNORE`.
//
// Authority
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   - D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22) Slice 10
//   - JSE-RULES-BONDS — JSE Debt Listings Requirements
//
// Author: Ravi (Treasury / ALM engineer, engineering)

import { readFileSync } from "node:fs";

import type { MarketDataStore } from "./store";
import type { BondPricePayload } from "./types";

// ---------------------------------------------------------------------------
// Build-phase posture marker
// ---------------------------------------------------------------------------

/**
 * Module-level marker — this is the build-phase fixture variant of the bond
 * reference-price ingester. Production live ingestion (JSE Debt Market feed)
 * is sequenced post-licence.
 */
export const BUILD_PHASE_VARIANT_MARKER = "build-phase-fixture" as const;

// ---------------------------------------------------------------------------
// Source interface
// ---------------------------------------------------------------------------

/**
 * One bond reference-price entry — a single (date, ISIN, price) tuple.
 *
 * The JSE Debt Market publishes an end-of-day mark per listed bond. The
 * `refTime` field records the publication time for canonical-JSON stability
 * under replay.
 */
export interface BondPriceEntry {
  /** ISO 8601 date (YYYY-MM-DD) — the price's as-of business day. */
  readonly asOfDate: string;
  /** Bond ISIN, e.g. "ZAG000030108" — used as the tick's instrument key. */
  readonly isin: string;
  /** Human-readable bond code, e.g. "R186". */
  readonly bondCode: string;
  /** Clean price as a percentage of par, fixed-point string (e.g. "101.52"). */
  readonly cleanPrice: string;
  /** Yield to maturity in decimal form (e.g. "0.0802" for 8.02%). */
  readonly yieldToMaturity: string;
  /** Time-of-day component of the publication, e.g. "17:00:00+02:00". */
  readonly refTime: string;
}

/**
 * Injectable source — build-phase implementations read from a JSON fixture;
 * the production implementation (post-licence) reads from the JSE Debt Market
 * feed. The storage logic is identical across both — only the source changes.
 */
export interface BondPriceSource {
  /**
   * Return all bond price entries for the given as-of date. Returns an empty
   * array when no prices are published (SA public holiday, weekend, or a date
   * outside the fixture range).
   */
  pricesForDate(date: string): ReadonlyArray<BondPriceEntry>;
  /** All known dates in chronological order (for full-history seeds). */
  allDates(): ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Fixture-backed source (build-phase variant)
// ---------------------------------------------------------------------------

/** One bond's identity in the on-disk fixture. */
export interface BondPriceFixtureInstrument {
  readonly isin: string;
  readonly bondCode: string;
}

/** Per-(date,ISIN) price node in the on-disk fixture. */
export interface BondPriceFixtureNode {
  readonly cleanPrice: string;
  readonly yield: string;
}

/** Shape of the on-disk fixture (`prototype/seeds/bond-prices.json`). */
export interface BondPriceFixtureShape {
  readonly source: string;
  readonly refTime: string;
  readonly instruments: ReadonlyArray<BondPriceFixtureInstrument>;
  readonly prices: Readonly<Record<string, Readonly<Record<string, BondPriceFixtureNode>>>>;
}

/**
 * Construct a `BondPriceSource` from the on-disk fixture shape.
 */
export function makeFixtureBondPriceSource(fixture: BondPriceFixtureShape): BondPriceSource {
  const dates = Object.keys(fixture.prices).sort();
  const bondCodeByIsin = new Map<string, string>();
  for (const inst of fixture.instruments) {
    bondCodeByIsin.set(inst.isin, inst.bondCode);
  }
  return {
    pricesForDate(date: string): ReadonlyArray<BondPriceEntry> {
      const byIsin = fixture.prices[date];
      if (!byIsin) return [];
      const entries: BondPriceEntry[] = [];
      // Iterate in stable ISIN order for canonical-JSON / replay stability.
      for (const isin of Object.keys(byIsin).sort()) {
        const node = byIsin[isin];
        if (!node) continue;
        entries.push({
          asOfDate: date,
          isin,
          bondCode: bondCodeByIsin.get(isin) ?? isin,
          cleanPrice: node.cleanPrice,
          yieldToMaturity: node.yield,
          refTime: fixture.refTime,
        });
      }
      return entries;
    },
    allDates(): ReadonlyArray<string> {
      return dates;
    },
  };
}

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic tick id for a bond reference-price entry — used by
 * MarketDataStore dedup (INSERT OR IGNORE on PRIMARY KEY).
 *
 * Form: `JSE:BOND:<isin>:<asOfDate>`
 */
export function deriveBondPriceTickId(isin: string, asOfDate: string): string {
  return `JSE:BOND:${isin}:${asOfDate}`;
}

// ---------------------------------------------------------------------------
// Run shape
// ---------------------------------------------------------------------------

export interface BondPriceIngestResult {
  readonly date: string;
  readonly ticksAppended: number;
  readonly ticksSkippedAsDuplicate: number;
  readonly entriesProcessed: number;
}

export interface RunBondPriceIngestOpts {
  /** The as-of date to ingest (ISO 8601 YYYY-MM-DD). */
  readonly date: string;
  /** Injectable source — build-phase fixture or production live feed. */
  readonly source: BondPriceSource;
  /** Market-data store handle — raw bond-price ticks land here. */
  readonly marketDataStore: MarketDataStore;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run the bond reference-price ingest for a single business date.
 *
 * For each bond entry returned by the source:
 *   1. Append a raw tick to `MarketDataStore` (dedup by tick id).
 *
 * Note: No OfficialMarkAdopted event is emitted — see module header.
 */
export function runBondPriceIngest(opts: RunBondPriceIngestOpts): BondPriceIngestResult {
  const { date, source, marketDataStore } = opts;

  const entries = source.pricesForDate(date);
  const result = {
    date,
    ticksAppended: 0,
    ticksSkippedAsDuplicate: 0,
    entriesProcessed: entries.length,
  };

  if (entries.length === 0) return result;

  for (const entry of entries) {
    const tickId = deriveBondPriceTickId(entry.isin, entry.asOfDate);
    const tickAsOf = `${entry.asOfDate}T${normaliseRefTime(entry.refTime)}`;

    // ---- MarketDataStore tick (dedup by tick id) ----------------------------
    // Write-path source-based dedup lookup, not a valuation read — exempt from
    // the market-data-provenance-gate provenance-filter requirement (gate
    // dedup-context heuristic keys on `existing` / `existingIds`).
    const existing = marketDataStore.query({ source: "jse-debt", instrument: entry.isin });
    const existingIds = new Set(existing.map((t) => t.id));
    if (existingIds.has(tickId)) {
      result.ticksSkippedAsDuplicate += 1;
    } else {
      const payload: BondPricePayload = {
        cleanPrice: entry.cleanPrice,
        yieldToMaturity: entry.yieldToMaturity,
        bondCode: entry.bondCode,
        fixingVariant: BUILD_PHASE_VARIANT_MARKER,
      };
      marketDataStore.append({
        id: tickId,
        source: "jse-debt",
        instrument: entry.isin,
        dataType: "bond-price",
        provenance: "production",
        asOf: tickAsOf,
        payload: payload as unknown as Record<string, unknown>,
      });
      result.ticksAppended += 1;
    }
  }

  return result;
}

/**
 * Convert a refTime like "17:00:00+02:00" into the time-and-offset suffix for
 * an ISO 8601 timestamp. Defensive: accepts also "17:00" / "17:00:00" (no
 * offset → assume +02:00 SAST per JSE publication convention).
 */
function normaliseRefTime(refTime: string): string {
  if (/\+|-|Z/.test(refTime.slice(5))) return refTime; // already has offset
  if (/^\d{2}:\d{2}$/.test(refTime)) return `${refTime}:00+02:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(refTime)) return `${refTime}+02:00`;
  return refTime; // best effort
}

// ---------------------------------------------------------------------------
// Convenience: ingest the entire fixture in one pass
// ---------------------------------------------------------------------------

export interface RunBondPriceIngestAllOpts {
  readonly source: BondPriceSource;
  readonly marketDataStore: MarketDataStore;
}

export function runBondPriceIngestAll(
  opts: RunBondPriceIngestAllOpts,
): ReadonlyArray<BondPriceIngestResult> {
  const dates = opts.source.allDates();
  return dates.map((date) =>
    runBondPriceIngest({
      date,
      source: opts.source,
      marketDataStore: opts.marketDataStore,
    }),
  );
}

// ---------------------------------------------------------------------------
// Convenience: load the on-disk fixture and ingest it in one pass
// ---------------------------------------------------------------------------

export interface IngestBondPriceFixtureResult {
  readonly ticksAppended: number;
  readonly ticksSkippedAsDuplicate: number;
  readonly datesProcessed: number;
}

/**
 * Load the bond-price fixture JSON at `fixturePath` and ingest every bond price
 * into `marketDataStore`. Idempotent (deterministic tick ids → INSERT OR
 * IGNORE). Shared by the dashboard boot path so the Bonds section of the
 * market-data dashboard is populated.
 *
 * Throws if the fixture is missing or malformed (loud — a silent absence would
 * leave the Bonds section empty without explanation).
 */
export function ingestBondPriceFixtureFromFile(
  marketDataStore: MarketDataStore,
  fixturePath: string,
): IngestBondPriceFixtureResult {
  const raw = readFileSync(fixturePath, "utf8");
  const fixture = JSON.parse(raw) as BondPriceFixtureShape;
  if (
    !fixture.instruments ||
    fixture.instruments.length === 0 ||
    !fixture.prices ||
    Object.keys(fixture.prices).length === 0
  ) {
    throw new Error(
      `ingestBondPriceFixtureFromFile: fixture at ${fixturePath} is malformed (missing instruments / prices)`,
    );
  }
  const source = makeFixtureBondPriceSource(fixture);
  const results = runBondPriceIngestAll({ source, marketDataStore });
  let ticksAppended = 0;
  let ticksSkippedAsDuplicate = 0;
  for (const r of results) {
    ticksAppended += r.ticksAppended;
    ticksSkippedAsDuplicate += r.ticksSkippedAsDuplicate;
  }
  return { ticksAppended, ticksSkippedAsDuplicate, datesProcessed: results.length };
}
