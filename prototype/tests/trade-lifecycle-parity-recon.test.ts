// tests/trade-lifecycle-parity-recon.test.ts
//
// D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE Phase D — the all-product lifecycle
// coherence recon.
//
// Author: Scrooge (Chief of Staff / Orchestrator), on behalf of Marc (CEO).

import { describe, expect, it } from "bun:test";

import { run } from "../platform/recon/trade-lifecycle-parity";

describe("recon:trade-lifecycle-parity", () => {
  it("passes with no orphan terminals (closure with no opening)", () => {
    const r = run();
    expect(r.pipeline).toBe("recon:trade-lifecycle-parity");
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("any census detail it emits is well-formed (empty on an empty store)", () => {
    // The recon reads the composition event store; in an isolated test process
    // that store may be empty, so the census can be empty. When present, each
    // line is shaped "census: live=… matured=… …".
    const r = run();
    for (const c of r.violations.filter((v) => v.severity === "info")) {
      expect(c.message).toContain("census:");
    }
  });
});
