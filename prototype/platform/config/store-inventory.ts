// platform/config/store-inventory.ts
//
// The single canonical inventory of every persistent data store the bank runs.
// One `StoreDescriptor` per store. New stores are added HERE (source-don't-
// hardcode, Engineering-Charter command 4) — the V2 "Bank Config" dashboard page
// and the `recon:store-inventory-coverage` gate both read this list, so a store
// cannot exist without being advertised and covered.
//
// TIER CLASSIFICATION (Marc, 2026-06-22) — the load-bearing distinction:
//   canonical   — the bank's event log (`event.db`). The single source of truth
//                 (Principle 1). Balances/positions/P&L are queries over it.
//   observation — outside-world OBSERVATION info (`market-data.db`: FX / ZARONIA /
//                 JIBAR / curves / bond / SENS). This is NOT events — a market
//                 rate is something the bank OBSERVES about the outside world, not
//                 a fact the bank AUTHORS. It lives in a SEPARATE store and never
//                 enters the event log.
//   projection  — rebuildable FROM the canonical event log (`graph.db`,
//                 `v2-anchor.db`, `v2-control-plane.db`). Derived caches; safe to
//                 drop and replay.
//   blob        — content-addressed document store (BLAKE3) + archive cold
//                 partitions. Opaque payloads keyed by hash.
//
// The `configKey` field, when present, names the `BankConfigPaths` key whose
// resolved value (env → file → default) is the live path. A store WITHOUT a
// `configKey` resolves its path through a standalone resolver (recorded below as
// a tracked de-dup gap) and the inventory reads the SAME env var + default so the
// advertised path never diverges.
//
// Authority: D-BANK-CONFIG-STORE (centralized config, 2026-05-25 — this extends
// it). Engineering Charter D-ENGINEERING-INTEGRITY-CHARTER (cmd 4 source-don't-
// hardcode; cmd 5 no-silent-deferral — the de-dup gaps are tracked, not hidden).
// Author: Atlas (Core banking platform architect, engineering).

import { resolve } from "node:path";
import type { BankConfigPaths } from "./schema";

/** The four store tiers. The market-data tier is `observation`, NOT `canonical`. */
export type StoreTier = "canonical" | "observation" | "projection" | "blob";

export interface StoreDescriptor {
  /** Human file/dir name as it appears on disk (e.g. "event.db", "documents/"). */
  readonly name: string;
  /** The tier this store belongs to (drives grouping + badging on the page). */
  readonly tier: StoreTier;
  /** One-line plain-English description of what the store holds and why. */
  readonly purpose: string;
  /** The env var that overrides the path (env → file → default precedence). */
  readonly envVar: string;
  /**
   * The `BankConfigPaths` key whose resolved value is the live path, when the
   * store is centralized in the platform config loader. Absent when the store's
   * production path is resolved by a standalone resolver (see `dedupGap`).
   */
  readonly configKey?: keyof BankConfigPaths;
  /** The module that owns / opens this store (for traceability). */
  readonly module: string;
  /**
   * When set, the store's PRODUCTION resolver is NOT the central config loader —
   * it's the named standalone resolver. The inventory still reads the same env
   * var + default so the advertised path is correct, but the two resolution
   * sites are not literally one function. A tracked de-dup gap (Charter cmd 5),
   * surfaced on the page and in the recon gate's report, never silent.
   */
  readonly dedupGap?: string;
}

/**
 * Built-in default for a store whose path is NOT centralized in the config
 * loader (no `configKey`). Mirrors the standalone resolver's default EXACTLY so
 * the advertised path matches what the production code opens. Kept here next to
 * the env var name so the two stay paired.
 */
export function homeDefault(home: string, ...segments: readonly string[]): string {
  return resolve(home, ...segments);
}

/**
 * THE canonical store inventory. Order is presentation order (canonical →
 * observation → projection → blob); the page groups by tier regardless.
 */
export const STORE_INVENTORY: readonly StoreDescriptor[] = [
  {
    name: "event.db",
    tier: "canonical",
    purpose:
      "The bank's event log — the single durable source of truth (Principle 1). Every balance, position, P&L line, and regulatory cell is a query over this log, never stored state.",
    envVar: "BANK_EVENT_DB",
    configKey: "eventDb",
    module: "platform/event-store/event-store.ts",
  },
  {
    name: "market-data.db",
    tier: "observation",
    purpose:
      "Outside-world OBSERVATION data — FX rates, ZARONIA / JIBAR fixings, yield curves, bond marks, SENS. NOT events: a market observation is something the bank observes about the outside world, not a fact it authors. Held in a SEPARATE store, never in the event log.",
    envVar: "BANK_MARKET_DATA_DB",
    configKey: "marketDataDb",
    module: "platform/markets/market-data-store.ts",
  },
  {
    name: "graph.db",
    tier: "projection",
    purpose:
      "The single-graph projection (Principle 2) — policy → procedure → capability → outcome citation graph. A derived cache, rebuildable by replaying the event log + graph seeders.",
    envVar: "BANK_GRAPH_DB",
    configKey: "graphDb",
    module: "platform/graph/graph-store.ts",
  },
  {
    name: "v2-anchor.db",
    tier: "projection",
    purpose:
      "The V2 FIL instrument-of-record book (FilInstrumentCreated / Terminated) — the anchor-tenant FIL instances whose value the recon gates and P&L / VaR / SA-CCR reads fold over. Rebuildable from the canonical event log + product rules.",
    envVar: "BANK_V2_ANCHOR_DB",
    configKey: "v2AnchorDb",
    module: "platform/markets/products/materialise-settled-cash.ts",
  },
  {
    name: "v2-control-plane.db",
    tier: "projection",
    purpose:
      "The V2 cross-tenant control plane — tenant registry, fleet state, and the bucket-C store-tee mirror of money-free control-plane event types. Rebuildable from the canonical event log (the tee is a mirror of authored V1 events).",
    envVar: "BANK_V2_CONTROL_PLANE_DB",
    // No configKey: the production resolver lives in v2-core and CANNOT import
    // the platform config loader (recon:v2-no-v1-import boundary). The inventory
    // reads the same env var + default below; tracked de-dup gap recorded.
    module: "v2-core/control-plane/store.ts",
    dedupGap:
      "v2-core/control-plane/store.ts:defaultControlPlanePath() resolves BANK_V2_CONTROL_PLANE_DB itself; it cannot import platform/config (v2-no-v1-import boundary). Same env var + same default ($HOME/.local/share/bank/v2-control-plane.db) — value never diverges, but resolution is duplicated. Closure path: a v2-core-native config primitive (roadmap), or a shared env-name constant. Authority: D-BANK-CONFIG-STORE.",
  },
  {
    name: "documents/",
    tier: "blob",
    purpose:
      "The content-addressed document store (BLAKE3) — RMS-registered deliverables, regulatory golden-source PDFs, and any blob keyed by hash. Opaque payloads addressed by content hash.",
    envVar: "BANK_DOCUMENT_STORE",
    configKey: "documentStoreRoot",
    module: "platform/document-store/resolve-document-store.ts",
  },
  {
    name: "archive/",
    tier: "blob",
    purpose:
      "Cold archive partitions — retired-to-cold event partitions (Phase-5 archival), and the archived legacy Owner/Team inbox folders (RMS Phase 4). Append-only cold storage.",
    envVar: "BANK_ARCHIVE_DIR",
    configKey: "archiveDir",
    module: "platform/event-store/partitioned-event-store.ts",
  },
] as const;

/** The display order of tiers on the page (canonical first). */
export const STORE_TIER_ORDER: readonly StoreTier[] = [
  "canonical",
  "observation",
  "projection",
  "blob",
];

/** Human-readable tier labels (the load-bearing market-data wording is here). */
export const STORE_TIER_LABELS: Record<StoreTier, string> = {
  canonical: "Canonical event store (bank truth — Principle 1)",
  observation: "Outside-world observation (NOT events)",
  projection: "Projection (rebuildable from events)",
  blob: "Blob / archive (content-addressed)",
};

/**
 * Every env var that the inventory KNOWS resolves a store path. The
 * `recon:store-inventory-coverage` gate cross-checks that every `BANK_*_DB`
 * store-path env var found in the source tree appears here — so a new store
 * cannot be added (with a new env var) without being inventoried.
 */
export function inventoryEnvVars(): readonly string[] {
  return STORE_INVENTORY.map((s) => s.envVar);
}
