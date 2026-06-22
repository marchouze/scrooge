// dashboard/v2-bank-config-view.ts
//
// Name-free DTO builder for the V2 "Bank Config" page (/v2/operations/config.html).
// Mirrors the V1 /config page but advertises the FULL set of persistent stores,
// classified by tier, with the load-bearing market-data distinction made explicit
// (market data is OBSERVATION, not events).
//
// The page is read-only: V1's PATCH edit is a deferred follow-on (tracked gap).
//
// SINGLE SOURCE: the store list comes from the canonical `STORE_INVENTORY`
// registry (platform/config/store-inventory.ts) and each path's resolved value +
// source badge comes from `getResolvedConfig()` (the same env → file → default
// resolution the V1 page uses). Nothing about the stores is hardcoded here.
//
// NAME-FREE: this DTO crosses the /api/v2 boundary; it carries no agent personal
// names (store metadata is structural — there are no owners to mask), so it is
// name-free by construction. No `seatTitle()` call is needed.
//
// Authority: D-BANK-CONFIG-STORE (centralized config, 2026-05-25 — this extends
// it). Author: Atlas (Core banking platform architect, engineering).

import { statSync } from "node:fs";
import { getResolvedConfig } from "../platform/config/loader";
import {
  STORE_INVENTORY,
  STORE_TIER_LABELS,
  STORE_TIER_ORDER,
  type StoreDescriptor,
  type StoreTier,
} from "../platform/config/store-inventory";
import type { ResolvedConfig } from "../platform/config/schema";

export type PathSource = "env" | "file" | "default";

/** On-disk status of a store, best-effort. `present:false` when stat throws. */
export interface StoreDiskStatus {
  readonly present: boolean;
  /** Size in bytes when statable (regular file). Null for directories / missing. */
  readonly sizeBytes: number | null;
  /** True when the resolved path is a directory (blob stores). */
  readonly isDirectory: boolean;
}

/** A single advertised store row. */
export interface BankConfigStoreRow {
  readonly name: string;
  readonly tier: StoreTier;
  readonly tierLabel: string;
  readonly purpose: string;
  readonly envVar: string;
  /** The resolved path. Null when the store has no config-resolved path. */
  readonly resolvedPath: string | null;
  /** Where the resolved value came from. Null when not config-resolved. */
  readonly source: PathSource | null;
  readonly status: StoreDiskStatus;
  /** Present iff this store's production resolver is a tracked de-dup gap. */
  readonly dedupGap?: string;
}

/** A tier group: a label + the stores in that tier (presentation order). */
export interface BankConfigTierGroup {
  readonly tier: StoreTier;
  readonly label: string;
  readonly stores: readonly BankConfigStoreRow[];
}

export interface BankConfigView {
  /** Where the platform config file lives + whether it exists yet. */
  readonly configFilePath: string;
  readonly configFileExists: boolean;
  /** Stores grouped by tier, in canonical → observation → projection → blob order. */
  readonly tierGroups: readonly BankConfigTierGroup[];
  /** Flat count of advertised stores (= STORE_INVENTORY.length). */
  readonly storeCount: number;
  /** The deferred gaps surfaced on the page (edit/PATCH + any path de-dup). */
  readonly deferredGaps: readonly string[];
}

/** Best-effort disk stat — tolerates a missing path (returns absent status). */
function statStore(path: string | null): StoreDiskStatus {
  if (path === null) return { present: false, sizeBytes: null, isDirectory: false };
  try {
    const s = statSync(path);
    return {
      present: true,
      isDirectory: s.isDirectory(),
      // Size is only meaningful for a regular file; a directory's `size` is
      // platform-dependent metadata, so report null for directories.
      sizeBytes: s.isDirectory() ? null : s.size,
    };
  } catch {
    // ENOENT (store not yet created) is the normal build-phase state — not an
    // error to swallow but an expected "absent" status the page renders honestly.
    return { present: false, sizeBytes: null, isDirectory: false };
  }
}

/**
 * Resolve a store descriptor's live path + source. When the store carries a
 * `configKey`, read it from the resolved config. Otherwise (a tracked de-dup
 * gap) read the same env var the standalone resolver uses, and fall back to the
 * config-loader default if that path key still exists in the resolved config.
 */
function resolvePath(
  store: StoreDescriptor,
  resolved: ResolvedConfig,
): { path: string | null; source: PathSource | null } {
  if (store.configKey) {
    const entry = resolved.paths[store.configKey];
    return { path: entry.value, source: entry.source };
  }
  // De-dup-gap store: resolve via the SAME env var the standalone resolver reads.
  // The advertised value matches what the production code opens.
  const fromEnv = process.env[store.envVar]?.trim();
  if (fromEnv) return { path: fromEnv, source: "env" };
  return { path: null, source: null };
}

export function buildBankConfigView(): BankConfigView {
  const resolved = getResolvedConfig();

  const rowsByTier = new Map<StoreTier, BankConfigStoreRow[]>();
  for (const tier of STORE_TIER_ORDER) rowsByTier.set(tier, []);

  for (const store of STORE_INVENTORY) {
    const { path, source } = resolvePath(store, resolved);
    const row: BankConfigStoreRow = {
      name: store.name,
      tier: store.tier,
      tierLabel: STORE_TIER_LABELS[store.tier],
      purpose: store.purpose,
      envVar: store.envVar,
      resolvedPath: path,
      source,
      status: statStore(path),
      ...(store.dedupGap ? { dedupGap: store.dedupGap } : {}),
    };
    const bucket = rowsByTier.get(store.tier);
    // Every store's tier is in STORE_TIER_ORDER (asserted by the coverage test),
    // so the bucket is always defined; fail-closed if a new tier slips through.
    if (!bucket) {
      throw new Error(`store ${store.name} has tier ${store.tier} not in STORE_TIER_ORDER`);
    }
    bucket.push(row);
  }

  const tierGroups: BankConfigTierGroup[] = STORE_TIER_ORDER.map((tier) => ({
    tier,
    label: STORE_TIER_LABELS[tier],
    stores: rowsByTier.get(tier) ?? [],
  }));

  const deferredGaps: string[] = [
    "Read-only: in-place editing of config values (V1's PATCH /api/config) is not yet ported to the V2 page — a deferred follow-on.",
    ...STORE_INVENTORY.filter((s) => s.dedupGap).map((s) => `${s.name}: ${s.dedupGap}`),
  ];

  return {
    configFilePath: resolved.configFilePath,
    configFileExists: resolved.configFileExists,
    tierGroups,
    storeCount: STORE_INVENTORY.length,
    deferredGaps,
  };
}
