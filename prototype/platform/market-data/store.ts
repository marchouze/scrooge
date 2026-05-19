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
  as_of        TEXT NOT NULL,
  payload      TEXT NOT NULL,
  ingested_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mdt_source_instrument_asof
  ON market_data_ticks(source, instrument, as_of DESC);
`;

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface MarketDataTick {
  id: string;
  source: string; // "fx-sim" | "jse-sens" | "news" | string
  instrument: string; // "USDZAR" | "AGL.JSE" | etc.
  dataType: string; // "fx-quote" | "equity-quote" | "sens-announcement" | "news"
  asOf: string; // ISO 8601
  payload: Record<string, unknown>;
  ingestedAt: string; // ISO 8601
}

export interface MarketDataQueryOptions {
  source?: string;
  instrument?: string;
  dataType?: string;
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
           (id, source, instrument, data_type, as_of, payload, ingested_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        tick.source,
        tick.instrument,
        tick.dataType,
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
      asOf: row.as_of as string,
      payload: JSON.parse(row.payload as string) as Record<string, unknown>,
      ingestedAt: row.ingested_at as string,
    };
  }
}
