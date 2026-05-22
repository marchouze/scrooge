// platform/event-store/postgres-mirror.ts
//
// Best-effort Postgres event mirror for cross-host dispatch sync.
//
// When `BANK_POSTGRES_EVENT_MIRROR_URL` is set, each event emitted by a
// dispatch CLI is INSERTed into a remote Postgres `events` table immediately
// after the local SQLite write. When the env var is absent, the function is
// a no-op — existing behaviour is entirely unchanged.
//
// Design notes:
//   - "Best-effort": any Postgres error is caught and logged as a warning;
//     the dispatch CLI never fails due to mirror unavailability.
//   - "Fire-and-forget": callers in the dispatch CLIs attach `.catch(() =>
//     {})` so a slow mirror does not block the CLI exit path.
//   - Uses `Bun.SQL` (built-in Postgres client, same as `postgres-sync.ts`).
//     No external package dep required.
//   - DDL is idempotent (CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT
//     EXISTS). The schema matches the Postgres schema in `postgres-sync.ts`
//     so both callers and the bulk-sync script read the same table.
//   - On CONFLICT (event_id) DO NOTHING — re-running a dispatch CLI with the
//     same event is safe.
//
// Env:
//   BANK_POSTGRES_EVENT_MIRROR_URL — postgres:// connection string (optional).
//     Stored only in env / secrets manager; NEVER committed, NEVER logged,
//     NEVER echoed. Same threat-model notes as postgres-sync.ts / Senna note
//     in Owner Inbox/2026-05-07_senna_neon-event-store-threat-model.md.
//
// Authority: D-DISPATCH-MULTI-HOST-POSTGRES-MIRROR-AUTO-INVOKE (CEO-approved)
//
// Author: Atlas (Core banking platform architect, engineering)

import type { Event } from "./types";

// Lazily created + cached Postgres client.  We hold one connection per
// process lifetime (dispatch CLIs are short-lived; this is fine).
//
// The type mirrors what `Bun.SQL` exposes. Typed as `unknown` externally so
// callers don't depend on the shape of the Bun built-in.
let _pgClient:
  | {
      unsafe: <T>(sql: string) => Promise<T>;
      end: () => Promise<void>;
    }
  | undefined;

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

let _ddlRun = false;

function escSql(s: string): string {
  return s.replace(/'/g, "''");
}

function getOrCreateClient(url: string): {
  unsafe: <T>(sql: string) => Promise<T>;
  end: () => Promise<void>;
} {
  if (!_pgClient) {
    // Bun.SQL is a built-in; cast via unknown to avoid TypeScript errors in
    // environments where Bun type definitions lag behind the runtime.
    const BunAny = Bun as unknown as {
      SQL: new (
        url: string,
      ) => {
        unsafe: <T>(sql: string) => Promise<T>;
        end: () => Promise<void>;
      };
    };
    _pgClient = new BunAny.SQL(url);
  }
  return _pgClient;
}

/**
 * Mirror a single event to Postgres (best-effort). Returns immediately when
 * `BANK_POSTGRES_EVENT_MIRROR_URL` is not set. Never throws.
 *
 * Callers in dispatch CLIs should fire-and-forget:
 *   mirrorEventToPostgres(event).catch(() => {});
 */
export async function mirrorEventToPostgres(event: Event): Promise<void> {
  const url = process.env.BANK_POSTGRES_EVENT_MIRROR_URL;
  if (!url) return;

  try {
    const pg = getOrCreateClient(url);

    // Run schema migration once per process. Idempotent.
    if (!_ddlRun) {
      await pg.unsafe(DDL_POSTGRES);
      _ddlRun = true;
    }

    await pg.unsafe(
      `INSERT INTO events (event_id, type, as_of, entity, actor_type, actor_id, citations, payload)
       VALUES (
         '${escSql(event.event_id)}',
         '${escSql(event.type)}',
         '${escSql(event.as_of)}',
         '${escSql(event.entity)}',
         '${escSql(event.actor.type)}',
         '${escSql(event.actor.id)}',
         '${escSql(JSON.stringify(event.citations))}'::jsonb,
         '${escSql(JSON.stringify(event.payload))}'::jsonb
       )
       ON CONFLICT (event_id) DO NOTHING`,
    );
  } catch (err) {
    // Best-effort: log warning, never throw. A mirror failure must not block
    // the dispatch CLI or cause CI to fail.
    console.warn("[postgres-mirror] failed to mirror event:", (err as Error).message ?? err);
  }
}

/**
 * Tear down the cached Postgres client (if any). Called during testing or
 * graceful shutdown. No-op when no client was created.
 */
export async function closeMirrorClient(): Promise<void> {
  if (_pgClient) {
    try {
      await _pgClient.end();
    } catch {
      // best-effort
    }
    _pgClient = undefined;
    _ddlRun = false;
  }
}

/**
 * Reset module-level state (for unit tests that need to inject their own
 * mock without cross-test pollution).
 *
 * @internal — exported only for testing.
 */
export function _resetMirrorForTesting(): void {
  _pgClient = undefined;
  _ddlRun = false;
}
