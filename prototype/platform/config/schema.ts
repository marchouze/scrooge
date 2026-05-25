// platform/config/schema.ts
//
// Type definitions for the centralized platform configuration store.
// The canonical config file lives at ~/.config/bank/platform.json.
// Env vars override on a per-key basis for test isolation and CI.
//
// Authority: D-BANK-CONFIG-STORE (centralized config, 2026-05-25)
// Author: Atlas (Core banking platform architect, engineering)

export interface BankConfigPaths {
  eventDb: string;
  marketDataDb: string;
  graphDb: string;
  documentStoreRoot: string;
  archiveDir: string;
  repoRoot: string;
}

export interface BankConfigServer {
  port: number;
  refreshMs: number;
}

export interface BankConfigFile {
  version: 1;
  paths: BankConfigPaths;
  server: BankConfigServer;
}

/** Resolved config with source annotation per key */
export interface ResolvedConfig {
  version: 1;
  paths: {
    [K in keyof BankConfigPaths]: { value: string; source: "env" | "file" | "default" };
  };
  server: {
    port: { value: number; source: "env" | "file" | "default" };
    refreshMs: { value: number; source: "env" | "file" | "default" };
  };
  configFilePath: string;
  configFileExists: boolean;
}
