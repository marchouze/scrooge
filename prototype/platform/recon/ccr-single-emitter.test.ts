// platform/recon/ccr-single-emitter.test.ts
//
// Tests for recon:ccr-single-emitter — the SA-CCR alias-flip single-emitter
// gate (WS-V2-BBAAS). The gate is a static scan over the production source
// tree; these tests assert it passes against the real tree post-flip (exactly
// one v2-sourced CCR emitter, v1 resolveMtm retired).
//
// Author: Rohan (Risk Engineer, engineering).

import { describe, expect, it } from "bun:test";

import { run } from "./ccr-single-emitter";

describe("recon:ccr-single-emitter", () => {
  it("passes against the post-flip tree: exactly one v2-sourced CCR emitter", () => {
    const r = run();
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("asserts the three invariants (count, identity, retired-symbol)", () => {
    const r = run();
    // count + identity + retired-resolveMtm.
    expect(r.asserted).toBe(3);
  });

  it("reports the sole emitter as the v2-sourced compute-and-emit boundary", () => {
    const r = run();
    expect(r.asOf).toContain("platform/risk/sa-ccr/compute-and-emit.ts");
    expect(r.asOf).toContain("v1 resolveMtm retired");
  });
});
