// tests/recon-pipelines.test.ts
//
// Unit tests for the new continuous-controls pipelines.
//   - mandate-ownership integrity returns ok over the live procedure set.
//   - decision-event reconciliation handles missing-event and missing-registry
//     cases as expected.
//
// Author: Vera

import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { run as decisionRecon } from "../platform/recon/decision-event-recon";
import { run as mandateOwnership } from "../platform/recon/mandate-ownership";

describe("mandate-ownership pipeline", () => {
  it("runs over the populated procedures and reports a result", () => {
    const r = mandateOwnership();
    expect(r.pipeline).toBe("mandate-ownership-integrity");
    expect(typeof r.asserted).toBe("number");
    expect(Array.isArray(r.violations)).toBe(true);
  });

  it("recognises governance seats and personas as valid owners", () => {
    // The procedure set as of 2026-05-06 has all owners resolving to
    // either real personas or known governance seats; therefore zero
    // failing violations expected.
    const r = mandateOwnership();
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
    expect(r.ok).toBe(true);
  });
});

describe("decision-event-reconciliation pipeline", () => {
  it("returns a fail when the registry path is missing", () => {
    const r = decisionRecon({ registryPath: "/tmp/nonexistent-bank-registry.json" });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
  });

  it("treats historical (date-only) decisions as not requiring an event match", () => {
    const tmp = mkdtempSync(join(tmpdir(), "bank-recon-"));
    const registryPath = join(tmp, "state.json");
    writeFileSync(
      registryPath,
      JSON.stringify({
        decisionsResolved: [
          { id: "HIST-1", title: "Historical decision", actionedAt: "2026-05-06" },
        ],
      }),
    );
    const dbPath = join(tmp, "no-such.db");
    const r = decisionRecon({ registryPath, dbPath });
    // Historical decision is asserted but not failed.
    expect(r.asserted).toBe(1);
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("flags a registry entry with an ISO timestamp that has no matching event", () => {
    const tmp = mkdtempSync(join(tmpdir(), "bank-recon-"));
    const registryPath = join(tmp, "state.json");
    writeFileSync(
      registryPath,
      JSON.stringify({
        decisionsResolved: [
          {
            id: "DASH-1",
            title: "Dashboard-actioned but no event",
            actionedAt: "2026-05-06T12:00:00.000Z",
          },
        ],
      }),
    );
    const dbPath = join(tmp, "no-such.db");
    const r = decisionRecon({ registryPath, dbPath });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some((v) => v.severity === "fail" && v.message.includes("no CeoDecision event")),
    ).toBe(true);
  });
});
