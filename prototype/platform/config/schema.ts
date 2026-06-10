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

/**
 * Platform-wide number/currency display convention. Applied by the dashboard's
 * shared formatter (public/_format.js) on every page — institutional, not
 * per-viewer, so it lives in the platform config store rather than localStorage.
 */
export interface BankConfigDisplay {
  /** Decimal places shown for monetary amounts. */
  decimals: number;
  /** Group integer part with locale thousands separators (e.g. 1,234,567). */
  thousandsSeparator: boolean;
  /** How negatives render: "−1,234" | "(1,234)" | red "−1,234". */
  negativeStyle: NegativeStyle;
  /** Right-align numeric table cells with tabular figures. */
  rightAlignNumbers: boolean;
  /** Currency code position relative to the amount. */
  currencyPosition: CurrencyPosition;
  /** BCP-47 locale used for digit grouping and separators. */
  locale: string;
}

export type NegativeStyle = "minus" | "parens" | "minus-red";
export type CurrencyPosition = "prefix" | "suffix";

export const NEGATIVE_STYLES: readonly NegativeStyle[] = ["minus", "parens", "minus-red"];
export const CURRENCY_POSITIONS: readonly CurrencyPosition[] = ["prefix", "suffix"];

export interface BankConfigFile {
  version: 1;
  paths: BankConfigPaths;
  server: BankConfigServer;
  display: BankConfigDisplay;
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
  display: {
    [K in keyof BankConfigDisplay]: {
      value: BankConfigDisplay[K];
      source: "env" | "file" | "default";
    };
  };
  configFilePath: string;
  configFileExists: boolean;
}
