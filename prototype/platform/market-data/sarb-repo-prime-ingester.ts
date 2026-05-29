// platform/market-data/sarb-repo-prime-ingester.ts
//
// SARB repo rate and prime rate ingester — stores SARB MPC decisions as raw
// ticks in MarketDataStore. The repo rate is the SARB Monetary Policy
// Committee's key policy rate; prime = repo + 3.5% per SA banking convention.
//
// What it does
// ------------
// For each MPC decision date carried by the injected `SarbRepoPrimeSource`,
// the ingester:
//
//   1. Persists a raw tick into `MarketDataStore` (data_type="repo-prime-rate",
//      source="sarb-repo", provenance="production" — SARB is a regulator-grade
//      source; the production tag is correct even in the build phase).
//      The tick is dedup-safe by deterministic id (`SARB:REPO:<effectiveDate>`).
//
// Step-function semantics
// -----------------------
// Repo rates are step functions: the most-recent MPC decision on or before
// a given date applies. `runSarbRepoPrimeIngest(date)` resolves the effective
// decision on that date (not all decisions up to that date), stores one tick
// per call, and is idempotent (INSERT OR IGNORE dedup by tick id).
//
// `runSarbRepoPrimeIngestAll` iterates over `allDecisionDates()` — one tick
// per MPC decision date — which is the canonical seeding pattern.
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
// SARB MPC decision ingestion path (live SARB publications) is sequenced
// post-licence. The injected `SarbRepoPrimeSource` interface is the seam.
//
// Idempotency
// -----------
// Replay-safe: tick id is deterministic (`SARB:REPO:<effectiveDate>`) →
// `MarketDataStore.append()` uses `INSERT OR IGNORE`.
//
// Authority
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   - Team/Ravi.md — rate conventions
//
// Author: Ravi (Treasury / ALM engineer, engineering)

import type { MarketDataStore } from "./store";
import type { RepoPrimeRatePayload } from "./types";

// ---------------------------------------------------------------------------
// Build-phase posture marker
// ---------------------------------------------------------------------------

/**
 * Module-level marker — this is the build-phase fixture variant of the
 * SARB repo rate ingester. Production live ingestion (SARB published
 * MPC decisions) is sequenced post-licence.
 */
export const BUILD_PHASE_VARIANT_MARKER = "build-phase-fixture" as const;

// ---------------------------------------------------------------------------
// Source interface
// ---------------------------------------------------------------------------

/**
 * One SARB MPC repo rate decision entry.
 */
export interface RepoDecisionEntry {
  /** ISO 8601 date (YYYY-MM-DD) — the date the rate became effective. */
  readonly effectiveDate: string;
  /** Repo rate in decimal form, e.g. "0.0825" for 8.25%. */
  readonly repoRate: string;
  /** Prime lending rate in decimal form = repo + 3.5%. */
  readonly primeRate: string;
}

/**
 * Injectable source — build-phase implementations read from a JSON
 * fixture; the production implementation (post-licence) reads from SARB
 * published MPC decisions. The storage logic is identical across both.
 *
 * The source models a step function: `decisionsOnOrBefore(date)` returns
 * all decisions whose `effectiveDate` ≤ `date`, ordered by effectiveDate
 * ascending. The caller takes the last entry as the effective rate.
 */
export interface SarbRepoPrimeSource {
  /**
   * Return all MPC decisions whose effectiveDate ≤ date, ordered ascending.
   * Returns an empty array when no decision predates the given date.
   */
  decisionsOnOrBefore(date: string): ReadonlyArray<RepoDecisionEntry>;
  /** All known decision dates in chronological order (for full-history seeds). */
  allDecisionDates(): ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Fixture-backed source (build-phase variant)
// ---------------------------------------------------------------------------

/** Shape of the on-disk fixture (`prototype/seeds/sarb-repo-rate.json`). */
export interface SarbRepoFixtureShape {
  readonly source: string;
  readonly decisions: ReadonlyArray<RepoDecisionEntry>;
}

/**
 * Construct a `SarbRepoPrimeSource` from the on-disk fixture shape.
 *
 * Implements step-function semantics: for a given date, returns all
 * decisions whose effectiveDate ≤ date (sorted ascending). The most
 * recently effective rate is the last entry.
 */
export function makeFixtureSarbRepoPrimeSource(
  fixture: SarbRepoFixtureShape,
): SarbRepoPrimeSource {
  // Sort decisions ascending by effectiveDate for stable step-function lookup.
  const sorted = [...fixture.decisions].sort((a, b) =>
    a.effectiveDate < b.effectiveDate ? -1 : a.effectiveDate > b.effectiveDate ? 1 : 0,
  );
  return {
    decisionsOnOrBefore(date: string): ReadonlyArray<RepoDecisionEntry> {
      return sorted.filter((d) => d.effectiveDate <= date);
    },
    allDecisionDates(): ReadonlyArray<string> {
      return sorted.map((d) => d.effectiveDate);
    },
  };
}

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic tick id for a SARB repo rate decision entry — used by
 * MarketDataStore dedup (INSERT OR IGNORE on PRIMARY KEY).
 *
 * Form: `SARB:REPO:<effectiveDate>`
 */
export function deriveRepoTickId(effectiveDate: string): string {
  return `SARB:REPO:${effectiveDate}`;
}

// ---------------------------------------------------------------------------
// Run shape
// ---------------------------------------------------------------------------

export interface SarbRepoPrimeIngestResult {
  readonly date: string;
  readonly effectiveDecisionDate: string | null;
  readonly ticksAppended: number;
  readonly ticksSkippedAsDuplicate: number;
}

export interface RunSarbRepoPrimeIngestOpts {
  /** The as-of date to ingest (ISO 8601 YYYY-MM-DD). */
  readonly date: string;
  /** Injectable source — build-phase fixture or production live feed. */
  readonly source: SarbRepoPrimeSource;
  /** Market-data store handle — raw repo rate ticks land here. */
  readonly marketDataStore: MarketDataStore;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run the SARB repo rate ingest for a single as-of date.
 *
 * Resolves the MPC decision that was effective on `date` (step-function:
 * most recent decision whose effectiveDate ≤ date) and stores that
 * decision as a tick in MarketDataStore (dedup by tick id).
 *
 * If no decision predates the given date, returns with ticksAppended=0.
 * The tick id is based on the decision's own effectiveDate, not the as-of
 * date — this ensures one tick per MPC decision regardless of how many
 * dates it is effective for.
 *
 * Returns a per-run summary; the script logs it line-by-line for
 * operator visibility.
 */
export function runSarbRepoPrimeIngest(
  opts: RunSarbRepoPrimeIngestOpts,
): SarbRepoPrimeIngestResult {
  const { date, source, marketDataStore } = opts;

  const decisions = source.decisionsOnOrBefore(date);
  const result: SarbRepoPrimeIngestResult = {
    date,
    effectiveDecisionDate: null,
    ticksAppended: 0,
    ticksSkippedAsDuplicate: 0,
  };

  if (decisions.length === 0) return result;

  // Step-function: take the most recently effective decision.
  const effective = decisions[decisions.length - 1];
  if (!effective) return result;

  const tickId = deriveRepoTickId(effective.effectiveDate);
  const tickAsOf = `${effective.effectiveDate}T17:00:00+02:00`;

  // ---- MarketDataStore tick (dedup by tick id) ----------------------------
  const existing = marketDataStore.query({ source: "sarb-repo", instrument: "REPO" });
  const existingIds = new Set(existing.map((t) => t.id));

  const mutResult = { ...result, effectiveDecisionDate: effective.effectiveDate };

  if (existingIds.has(tickId)) {
    return { ...mutResult, ticksSkippedAsDuplicate: 1 };
  }

  const payload: RepoPrimeRatePayload = {
    repoRate: effective.repoRate,
    primeRate: effective.primeRate,
    effectiveDate: effective.effectiveDate,
    fixingVariant: BUILD_PHASE_VARIANT_MARKER,
  };
  marketDataStore.append({
    id: tickId,
    source: "sarb-repo",
    instrument: "REPO",
    dataType: "repo-prime-rate",
    provenance: "production",
    asOf: tickAsOf,
    payload: payload as unknown as Record<string, unknown>,
  });

  return { ...mutResult, ticksAppended: 1 };
}

// ---------------------------------------------------------------------------
// Convenience: ingest all decision dates in one pass
// ---------------------------------------------------------------------------

export interface RunSarbRepoPrimeIngestAllOpts {
  readonly source: SarbRepoPrimeSource;
  readonly marketDataStore: MarketDataStore;
}

export function runSarbRepoPrimeIngestAll(
  opts: RunSarbRepoPrimeIngestAllOpts,
): ReadonlyArray<SarbRepoPrimeIngestResult> {
  const dates = opts.source.allDecisionDates();
  return dates.map((date) =>
    runSarbRepoPrimeIngest({
      date,
      source: opts.source,
      marketDataStore: opts.marketDataStore,
    }),
  );
}
