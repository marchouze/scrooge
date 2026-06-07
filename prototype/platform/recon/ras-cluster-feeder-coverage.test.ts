// platform/recon/ras-cluster-feeder-coverage.test.ts
//
// Tests for the ras-cluster-feeder-coverage recon pipeline.
//
// The recon drives synthetic per-cluster probe streams through the
// limit-utilisation projection and asserts each event-fed cluster reports a
// non-zero exposure (i.e. has a working feeder). It is the standing gate for
// the B2 settlement-window blind spot D-RAS-B2-SETTLEMENT-EXPOSURE-FIX closed.
//
// Author: Rohan (Risk engineer, engineering) + Vera (Internal audit engineer,
//   third-line).

import { describe, expect, it } from "bun:test";

import { run } from "./ras-cluster-feeder-coverage";

describe("recon:ras-cluster-feeder-coverage", () => {
  it("passes against the current projection (every event-fed cluster wired, incl. B2)", () => {
    const r = run();
    expect(r.ok).toBe(true);
    // No fail-severity violations; B4/B5 info notes are allowed.
    expect(r.violations.every((v) => v.severity !== "fail")).toBe(true);
  });

  it("asserts B2 specifically (no B2 feeder finding present)", () => {
    const r = run();
    const b2Fail = r.violations.find(
      (v) => v.subject.startsWith("ras-cluster:B2") && v.severity === "fail",
    );
    expect(b2Fail).toBeUndefined();
  });

  it("records B4 and B5 as info (not-event-fed substrate gaps, surfaced not silenced)", () => {
    const r = run();
    const b4 = r.violations.find((v) => v.subject === "ras-cluster:B4");
    const b5 = r.violations.find((v) => v.subject === "ras-cluster:B5");
    expect(b4?.severity).toBe("info");
    expect(b5?.severity).toBe("info");
  });

  it("asserts at least one probe per declared cluster + the B2 failure branch", () => {
    const r = run();
    // 1 drift guard + 5 cluster probes + 1 B2-failure-branch = 7 assertions.
    expect(r.asserted).toBe(7);
  });
});
