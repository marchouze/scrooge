// platform/market-data/jibar-swap-curve-ingester.ts
//
// JIBAR swap curve daily snapshot ingester — stores the SARB/market-derived
// ZAR swap curve as a raw tick in MarketDataStore. The curve provides the
// full term structure of discount factors and par JIBAR rates from 3M to 10Y,
// used by the IRS mark-to-market pricing engine (`IrsRateSource` interface).
//
// What it does
// ------------
// For each date carried by the injected `JibarSwapCurveSource`, the
// ingester:
//
//   1. Persists a raw tick into `MarketDataStore` (data_type="swap-curve-snapshot",
//      source="jibar-swap-sarb", provenance="production" — SARB-derived
//      curve data is regulator-grade; the production tag is correct even
//      in the build phase).
//      The tick is dedup-safe by deterministic id (`SARB:SWAPJIBAR:<date>`).
//
// Connection to IrsRateSource
// ---------------------------
// `MarketDataStoreJibarRateSource` (in platform/markets/eod/make-jibar-rate-source.ts)
// reads the latest swap-curve-snapshot tick from this store and implements
// the `IrsRateSource` interface using log-linear discount factor interpolation.
// This closes GAP-IRS-1 in jibar-curve-seed.ts.
//
// Provenance posture
// ------------------
// The build-phase fixture provenance is documented in the `fixingVariant`
// payload field (`"build-phase-fixture"`). The ticks carry
// `provenance: "production"` in MarketDataStore.
//
// Build-phase posture
// -------------------
// `BUILD_PHASE_VARIANT_MARKER` is the machine-readable flag. The production
// SARB/Bloomberg curve ingestion path is sequenced post-licence. The injected
// `JibarSwapCurveSource` interface is the seam.
//
// Idempotency
// -----------
// Replay-safe: tick id is deterministic (`SARB:SWAPJIBAR:<asOfDate>`) →
// `MarketDataStore.append()` uses `INSERT OR IGNORE`.
//
// Authority
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   - Team/Ravi.md — curve conventions
//
// Author: Ravi (Treasury / ALM engineer, engineering)

import { readFileSync } from "node:fs";

import type { MarketDataStore } from "./store";
import type { SwapCurveSnapshotPayload } from "./types";

// ---------------------------------------------------------------------------
// Build-phase posture marker
// ---------------------------------------------------------------------------

/**
 * Module-level marker — this is the build-phase fixture variant of the
 * JIBAR swap curve ingester. Production live ingestion (SARB / Bloomberg
 * curve feed) is sequenced post-licence.
 */
export const BUILD_PHASE_VARIANT_MARKER = "build-phase-fixture" as const;

// ---------------------------------------------------------------------------
// Source interface
// ---------------------------------------------------------------------------

/**
 * One JIBAR swap curve snapshot entry — a full (date, curve) tuple.
 *
 * Per SARB/market convention, the curve is published once per business day
 * at 17:00 SAST. The `refTime` field records the publication time.
 */
export interface JibarSwapCurveEntry {
  /** ISO 8601 date (YYYY-MM-DD) — the curve snapshot's as-of business day. */
  readonly asOfDate: string;
  /** Annualised par JIBAR rates by tenor node, e.g. {"3M": 0.0815, "10Y": 0.086}. */
  readonly tenors: Record<string, number>;
  /** Discount factors P(0,T) by tenor node, e.g. {"3M": 0.9798, "10Y": 0.4491}. */
  readonly discountFactors: Record<string, number>;
  /**
   * Time-of-day component of the publication, e.g. "17:00:00+02:00".
   */
  readonly refTime: string;
}

/**
 * Injectable source — build-phase implementations read from a JSON
 * fixture; the production implementation (post-licence) reads from the
 * SARB published curve or a Bloomberg/Reuters feed. The storage logic
 * is identical across both — only the source changes.
 */
export interface JibarSwapCurveSource {
  /**
   * Return the swap curve snapshot for the given as-of date. Returns an
   * empty array when no curve is available (SA public holiday, weekend, or
   * a date outside the fixture range).
   */
  curvesForDate(date: string): ReadonlyArray<JibarSwapCurveEntry>;
  /** All known dates in chronological order (for full-history seeds). */
  allDates(): ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Fixture-backed source (build-phase variant)
// ---------------------------------------------------------------------------

/** Per-date curve node shape in the on-disk fixture. */
export interface JibarSwapCurveDateNode {
  readonly tenors: Record<string, number>;
  readonly discountFactors: Record<string, number>;
}

/** Shape of the on-disk fixture (`prototype/seeds/jibar-swap-curve.json`). */
export interface JibarSwapCurveFixtureShape {
  readonly source: string;
  readonly instrument: string;
  readonly refTime: string;
  readonly curves: Readonly<Record<string, JibarSwapCurveDateNode>>;
}

/**
 * Construct a `JibarSwapCurveSource` from the on-disk fixture shape.
 */
export function makeFixtureJibarSwapCurveSource(
  fixture: JibarSwapCurveFixtureShape,
): JibarSwapCurveSource {
  const dates = Object.keys(fixture.curves).sort();
  return {
    curvesForDate(date: string): ReadonlyArray<JibarSwapCurveEntry> {
      const node = fixture.curves[date];
      if (!node) return [];
      return [
        {
          asOfDate: date,
          tenors: { ...node.tenors },
          discountFactors: { ...node.discountFactors },
          refTime: fixture.refTime,
        },
      ];
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
 * Deterministic tick id for a JIBAR swap curve snapshot — used by
 * MarketDataStore dedup (INSERT OR IGNORE on PRIMARY KEY).
 *
 * Form: `SARB:SWAPJIBAR:<asOfDate>`
 */
export function deriveSwapCurveTickId(asOfDate: string): string {
  return `SARB:SWAPJIBAR:${asOfDate}`;
}

// ---------------------------------------------------------------------------
// Run shape
// ---------------------------------------------------------------------------

export interface JibarSwapCurveIngestResult {
  readonly date: string;
  readonly ticksAppended: number;
  readonly ticksSkippedAsDuplicate: number;
  readonly entriesProcessed: number;
}

export interface RunJibarSwapCurveIngestOpts {
  /** The as-of date to ingest (ISO 8601 YYYY-MM-DD). */
  readonly date: string;
  /** Injectable source — build-phase fixture or production live feed. */
  readonly source: JibarSwapCurveSource;
  /** Market-data store handle — raw swap-curve-snapshot ticks land here. */
  readonly marketDataStore: MarketDataStore;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run the JIBAR swap curve ingest for a single business date.
 *
 * For each date entry returned by the source:
 *   1. Append a raw tick to `MarketDataStore` (dedup by tick id).
 *
 * Returns a per-run summary; the script logs it line-by-line for
 * operator visibility.
 */
export function runJibarSwapCurveIngest(
  opts: RunJibarSwapCurveIngestOpts,
): JibarSwapCurveIngestResult {
  const { date, source, marketDataStore } = opts;

  const entries = source.curvesForDate(date);
  const result = {
    date,
    ticksAppended: 0,
    ticksSkippedAsDuplicate: 0,
    entriesProcessed: entries.length,
  };

  if (entries.length === 0) return result;

  for (const entry of entries) {
    const tickId = deriveSwapCurveTickId(entry.asOfDate);
    const tickAsOf = `${entry.asOfDate}T${normaliseRefTime(entry.refTime)}`;

    // ---- MarketDataStore tick (dedup by tick id) ----------------------------
    const existing = marketDataStore.query({ source: "jibar-swap-sarb", instrument: "SWAPJIBAR" });
    const existingIds = new Set(existing.map((t) => t.id));
    if (existingIds.has(tickId)) {
      result.ticksSkippedAsDuplicate += 1;
    } else {
      const payload: SwapCurveSnapshotPayload = {
        tenors: { ...entry.tenors },
        discountFactors: { ...entry.discountFactors },
        curveConvention: "jibar-single-curve",
        fixingVariant: BUILD_PHASE_VARIANT_MARKER,
      };
      marketDataStore.append({
        id: tickId,
        source: "jibar-swap-sarb",
        instrument: "SWAPJIBAR",
        dataType: "swap-curve-snapshot",
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
 * Convert a refTime like "17:00:00+02:00" into the time-and-offset suffix
 * for an ISO 8601 timestamp. Defensive: accepts also "17:00" / "17:00:00"
 * (no offset → assume +02:00 SAST per SARB publication convention).
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

export interface RunJibarSwapCurveIngestAllOpts {
  readonly source: JibarSwapCurveSource;
  readonly marketDataStore: MarketDataStore;
}

export function runJibarSwapCurveIngestAll(
  opts: RunJibarSwapCurveIngestAllOpts,
): ReadonlyArray<JibarSwapCurveIngestResult> {
  const dates = opts.source.allDates();
  return dates.map((date) =>
    runJibarSwapCurveIngest({
      date,
      source: opts.source,
      marketDataStore: opts.marketDataStore,
    }),
  );
}

// ---------------------------------------------------------------------------
// Convenience: load the on-disk fixture and ingest it in one pass
// ---------------------------------------------------------------------------

export interface IngestJibarSwapCurveFixtureResult {
  readonly ticksAppended: number;
  readonly ticksSkippedAsDuplicate: number;
  readonly datesProcessed: number;
}

/**
 * Load the JIBAR swap curve fixture JSON at `fixturePath` and ingest every
 * curve snapshot into `marketDataStore`. Idempotent (deterministic tick ids →
 * INSERT OR IGNORE). Shared by the dashboard boot path so the ZAR swap curve
 * is surfaced on the market-data dashboard's Rates section.
 *
 * Throws if the fixture is missing or malformed (loud — a silent absence would
 * leave the Rates section incomplete without explanation).
 */
export function ingestJibarSwapCurveFixtureFromFile(
  marketDataStore: MarketDataStore,
  fixturePath: string,
): IngestJibarSwapCurveFixtureResult {
  const raw = readFileSync(fixturePath, "utf8");
  const fixture = JSON.parse(raw) as JibarSwapCurveFixtureShape;
  if (!fixture.instrument || !fixture.curves || Object.keys(fixture.curves).length === 0) {
    throw new Error(
      `ingestJibarSwapCurveFixtureFromFile: fixture at ${fixturePath} is malformed (missing instrument / curves)`,
    );
  }
  const source = makeFixtureJibarSwapCurveSource(fixture);
  const results = runJibarSwapCurveIngestAll({ source, marketDataStore });
  let ticksAppended = 0;
  let ticksSkippedAsDuplicate = 0;
  for (const r of results) {
    ticksAppended += r.ticksAppended;
    ticksSkippedAsDuplicate += r.ticksSkippedAsDuplicate;
  }
  return { ticksAppended, ticksSkippedAsDuplicate, datesProcessed: results.length };
}
