// platform/market-data/store.ts
//
// MarketDataStore — SQLite-backed time-series store for market reference data.
//
// Market data ticks (FX quotes, equity prices, SENS announcements, news) are
// reference/time-series data, NOT business domain events. They must NOT enter
// the event store. This store is intentionally separate and designed to expand
// over time as real data feeds are connected.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.
// Author: Devon (Chief Operating Officer, engineering)

import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { Database } from "bun:sqlite";

import { nowUtc } from "../core/types";

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

const DDL = `
CREATE TABLE IF NOT EXISTS market_data_ticks (
  id           TEXT PRIMARY KEY,
  source       TEXT NOT NULL,
  instrument   TEXT NOT NULL,
  data_type    TEXT NOT NULL,
  provenance   TEXT NOT NULL DEFAULT 'production',
  as_of        TEXT NOT NULL,
  payload      TEXT NOT NULL,
  ingested_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mdt_source_instrument_asof
  ON market_data_ticks(source, instrument, as_of DESC);
`;

const MIGRATION_ADD_PROVENANCE = `
  ALTER TABLE market_data_ticks ADD COLUMN provenance TEXT NOT NULL DEFAULT 'production';
`;

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface MarketDataTick {
  id: string;
  source: string; // "fx-sim" | "jse-sens" | "news" | string
  instrument: string; // "USDZAR" | "AGL.JSE" | etc.
  dataType: string; // "fx-quote" | "equity-quote" | "sens-announcement" | "news"
  provenance: "production" | "simulated";
  asOf: string; // ISO 8601
  payload: Record<string, unknown>;
  ingestedAt: string; // ISO 8601
}

export interface MarketDataQueryOptions {
  source?: string;
  instrument?: string;
  dataType?: string;
  provenance?: "production" | "simulated";
  from?: string;
  to?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// MarketDataStore
// ---------------------------------------------------------------------------

export class MarketDataStore {
  private readonly db: Database;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") {
      try {
        mkdirSync(dirname(dbPath), { recursive: true });
      } catch {
        // directory may already exist
      }
    }
    this.db = new Database(dbPath);
    this.db.exec(DDL);
    try {
      this.db.exec(MIGRATION_ADD_PROVENANCE);
    } catch {
      /* column already exists */
    }
  }

  /**
   * Append a new tick. `ingestedAt` is always set to now at write time.
   * A random UUID is generated for `id` if not provided.
   */
  append(tick: Omit<MarketDataTick, "ingestedAt">): void {
    const id = tick.id ?? randomUUID();
    const ingestedAt = nowUtc();
    this.db
      .prepare(
        `INSERT OR IGNORE INTO market_data_ticks
           (id, source, instrument, data_type, provenance, as_of, payload, ingested_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        tick.source,
        tick.instrument,
        tick.dataType,
        tick.provenance,
        tick.asOf,
        JSON.stringify(tick.payload),
        ingestedAt,
      );
  }

  /**
   * Get the latest tick for a (source, instrument) pair, optionally bounded
   * by `asOf` (returns the most recent tick with as_of <= asOf).
   */
  getLatest(source: string, instrument: string, asOf?: string): MarketDataTick | undefined {
    let row: Record<string, unknown> | null;
    if (asOf !== undefined) {
      row = this.db
        .prepare(
          `SELECT * FROM market_data_ticks
           WHERE source = ? AND instrument = ? AND as_of <= ?
           ORDER BY as_of DESC LIMIT 1`,
        )
        .get(source, instrument, asOf) as Record<string, unknown> | null;
    } else {
      row = this.db
        .prepare(
          `SELECT * FROM market_data_ticks
           WHERE source = ? AND instrument = ?
           ORDER BY as_of DESC LIMIT 1`,
        )
        .get(source, instrument) as Record<string, unknown> | null;
    }
    return row ? this.rowToTick(row) : undefined;
  }

  /**
   * Query ticks with optional filters.
   */
  query(opts: MarketDataQueryOptions = {}): MarketDataTick[] {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (opts.source !== undefined) {
      conditions.push("source = ?");
      params.push(opts.source);
    }
    if (opts.instrument !== undefined) {
      conditions.push("instrument = ?");
      params.push(opts.instrument);
    }
    if (opts.dataType !== undefined) {
      conditions.push("data_type = ?");
      params.push(opts.dataType);
    }
    if (opts.provenance !== undefined) {
      conditions.push("provenance = ?");
      params.push(opts.provenance);
    }
    if (opts.from !== undefined) {
      conditions.push("as_of >= ?");
      params.push(opts.from);
    }
    if (opts.to !== undefined) {
      conditions.push("as_of <= ?");
      params.push(opts.to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limitClause = opts.limit !== undefined ? `LIMIT ${opts.limit}` : "";

    const rows = this.db
      .prepare(`SELECT * FROM market_data_ticks ${where} ORDER BY as_of DESC ${limitClause}`)
      .all(...params) as Record<string, unknown>[];

    return rows.map((r) => this.rowToTick(r));
  }

  /** Close the underlying SQLite connection. */
  close(): void {
    this.db.close();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private rowToTick(row: Record<string, unknown>): MarketDataTick {
    return {
      id: row.id as string,
      source: row.source as string,
      instrument: row.instrument as string,
      dataType: row.data_type as string,
      provenance: (row.provenance as "production" | "simulated") ?? "production",
      asOf: row.as_of as string,
      payload: JSON.parse(row.payload as string) as Record<string, unknown>,
      ingestedAt: row.ingested_at as string,
    };
  }
}

// ---------------------------------------------------------------------------
// Pair-direction-aware FX quote lookup
// ---------------------------------------------------------------------------

/**
 * Outcome of a direction-aware FX quote lookup. `rate` is always returned in
 * the direction the caller asked for; `sourceDirection` records whether the
 * stored tick was already in that direction ("direct") or required inversion
 * ("inverse"). `tick` is the underlying market-data tick the rate was derived
 * from — exposed so callers can attribute rate-source provenance and so the
 * IPV path can compare cross-source candidates.
 */
export interface DirectedQuote {
  rate: number;
  sourceDirection: "direct" | "inverse";
  tick: MarketDataTick;
}

/**
 * Extract a usable mid rate from an FX-quote tick payload. Accepts payloads
 * that expose `mid`, `midRate`, or `bid` + `ask` (average). Returns
 * `undefined` if no usable rate can be derived.
 *
 * Exported so the inverse-lookup helper, the MTM runner, and tests can share
 * one rate-derivation rule (Principle 2 — single derivation site).
 */
export function extractMidRate(payload: Record<string, unknown>): number | undefined {
  if (typeof payload.mid === "number" && payload.mid > 0) return payload.mid;
  if (typeof payload.midRate === "number" && payload.midRate > 0) return payload.midRate;
  if (
    typeof payload.bid === "number" &&
    typeof payload.ask === "number" &&
    payload.bid > 0 &&
    payload.ask > 0
  ) {
    return ((payload.bid as number) + (payload.ask as number)) / 2;
  }
  return undefined;
}

/**
 * Invert a canonical pair string. "EUR/ZAR" → "ZAR/EUR". Returns the original
 * string if the input does not match the BASE/QUOTE shape.
 */
export function invertPair(pair: string): string {
  const slash = pair.indexOf("/");
  if (slash <= 0 || slash === pair.length - 1) return pair;
  return `${pair.slice(slash + 1)}/${pair.slice(0, slash)}`;
}

/**
 * Direction-aware FX quote lookup. Resolves the bug where trades booked in
 * one direction (e.g. ZAR/EUR) silently skip MTM because the upstream feeds
 * store the opposite direction (e.g. EUR/ZAR).
 *
 * Algorithm:
 *   1. Query the store for the requested pair string. If a tick is found
 *      with a usable mid rate, return it as `sourceDirection: "direct"`.
 *   2. Otherwise, query the inverted pair (`QUOTE/BASE`). If a tick is found
 *      with a usable mid rate `r`, return `{ rate: 1/r, sourceDirection: "inverse" }`.
 *   3. If neither direction returns a usable tick, return `null`.
 *
 * The `excludeSource` option lets the IPV path request a tick that comes
 * from a different source than the primary's, so the variance check is
 * genuinely cross-provider (e.g. open-er-api vs twelve-data).
 *
 * Authority:
 *   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
 *   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
 *   - IAS-21-§28 (closing-rate translation — direction-neutral by construction)
 */
export function lookupQuoteWithInverse(
  store: MarketDataStore,
  pair: string,
  opts: {
    provenance?: "production" | "simulated";
    excludeSource?: string;
    limit?: number;
  } = {},
): DirectedQuote | null {
  const provenance = opts.provenance ?? "production";
  const limit = opts.limit ?? 10;

  // Try the direct direction first.
  const directCandidates = store
    .query({ provenance, instrument: pair, dataType: "fx-quote", limit })
    .filter((t) => (opts.excludeSource ? t.source !== opts.excludeSource : true));
  for (const tick of directCandidates) {
    const rate = extractMidRate(tick.payload);
    if (rate !== undefined && rate > 0) {
      return { rate, sourceDirection: "direct", tick };
    }
  }

  // Fall back to the inverted direction.
  const inverted = invertPair(pair);
  if (inverted === pair) return null;
  const inverseCandidates = store
    .query({ provenance, instrument: inverted, dataType: "fx-quote", limit })
    .filter((t) => (opts.excludeSource ? t.source !== opts.excludeSource : true));
  for (const tick of inverseCandidates) {
    const rate = extractMidRate(tick.payload);
    if (rate !== undefined && rate > 0) {
      return { rate: 1 / rate, sourceDirection: "inverse", tick };
    }
  }

  return null;
}
