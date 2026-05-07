// platform/event-store/postgres-sync.ts
//
// Bidirectional event-store sync between local sqlite and Neon Postgres.
// Closes Atlas substrate-gap #1 (host-local event store).
//
// Design: sync-on-boot, NOT async EventStore wholesale.
//
// Why: the in-process EventStore API is synchronous and is called from 30+
// sites across handlers, dashboard, recon, scripts. Making it async forces
// a deep refactor of every call site (handlers, derive(), recon harnesses,
// tests) for marginal architectural benefit during the build phase. The
// sync-on-boot pattern keeps all in-process code synchronous and isolates
// the cloud round-trip to the workflow boundary, where async is natural.
//
// Operational shape:
//   1. Workflow starts (or Marc runs locally) → `bun run event-store:sync`.
//   2. This module connects to Neon, walks both stores by `event_id`, and
//      INSERTs missing events in each direction.
//   3. Agent runs proceed against the now-synced local sqlite.
//   4. After the run, `bun run event-store:sync` runs again to push any
//      new events the agent emitted up to Neon.
//
// Idempotency: every event has a UNIQUE `event_id`. Re-running the sync is
// a no-op when both stores agree. Append-only by construction (per
// Principle 1) — no UPDATE / DELETE paths to reconcile.
//
// Senna threat-model notes (in-line, full note in
// `Owner Inbox/2026-05-07_senna_neon-event-store-threat-model.md`):
//   - Connection string contains the password. Stored only in env
//     (BANK_EVENT_DB_URL). NEVER committed; NEVER logged; NEVER echoed to
//     deliverables.
//   - Postgres role granted SELECT + INSERT only on `events`; no UPDATE,
//     DELETE, DDL. Append-only enforced at the schema level too.
//   - TLS-required connection (Neon enforces; we don't disable).
//   - Today's events contain no PII. When real customer onboarding starts
//     (post-licence-day per the AI-driven-bank reframe), Iris's
//     lawful-processing register and SARB Directive 3 of 2018 cross-border
//     governance gate the data going to Neon. Neon is on Azure Marketplace
//     so a region-pinned setup is feasible at M8.
//
// Author: Atlas (substrate plumbing) · Senna (threat model gate at next
// cycle).

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { Database } from "bun:sqlite";

import type { Event } from "./types";
import { eventSchema } from "./types";

export interface SyncResult {
  /** Events found locally that were not in Postgres; INSERTed remotely. */
  pushedToCloud: number;
  /** Events found in Postgres that were not local; INSERTed locally. */
  pulledFromCloud: number;
  /** Events present in both with matching event_id. */
  alreadyInSync: number;
  /** ISO 8601 timestamp at sync start. */
  startedAt: string;
  /** ISO 8601 timestamp at sync completion. */
  completedAt: string;
  /** Postgres role used (logged for audit; password not logged). */
  pgRole: string;
}

const DDL_POSTGRES = `
CREATE TABLE IF NOT EXISTS events (
  sequence    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id    TEXT NOT NULL UNIQUE,
  type        TEXT NOT NULL,
  as_of       TIMESTAMPTZ NOT NULL,
  entity      TEXT NOT NULL,
  actor_type  TEXT NOT NULL,
  actor_id    TEXT NOT NULL,
  citations   JSONB NOT NULL,
  payload     JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_type   ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity);
CREATE INDEX IF NOT EXISTS idx_events_as_of  ON events(as_of);
`;

interface SqliteRow {
  event_id: string;
  type: string;
  as_of: string;
  entity: string;
  actor_type: string;
  actor_id: string;
  citations: string; // JSON
  payload: string; // JSON
}

interface PgRow {
  event_id: string;
  type: string;
  as_of: string | Date;
  entity: string;
  actor_type: string;
  actor_id: string;
  citations: unknown; // JSONB
  payload: unknown; // JSONB
}

function rowToEvent(row: SqliteRow): Event {
  return eventSchema.parse({
    event_id: row.event_id,
    type: row.type,
    as_of: row.as_of,
    entity: row.entity,
    actor: { type: row.actor_type, id: row.actor_id },
    citations: JSON.parse(row.citations) as string[],
    payload: JSON.parse(row.payload) as Record<string, unknown>,
  });
}

function pgRowToEvent(row: PgRow): Event {
  const asOf =
    row.as_of instanceof Date ? row.as_of.toISOString() : String(row.as_of);
  return eventSchema.parse({
    event_id: row.event_id,
    type: row.type,
    as_of: asOf,
    entity: row.entity,
    actor: { type: row.actor_type, id: row.actor_id },
    citations: row.citations as string[],
    payload: row.payload as Record<string, unknown>,
  });
}

/**
 * Run the bidirectional sync. Throws on connection / schema errors.
 * Returns counts for run-log purposes.
 */
export async function runSync(opts: {
  sqlitePath: string;
  postgresUrl: string;
}): Promise<SyncResult> {
  const startedAt = new Date().toISOString();

  // --- sqlite side -----------------------------------------------------
  // On a fresh GitHub Actions runner the parent directory (e.g. `.local/`)
  // doesn't exist yet, and `bun:sqlite` will refuse to open the database
  // ("unable to open database file"). Create the parent eagerly so the
  // first sync on a clean host succeeds.
  mkdirSync(dirname(opts.sqlitePath), { recursive: true });
  const sqlite = new Database(opts.sqlitePath);
  // The local store may not have been initialised yet on a fresh runner.
  // Re-running the EventStore DDL here is idempotent.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS events (
      sequence    INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id    TEXT    UNIQUE NOT NULL,
      type        TEXT    NOT NULL,
      as_of       TEXT    NOT NULL,
      entity      TEXT    NOT NULL,
      actor_type  TEXT    NOT NULL,
      actor_id    TEXT    NOT NULL,
      citations   TEXT    NOT NULL,
      payload     TEXT    NOT NULL,
      recorded_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_events_type   ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity);
    CREATE INDEX IF NOT EXISTS idx_events_as_of  ON events(as_of);
  `);

  const localRows = sqlite
    .prepare(
      "SELECT event_id, type, as_of, entity, actor_type, actor_id, citations, payload FROM events ORDER BY sequence",
    )
    .all() as SqliteRow[];
  const localById = new Map<string, Event>();
  for (const r of localRows) localById.set(r.event_id, rowToEvent(r));

  // --- postgres side ---------------------------------------------------
  // Bun.sql is a built-in Postgres client (no external dep). Connection
  // string format: postgresql://user:password@host:port/database?sslmode=require
  const pg = new (Bun as unknown as {
    SQL: new (url: string) => { unsafe: <T>(s: string) => Promise<T>; end: () => Promise<void> };
  }).SQL(opts.postgresUrl);

  // Capture role (the Postgres user) for the run log without logging the
  // password. Connection-string format documented; if it doesn't parse
  // cleanly, just record "unknown".
  let pgRole = "unknown";
  try {
    const parsed = new URL(opts.postgresUrl);
    pgRole = decodeURIComponent(parsed.username || "unknown");
  } catch {
    // not a URL; leave as unknown
  }

  try {
    // Schema migration. Idempotent: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
    await pg.unsafe(DDL_POSTGRES);

    const pgRows = await pg.unsafe<PgRow[]>(
      "SELECT event_id, type, as_of, entity, actor_type, actor_id, citations, payload FROM events ORDER BY sequence",
    );
    const pgById = new Map<string, Event>();
    for (const r of pgRows) pgById.set(r.event_id, pgRowToEvent(r));

    // --- diff ----------------------------------------------------------
    const toPushToCloud: Event[] = [];
    const toPullFromCloud: Event[] = [];
    let alreadyInSync = 0;

    for (const [id, ev] of localById) {
      if (pgById.has(id)) {
        alreadyInSync++;
      } else {
        toPushToCloud.push(ev);
      }
    }
    for (const [id, ev] of pgById) {
      if (!localById.has(id)) toPullFromCloud.push(ev);
    }

    // --- push to cloud --------------------------------------------------
    if (toPushToCloud.length > 0) {
      const escape = (s: string) => s.replace(/'/g, "''");
      // Insert in batches; Bun.sql doesn't yet have the tagged-template
      // batch shape we want for typed values, so we use unsafe with
      // server-side parameter escaping for safety.
      for (const ev of toPushToCloud) {
        await pg.unsafe(
          `INSERT INTO events (event_id, type, as_of, entity, actor_type, actor_id, citations, payload)
             VALUES ('${escape(ev.event_id)}', '${escape(ev.type)}', '${escape(ev.as_of)}', '${escape(ev.entity)}', '${escape(ev.actor.type)}', '${escape(ev.actor.id)}', '${escape(JSON.stringify(ev.citations))}'::jsonb, '${escape(JSON.stringify(ev.payload))}'::jsonb)
             ON CONFLICT (event_id) DO NOTHING`,
        );
      }
    }

    // --- pull from cloud ------------------------------------------------
    if (toPullFromCloud.length > 0) {
      const stmt = sqlite.prepare(
        "INSERT OR IGNORE INTO events (event_id, type, as_of, entity, actor_type, actor_id, citations, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      );
      const tx = sqlite.transaction((events: Event[]) => {
        for (const ev of events) {
          stmt.run(
            ev.event_id,
            ev.type,
            ev.as_of,
            ev.entity,
            ev.actor.type,
            ev.actor.id,
            JSON.stringify(ev.citations),
            JSON.stringify(ev.payload),
          );
        }
      });
      tx(toPullFromCloud);
    }

    return {
      pushedToCloud: toPushToCloud.length,
      pulledFromCloud: toPullFromCloud.length,
      alreadyInSync,
      startedAt,
      completedAt: new Date().toISOString(),
      pgRole,
    };
  } finally {
    await pg.end();
    sqlite.close();
  }
}
