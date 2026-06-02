// platform/market-data/jibar-fixing-ingester.ts
//
// JIBAR 3M daily fixing ingester — stores the AFMA-published JIBAR 3M
// (Johannesburg Interbank Average Rate, 3-month tenor) daily fixing as a
// raw tick in MarketDataStore. JIBAR 3M is the primary SA benchmark rate
// for floating-rate IRS coupon determination.
//
// What it does
// ------------
// For each date carried by the injected `JibarFixingSource`, the ingester:
//
//   1. Persists a raw tick into `MarketDataStore` (data_type="jibar-fixing",
//      source="jibar-afma", provenance="production" — AFMA is a
//      regulator-grade published rate; the production tag is the right
//      read-side label even in the build phase, per the same convention
//      applied to SARB ZARONIA fixings).
//      The tick is dedup-safe by deterministic id (`AFMA:JIBAR3M:<date>`).
//
// Why no OfficialMarkAdopted
// --------------------------
// JIBAR 3M is a reference rate, not an IPV mark. It is consumed by the
// IRS pricing model (coupon determination and discount curve construction),
// not by the valuation policy's mark-adoption framework.
//
// Provenance posture
// ------------------
// The build-phase fixture provenance is documented in the `fixingVariant`
// payload field (`"build-phase-fixture"`). The ticks carry
// `provenance: "production"` in MarketDataStore — AFMA is a regulator-grade
// source; the production tag is the correct read-side label.
//
// Build-phase posture
// -------------------
// `BUILD_PHASE_VARIANT_MARKER` (module-level constant below) is the
// machine-readable flag. The production AFMA JIBAR ingestion path is
// sequenced post-licence. The injected `JibarFixingSource` interface is
// the seam: swap the fixture-backed implementation for the live one at
// licence-day; the storage logic does not change.
//
// Idempotency
// -----------
// Replay-safe: tick id is deterministic (`AFMA:JIBAR3M:<asOfDate>`) →
// `MarketDataStore.append()` uses `INSERT OR IGNORE`.
//
// Authority
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   - Team/Ravi.md — JIBAR conventions
//
// Author: Ravi (Treasury / ALM engineer, engineering)

import { readFileSync } from "node:fs";

import type { MarketDataStore } from "./store";
import type { JibarFixingPayload } from "./types";

// ---------------------------------------------------------------------------
// Build-phase posture marker
// ---------------------------------------------------------------------------

/**
 * Module-level marker — this is the build-phase fixture variant of the
 * JIBAR 3M fixing ingester. Production live ingestion (AFMA API feed)
 * is sequenced post-licence.
 *
 * Recon pipelines assert this marker stays `"build-phase-fixture"` until
 * the post-licence cutover.
 */
export const BUILD_PHASE_VARIANT_MARKER = "build-phase-fixture" as const;

// ---------------------------------------------------------------------------
// Source interface
// ---------------------------------------------------------------------------

/**
 * One JIBAR 3M fixing entry — a single (date, rate) tuple.
 *
 * Per AFMA convention, the rate is published once per business day
 * at 17:00 SAST. The `refTime` field records the publication time
 * for canonical-JSON stability under replay.
 */
export interface JibarFixingEntry {
  /** ISO 8601 date (YYYY-MM-DD) — the fixing's as-of business day. */
  readonly asOfDate: string;
  /** JIBAR 3M rate as a fixed-point decimal string (e.g. "0.0890" for 8.90%). */
  readonly rate: string;
  /**
   * Time-of-day component of the publication, e.g. "17:00:00+02:00".
   * Combined with `asOfDate` to form the tick's full ISO 8601 timestamp.
   */
  readonly refTime: string;
}

/**
 * Injectable source — build-phase implementations read from a JSON
 * fixture; the production implementation (post-licence) reads from the
 * AFMA published rate page or AFMA API. The storage logic is identical
 * across both — only the source changes.
 */
export interface JibarFixingSource {
  /**
   * Return the JIBAR 3M fixing for the given as-of date. Returns an empty
   * array when no rate is published (SA public holiday, weekend, or a
   * date outside the fixture range).
   */
  fixingsForDate(date: string): ReadonlyArray<JibarFixingEntry>;
  /** All known dates in chronological order (for full-history seeds). */
  allDates(): ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Fixture-backed source (build-phase variant)
// ---------------------------------------------------------------------------

/** Shape of the on-disk fixture (`prototype/seeds/jibar-fixings.json`). */
export interface JibarFixingFixtureShape {
  readonly source: string;
  readonly instrument: string;
  readonly convention: string;
  readonly refTime: string;
  readonly fixings: Readonly<Record<string, string>>;
}

/**
 * Construct a `JibarFixingSource` from the on-disk fixture shape.
 */
export function makeFixtureJibarFixingSource(fixture: JibarFixingFixtureShape): JibarFixingSource {
  const dates = Object.keys(fixture.fixings).sort();
  return {
    fixingsForDate(date: string): ReadonlyArray<JibarFixingEntry> {
      const rate = fixture.fixings[date];
      if (rate === undefined) return [];
      return [
        {
          asOfDate: date,
          rate,
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
 * Deterministic tick id for a JIBAR 3M fixing entry — used by MarketDataStore
 * dedup (INSERT OR IGNORE on PRIMARY KEY).
 *
 * Form: `AFMA:JIBAR3M:<asOfDate>`
 */
export function deriveJibarFixingTickId(asOfDate: string): string {
  return `AFMA:JIBAR3M:${asOfDate}`;
}

// ---------------------------------------------------------------------------
// Run shape
// ---------------------------------------------------------------------------

export interface JibarFixingIngestResult {
  readonly date: string;
  readonly ticksAppended: number;
  readonly ticksSkippedAsDuplicate: number;
  readonly entriesProcessed: number;
}

export interface RunJibarFixingIngestOpts {
  /** The as-of date to ingest (ISO 8601 YYYY-MM-DD). */
  readonly date: string;
  /** Injectable source — build-phase fixture or production live feed. */
  readonly source: JibarFixingSource;
  /** Market-data store handle — raw JIBAR 3M ticks land here. */
  readonly marketDataStore: MarketDataStore;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run the JIBAR 3M fixing ingest for a single business date.
 *
 * For each date entry returned by the source:
 *   1. Append a raw tick to `MarketDataStore` (dedup by tick id).
 *
 * Note: No OfficialMarkAdopted event is emitted — JIBAR 3M is a reference
 * rate driving coupon determination and curve construction, not an IPV mark.
 *
 * Returns a per-run summary; the script logs it line-by-line for
 * operator visibility.
 */
export function runJibarFixingIngest(opts: RunJibarFixingIngestOpts): JibarFixingIngestResult {
  const { date, source, marketDataStore } = opts;

  const entries = source.fixingsForDate(date);
  const result = {
    date,
    ticksAppended: 0,
    ticksSkippedAsDuplicate: 0,
    entriesProcessed: entries.length,
  };

  if (entries.length === 0) return result;

  for (const entry of entries) {
    const tickId = deriveJibarFixingTickId(entry.asOfDate);
    const tickAsOf = `${entry.asOfDate}T${normaliseRefTime(entry.refTime)}`;

    // ---- MarketDataStore tick (dedup by tick id) ----------------------------
    const existing = marketDataStore.query({ source: "jibar-afma", instrument: "JIBAR3M" });
    const existingIds = new Set(existing.map((t) => t.id));
    if (existingIds.has(tickId)) {
      result.ticksSkippedAsDuplicate += 1;
    } else {
      const payload: JibarFixingPayload = {
        rate: entry.rate,
        tenor: "3M",
        convention: "act365-simple",
        fixingVariant: BUILD_PHASE_VARIANT_MARKER,
      };
      marketDataStore.append({
        id: tickId,
        source: "jibar-afma",
        instrument: "JIBAR3M",
        dataType: "jibar-fixing",
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
 * (no offset → assume +02:00 SAST per AFMA publication convention).
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

export interface RunJibarFixingIngestAllOpts {
  readonly source: JibarFixingSource;
  readonly marketDataStore: MarketDataStore;
}

export function runJibarFixingIngestAll(
  opts: RunJibarFixingIngestAllOpts,
): ReadonlyArray<JibarFixingIngestResult> {
  const dates = opts.source.allDates();
  return dates.map((date) =>
    runJibarFixingIngest({
      date,
      source: opts.source,
      marketDataStore: opts.marketDataStore,
    }),
  );
}

// ---------------------------------------------------------------------------
// Convenience: load the on-disk fixture and ingest it in one pass
// ---------------------------------------------------------------------------

export interface IngestJibarFixingFixtureResult {
  readonly ticksAppended: number;
  readonly ticksSkippedAsDuplicate: number;
  readonly datesProcessed: number;
}

/**
 * Load the JIBAR 3M fixing fixture JSON at `fixturePath` and ingest every
 * fixing into `marketDataStore`. Idempotent (deterministic tick ids →
 * INSERT OR IGNORE). Shared by the dashboard boot path so the JIBAR 3M
 * benchmark is surfaced on the market-data dashboard alongside FX.
 *
 * Throws if the fixture is missing or malformed (loud — a silent absence
 * would leave the Rates section empty without explanation).
 */
export function ingestJibarFixingFixtureFromFile(
  marketDataStore: MarketDataStore,
  fixturePath: string,
): IngestJibarFixingFixtureResult {
  const raw = readFileSync(fixturePath, "utf8");
  const fixture = JSON.parse(raw) as JibarFixingFixtureShape;
  if (!fixture.instrument || !fixture.fixings || Object.keys(fixture.fixings).length === 0) {
    throw new Error(
      `ingestJibarFixingFixtureFromFile: fixture at ${fixturePath} is malformed (missing instrument / fixings)`,
    );
  }
  const source = makeFixtureJibarFixingSource(fixture);
  const results = runJibarFixingIngestAll({ source, marketDataStore });
  let ticksAppended = 0;
  let ticksSkippedAsDuplicate = 0;
  for (const r of results) {
    ticksAppended += r.ticksAppended;
    ticksSkippedAsDuplicate += r.ticksSkippedAsDuplicate;
  }
  return { ticksAppended, ticksSkippedAsDuplicate, datesProcessed: results.length };
}
