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
//   BANK_DOCUMENT_STORE        → paths.documentStoreRoot (primary; mirrors BANK_EVENT_DB)
//   BANK_DOCUMENT_STORE_PATH   → paths.documentStoreRoot (legacy alias)
//   BANK_REPO_ROOT             → paths.repoRoot
//   BANK_DASHBOARD_PORT        → server.port
//   BANK_DASHBOARD_REFRESH_MS  → server.refreshMs
//
// Authority: D-BANK-CONFIG-STORE (centralized config, 2026-05-25)
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  BankConfigDisplay,
  BankConfigFile,
  BankConfigFlags,
  BankConfigPaths,
  BankConfigServer,
  ResolvedConfig,
} from "./schema";
import { FLAG_DEFAULTS } from "./schema";

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
    display: buildDisplayDefaults(),
    flags: { ...FLAG_DEFAULTS },
  };
}

// ── Display defaults ──────────────────────────────────────────────────────────
// The "house style" for numbers/currency across the dashboard. SA bank → en-ZA,
// 2 decimals, grouped thousands, minus-sign negatives, right-aligned, ISO code prefix.

function buildDisplayDefaults(): BankConfigDisplay {
  return {
    decimals: 2,
    thousandsSeparator: true,
    negativeStyle: "minus",
    rightAlignNumbers: true,
    currencyPosition: "prefix",
    locale: "en-ZA",
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

/** Display fields resolve file → default (no env layer); source tagged for the UI. */
function resolveVal<T>(fileVal: T | undefined, defaultVal: T): { value: T; source: Source } {
  if (fileVal !== undefined) return { value: fileVal, source: "file" };
  return { value: defaultVal, source: "default" };
}

/**
 * Boolean flag resolution: env var → file → default. The env value is parsed
 * truthy/falsey explicitly (only "1"/"true"/"yes"/"on" → true, anything else
 * that is set → false) so an env override can also force a flag OFF.
 */
function resolveBool(
  envVal: string | undefined,
  fileVal: boolean | undefined,
  defaultVal: boolean,
): { value: boolean; source: Source } {
  const env = envVal?.trim().toLowerCase();
  if (env !== undefined && env !== "") {
    const truthy = env === "1" || env === "true" || env === "yes" || env === "on";
    return { value: truthy, source: "env" };
  }
  if (fileVal !== undefined) return { value: fileVal, source: "file" };
  return { value: defaultVal, source: "default" };
}

// ── In-process cache ────────────────────────────────────────────────────────

let _cache:
  | (BankConfigPaths & {
      server: BankConfigServer;
      display: BankConfigDisplay;
      flags: BankConfigFlags;
    })
  | null = null;

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
  const fd = fileConfig?.display;
  const ff = fileConfig?.flags;
  const dp = defaults.paths;
  const ds = defaults.server;
  const dd = defaults.display;
  const df = defaults.flags ?? FLAG_DEFAULTS;

  return {
    version: 1,
    paths: {
      eventDb: resolveStr(process.env.BANK_EVENT_DB, fp?.eventDb, dp.eventDb),
      marketDataDb: resolveStr(process.env.BANK_MARKET_DATA_DB, fp?.marketDataDb, dp.marketDataDb),
      graphDb: resolveStr(process.env.BANK_GRAPH_DB, fp?.graphDb, dp.graphDb),
      documentStoreRoot: resolveStr(
        // Primary env (mirrors BANK_EVENT_DB naming) wins over the legacy
        // alias — same ordering as resolve-document-store.ts.
        process.env.BANK_DOCUMENT_STORE?.trim()
          ? process.env.BANK_DOCUMENT_STORE
          : process.env.BANK_DOCUMENT_STORE_PATH,
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
    display: {
      decimals: resolveVal(fd?.decimals, dd.decimals),
      thousandsSeparator: resolveVal(fd?.thousandsSeparator, dd.thousandsSeparator),
      negativeStyle: resolveVal(fd?.negativeStyle, dd.negativeStyle),
      rightAlignNumbers: resolveVal(fd?.rightAlignNumbers, dd.rightAlignNumbers),
      currencyPosition: resolveVal(fd?.currencyPosition, dd.currencyPosition),
      locale: resolveVal(fd?.locale, dd.locale),
    },
    flags: {
      useV2Store: resolveBool(process.env.BANK_USE_V2_STORE, ff?.useV2Store, df.useV2Store),
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
export function getBankConfig(): BankConfigPaths & {
  server: BankConfigServer;
  display: BankConfigDisplay;
  flags: BankConfigFlags;
} {
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
    display: {
      decimals: resolved.display.decimals.value,
      thousandsSeparator: resolved.display.thousandsSeparator.value,
      negativeStyle: resolved.display.negativeStyle.value,
      rightAlignNumbers: resolved.display.rightAlignNumbers.value,
      currencyPosition: resolved.display.currencyPosition.value,
      locale: resolved.display.locale.value,
    },
    flags: {
      useV2Store: resolved.flags.useV2Store.value,
    },
  };
  return _cache;
}

/**
 * Convenience accessor for a single feature flag. Reads the resolved config
 * (cached) so callers don't repeat the lookup. Use this at route boundaries to
 * branch V1/V2 read paths.
 */
export function isFlagEnabled(flag: keyof BankConfigFlags): boolean {
  return getBankConfig().flags[flag];
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
  patch: Partial<{
    paths: Partial<BankConfigPaths>;
    server: Partial<BankConfigServer>;
    display: Partial<BankConfigDisplay>;
    flags: Partial<BankConfigFlags>;
  }>,
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
    display: {
      ...defaults.display,
      ...(existing?.display ?? {}),
      ...(patch.display ?? {}),
    },
    flags: {
      ...(defaults.flags ?? FLAG_DEFAULTS),
      ...(existing?.flags ?? {}),
      ...(patch.flags ?? {}),
    },
  };

  writeConfigFile(configFilePath, merged);

  // Reset cache so next getBankConfig() reads fresh values
  _cache = null;
}
