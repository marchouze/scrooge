// platform/regulatory/graph/db.ts
//
// SQLite connection for the regulatory knowledge graph.
// Follows the same pattern as platform/event-store/store.ts (bun:sqlite).
//
// Opens (or creates) `.local/graph.db`, runs the DDL on init.
// Exports upsertNode, upsertEdge, count helpers, and the raw DB handle
// for Phase 3 query functions.
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getBankConfig } from "../../config/loader";
import type { GraphEdge, GraphNode } from "./types";

const SCHEMA_SQL_PATH = resolve(import.meta.dir, "schema.sql");

function initDb(path: string): Database {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  // Enable WAL mode for better concurrent read performance
  db.exec("PRAGMA journal_mode=WAL;");
  const ddl = readFileSync(SCHEMA_SQL_PATH, "utf-8");
  db.exec(ddl);
  return db;
}

const dbPath = process.env.BANK_GRAPH_DB ?? getBankConfig().graphDb;
let _db: Database | null = null;

/** Lazy singleton — initialised on first call. */
export function getDb(): Database {
  if (!_db) {
    _db = initDb(dbPath);
  }
  return _db;
}

/**
 * Truncate graph tables. Called at the start of `runSeed()` to ensure
 * re-runs don't fail with `UNIQUE constraint failed: graph_*.id` when the
 * sequence-based edge IDs (`edgeId()` counter resets each run) collide with
 * persisted rows from a prior run with a different event count.
 *
 * The graph is a derived projection (Principle 1) — truncate-and-rebuild
 * is the canonical pattern.
 */
export function truncateGraphTables(): void {
  const db = getDb();
  db.exec("DELETE FROM graph_edges; DELETE FROM graph_nodes;");
}

/** Upsert a graph node (INSERT OR REPLACE). */
export function upsertNode(node: GraphNode): void {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO graph_nodes
       (id, node_type, label, effective_from, effective_to, metadata)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    node.id,
    node.nodeType,
    node.label,
    node.effectiveFrom ?? null,
    node.effectiveTo ?? null,
    node.metadata ? JSON.stringify(node.metadata) : null,
  );
}

/**
 * Upsert a graph edge.
 *
 * The table has a UNIQUE(from_id, to_id, edge_type) constraint; on
 * conflict we update the mutable fields (confidence score, extraction
 * method, timestamps) but leave the primary key unchanged.
 */
export function upsertEdge(edge: GraphEdge): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO graph_edges
       (id, from_id, to_id, edge_type, effective_from, effective_to,
        source_provision, extraction_method, confidence_score, extracted_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(from_id, to_id, edge_type) DO UPDATE SET
       extraction_method = excluded.extraction_method,
       confidence_score  = excluded.confidence_score,
       extracted_at      = excluded.extracted_at,
       source_provision  = excluded.source_provision,
       metadata          = excluded.metadata`,
  ).run(
    edge.id,
    edge.fromId,
    edge.toId,
    edge.edgeType,
    edge.effectiveFrom ?? null,
    edge.effectiveTo ?? null,
    edge.sourceProvision ?? null,
    edge.extractionMethod,
    edge.confidenceScore,
    edge.extractedAt,
    edge.metadata ? JSON.stringify(edge.metadata) : null,
  );
}

export function getNodeCount(): number {
  const r = getDb().prepare("SELECT COUNT(*) AS n FROM graph_nodes").get() as { n: number };
  return r.n;
}

export function getEdgeCount(): number {
  const r = getDb().prepare("SELECT COUNT(*) AS n FROM graph_edges").get() as { n: number };
  return r.n;
}

/** Exposed for tests / Phase 3 raw queries. */
export type { Database };
