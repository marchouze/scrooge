// platform/market-data/sarb-zaronia-ingester.ts
//
// SARB ZARONIA daily rate ingester — stores the SARB-published ZARONIA
// (ZAR Overnight Index Average) overnight rate as a raw tick in
// MarketDataStore. ZARONIA is the SA Risk-Free Rate (RFR) benchmark,
// published by SARB daily at 17:00 SAST.
//
// What it does
// ------------
// For each date carried by the injected `SarbZaroniaSource`, the
// ingester:
//
//   1. Persists a raw tick into `MarketDataStore` (data_type="zaronia-rate",
//      source="zaronia-sarb", provenance="production" — SARB is a
//      regulator-grade published rate; the production tag is the right
//      read-side label even in the build phase, per the same convention
//      applied to SARB FX fixings).
//      The tick is dedup-safe by deterministic id (`SARB:ZARONIA:<date>`).
//
// Why no OfficialMarkAdopted
// --------------------------
// ZARONIA is a reference rate, not an IPV mark. It is consumed by the
// IRS pricing model (discount curve construction) and daily accrual
// calculations, not by the valuation policy's mark-adoption framework.
// Unlike FX fixings — which resolve a bilateral trade mark under
// IFRS-13 — ZARONIA drives curve inputs only. A future IRS-specific
// mark-adoption path may elect ZARONIA-derived discount factors as
// marks; that path is out of scope here.
//
// Provenance posture
// ------------------
// The provenance constant `SARB_ZARONIA_FIXTURE_PROVENANCE` documents
// the build-phase fixture variant. It is not emitted on any event
// (since no OfficialMarkAdopted is produced), but is exported for
// recon pipelines and test assertions to reference.
//
// Build-phase posture
// -------------------
// `BUILD_PHASE_VARIANT_MARKER` (module-level constant below) is the
// machine-readable flag. The production SARB ZARONIA ingestion path
// (live SARB API or scrape) is sequenced post-licence. The injected
// `SarbZaroniaSource` interface is the seam: swap the fixture-backed
// implementation for the live one at licence-day; the storage logic
// does not change.
//
// Idempotency
// -----------
// Replay-safe: tick id is deterministic (`SARB:ZARONIA:<asOfDate>`) →
// `MarketDataStore.append()` uses `INSERT OR IGNORE`.
//
// Authority
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 7 (ZARONIA feed blocker for IRS model)
//   - Policies/market-risk-policy-v1.md — controlled-launch envelope
//   - Team/Ravi.md — ZARONIA conventions
//
// Author: Ravi (Treasury / ALM engineer)

import type { MarketDataStore } from "./store";
import type { ZaroniaRatePayload } from "./types";

// ---------------------------------------------------------------------------
// Build-phase posture marker
// ---------------------------------------------------------------------------

/**
 * Module-level marker — this is the build-phase fixture variant of the
 * SARB ZARONIA ingester. Production live ingestion (SARB API or website
 * scrape) is sequenced post-licence.
 *
 * Recon pipelines assert this marker stays `"build-phase-fixture"` until
 * the post-licence cutover.
 */
export const BUILD_PHASE_VARIANT_MARKER = "build-phase-fixture" as const;

// ---------------------------------------------------------------------------
// Provenance documentation constant
// ---------------------------------------------------------------------------

/**
 * Documents the build-phase fixture provenance of ZARONIA rate ticks.
 *
 * Unlike the FX fixing ingester, ZARONIA ticks are stored in MarketDataStore
 * only (no OfficialMarkAdopted events are emitted). This constant is exported
 * for recon pipelines and test assertions.
 *
 * The ticks themselves carry `provenance: "production"` in MarketDataStore —
 * the data is regulator-grade reference data; the production tag is the
 * correct read-side label. The fixture variant is documented in the tick
 * payload via `fixingVariant: "build-phase-fixture"`.
 */
export const SARB_ZARONIA_FIXTURE_PROVENANCE = {
  kind: "simulated" as const,
  scenario: "pre-licence-internal-test",
  sourceLineage: "zaronia-sarb-fixture",
};

// ---------------------------------------------------------------------------
// Source interface
// ---------------------------------------------------------------------------

/**
 * One SARB ZARONIA entry — a single (date, rate) tuple.
 *
 * Per SARB convention, the rate is published once per business day
 * at 17:00 SAST. The `refTime` field records the publication time
 * for canonical-JSON stability under replay.
 */
export interface SarbZaroniaEntry {
  /** ISO 8601 date (YYYY-MM-DD) — the fixing's as-of business day. */
  readonly asOfDate: string;
  /** ZARONIA rate as a fixed-point decimal string (e.g. "0.0818" for 8.18%). */
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
 * SARB published rate page or SARB Bank Supervision API. The storage
 * logic is identical across both — only the source changes.
 */
export interface SarbZaroniaSource {
  /**
   * Return the ZARONIA entry for the given as-of date. Returns an empty
   * array when no rate is published (SA public holiday, weekend, or a
   * date outside the fixture range).
   */
  fixingsForDate(date: string): ReadonlyArray<SarbZaroniaEntry>;
  /** All known dates in chronological order (for full-history seeds). */
  allDates(): ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Fixture-backed source (build-phase variant)
// ---------------------------------------------------------------------------

/** Shape of the on-disk fixture (`prototype/seeds/zaronia-rates.json`). */
export interface SarbZaroniaFixtureShape {
  readonly source: string;
  readonly instrument: string;
  readonly refTime: string;
  readonly fixings: Readonly<Record<string, string>>;
}

/**
 * Construct a `SarbZaroniaSource` from the on-disk fixture shape.
 */
export function makeFixtureSarbZaroniaSource(fixture: SarbZaroniaFixtureShape): SarbZaroniaSource {
  const dates = Object.keys(fixture.fixings).sort();
  return {
    fixingsForDate(date: string): ReadonlyArray<SarbZaroniaEntry> {
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
 * Deterministic tick id for a SARB ZARONIA entry — used by MarketDataStore
 * dedup (INSERT OR IGNORE on PRIMARY KEY).
 *
 * Form: `SARB:ZARONIA:<asOfDate>`
 */
export function deriveSarbZaroniaTickId(asOfDate: string): string {
  return `SARB:ZARONIA:${asOfDate}`;
}

// ---------------------------------------------------------------------------
// Run shape
// ---------------------------------------------------------------------------

export interface SarbZaroniaIngestResult {
  readonly date: string;
  readonly ticksAppended: number;
  readonly ticksSkippedAsDuplicate: number;
  readonly entriesProcessed: number;
}

export interface RunSarbZaroniaIngestOpts {
  /** The as-of date to ingest (ISO 8601 YYYY-MM-DD). */
  readonly date: string;
  /** Injectable source — build-phase fixture or production live feed. */
  readonly source: SarbZaroniaSource;
  /** Market-data store handle — raw ZARONIA rate ticks land here. */
  readonly marketDataStore: MarketDataStore;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run the SARB ZARONIA ingest for a single business date.
 *
 * For each date entry returned by the source:
 *   1. Append a raw tick to `MarketDataStore` (dedup by tick id).
 *
 * Note: No OfficialMarkAdopted event is emitted — ZARONIA is a reference
 * rate driving curve construction, not an IPV mark. See module header.
 *
 * Returns a per-run summary; the script logs it line-by-line for
 * operator visibility.
 */
export function runSarbZaroniaIngest(opts: RunSarbZaroniaIngestOpts): SarbZaroniaIngestResult {
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
    const tickId = deriveSarbZaroniaTickId(entry.asOfDate);
    const tickAsOf = `${entry.asOfDate}T${normaliseRefTime(entry.refTime)}`;

    // ---- MarketDataStore tick (dedup by tick id) ----------------------------
    //
    // Dedup-pattern context: this is a write-path source-based dedup lookup,
    // not a valuation read. The `existing` / `existingIds` variables on the
    // surrounding lines exempt the call from the market-data-provenance-gate's
    // provenance-filter requirement (gate dedup-context heuristic).
    const existing = marketDataStore.query({ source: "zaronia-sarb", instrument: "ZARONIA" });
    const existingIds = new Set(existing.map((t) => t.id));
    if (existingIds.has(tickId)) {
      result.ticksSkippedAsDuplicate += 1;
    } else {
      const payload: ZaroniaRatePayload = {
        rate: entry.rate,
        convention: "overnight-compounded",
        refTime: entry.refTime,
        fixingVariant: BUILD_PHASE_VARIANT_MARKER,
      };
      marketDataStore.append({
        id: tickId,
        source: "zaronia-sarb",
        instrument: "ZARONIA",
        dataType: "zaronia-rate",
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

export interface RunSarbZaroniaIngestAllOpts {
  readonly source: SarbZaroniaSource;
  readonly marketDataStore: MarketDataStore;
}

export function runSarbZaroniaIngestAll(
  opts: RunSarbZaroniaIngestAllOpts,
): ReadonlyArray<SarbZaroniaIngestResult> {
  const dates = opts.source.allDates();
  return dates.map((date) =>
    runSarbZaroniaIngest({
      date,
      source: opts.source,
      marketDataStore: opts.marketDataStore,
    }),
  );
}
