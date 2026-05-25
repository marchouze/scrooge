// platform/config/loader.ts
//
// Centralized platform configuration loader.
//
// Config file: $HOME/.config/bank/platform.json (XDG location).
// Override via BANK_CONFIG_FILE env var (for tests).
//
// Resolution per key: env var override → config file value → built-in default.
//
// Env var mapping:
//   BANK_EVENT_DB              → paths.eventDb
//   BANK_MARKET_DATA_DB        → paths.marketDataDb
//   BANK_GRAPH_DB              → paths.graphDb
//   BANK_DOCUMENT_STORE_PATH   → paths.documentStoreRoot
//   BANK_REPO_ROOT             → paths.repoRoot
//   BANK_DASHBOARD_PORT        → server.port
//   BANK_DASHBOARD_REFRESH_MS  → server.refreshMs
//
// Authority: D-BANK-CONFIG-STORE (centralized config, 2026-05-25)
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { BankConfigFile, BankConfigPaths, BankConfigServer, ResolvedConfig } from "./schema";

// ── Config file path ────────────────────────────────────────────────────────

function getConfigFilePath(): string {
  const envOverride = process.env.BANK_CONFIG_FILE?.trim();
  if (envOverride) return resolve(envOverride);
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  return resolve(home, ".config", "bank", "platform.json");
}

// ── Built-in defaults ───────────────────────────────────────────────────────

function buildDefaults(): BankConfigFile {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  return {
    version: 1,
    paths: {
      eventDb: resolve(home, ".local", "share", "bank", "event.db"),
      marketDataDb: resolve(home, ".local", "share", "bank", "market-data.db"),
      graphDb: resolve(home, ".local", "share", "bank", "graph.db"),
      documentStoreRoot: resolve(home, ".local", "share", "bank", "documents"),
      archiveDir: resolve(home, "code", "Bank", "archive"),
      repoRoot: resolve(home, "code", "Bank"),
    },
    server: {
      port: 3010,
      refreshMs: 30000,
    },
  };
}

// ── File I/O ────────────────────────────────────────────────────────────────

function readConfigFile(path: string): BankConfigFile | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as BankConfigFile;
  } catch {
    return null;
  }
}

function writeConfigFile(path: string, config: BankConfigFile): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

// ── Resolution helpers ──────────────────────────────────────────────────────

type Source = "env" | "file" | "default";

function resolveStr(
  envVal: string | undefined,
  fileVal: string | undefined,
  defaultVal: string,
): { value: string; source: Source } {
  const env = envVal?.trim();
  if (env) return { value: resolve(env), source: "env" };
  if (fileVal !== undefined) return { value: fileVal, source: "file" };
  return { value: defaultVal, source: "default" };
}

function resolveNum(
  envVal: string | undefined,
  fileVal: number | undefined,
  defaultVal: number,
): { value: number; source: Source } {
  const env = envVal?.trim();
  if (env) {
    const n = Number(env);
    if (!Number.isNaN(n)) return { value: n, source: "env" };
  }
  if (fileVal !== undefined) return { value: fileVal, source: "file" };
  return { value: defaultVal, source: "default" };
}

// ── In-process cache ────────────────────────────────────────────────────────

let _cache: (BankConfigPaths & { server: BankConfigServer }) | null = null;

function buildResolved(): ResolvedConfig {
  const configFilePath = getConfigFilePath();
  const fileConfig = readConfigFile(configFilePath);
  const defaults = buildDefaults();

  const configFileExists = existsSync(configFilePath);

  // If file doesn't exist yet, create it with defaults
  if (!configFileExists) {
    process.stderr.write(
      `[bank-config] No config file found at ${configFilePath} — creating with defaults.\n`,
    );
    writeConfigFile(configFilePath, defaults);
  }

  const fp = fileConfig?.paths;
  const fs = fileConfig?.server;
  const dp = defaults.paths;
  const ds = defaults.server;

  return {
    version: 1,
    paths: {
      eventDb: resolveStr(process.env.BANK_EVENT_DB, fp?.eventDb, dp.eventDb),
      marketDataDb: resolveStr(process.env.BANK_MARKET_DATA_DB, fp?.marketDataDb, dp.marketDataDb),
      graphDb: resolveStr(process.env.BANK_GRAPH_DB, fp?.graphDb, dp.graphDb),
      documentStoreRoot: resolveStr(
        process.env.BANK_DOCUMENT_STORE_PATH,
        fp?.documentStoreRoot,
        dp.documentStoreRoot,
      ),
      archiveDir: resolveStr(undefined, fp?.archiveDir, dp.archiveDir),
      repoRoot: resolveStr(process.env.BANK_REPO_ROOT, fp?.repoRoot, dp.repoRoot),
    },
    server: {
      port: resolveNum(process.env.BANK_DASHBOARD_PORT, fs?.port, ds.port),
      refreshMs: resolveNum(process.env.BANK_DASHBOARD_REFRESH_MS, fs?.refreshMs, ds.refreshMs),
    },
    configFilePath,
    configFileExists,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns the resolved plain config values — what all callers use for actual
 * paths and settings. Cached after first call per process.
 *
 * Use this for reading DB paths in production code.
 */
export function getBankConfig(): BankConfigPaths & { server: BankConfigServer } {
  if (_cache) return _cache;
  const resolved = buildResolved();
  _cache = {
    eventDb: resolved.paths.eventDb.value,
    marketDataDb: resolved.paths.marketDataDb.value,
    graphDb: resolved.paths.graphDb.value,
    documentStoreRoot: resolved.paths.documentStoreRoot.value,
    archiveDir: resolved.paths.archiveDir.value,
    repoRoot: resolved.paths.repoRoot.value,
    server: {
      port: resolved.server.port.value,
      refreshMs: resolved.server.refreshMs.value,
    },
  };
  return _cache;
}

/**
 * Returns the annotated view with source tags — used by the dashboard API.
 * Not cached: re-reads the file each call so the dashboard shows live state.
 */
export function getResolvedConfig(): ResolvedConfig {
  return buildResolved();
}

/**
 * Merges patch into the config file and resets the in-process cache so
 * subsequent getBankConfig() calls pick up the new values.
 */
export function updateConfigFile(
  patch: Partial<{ paths: Partial<BankConfigPaths>; server: Partial<BankConfigServer> }>,
): void {
  const configFilePath = getConfigFilePath();
  const existing = readConfigFile(configFilePath);
  const defaults = buildDefaults();

  const merged: BankConfigFile = {
    version: 1,
    paths: {
      ...defaults.paths,
      ...(existing?.paths ?? {}),
      ...(patch.paths ?? {}),
    },
    server: {
      ...defaults.server,
      ...(existing?.server ?? {}),
      ...(patch.server ?? {}),
    },
  };

  writeConfigFile(configFilePath, merged);

  // Reset cache so next getBankConfig() reads fresh values
  _cache = null;
}
