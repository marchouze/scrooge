// platform/recon/v2-fleet-integrity.test.ts
//
// Regression test for the V2 S14 fleet-integrity recon pipeline.
//
// Drives the pure assertion logic (`assertFleetIntegrity`) the recon `run()`
// depends on, and proves the SABOTAGE invariant: a clean fleet asserts with
// zero violations, but a synthetic version regression / malformed metering
// window / missing surface grant IS caught. (The recon `run()` itself reads
// the live control-plane store; here we exercise the load-bearing logic
// without store I/O so the proof runs deterministically on any runner.)
//
// Author: Sade (AgentOps, operations).

import { describe, expect, it } from "bun:test";

import type { UpgradeEntry } from "../../v2-core/control-plane";
import { type FleetIntegrityInput, assertFleetIntegrity } from "./v2-fleet-integrity";

function upgrades(
  entries: ReadonlyArray<[string, readonly UpgradeEntry[]]>,
): ReadonlyMap<string, readonly UpgradeEntry[]> {
  return new Map(entries);
}

const CLEAN: FleetIntegrityInput = {
  tenants: [{ tenantId: "tenant:za-bank", tier: "K", surfaceVersion: "v1.0" }],
  meterEntries: [
    {
      tenantId: "tenant:za-bank",
      metricKey: "api-calls",
      quantity: 100,
      windowStart: "2026-06-01T00:00:00Z",
      windowEnd: "2026-06-30T00:00:00Z",
    },
  ],
  upgradeHistory: upgrades([
    [
      "tenant:za-bank",
      [
        { tenantId: "tenant:za-bank", fromVersion: "v0", toVersion: "v1.0", appliedAt: "x" },
        { tenantId: "tenant:za-bank", fromVersion: "v1.0", toVersion: "v1.1", appliedAt: "y" },
      ],
    ],
  ]),
};

describe("recon:v2-fleet-integrity — assertFleetIntegrity", () => {
  it("clean fleet asserts with zero violations", () => {
    const { violations, asserted } = assertFleetIntegrity(CLEAN, "fail");
    expect(violations).toHaveLength(0);
    expect(asserted).toBeGreaterThan(0);
  });

  it("SABOTAGE: missing surface grant is caught", () => {
    const sabotaged: FleetIntegrityInput = {
      ...CLEAN,
      tenants: [{ tenantId: "tenant:za-bank", tier: "K", surfaceVersion: null }],
    };
    const { violations } = assertFleetIntegrity(sabotaged, "fail");
    expect(violations.some((v) => v.message.includes("no surface grant"))).toBe(true);
  });

  it("SABOTAGE: missing tier is caught", () => {
    const sabotaged: FleetIntegrityInput = {
      ...CLEAN,
      tenants: [{ tenantId: "tenant:za-bank", tier: null, surfaceVersion: "v1.0" }],
    };
    const { violations } = assertFleetIntegrity(sabotaged, "fail");
    expect(violations.some((v) => v.message.includes("no tier"))).toBe(true);
  });

  it("SABOTAGE: malformed metering window (start after end) is caught", () => {
    const sabotaged: FleetIntegrityInput = {
      ...CLEAN,
      meterEntries: [
        {
          tenantId: "tenant:za-bank",
          metricKey: "api-calls",
          quantity: 100,
          windowStart: "2026-06-30T00:00:00Z",
          windowEnd: "2026-06-01T00:00:00Z",
        },
      ],
    };
    const { violations } = assertFleetIntegrity(sabotaged, "fail");
    expect(violations.some((v) => v.message.includes("window malformed"))).toBe(true);
  });

  it("SABOTAGE: negative metering quantity is caught", () => {
    const sabotaged: FleetIntegrityInput = {
      ...CLEAN,
      meterEntries: [
        {
          tenantId: "tenant:za-bank",
          metricKey: "api-calls",
          quantity: -5,
          windowStart: "2026-06-01T00:00:00Z",
          windowEnd: "2026-06-30T00:00:00Z",
        },
      ],
    };
    const { violations } = assertFleetIntegrity(sabotaged, "fail");
    expect(violations.some((v) => v.message.includes("quantity invalid"))).toBe(true);
  });

  it("SABOTAGE: upgrade-ledger version regression is caught", () => {
    const sabotaged: FleetIntegrityInput = {
      ...CLEAN,
      upgradeHistory: upgrades([
        [
          "tenant:za-bank",
          [
            { tenantId: "tenant:za-bank", fromVersion: "v0", toVersion: "v1.1", appliedAt: "x" },
            // regresses to v1.0 — and breaks chain continuity
            { tenantId: "tenant:za-bank", fromVersion: "v1.1", toVersion: "v1.0", appliedAt: "y" },
          ],
        ],
      ]),
    };
    const { violations } = assertFleetIntegrity(sabotaged, "fail");
    expect(violations.some((v) => v.message.includes("regression"))).toBe(true);
  });

  it("SABOTAGE: upgrade-ledger chain discontinuity is caught", () => {
    const sabotaged: FleetIntegrityInput = {
      ...CLEAN,
      upgradeHistory: upgrades([
        [
          "tenant:za-bank",
          [
            { tenantId: "tenant:za-bank", fromVersion: "v0", toVersion: "v1.0", appliedAt: "x" },
            // fromVersion v1.5 != previous toVersion v1.0 → discontinuity
            { tenantId: "tenant:za-bank", fromVersion: "v1.5", toVersion: "v1.6", appliedAt: "y" },
          ],
        ],
      ]),
    };
    const { violations } = assertFleetIntegrity(sabotaged, "fail");
    expect(violations.some((v) => v.message.includes("discontinuity"))).toBe(true);
  });

  it("severity is propagated to violations", () => {
    const sabotaged: FleetIntegrityInput = {
      ...CLEAN,
      tenants: [{ tenantId: "tenant:za-bank", tier: "K", surfaceVersion: null }],
    };
    expect(assertFleetIntegrity(sabotaged, "warn").violations[0]?.severity).toBe("warn");
    expect(assertFleetIntegrity(sabotaged, "fail").violations[0]?.severity).toBe("fail");
  });
});
