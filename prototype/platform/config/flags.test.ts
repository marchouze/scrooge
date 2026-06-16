// platform/config/flags.test.ts
//
// Regression tests for the useV2Store feature flag (V1-removal Phase 4).
// Verifies env → file → default resolution and the OFF-by-default contract.
//
// Authority: D-V1-REMOVAL-PHASE-4 (CEO-approved 2026-06-16).
// Author: Atlas (Core banking platform architect, engineering).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// loader caches per-process; re-import a fresh module instance per test so the
// in-process cache does not leak across cases.
async function freshLoader() {
  const mod = await import(`./loader?cachebust=${Math.random()}`);
  return mod as typeof import("./loader");
}

describe("useV2Store feature flag", () => {
  let dir: string;
  let configPath: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bank-flags-"));
    configPath = join(dir, "platform.json");
    savedEnv.BANK_CONFIG_FILE = process.env.BANK_CONFIG_FILE;
    savedEnv.BANK_USE_V2_STORE = process.env.BANK_USE_V2_STORE;
    process.env.BANK_CONFIG_FILE = configPath;
    process.env.BANK_USE_V2_STORE = undefined;
    delete process.env.BANK_USE_V2_STORE;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it("defaults OFF when no config file and no env (V1 authoritative)", async () => {
    const { getBankConfig, isFlagEnabled } = await freshLoader();
    expect(getBankConfig().flags.useV2Store).toBe(false);
    expect(isFlagEnabled("useV2Store")).toBe(false);
  });

  it("reads the file value when present", async () => {
    writeFileSync(
      configPath,
      JSON.stringify({ version: 1, flags: { useV2Store: true } }),
      "utf-8",
    );
    const { isFlagEnabled } = await freshLoader();
    expect(isFlagEnabled("useV2Store")).toBe(true);
  });

  it("env override turns the flag ON (1/true/yes/on)", async () => {
    for (const truthy of ["1", "true", "yes", "on", "TRUE"]) {
      process.env.BANK_USE_V2_STORE = truthy;
      const { isFlagEnabled } = await freshLoader();
      expect(isFlagEnabled("useV2Store")).toBe(true);
    }
  });

  it("env override can force the flag OFF even if the file says ON", async () => {
    writeFileSync(
      configPath,
      JSON.stringify({ version: 1, flags: { useV2Store: true } }),
      "utf-8",
    );
    process.env.BANK_USE_V2_STORE = "0";
    const { isFlagEnabled } = await freshLoader();
    expect(isFlagEnabled("useV2Store")).toBe(false);
  });

  it("annotates the resolution source (env)", async () => {
    process.env.BANK_USE_V2_STORE = "true";
    const { getResolvedConfig } = await freshLoader();
    const resolved = getResolvedConfig();
    expect(resolved.flags.useV2Store.value).toBe(true);
    expect(resolved.flags.useV2Store.source).toBe("env");
  });
});
